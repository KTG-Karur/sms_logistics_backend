"use strict";

const messages = require("../helpers/message");
const _ = require("lodash");
const { Op, QueryTypes } = require("sequelize");
const sequelize = require("../models/index").sequelize;
const { 
  Employee, 
  StaffAttendance, 
  SalaryAdjustment, 
  Expense,
  ExpensePayment,
  expence_type,
  OfficeCenter
} = require("../models");
const moment = require("moment");
const { v4: uuidv4 } = require('uuid');

// Cache for expense type ID to avoid multiple DB calls
let salaryExpenseTypeIdCache = null;

// Helper function to get salary expense type ID
async function getSalaryExpenseTypeId() {
  // Return cached value if available
  if (salaryExpenseTypeIdCache) {
    return salaryExpenseTypeIdCache;
  }
  
  // Fetch from database
  const salaryType = await expence_type.findOne({
    where: { expence_type_name: 'Salary' },
    attributes: ['expence_type_id'],
    raw: true
  });
  
  if (!salaryType) {
    throw new Error("Salary expense type not found in database. Please add 'Salary' to expence_type table.");
  }
  
  // Cache the value
  salaryExpenseTypeIdCache = salaryType.expence_type_id;
  return salaryExpenseTypeIdCache;
}

// Helper function to get month dates
function getMonthDates(salaryMonth) {
  const startDate = moment(salaryMonth, 'YYYY-MM').startOf('month').format('YYYY-MM-DD');
  const endDate = moment(salaryMonth, 'YYYY-MM').endOf('month').format('YYYY-MM-DD');
  const daysInMonth = moment(salaryMonth, 'YYYY-MM').daysInMonth();
  return { startDate, endDate, daysInMonth };
}

// Helper function to check if a date is a holiday
async function isHoliday(date) {
  const holiday = await sequelize.query(
    `SELECT holiday_date FROM holidays 
     WHERE holiday_date = '${date}' LIMIT 1`,
    { type: QueryTypes.SELECT, raw: true }
  );
  return holiday.length > 0;
}

// Helper function to get holidays in a month
async function getHolidaysInMonth(salaryMonth) {
  const { startDate, endDate } = getMonthDates(salaryMonth);
  
  const holidays = await sequelize.query(
    `SELECT holiday_date FROM holidays 
     WHERE holiday_date BETWEEN '${startDate}' AND '${endDate}'`,
    { type: QueryTypes.SELECT, raw: true }
  );
  
  return new Set(holidays.map(h => moment(h.holiday_date).format('YYYY-MM-DD')));
}

// Helper function to get attendance summary for employee in a month
async function getAttendanceSummary(employeeId, salaryMonth) {
  const { startDate, endDate } = getMonthDates(salaryMonth);
  
  const attendance = await StaffAttendance.findAll({
    where: {
      staff_id: employeeId,
      attendance_date: { [Op.between]: [startDate, endDate] },
      is_active: 1
    },
    attributes: [
      'attendance_status',
      [sequelize.fn('COUNT', sequelize.col('attendance_status')), 'count']
    ],
    group: ['attendance_status'],
    raw: true
  });
  
  const summary = {
    present: 0,
    absent: 0,
    halfday: 0,
    total: 0
  };
  
  attendance.forEach(item => {
    if (item.attendance_status === 'present') summary.present = parseInt(item.count);
    else if (item.attendance_status === 'absent') summary.absent = parseInt(item.count);
    else if (item.attendance_status === 'halfday') summary.halfday = parseInt(item.count);
  });
  
  summary.total = summary.present + summary.absent + summary.halfday;
  
  return summary;
}

// Helper function to get absent days excluding Sundays and holidays
async function getAbsentDaysExcludingHolidays(employeeId, salaryMonth) {
  const { startDate, endDate } = getMonthDates(salaryMonth);
  
  // Get all attendance records for the month
  const attendance = await StaffAttendance.findAll({
    where: {
      staff_id: employeeId,
      attendance_date: { [Op.between]: [startDate, endDate] },
      is_active: 1
    },
    attributes: ['attendance_date', 'attendance_status'],
    raw: true
  });
  
  // Get holidays for the month
  const holidaySet = await getHolidaysInMonth(salaryMonth);
  
  // Create a map of attendance by date
  const attendanceMap = {};
  attendance.forEach(a => {
    attendanceMap[moment(a.attendance_date).format('YYYY-MM-DD')] = a.attendance_status;
  });
  
  // Calculate absent days (excluding Sundays and holidays)
  let absentDays = 0;
  let currentDate = moment(startDate);
  
  while (currentDate <= moment(endDate)) {
    const dateStr = currentDate.format('YYYY-MM-DD');
    const dayOfWeek = currentDate.day();
    
    // Check if it's a working day (not Sunday and not holiday)
    const isWorkingDay = dayOfWeek !== 0 && !holidaySet.has(dateStr);
    
    if (isWorkingDay) {
      const status = attendanceMap[dateStr];
      // If no attendance record or status is 'absent', count as absent
      if (!status || status === 'absent') {
        absentDays++;
      }
    }
    
    currentDate.add(1, 'day');
  }
  
  return absentDays;
}

// Helper function to calculate salary for an employee
async function calculateEmployeeSalary(employeeId, salaryMonth, includeAdjustments = true) {
  // Get employee details
  const employee = await Employee.findOne({
    where: { employee_id: employeeId, is_active: 1 },
    attributes: [
      'employee_id', 'employee_name', 'has_salary', 'salary_type', 
      'salary', 'is_driver', 'is_loadman'
    ],
    raw: true
  });
  
  if (!employee) {
    throw new Error("Employee not found");
  }
  
  // If employee doesn't have salary, return zero base
  if (!employee.has_salary) {
    return {
      employeeId: employee.employee_id,
      employeeName: employee.employee_name,
      baseSalary: 0,
      presentDays: 0,
      absentDays: 0,
      halfDays: 0,
      totalDaysInMonth: 0,
      salaryType: employee.salary_type,
      monthlyRate: employee.salary_type === 'monthly' ? parseFloat(employee.salary) : 0,
      dailyRate: employee.salary_type === 'daily' ? parseFloat(employee.salary) : 0
    };
  }
  
  // Get attendance summary
  const attendance = await getAttendanceSummary(employeeId, salaryMonth);
  
  // Get month details
  const { daysInMonth } = getMonthDates(salaryMonth);
  
  // Get absent days excluding holidays and Sundays for monthly employees
  const absentDaysExcludingHolidays = await getAbsentDaysExcludingHolidays(employeeId, salaryMonth);
  
  const salary = parseFloat(employee.salary);
  let baseSalary = 0;
  let absentDays = 0;
  let halfDays = 0;
  let presentDays = 0;
  
  // Calculate base salary based on type
  if (employee.salary_type === 'daily') {
    // Daily salary: only present days count (including half days as 0.5)
    presentDays = attendance.present;
    halfDays = attendance.halfday;
    baseSalary = (presentDays * salary) + (halfDays * 0.5 * salary);
  } 
  else if (employee.salary_type === 'monthly') {
    // Monthly salary: full month salary minus deduction for absent days and half days
    
    // Calculate per day rate based on total days in month
    const perDayRate = salary / daysInMonth;
    
    // Deduction calculation:
    // - Full absent days: deduct full per day rate
    // - Half days: deduct half per day rate
    const fullDayDeduction = perDayRate * absentDaysExcludingHolidays;
    const halfDayDeduction = perDayRate * 0.5 * attendance.halfday;
    
    // Total deduction
    const totalDeduction = fullDayDeduction + halfDayDeduction;
    
    // Base salary after deductions
    baseSalary = salary - totalDeduction;
    
    // Ensure baseSalary doesn't go below 0
    baseSalary = Math.max(0, baseSalary);
    
    // For display purposes
    absentDays = absentDaysExcludingHolidays;
    halfDays = attendance.halfday;
  }
  
  const result = {
    employeeId: employee.employee_id,
    employeeName: employee.employee_name,
    baseSalary: Math.round(baseSalary * 100) / 100,
    presentDays: attendance.present,
    absentDays: employee.salary_type === 'monthly' ? absentDays : attendance.absent,
    halfDays: halfDays,
    totalDaysInMonth: daysInMonth,
    salaryType: employee.salary_type,
    monthlyRate: employee.salary_type === 'monthly' ? salary : 0,
    dailyRate: employee.salary_type === 'daily' ? salary : 0
  };
  
  // Include adjustments if requested
  if (includeAdjustments) {
    const adjustments = await SalaryAdjustment.findAll({
      where: {
        employee_id: employeeId,
        salary_month: salaryMonth,
        is_active: 1
      },
      attributes: ['adjustment_id', 'type', 'amount', 'reason'],
      raw: true
    });
    
    const deductions = adjustments.filter(a => a.type === 'deduction');
    const extras = adjustments.filter(a => a.type === 'extra');
    
    const totalDeductions = deductions.reduce((sum, d) => sum + parseFloat(d.amount), 0);
    const totalExtras = extras.reduce((sum, e) => sum + parseFloat(e.amount), 0);
    
    result.deductions = deductions;
    result.extras = extras;
    result.totalDeductions = totalDeductions;
    result.totalExtras = totalExtras;
    result.netSalary = Math.round((baseSalary + totalExtras - totalDeductions) * 100) / 100;
  } else {
    result.netSalary = Math.round(baseSalary * 100) / 100;
  }
  
  return result;
}

// Main function to calculate salary for multiple employees
async function calculateSalary(query) {
  try {
    const { 
      salaryMonth, 
      employeeId,
      includeAdjustments = 'true' 
    } = query;
    
    if (!salaryMonth) {
      throw new Error("salaryMonth is required (YYYY-MM)");
    }
    
    // Get salary expense type ID for later use
    const salaryExpenseTypeId = await getSalaryExpenseTypeId();
    
    // Build employee filter
    let employeeWhere = {
      is_active: 1
    };
    
    if (employeeId) {
      employeeWhere.employee_id = employeeId;
    }
    
    // Get employees with has_salary = true
    const employees = await Employee.findAll({
      where: employeeWhere,
      attributes: ['employee_id', 'employee_name', 'has_salary', 'salary_type', 'salary', 'is_driver', 'is_loadman'],
      raw: true
    });
    
    const includeAdj = includeAdjustments === 'true';
    const results = [];
    
    for (const employee of employees) {
      try {
        // Skip employees without salary
        if (!employee.has_salary) continue;
        
        const salaryDetail = await calculateEmployeeSalary(
          employee.employee_id, 
          salaryMonth, 
          includeAdj
        );
        
        // Check if expense exists for this employee-month
        const expense = await Expense.findOne({
          where: {
            employee_id: employee.employee_id,
            salary_month: salaryMonth,
            expense_type_id: salaryExpenseTypeId,
            is_active: 1
          },
          attributes: ['expense_id', 'paid_amount', 'is_paid'],
          raw: true
        });
        
        if (expense) {
          salaryDetail.expenseId = expense.expense_id;
          salaryDetail.paidAmount = parseFloat(expense.paid_amount);
          salaryDetail.isPaid = expense.is_paid;
          salaryDetail.remainingAmount = salaryDetail.netSalary - parseFloat(expense.paid_amount);
        } else {
          salaryDetail.paidAmount = 0;
          salaryDetail.isPaid = false;
          salaryDetail.remainingAmount = salaryDetail.netSalary;
        }
        
        results.push(salaryDetail);
      } catch (err) {
        console.error(`Error calculating salary for employee ${employee.employee_id}:`, err.message);
      }
    }
    
    // Calculate totals
    const summary = {
      totalEmployees: results.length,
      totalSalary: results.reduce((sum, r) => sum + r.netSalary, 0),
      totalPaid: results.reduce((sum, r) => sum + (r.paidAmount || 0), 0),
      totalDeductions: results.reduce((sum, r) => sum + (r.totalDeductions || 0), 0),
      totalExtras: results.reduce((sum, r) => sum + (r.totalExtras || 0), 0),
      totalRemaining: results.reduce((sum, r) => sum + (r.remainingAmount || r.netSalary), 0),
      fullyPaid: results.filter(r => r.isPaid).length,
      partiallyPaid: results.filter(r => !r.isPaid && r.paidAmount > 0).length,
      unpaid: results.filter(r => !r.isPaid && (!r.paidAmount || r.paidAmount === 0)).length
    };
    
    return {
      salaryMonth,
      employees: results,
      summary
    };
  } catch (error) {
    throw new Error(error.message || messages.OPERATION_ERROR);
  }
}

// Get salary summary with filters
async function getSalarySummary(query) {
  try {
    const { salaryMonth, employeeId } = query;
    
    if (!salaryMonth) {
      throw new Error("salaryMonth is required (YYYY-MM)");
    }
    
    // Get salary expense type ID
    const salaryExpenseTypeId = await getSalaryExpenseTypeId();
    
    // Get all salary expenses for the month
    let expenseWhere = {
      expense_type_id: salaryExpenseTypeId,
      salary_month: salaryMonth,
      is_active: 1
    };
    
    if (employeeId) {
      expenseWhere.employee_id = employeeId;
    }
    
    const expenses = await Expense.findAll({
      where: expenseWhere,
      attributes: [
        'expense_id',
        'employee_id',
        'amount',
        'paid_amount',
        'is_paid'
      ],
      include: [
        {
          model: Employee,
          as: 'employee',
          attributes: ['employee_id', 'employee_name'],
          required: true
        }
      ],
      raw: true,
      nest: true
    });
    
    // Calculate salary for employees without expenses yet
    const employeeWhere = {
      is_active: 1,
      has_salary: 1
    };
    
    if (employeeId) {
      employeeWhere.employee_id = employeeId;
    }
    
    const allEmployees = await Employee.findAll({
      where: employeeWhere,
      attributes: ['employee_id', 'employee_name'],
      raw: true
    });
    
    const employeeIdsWithExpense = new Set(expenses.map(e => e.employee_id));
    const employeesWithoutExpense = allEmployees.filter(e => !employeeIdsWithExpense.has(e.employee_id));
    
    // Calculate for employees without expense
    for (const emp of employeesWithoutExpense) {
      try {
        const salaryDetail = await calculateEmployeeSalary(emp.employee_id, salaryMonth, true);
        expenses.push({
          expense_id: null,
          employee_id: emp.employee_id,
          employee: {
            employee_id: emp.employee_id,
            employee_name: emp.employee_name
          },
          amount: salaryDetail.netSalary,
          paid_amount: 0,
          is_paid: false,
          ...salaryDetail
        });
      } catch (err) {
        console.error(err);
      }
    }
    
    return expenses;
  } catch (error) {
    throw new Error(error.message || messages.OPERATION_ERROR);
  }
}

// Get detailed salary for a specific employee
async function getEmployeeSalaryDetail(employeeId, salaryMonth) {
  try {
    // Get salary expense type ID
    const salaryExpenseTypeId = await getSalaryExpenseTypeId();
    
    // Calculate salary with adjustments
    const salaryDetail = await calculateEmployeeSalary(employeeId, salaryMonth, true);
    
    // Get expense details if exists
    const expense = await Expense.findOne({
      where: {
        employee_id: employeeId,
        salary_month: salaryMonth,
        expense_type_id: salaryExpenseTypeId,
        is_active: 1
      },
      attributes: [
        'expense_id',
        'expense_date',
        'amount',
        'paid_amount',
        'is_paid',
        'description',
        'office_center_id'
      ],
      include: [
        {
          model: ExpensePayment,
          as: 'payments',
          where: { is_active: 1 },
          required: false,
          attributes: [
            'expense_payment_id',
            'payment_date',
            'amount',
            'payment_type',
            'notes',
            'created_at'
          ]
        }
      ],
      order: [
        [{ model: ExpensePayment, as: 'payments' }, 'payment_date', 'DESC']
      ]
    });
    
    if (expense) {
      salaryDetail.expense = expense.toJSON();
      salaryDetail.paidAmount = parseFloat(expense.paid_amount);
      salaryDetail.isPaid = expense.is_paid;
      salaryDetail.remainingAmount = salaryDetail.netSalary - parseFloat(expense.paid_amount);
    } else {
      salaryDetail.paidAmount = 0;
      salaryDetail.isPaid = false;
      salaryDetail.remainingAmount = salaryDetail.netSalary;
    }
    
    return salaryDetail;
  } catch (error) {
    throw new Error(error.message || messages.OPERATION_ERROR);
  }
}

// 🔥 COMPLETE PROCESS SALARY PAYMENT FUNCTION WITH DYNAMIC EXPENSE TYPE 🔥
async function processSalaryPayment(paymentData) {
  const transaction = await sequelize.transaction();
  
  try {
    // Destructure all fields from paymentData
    const {
      employeeId,
      salaryMonth,
      amount,
      paymentDate,
      officeCenterId,
      paymentType = 'cash',
      notes = '',
      createdBy
    } = paymentData;
    
    // Validate required fields
    if (!employeeId) throw new Error("Employee ID is required");
    if (!salaryMonth) throw new Error("Salary month is required");
    if (!amount) throw new Error("Payment amount is required");
    if (!paymentDate) throw new Error("Payment date is required");
    if (!officeCenterId) throw new Error("Office center ID is required");
    
    console.log("Processing salary payment:", {
      employeeId,
      salaryMonth,
      amount,
      paymentDate,
      officeCenterId,
      paymentType,
      notes,
      createdBy
    });
    
    // Get salary expense type ID dynamically
    const salaryExpenseTypeId = await getSalaryExpenseTypeId();
    console.log("Using salary expense type ID:", salaryExpenseTypeId);
    
    // Get or create salary expense
    let expense = await Expense.findOne({
      where: {
        employee_id: employeeId,
        salary_month: salaryMonth,
        expense_type_id: salaryExpenseTypeId,
        is_active: 1
      },
      transaction,
      lock: transaction.LOCK
    });
    
    if (!expense) {
      // Calculate salary first
      const salaryDetail = await calculateEmployeeSalary(employeeId, salaryMonth, true);
      
      // Create expense with dynamically fetched expense_type_id
      const expenseId = `EXP${moment().format('YYYYMMDDHHmmss')}${Math.floor(Math.random() * 1000)}`;
      
      expense = await Expense.create({
        expense_id: expenseId,
        expense_date: moment(salaryMonth, 'YYYY-MM').startOf('month').format('YYYY-MM-DD'),
        expense_type_id: salaryExpenseTypeId,  // ✅ Dynamically fetched
        office_center_id: officeCenterId,
        amount: salaryDetail.netSalary,
        description: `Salary for ${salaryDetail.employeeName} - ${salaryMonth}`,
        employee_id: employeeId,
        salary_month: salaryMonth,
        created_by: createdBy,
        is_active: 1
      }, { transaction });
      
      console.log("Created new expense:", expense.expense_id);
    } else {
      console.log("Found existing expense:", expense.expense_id);
    }
    
    // Validate payment amount
    const expenseAmount = parseFloat(expense.amount);
    const currentPaid = parseFloat(expense.paid_amount || 0);
    const paymentAmount = parseFloat(amount);
    const newTotalPaid = currentPaid + paymentAmount;
    
    if (newTotalPaid > expenseAmount) {
      const remaining = expenseAmount - currentPaid;
      throw new Error(
        `Payment amount exceeds remaining balance. ` +
        `Expense: ₹${expenseAmount}, Already paid: ₹${currentPaid}, ` +
        `Remaining: ₹${remaining}, You tried to pay: ₹${paymentAmount}`
      );
    }
    
    // Create expense payment
    const paymentId = `PAY${moment().format('YYYYMMDDHHmmss')}${Math.floor(Math.random() * 1000)}`;
    
    const payment = await ExpensePayment.create({
      expense_payment_id: paymentId,
      expense_id: expense.expense_id,
      payment_date: paymentDate,
      amount: paymentAmount,
      payment_type: paymentType,
      notes: notes || `Salary payment for ${salaryMonth}`,
      created_by: createdBy,
      is_active: 1
    }, { transaction });
    
    console.log("Created payment:", payment.expense_payment_id);
    
    // Update expense paid_amount (will trigger is_paid update via hook)
    await expense.update({
      paid_amount: newTotalPaid
    }, { transaction });
    
    await transaction.commit();
    console.log("Transaction committed successfully");
    
    // Get complete details
    const result = await getEmployeeSalaryDetail(employeeId, salaryMonth);
    
    return {
      ...result,
      payment: payment.toJSON()
    };
  } catch (error) {
    await transaction.rollback();
    console.error("Error in processSalaryPayment:", error.message);
    throw new Error(error.message || messages.OPERATION_ERROR);
  }
}

// Get salary payments with filters
async function getSalaryPayments(query) {
  try {
    const {
      employeeId,
      salaryMonth,
      startDate,
      endDate,
      page = 1,
      limit = 100
    } = query;
    
    // Get salary expense type ID
    const salaryExpenseTypeId = await getSalaryExpenseTypeId();
    
    let expenseWhere = {
      expense_type_id: salaryExpenseTypeId,
      is_active: 1
    };
    
    if (employeeId) {
      expenseWhere.employee_id = employeeId;
    }
    
    if (salaryMonth) {
      expenseWhere.salary_month = salaryMonth;
    }
    
    const paymentWhere = {
      is_active: 1
    };
    
    if (startDate && endDate) {
      paymentWhere.payment_date = {
        [Op.between]: [startDate, endDate]
      };
    } else if (startDate) {
      paymentWhere.payment_date = {
        [Op.gte]: startDate
      };
    } else if (endDate) {
      paymentWhere.payment_date = {
        [Op.lte]: endDate
      };
    }
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const { count, rows } = await ExpensePayment.findAndCountAll({
      where: paymentWhere,
      include: [
        {
          model: Expense,
          as: 'expense',
          where: expenseWhere,
          required: true,
          attributes: [
            'expense_id',
            'expense_date',
            'amount',
            'paid_amount',
            'is_paid',
            'description',
            'employee_id',
            'salary_month',
            'office_center_id'
          ],
          include: [
            {
              model: Employee,
              as: 'employee',
              attributes: ['employee_id', 'employee_name']
            },
            {
              model: OfficeCenter,
              as: 'officeCenter',
              attributes: ['office_center_id', 'office_center_name']
            }
          ]
        }
      ],
      attributes: [
        'expense_payment_id',
        'payment_date',
        'amount',
        'payment_type',
        'notes',
        'created_at'
      ],
      order: [['payment_date', 'DESC'], ['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: offset,
      distinct: true
    });
    
    return {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / parseInt(limit)),
      data: rows
    };
  } catch (error) {
    throw new Error(error.message || messages.OPERATION_ERROR);
  }
}

// Get single salary payment by ID
async function getSalaryPaymentById(paymentId) {
  try {
    // Get salary expense type ID
    const salaryExpenseTypeId = await getSalaryExpenseTypeId();
    
    const payment = await ExpensePayment.findOne({
      where: {
        expense_payment_id: paymentId,
        is_active: 1
      },
      include: [
        {
          model: Expense,
          as: 'expense',
          required: true,
          where: {
            expense_type_id: salaryExpenseTypeId
          },
          attributes: [
            'expense_id',
            'expense_date',
            'amount',
            'paid_amount',
            'is_paid',
            'description',
            'employee_id',
            'salary_month',
            'office_center_id'
          ],
          include: [
            {
              model: Employee,
              as: 'employee',
              attributes: ['employee_id', 'employee_name']
            },
            {
              model: OfficeCenter,
              as: 'officeCenter',
              attributes: ['office_center_id', 'office_center_name']
            }
          ]
        }
      ],
      attributes: [
        'expense_payment_id',
        'payment_date',
        'amount',
        'payment_type',
        'notes',
        'created_at',
        'created_by'
      ]
    });
    
    if (!payment) {
      throw new Error(messages.DATA_NOT_FOUND);
    }
    
    return payment;
  } catch (error) {
    throw new Error(error.message || messages.OPERATION_ERROR);
  }
}

module.exports = {
  calculateSalary,
  getSalarySummary,
  getEmployeeSalaryDetail,
  processSalaryPayment,
  getSalaryPayments,
  getSalaryPaymentById
};