"use strict";

const messages = require("../helpers/message");
const _ = require("lodash");
const { Op } = require("sequelize");
const sequelize = require("../models/index").sequelize;
const { 
  Employee, 
  Expense,
  ExpensePayment,
  expence_type,
  OfficeCenter,
  LoadmanSalary,
  PackageLoadman,
  Trip,
  BookingPackage,
  TripBooking,
  PackageType,
  Booking
} = require("../models");
const moment = require("moment");
const { v4: uuidv4 } = require('uuid');

// Cache for loadman expense type ID
let loadmanExpenseTypeIdCache = null;

// Helper function to get loadman expense type ID
async function getLoadmanExpenseTypeId() {
  if (loadmanExpenseTypeIdCache) {
    return loadmanExpenseTypeIdCache;
  }
  
  const loadmanType = await expence_type.findOne({
    where: { expence_type_name: 'Loadman Salary' },
    attributes: ['expence_type_id'],
    raw: true
  });
  
  if (!loadmanType) {
    // Try to find 'Salary' type as fallback
    const salaryType = await expence_type.findOne({
      where: { expence_type_name: 'Salary' },
      attributes: ['expence_type_id'],
      raw: true
    });
    
    if (!salaryType) {
      throw new Error("Loadman salary expense type not found. Please add 'Loadman Salary' to expence_type table.");
    }
    
    loadmanExpenseTypeIdCache = salaryType.expence_type_id;
    return loadmanExpenseTypeIdCache;
  }
  
  loadmanExpenseTypeIdCache = loadmanType.expence_type_id;
  return loadmanExpenseTypeIdCache;
}

// Helper function to get date range for a single day
function getSingleDayRange(date) {
  const startDate = moment(date).format('YYYY-MM-DD');
  const endDate = moment(date).format('YYYY-MM-DD');
  return { startDate, endDate };
}

// Calculate loadman salary for a specific date
async function calculateLoadmanDailySalary(loadmanId, date, includeDetails = true) {
  try {
    const { startDate, endDate } = getSingleDayRange(date);
    
    // Get loadman details
    const loadman = await Employee.findOne({
      where: { employee_id: loadmanId, is_loadman: true, is_active: 1 },
      attributes: ['employee_id', 'employee_name', 'mobile_no'],
      raw: true
    });
    
    if (!loadman) {
      throw new Error("Loadman not found");
    }
    
    // Get all package assignments for this loadman on this date
    const assignments = await PackageLoadman.findAll({
      where: {
        loadman_id: loadmanId,
        created_at: {
          [Op.between]: [startDate + ' 00:00:00', endDate + ' 23:59:59']
        },
        is_active: 1
      },
      include: [
        {
          model: BookingPackage,
          as: 'bookingPackage',
          attributes: [
            'booking_package_id',
            'booking_id',
            'package_type_id',
            'quantity',
            'pickup_charge',
            'drop_charge',
            'handling_charge',
            'total_package_charge'
          ],
          include: [
            {
              model: Booking,
              as: 'booking',
              attributes: ['booking_id', 'booking_number', 'booking_date']
            }
          ]
        },
        {
          model: TripBooking,
          as: 'tripBooking',
          attributes: ['trip_booking_id', 'trip_id'],
          include: [
            {
              model: Trip,
              as: 'trip',
              attributes: ['trip_id', 'trip_number', 'trip_date']
            }
          ]
        }
      ],
      raw: false,
      nest: true
    });
    
    if (assignments.length === 0) {
      return {
        loadmanId: loadman.employee_id,
        loadmanName: loadman.employee_name,
        date: date,
        totalEarnings: 0,
        totalPackages: 0,
        totalAssignments: 0,
        paidAmount: 0,
        pendingAmount: 0,
        assignments: []
      };
    }
    
    // Calculate totals
    let totalEarnings = 0;
    let totalPackages = 0;
    let pickupEarnings = 0;
    let dropEarnings = 0;
    let handlingEarnings = 0;
    let pickupCount = 0;
    let dropCount = 0;
    let bothCount = 0;
    
    const assignmentDetails = [];
    
    assignments.forEach(assignment => {
      const amount = parseFloat(assignment.amount_earned || 0);
      const quantity = assignment.bookingPackage?.quantity || 1;
      
      totalEarnings += amount;
      totalPackages += quantity;
      
      if (assignment.loadman_type === 'pickup') {
        pickupEarnings += amount;
        pickupCount++;
      } else if (assignment.loadman_type === 'drop') {
        dropEarnings += amount;
        dropCount++;
      } else if (assignment.loadman_type === 'both') {
        bothCount++;
        // For 'both', we need to split between pickup and drop
        const pickupCharge = parseFloat(assignment.bookingPackage?.pickup_charge || 0) * quantity;
        const dropCharge = parseFloat(assignment.bookingPackage?.drop_charge || 0) * quantity;
        pickupEarnings += pickupCharge;
        dropEarnings += dropCharge;
      }
      
      // Calculate handling earnings (if applicable)
      if (assignment.bookingPackage?.handling_charge) {
        // Find how many loadmen are assigned to this package
        const loadmenForThisPackage = assignments.filter(
          a => a.booking_package_id === assignment.booking_package_id
        ).length;
        
        if (loadmenForThisPackage > 0) {
          const handlingForThisPackage = (parseFloat(assignment.bookingPackage.handling_charge) * quantity) / loadmenForThisPackage;
          handlingEarnings += handlingForThisPackage;
        }
      }
      
      if (includeDetails) {
        assignmentDetails.push({
          assignmentId: assignment.package_loadman_id,
          loadmanType: assignment.loadman_type,
          amountEarned: amount,
          quantity: quantity,
          tripNumber: assignment.tripBooking?.trip?.trip_number,
          bookingNumber: assignment.bookingPackage?.booking?.booking_number,
          packageTypeId: assignment.bookingPackage?.package_type_id,
          pickupChargePerUnit: assignment.bookingPackage?.pickup_charge,
          dropChargePerUnit: assignment.bookingPackage?.drop_charge,
          createdAt: assignment.created_at
        });
      }
    });
    
    // Get payment information for this date
    const loadmanExpenseTypeId = await getLoadmanExpenseTypeId();
    
    // Find expense for this loadman on this date (using expense_date as the salary date)
    const expense = await Expense.findOne({
      where: {
        employee_id: loadmanId,
        expense_type_id: loadmanExpenseTypeId,
        expense_date: date,
        is_active: 1
      },
      attributes: ['expense_id', 'amount', 'paid_amount'],
      raw: true
    });
    
    let paidAmount = 0;
    if (expense) {
      paidAmount = parseFloat(expense.paid_amount || 0);
    }
    
    return {
      loadmanId: loadman.employee_id,
      loadmanName: loadman.employee_name,
      date: date,
      totalEarnings: Math.round(totalEarnings * 100) / 100,
      paidAmount: paidAmount,
      pendingAmount: Math.round((totalEarnings - paidAmount) * 100) / 100,
      totalPackages: totalPackages,
      totalAssignments: assignments.length,
      pickupEarnings: Math.round(pickupEarnings * 100) / 100,
      dropEarnings: Math.round(dropEarnings * 100) / 100,
      handlingEarnings: Math.round(handlingEarnings * 100) / 100,
      pickupCount: pickupCount,
      dropCount: dropCount,
      bothCount: bothCount,
      isFullyPaid: paidAmount >= totalEarnings,
      assignments: includeDetails ? assignmentDetails : []
    };
    
  } catch (error) {
    throw new Error(error.message || messages.OPERATION_ERROR);
  }
}

// Get loadman salary summary with pending amounts
async function getLoadmanSalarySummary(filters = {}) {
  try {
    const { loadmanId, startDate, endDate, status, page = 1, limit = 20 } = filters;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Get loadman expense type ID
    const loadmanExpenseTypeId = await getLoadmanExpenseTypeId();
    
    // Build where clause for loadmen
    const loadmanWhere = { is_loadman: true, is_active: 1 };
    if (loadmanId) {
      loadmanWhere.employee_id = loadmanId;
    }
    
    // Get all loadmen with pagination
    const { count: totalLoadmen, rows: loadmen } = await Employee.findAndCountAll({
      where: loadmanWhere,
      attributes: ['employee_id', 'employee_name', 'mobile_no'],
      limit: parseInt(limit),
      offset: offset,
      distinct: true
    });
    
    if (loadmen.length === 0) {
      return {
        summary: {
          totalLoadmen: 0,
          totalEarnings: "0.00",
          totalPaid: "0.00",
          totalPending: "0.00"
        },
        loadmen: [],
        pagination: {
          currentPage: parseInt(page),
          totalPages: 0,
          totalRecords: 0,
          limit: parseInt(limit)
        }
      };
    }
    
    const loadmanIds = loadmen.map(l => l.employee_id);
    
    // Get all salary records for these loadmen in date range
    const salaryWhere = {
      loadman_id: { [Op.in]: loadmanIds },
      is_active: 1
    };
    
    if (startDate && endDate) {
      salaryWhere.salary_date = {
        [Op.between]: [startDate, endDate]
      };
    }
    
    if (status) {
      if (status === 'paid') {
        // For paid status, we need to check if total_amount <= paid_amount in expenses
        // This will be handled in post-processing
      } else if (status === 'pending') {
        // For pending status, we need to check if total_amount > paid_amount
        // This will be handled in post-processing
      }
    }
    
    const salaryRecords = await LoadmanSalary.findAll({
      where: salaryWhere,
      attributes: [
        'loadman_salary_id',
        'loadman_id',
        'salary_date',
        'total_amount',
        'package_count',
        'status'
      ],
      raw: true
    });
    
    // Get all expenses for these loadmen
    const expenses = await Expense.findAll({
      where: {
        employee_id: { [Op.in]: loadmanIds },
        expense_type_id: loadmanExpenseTypeId,
        is_active: 1
      },
      attributes: ['employee_id', 'expense_date', 'amount', 'paid_amount'],
      raw: true
    });
    
    // Group salary records by date and loadman
    const salaryByDate = {};
    salaryRecords.forEach(record => {
      const key = `${record.loadman_id}_${record.salary_date}`;
      salaryByDate[key] = {
        amount: parseFloat(record.total_amount || 0),
        packageCount: record.package_count || 0,
        status: record.status
      };
    });
    
    // Group expenses by date and loadman
    const paidByDate = {};
    expenses.forEach(expense => {
      const key = `${expense.employee_id}_${expense.expense_date}`;
      if (!paidByDate[key]) {
        paidByDate[key] = 0;
      }
      paidByDate[key] += parseFloat(expense.paid_amount || 0);
    });
    
    // Build loadman summary
    const loadmanSummary = {};
    
    // Initialize with loadman data
    loadmen.forEach(loadman => {
      loadmanSummary[loadman.employee_id] = {
        loadmanId: loadman.employee_id,
        loadmanName: loadman.employee_name,
        mobileNo: loadman.mobile_no,
        totalEarnings: 0,
        totalPaid: 0,
        totalPending: 0,
        totalPackages: 0,
        workingDays: 0,
        dailyBreakdown: []
      };
    });
    
    // Get all dates in range
    const dates = [];
    if (startDate && endDate) {
      let currentDate = moment(startDate);
      const lastDate = moment(endDate);
      while (currentDate <= lastDate) {
        dates.push(currentDate.format('YYYY-MM-DD'));
        currentDate.add(1, 'day');
      }
    }
    
    // If no date range, get all dates from salary records
    if (dates.length === 0) {
      const uniqueDates = [...new Set(salaryRecords.map(r => r.salary_date))];
      uniqueDates.sort().forEach(date => {
        dates.push(date);
      });
    }
    
    // Process each date for each loadman
    for (const loadmanId of loadmanIds) {
      for (const date of dates) {
        const salaryKey = `${loadmanId}_${date}`;
        const earnings = salaryByDate[salaryKey]?.amount || 0;
        const packages = salaryByDate[salaryKey]?.packageCount || 0;
        const paid = paidByDate[salaryKey] || 0;
        const pending = earnings - paid;
        
        if (earnings > 0 || paid > 0) {
          loadmanSummary[loadmanId].totalEarnings += earnings;
          loadmanSummary[loadmanId].totalPaid += paid;
          loadmanSummary[loadmanId].totalPending += pending;
          loadmanSummary[loadmanId].totalPackages += packages;
          loadmanSummary[loadmanId].workingDays++;
          
          loadmanSummary[loadmanId].dailyBreakdown.push({
            date: date,
            earnings: earnings,
            paid: paid,
            pending: pending,
            packages: packages,
            isFullyPaid: pending <= 0.01
          });
        }
      }
    }
    
    // Format the result
    const resultLoadmen = Object.values(loadmanSummary).map(l => ({
      ...l,
      totalEarnings: Math.round(l.totalEarnings * 100) / 100,
      totalPaid: Math.round(l.totalPaid * 100) / 100,
      totalPending: Math.round(l.totalPending * 100) / 100,
      dailyBreakdown: l.dailyBreakdown.sort((a, b) => a.date.localeCompare(b.date))
    }));
    
    // Apply status filter if needed
    let filteredLoadmen = resultLoadmen;
    if (status === 'paid') {
      filteredLoadmen = resultLoadmen.filter(l => l.totalPending <= 0.01);
    } else if (status === 'pending') {
      filteredLoadmen = resultLoadmen.filter(l => l.totalPending > 0.01);
    }
    
    // Calculate totals
    const totalEarnings = filteredLoadmen.reduce((sum, l) => sum + l.totalEarnings, 0);
    const totalPaid = filteredLoadmen.reduce((sum, l) => sum + l.totalPaid, 0);
    const totalPending = filteredLoadmen.reduce((sum, l) => sum + l.totalPending, 0);
    
    return {
      summary: {
        totalLoadmen: filteredLoadmen.length,
        totalEarnings: totalEarnings.toFixed(2),
        totalPaid: totalPaid.toFixed(2),
        totalPending: totalPending.toFixed(2),
        dateRange: startDate && endDate ? { startDate, endDate } : null
      },
      loadmen: filteredLoadmen,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalLoadmen / parseInt(limit)),
        totalRecords: totalLoadmen,
        limit: parseInt(limit)
      }
    };
    
  } catch (error) {
    throw new Error(error.message || messages.OPERATION_ERROR);
  }
}

// Process loadman salary payment (supports partial payments)
async function processLoadmanSalaryPayment(paymentData) {
  const transaction = await sequelize.transaction();
  
  try {
    const {
      loadmanId,
      paymentDate,
      amount,
      officeCenterId,
      paymentType = 'cash',
      notes = '',
      createdBy,
      salaryDate // This is the date of earnings being paid
    } = paymentData;
    
    // Validate required fields
    if (!loadmanId) throw new Error("Loadman ID is required");
    if (!paymentDate) throw new Error("Payment date is required");
    if (!amount) throw new Error("Payment amount is required");
    if (!officeCenterId) throw new Error("Office center ID is required");
    if (!salaryDate) throw new Error("Salary date is required");
    
    console.log("Processing loadman salary payment:", {
      loadmanId,
      paymentDate,
      amount,
      officeCenterId,
      paymentType,
      salaryDate,
      createdBy
    });
    
    // Get loadman expense type ID
    const loadmanExpenseTypeId = await getLoadmanExpenseTypeId();
    
    // Get loadman details
    const loadman = await Employee.findOne({
      where: { employee_id: loadmanId, is_loadman: true, is_active: 1 },
      attributes: ['employee_id', 'employee_name'],
      transaction
    });
    
    if (!loadman) {
      throw new Error("Loadman not found");
    }
    
    // Calculate earnings for the day
    const earningsData = await calculateLoadmanDailySalary(loadmanId, salaryDate, false);
    const dailyEarnings = earningsData.totalEarnings;
    
    // Get or create loadman salary record for this date
    let salaryRecord = await LoadmanSalary.findOne({
      where: {
        loadman_id: loadmanId,
        salary_date: salaryDate,
        is_active: 1
      },
      transaction
    });
    
    if (!salaryRecord) {
      // Create salary record if it doesn't exist
      salaryRecord = await LoadmanSalary.create({
        loadman_id: loadmanId,
        salary_date: salaryDate,
        total_pickup_charges: earningsData.pickupEarnings || 0,
        total_drop_charges: earningsData.dropEarnings || 0,
        total_handling_charges: earningsData.handlingEarnings || 0,
        total_amount: dailyEarnings,
        package_count: earningsData.totalPackages,
        booking_count: 0,
        status: dailyEarnings > 0 ? 'pending' : 'processed',
        notes: `Daily salary for ${salaryDate}`,
        created_at: new Date(),
        updated_at: new Date()
      }, { transaction });
      
      console.log("Created salary record:", salaryRecord.loadman_salary_id);
    }
    
    // Find or create expense for this date
    let expense = await Expense.findOne({
      where: {
        employee_id: loadmanId,
        expense_type_id: loadmanExpenseTypeId,
        expense_date: salaryDate,
        is_active: 1
      },
      transaction,
      lock: transaction.LOCK
    });
    
    if (!expense) {
      // Create expense if it doesn't exist
      const description = `Salary for ${loadman.employee_name} - ${salaryDate}`;
      
      expense = await Expense.create({
        expense_date: salaryDate,
        expense_type_id: loadmanExpenseTypeId,
        office_center_id: officeCenterId,
        amount: dailyEarnings,
        description: description,
        employee_id: loadmanId,
        paid_amount: 0,
        is_paid: false,
        created_by: createdBy,
        is_active: 1,
        created_at: new Date(),
        updated_at: new Date()
      }, { transaction });
      
      console.log("Created new expense:", {
        expense_id: expense.expense_id,
        amount: expense.amount,
        expense_date: expense.expense_date
      });
      
      // IMPORTANT: Fetch the expense again to ensure all fields are populated
      expense = await Expense.findOne({
        where: { expense_id: expense.expense_id },
        transaction
      });
      
      if (!expense) {
        throw new Error("Failed to retrieve created expense");
      }
    }
    
    // Check if payment amount exceeds remaining balance
    const currentPaid = parseFloat(expense.paid_amount || 0);
    const expenseAmount = parseFloat(expense.amount || dailyEarnings);
    const remainingAmount = expenseAmount - currentPaid;
    
    if (parseFloat(amount) > remainingAmount + 0.01) {
      throw new Error(
        `Payment amount (${amount}) exceeds remaining balance (${remainingAmount.toFixed(2)}). ` +
        `Total due: ${expenseAmount.toFixed(2)}, Already paid: ${currentPaid.toFixed(2)}`
      );
    }
    
    // Create payment record
    const payment = await ExpensePayment.create({
      expense_id: expense.expense_id, // Use expense_id, not id
      payment_date: paymentDate,
      amount: amount,
      payment_type: paymentType,
      notes: notes || `Salary payment for ${salaryDate}`,
      created_by: createdBy,
      is_active: 1,
      created_at: new Date()
    }, { transaction });
    
    console.log("Created payment:", {
      payment_id: payment.expense_payment_id,
      amount: payment.amount
    });
    
    // Update expense paid amount - USE THE PRIMARY KEY (id) FOR UPDATE
    const newPaidAmount = currentPaid + parseFloat(amount);
    const isFullyPaid = newPaidAmount >= expenseAmount - 0.01;
    
    // METHOD: Update using the primary key 'id' (not expense_id)
    const [updatedCount] = await Expense.update(
      { 
        paid_amount: newPaidAmount,
        is_paid: isFullyPaid,
        updated_at: new Date()
      },
      { 
        where: { 
          id: expense.id // Use the auto-increment primary key 'id'
        },
        transaction 
      }
    );
    
    if (updatedCount === 0) {
      throw new Error(`Failed to update expense - record with id ${expense.id} not found`);
    }
    
    // Refresh expense to get updated values
    expense = await Expense.findOne({
      where: { expense_id: expense.expense_id }, // Use 'id' to fetch
      transaction
    });
    
    // Update salary record status based on payment
    if (dailyEarnings > 0) {
      if (isFullyPaid) {
        await salaryRecord.update({
          status: 'paid',
          payment_date: paymentDate,
          updated_at: new Date()
        }, { transaction });
      } else {
        await salaryRecord.update({
          status: 'partial',
          updated_at: new Date()
        }, { transaction });
      }
    }
    
    await transaction.commit();
    
    // Get updated earnings with payment info
    const updatedEarnings = await calculateLoadmanDailySalary(loadmanId, salaryDate, true);
    
    return {
      success: true,
      message: isFullyPaid ? "Loadman salary fully paid" : "Partial payment processed successfully",
      loadman: {
        loadmanId: loadman.employee_id,
        loadmanName: loadman.employee_name
      },
      payment: {
        paymentId: payment.expense_payment_id,
        amount: payment.amount,
        paymentDate: payment.payment_date,
        paymentType: payment.payment_type
      },
      expense: {
        expenseId: expense.expense_id,
        amount: expense.amount,
        paidAmount: expense.paid_amount,
        remainingAmount: (expense.amount - expense.paid_amount).toFixed(2),
        isFullyPaid: expense.is_paid
      },
      earnings: updatedEarnings
    };
    
  } catch (error) {
    await transaction.rollback();
    console.error("Error in processLoadmanSalaryPayment:", error.message);
    console.error("Error stack:", error.stack);
    throw new Error(error.message || messages.OPERATION_ERROR);
  }
}

// Get detailed loadman salary with payment history
async function getLoadmanSalaryDetail(loadmanId, startDate, endDate) {
  try {
    // Get loadman details
    const loadman = await Employee.findOne({
      where: { employee_id: loadmanId, is_loadman: true, is_active: 1 },
      attributes: ['employee_id', 'employee_name', 'mobile_no']
    });
    
    if (!loadman) {
      throw new Error("Loadman not found");
    }
    
    const loadmanExpenseTypeId = await getLoadmanExpenseTypeId();
    
    // Get all salary records in date range
    const salaryRecords = await LoadmanSalary.findAll({
      where: {
        loadman_id: loadmanId,
        salary_date: {
          [Op.between]: [startDate, endDate]
        },
        is_active: 1
      },
      attributes: [
        'loadman_salary_id',
        'salary_date',
        'total_amount',
        'package_count',
        'status',
        'payment_date',
        'notes',
        'created_at'
      ],
      order: [['salary_date', 'DESC']]
    });
    
    // Get all expenses for this loadman in date range
    const expenses = await Expense.findAll({
      where: {
        employee_id: loadmanId,
        expense_type_id: loadmanExpenseTypeId,
        expense_date: {
          [Op.between]: [startDate, endDate]
        },
        is_active: 1
      },
      attributes: [
        'expense_id',
        'expense_date',
        'amount',
        'paid_amount',
        'is_paid'
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
            'notes'
          ]
        }
      ],
      order: [['expense_date', 'DESC']]
    });
    
    // Create a map of expenses by date
    const expenseMap = {};
    expenses.forEach(expense => {
      expenseMap[expense.expense_date] = expense;
    });
    
    // Combine salary and expense data
    const dailyBreakdown = [];
    let totalEarnings = 0;
    let totalPaid = 0;
    
    // Get all dates in range
    let currentDate = moment(startDate);
    const lastDate = moment(endDate);
    
    while (currentDate <= lastDate) {
      const dateStr = currentDate.format('YYYY-MM-DD');
      const salaryRecord = salaryRecords.find(s => s.salary_date === dateStr);
      const expense = expenseMap[dateStr];
      
      const earnings = salaryRecord ? parseFloat(salaryRecord.total_amount) : 0;
      const paid = expense ? parseFloat(expense.paid_amount) : 0;
      const pending = earnings - paid;
      
      totalEarnings += earnings;
      totalPaid += paid;
      
      if (earnings > 0 || paid > 0) {
        dailyBreakdown.push({
          date: dateStr,
          earnings: earnings,
          paid: paid,
          pending: pending,
          packages: salaryRecord ? salaryRecord.package_count : 0,
          status: salaryRecord ? salaryRecord.status : 'no_work',
          isFullyPaid: pending <= 0.01,
          expense: expense ? {
            expenseId: expense.expense_id,
            amount: expense.amount,
            paidAmount: expense.paid_amount,
            isPaid: expense.is_paid,
            payments: expense.payments
          } : null
        });
      }
      
      currentDate.add(1, 'day');
    }
    
    return {
      loadman: {
        loadmanId: loadman.employee_id,
        loadmanName: loadman.employee_name,
        mobileNo: loadman.mobile_no
      },
      dateRange: { startDate, endDate },
      summary: {
        totalEarnings: totalEarnings.toFixed(2),
        totalPaid: totalPaid.toFixed(2),
        totalPending: (totalEarnings - totalPaid).toFixed(2),
        workingDays: dailyBreakdown.length,
        fullyPaidDays: dailyBreakdown.filter(d => d.isFullyPaid).length,
        partiallyPaidDays: dailyBreakdown.filter(d => d.paid > 0 && !d.isFullyPaid).length,
        unpaidDays: dailyBreakdown.filter(d => d.paid === 0 && d.earnings > 0).length
      },
      dailyBreakdown: dailyBreakdown
    };
    
  } catch (error) {
    throw new Error(error.message || messages.OPERATION_ERROR);
  }
}

// Get all loadmen salary summary (simplified view)
async function getAllLoadmenSalarySummary(filters = {}) {
  try {
    const { startDate, endDate, status, search } = filters;
    
    const loadmanExpenseTypeId = await getLoadmanExpenseTypeId();
    
    // Get all active loadmen
    const loadmanWhere = { is_loadman: true, is_active: 1 };
    if (search) {
      loadmanWhere[Op.or] = [
        { employee_name: { [Op.like]: `%${search}%` } },
        { employee_id: { [Op.like]: `%${search}%` } },
        { mobile_no: { [Op.like]: `%${search}%` } }
      ];
    }
    
    const loadmen = await Employee.findAll({
      where: loadmanWhere,
      attributes: ['employee_id', 'employee_name', 'mobile_no'],
      raw: true
    });
    
    if (loadmen.length === 0) {
      return {
        summary: {
          totalLoadmen: 0,
          totalEarnings: "0.00",
          totalPaid: "0.00",
          totalPending: "0.00"
        },
        loadmen: []
      };
    }
    
    const loadmanIds = loadmen.map(l => l.employee_id);
    
    // Get all salary records in date range
    const salaryWhere = {
      loadman_id: { [Op.in]: loadmanIds },
      is_active: 1
    };
    
    if (startDate && endDate) {
      salaryWhere.salary_date = {
        [Op.between]: [startDate, endDate]
      };
    }
    
    const salaryRecords = await LoadmanSalary.findAll({
      where: salaryWhere,
      attributes: [
        'loadman_id',
        'salary_date',
        'total_amount',
        'package_count'
      ],
      raw: true
    });
    
    // Get all expenses in date range
    const expenseWhere = {
      employee_id: { [Op.in]: loadmanIds },
      expense_type_id: loadmanExpenseTypeId,
      is_active: 1
    };
    
    if (startDate && endDate) {
      expenseWhere.expense_date = {
        [Op.between]: [startDate, endDate]
      };
    }
    
    const expenses = await Expense.findAll({
      where: expenseWhere,
      attributes: ['employee_id', 'expense_date', 'paid_amount'],
      raw: true
    });
    
    // Group salary by loadman
    const salaryByLoadman = {};
    salaryRecords.forEach(record => {
      if (!salaryByLoadman[record.loadman_id]) {
        salaryByLoadman[record.loadman_id] = {
          totalEarnings: 0,
          totalPackages: 0,
          workingDays: 0
        };
      }
      salaryByLoadman[record.loadman_id].totalEarnings += parseFloat(record.total_amount || 0);
      salaryByLoadman[record.loadman_id].totalPackages += record.package_count || 0;
      salaryByLoadman[record.loadman_id].workingDays++;
    });
    
    // Group expenses by loadman
    const expenseByLoadman = {};
    expenses.forEach(expense => {
      if (!expenseByLoadman[expense.employee_id]) {
        expenseByLoadman[expense.employee_id] = 0;
      }
      expenseByLoadman[expense.employee_id] += parseFloat(expense.paid_amount || 0);
    });
    
    // Build result
    const resultLoadmen = [];
    let totalEarningsAll = 0;
    let totalPaidAll = 0;
    let totalPendingAll = 0;
    
    loadmen.forEach(loadman => {
      const earnings = salaryByLoadman[loadman.employee_id]?.totalEarnings || 0;
      const paid = expenseByLoadman[loadman.employee_id] || 0;
      const pending = earnings - paid;
      
      totalEarningsAll += earnings;
      totalPaidAll += paid;
      totalPendingAll += pending;
      
      // Apply status filter
      if (status === 'paid' && pending > 0.01) return;
      if (status === 'pending' && pending <= 0.01) return;
      if (status === 'partial' && (paid === 0 || pending <= 0.01)) return;
      
      resultLoadmen.push({
        loadmanId: loadman.employee_id,
        loadmanName: loadman.employee_name,
        mobileNo: loadman.mobile_no,
        totalEarnings: earnings.toFixed(2),
        totalPaid: paid.toFixed(2),
        totalPending: pending.toFixed(2),
        totalPackages: salaryByLoadman[loadman.employee_id]?.totalPackages || 0,
        workingDays: salaryByLoadman[loadman.employee_id]?.workingDays || 0,
        status: pending <= 0.01 ? 'paid' : (paid > 0 ? 'partial' : 'pending')
      });
    });
    
    return {
      summary: {
        totalLoadmen: resultLoadmen.length,
        totalEarnings: totalEarningsAll.toFixed(2),
        totalPaid: totalPaidAll.toFixed(2),
        totalPending: totalPendingAll.toFixed(2),
        dateRange: startDate && endDate ? { startDate, endDate } : null
      },
      loadmen: resultLoadmen.sort((a, b) => parseFloat(b.totalPending) - parseFloat(a.totalPending))
    };
    
  } catch (error) {
    throw new Error(error.message || messages.OPERATION_ERROR);
  }
}

// Get loadman payment history
async function getLoadmanPayments(query) {
  try {
    const { loadmanId, startDate, endDate, page = 1, limit = 20 } = query;
    
    const loadmanExpenseTypeId = await getLoadmanExpenseTypeId();
    
    const expenseWhere = {
      expense_type_id: loadmanExpenseTypeId,
      is_active: 1
    };
    
    if (loadmanId) {
      expenseWhere.employee_id = loadmanId;
    }
    
    const paymentWhere = { is_active: 1 };
    
    if (startDate && endDate) {
      paymentWhere.payment_date = {
        [Op.between]: [startDate, endDate]
      };
    }
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const { count, rows: payments } = await ExpensePayment.findAndCountAll({
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
            'description',
            'employee_id'
          ],
          include: [
            {
              model: Employee,
              as: 'employee',
              attributes: ['employee_id', 'employee_name']
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
      data: payments
    };
    
  } catch (error) {
    throw new Error(error.message || messages.OPERATION_ERROR);
  }
}

module.exports = {
  calculateLoadmanDailySalary,
  getLoadmanSalarySummary,
  getLoadmanSalaryDetail,
  getAllLoadmenSalarySummary,
  processLoadmanSalaryPayment,
  getLoadmanPayments,
  getLoadmanExpenseTypeId
};