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
    console.log(`Calculating daily salary for loadman ${loadmanId} on date ${date}`);
    
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
            },
            {
              model: PackageType,
              as: 'packageType',
              attributes: ['package_type_id', 'package_type_name']
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
    
    console.log(`Found ${assignments.length} assignments for loadman ${loadmanId} on ${date}`);
    
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
        pickupEarnings: 0,
        dropEarnings: 0,
        handlingEarnings: 0,
        pickupCount: 0,
        dropCount: 0,
        bothCount: 0,
        isFullyPaid: true,
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
    
    // Group assignments by booking_package_id to handle multiple loadmen on same package
    const packageGroups = {};
    assignments.forEach(assignment => {
      const packageId = assignment.booking_package_id;
      if (!packageGroups[packageId]) {
        packageGroups[packageId] = [];
      }
      packageGroups[packageId].push(assignment);
    });
    
    // Process each assignment
    assignments.forEach(assignment => {
      const amount = parseFloat(assignment.amount_earned || 0);
      const quantity = assignment.bookingPackage?.quantity || 1;
      const packageId = assignment.booking_package_id;
      const loadmenCount = packageGroups[packageId]?.length || 1;
      
      totalEarnings += amount;
      totalPackages += quantity;
      
      // Track by loadman type
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
      
      // Calculate handling earnings - split among loadmen assigned to this package
      if (assignment.bookingPackage?.handling_charge && parseFloat(assignment.bookingPackage.handling_charge) > 0) {
        const handlingForThisPackage = (parseFloat(assignment.bookingPackage.handling_charge) * quantity) / loadmenCount;
        handlingEarnings += handlingForThisPackage;
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
          packageTypeName: assignment.bookingPackage?.packageType?.package_type_name,
          pickupChargePerUnit: assignment.bookingPackage?.pickup_charge,
          dropChargePerUnit: assignment.bookingPackage?.drop_charge,
          handlingChargePerUnit: assignment.bookingPackage?.handling_charge,
          createdAt: assignment.created_at
        });
      }
    });
    
    // Round all values to 2 decimal places to avoid floating point issues
    totalEarnings = Math.round(totalEarnings * 100) / 100;
    pickupEarnings = Math.round(pickupEarnings * 100) / 100;
    dropEarnings = Math.round(dropEarnings * 100) / 100;
    handlingEarnings = Math.round(handlingEarnings * 100) / 100;
    
    console.log(`Calculated earnings for ${loadmanId} on ${date}: total=${totalEarnings}, pickup=${pickupEarnings}, drop=${dropEarnings}, handling=${handlingEarnings}`);
    
    // Get payment information for this date from expenses (by salary date)
    const loadmanExpenseTypeId = await getLoadmanExpenseTypeId();
    
    // Find expense for this loadman on this date (salary date)
    const expense = await Expense.findOne({
      where: {
        employee_id: loadmanId,
        expense_type_id: loadmanExpenseTypeId,
        expense_date: date, // This is the salary date
        is_active: 1
      },
      attributes: ['expense_id', 'amount', 'paid_amount'],
      raw: true
    });
    
    let paidAmount = 0;
    if (expense) {
      paidAmount = parseFloat(expense.paid_amount || 0);
    }
    
    // Get or create salary record in LoadmanSalary table
    await updateLoadmanSalaryRecord(loadmanId, date, {
      totalEarnings,
      pickupEarnings,
      dropEarnings,
      handlingEarnings,
      totalPackages,
      totalAssignments: assignments.length
    });
    
    return {
      loadmanId: loadman.employee_id,
      loadmanName: loadman.employee_name,
      date: date,
      totalEarnings: totalEarnings,
      paidAmount: paidAmount,
      pendingAmount: Math.round((totalEarnings - paidAmount) * 100) / 100,
      totalPackages: totalPackages,
      totalAssignments: assignments.length,
      pickupEarnings: pickupEarnings,
      dropEarnings: dropEarnings,
      handlingEarnings: handlingEarnings,
      pickupCount: pickupCount,
      dropCount: dropCount,
      bothCount: bothCount,
      isFullyPaid: paidAmount >= totalEarnings - 0.01,
      assignments: includeDetails ? assignmentDetails : []
    };
    
  } catch (error) {
    console.error("Error in calculateLoadmanDailySalary:", error.message);
    throw new Error(error.message || messages.OPERATION_ERROR);
  }
}

// Helper function to update LoadmanSalary record
async function updateLoadmanSalaryRecord(loadmanId, date, earnings) {
  try {
    const [salaryRecord, created] = await LoadmanSalary.findOrCreate({
      where: {
        loadman_id: loadmanId,
        salary_date: date,
        is_active: 1
      },
      defaults: {
        loadman_salary_id: uuidv4(),
        loadman_id: loadmanId,
        salary_date: date,
        total_pickup_charges: earnings.pickupEarnings,
        total_drop_charges: earnings.dropEarnings,
        total_handling_charges: earnings.handlingEarnings,
        total_amount: earnings.totalEarnings,
        package_count: earnings.totalPackages,
        booking_count: 0,
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date()
      }
    });
    
    if (!created) {
      // Update existing record
      await salaryRecord.update({
        total_pickup_charges: earnings.pickupEarnings,
        total_drop_charges: earnings.dropEarnings,
        total_handling_charges: earnings.handlingEarnings,
        total_amount: earnings.totalEarnings,
        package_count: earnings.totalPackages,
        updated_at: new Date()
      });
    }
    
    return salaryRecord;
  } catch (error) {
    console.error("Error updating loadman salary record:", error.message);
    // Don't throw, just log the error
  }
}

// Get loadman salary summary with pending amounts
async function getLoadmanSalarySummary(filters = {}) {
  try {
    const { loadmanId, startDate, endDate, status, page = 1, limit = 20 } = filters;
    
    console.log("Getting loadman salary summary with filters:", filters);
    
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
      distinct: true,
      order: [['employee_name', 'ASC']]
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
    
    console.log(`Found ${salaryRecords.length} salary records`);
    
    // Get all expenses for these loadmen (by salary date)
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
      attributes: ['employee_id', 'expense_date', 'amount', 'paid_amount'],
      raw: true
    });
    
    console.log(`Found ${expenses.length} expense records`);
    
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
    } else {
      // If no date range, get all dates from salary records
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
    } else if (status === 'partial') {
      filteredLoadmen = resultLoadmen.filter(l => l.totalPaid > 0 && l.totalPending > 0.01);
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
    console.error("Error in getLoadmanSalarySummary:", error.message);
    throw new Error(error.message || messages.OPERATION_ERROR);
  }
}




/**
 * Process loadman salary payment - ALWAYS creates NEW expense and payment records
 */
async function processLoadmanSalaryPayment(paymentData) {
  const transaction = await sequelize.transaction();
  
  try {
    const { 
      loadmanId, 
      paymentDate, 
      amount, 
      officeCenterId, 
      payUntilDate, // Pay all outstanding salary up to this date
      paymentType = 'cash', 
      notes = '', 
      createdBy 
    } = paymentData;

    // Validate required fields
    if (!loadmanId) throw new Error("Loadman ID is required");
    if (!paymentDate) throw new Error("Payment date is required");
    if (!amount) throw new Error("Payment amount is required");
    if (!officeCenterId) throw new Error("Office center ID is required");
    if (!payUntilDate) throw new Error("Pay until date is required");

    console.log("Processing loadman salary payment:", {
      loadmanId, paymentDate, amount, officeCenterId, payUntilDate, paymentType, createdBy
    });

    // Get loadman expense type ID
    const loadmanExpenseTypeId = await getLoadmanExpenseTypeId();

    // Get loadman details
    const loadman = await Employee.findOne({
      where: { 
        employee_id: loadmanId, 
        is_loadman: true, 
        is_active: 1 
      },
      attributes: ['employee_id', 'employee_name'],
      transaction
    });

    if (!loadman) {
      throw new Error("Loadman not found");
    }

    // Get all package assignments for this loadman up to payUntilDate
    const packageAssignments = await PackageLoadman.findAll({
      where: { 
        loadman_id: loadmanId, 
        created_at: { 
          [Op.lte]: payUntilDate + ' 23:59:59' // Only up to the end of payUntilDate
        },
        is_active: 1 
      },
      attributes: [
        'package_loadman_id', 
        'loadman_type', 
        'amount_earned', 
        'booking_package_id', 
        'created_at'
      ],
      include: [
        { 
          model: BookingPackage, 
          as: 'bookingPackage', 
          attributes: ['quantity', 'handling_charge', 'pickup_charge', 'drop_charge'],
          required: false 
        }
      ],
      transaction
    });

    console.log(`Found ${packageAssignments.length} package assignments up to ${payUntilDate}`);

    if (packageAssignments.length === 0) {
      throw new Error(`No work found for loadman up to ${payUntilDate}`);
    }

    // Group assignments by booking_package_id to handle multiple loadmen on same package
    const packageGroups = {};
    packageAssignments.forEach(assignment => {
      const packageId = assignment.booking_package_id;
      if (!packageGroups[packageId]) {
        packageGroups[packageId] = [];
      }
      packageGroups[packageId].push(assignment);
    });

    // Calculate total earnings from all assignments up to payUntilDate
    let totalEarnings = 0;
    let totalPackages = 0;
    
    packageAssignments.forEach(assignment => {
      const amountEarned = parseFloat(assignment.amount_earned || 0);
      const quantity = assignment.bookingPackage?.quantity || 1;
      
      totalEarnings += amountEarned;
      totalPackages += quantity;
    });

    totalEarnings = Math.round(totalEarnings * 100) / 100;
    console.log(`Total earnings up to ${payUntilDate}: ${totalEarnings}`);

    // Get all existing expense payments for this loadman up to payUntilDate
    // to calculate total paid amount
    const existingExpenses = await Expense.findAll({
      where: { 
        employee_id: loadmanId, 
        expense_type_id: loadmanExpenseTypeId,
        expense_date: { 
          [Op.lte]: payUntilDate 
        },
        is_active: 1 
      },
      attributes: ['expense_id', 'expense_date', 'amount', 'paid_amount'],
      include: [
        {
          model: ExpensePayment,
          as: 'payments',
          where: { is_active: 1 },
          required: false,
          attributes: ['expense_payment_id', 'amount', 'payment_date']
        }
      ],
      transaction
    });

    console.log(`Found ${existingExpenses.length} existing expense records`);

    // Calculate total paid amount from all previous payments
    let totalPaid = 0;
    existingExpenses.forEach(expense => {
      totalPaid += parseFloat(expense.paid_amount || 0);
    });
    totalPaid = Math.round(totalPaid * 100) / 100;
    console.log(`Total paid up to ${payUntilDate}: ${totalPaid}`);

    // Calculate outstanding amount
    const totalOutstanding = Math.max(0, totalEarnings - totalPaid);
    console.log(`Total outstanding: ${totalOutstanding.toFixed(2)}`);
    console.log(`Payment amount: ${amount}`);

    // Validate payment amount
    if (parseFloat(amount) > totalOutstanding + 0.01) {
      throw new Error(
        `Payment amount (${amount}) exceeds total outstanding (${totalOutstanding.toFixed(2)}). ` +
        `Maximum allowed: ${totalOutstanding.toFixed(2)}`
      );
    }

    if (totalOutstanding <= 0.01) {
      throw new Error(`No outstanding amount for loadman up to ${payUntilDate}`);
    }

    // ===== ALWAYS CREATE A NEW EXPENSE FOR THIS PAYMENT =====
    // Generate a unique description
    const description = notes || `Salary payment for work up to ${payUntilDate}`;
    
    // Create a new expense for this payment
    const newExpense = await Expense.create({
      expense_id: uuidv4(),
      expense_date: paymentDate,
      expense_type_id: loadmanExpenseTypeId,
      office_center_id: officeCenterId,
      amount: parseFloat(amount), // Set amount to the payment amount
      paid_amount: 0, // Will be updated after payment
      is_paid: false,
      description: description,
      employee_id: loadmanId,
      created_by: createdBy,
      is_active: 1,
      created_at: new Date(),
      updated_at: new Date()
    }, { transaction });

    console.log(`Created NEW expense for payment date ${paymentDate}:`, newExpense.expense_id);

    // Create a NEW payment record linked to the new expense
    const newPayment = await ExpensePayment.create({
      expense_payment_id: uuidv4(),
      expense_id: newExpense.expense_id,
      payment_date: paymentDate,
      amount: parseFloat(amount),
      payment_type: paymentType,
      notes: notes || `Salary payment for work up to ${payUntilDate}`,
      created_by: createdBy,
      is_active: 1,
      created_at: new Date()
    }, { transaction });

    console.log(`Created NEW payment:`, newPayment.expense_payment_id);

    // Update the new expense with paid amount
    const isFullyPaid = parseFloat(amount) >= parseFloat(newExpense.amount) - 0.01;
    
    await newExpense.update({
      paid_amount: parseFloat(amount),
      is_paid: isFullyPaid,
      updated_at: new Date()
    }, { transaction });

    // Update or create LoadmanSalary record for the payment date
    try {
      const [salaryRecord, created] = await LoadmanSalary.findOrCreate({
        where: { 
          loadman_id: loadmanId, 
          salary_date: paymentDate,
          is_active: 1 
        },
        defaults: {
          loadman_salary_id: uuidv4(),
          loadman_id: loadmanId,
          salary_date: paymentDate,
          total_pickup_charges: 0,
          total_drop_charges: 0,
          total_handling_charges: 0,
          total_amount: parseFloat(amount),
          package_count: totalPackages,
          booking_count: packageAssignments.length,
          status: isFullyPaid ? 'paid' : 'partial',
          payment_date: paymentDate,
          created_at: new Date(),
          updated_at: new Date()
        },
        transaction
      });

      if (!created) {
        // Update existing record - add to total amount
        const newTotalAmount = parseFloat(salaryRecord.total_amount || 0) + parseFloat(amount);
        await salaryRecord.update({
          total_amount: newTotalAmount,
          package_count: salaryRecord.package_count + totalPackages,
          booking_count: salaryRecord.booking_count + packageAssignments.length,
          status: 'partial', // Mark as partial since we're adding
          payment_date: paymentDate,
          updated_at: new Date()
        }, { transaction });
      }
    } catch (err) {
      console.error("Error updating LoadmanSalary record:", err.message);
      // Continue even if this fails - it's not critical
    }

    await transaction.commit();

    // Calculate remaining balance after this payment
    const remainingBalance = totalOutstanding - parseFloat(amount);

    return {
      success: true,
      message: remainingBalance <= 0.01 
        ? "All outstanding salary paid successfully" 
        : `Partial payment of ${parseFloat(amount).toFixed(2)} processed successfully. Remaining: ${remainingBalance.toFixed(2)}`,
      loadman: {
        loadmanId: loadman.employee_id,
        loadmanName: loadman.employee_name
      },
      summary: {
        payUntilDate: payUntilDate,
        totalEarnings: totalEarnings.toFixed(2),
        totalPaidBefore: totalPaid.toFixed(2),
        totalOutstanding: totalOutstanding.toFixed(2),
        amountPaid: parseFloat(amount).toFixed(2),
        remainingBalance: remainingBalance.toFixed(2)
      },
      payment: {
        paymentId: newPayment.expense_payment_id,
        expenseId: newExpense.expense_id,
        amount: newPayment.amount,
        paymentDate: newPayment.payment_date,
        paymentType: newPayment.payment_type
      }
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
    console.log(`Getting salary detail for loadman ${loadmanId} from ${startDate} to ${endDate}`);
    
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
    
    console.log(`Found ${salaryRecords.length} salary records`);
    
    // Get all expenses for this loadman in date range (by salary date)
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
      
      // Only include days with activity
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
      dailyBreakdown: dailyBreakdown.sort((a, b) => a.date.localeCompare(b.date))
    };
    
  } catch (error) {
    console.error("Error in getLoadmanSalaryDetail:", error.message);
    throw new Error(error.message || messages.OPERATION_ERROR);
  }
}

// Get all loadmen salary summary (simplified view) - CORRECTED VERSION
async function getAllLoadmenSalarySummary(filters = {}) {
  try {
    const { startDate, endDate, status, search } = filters;
    
    console.log("Getting all loadmen salary summary with filters:", filters);
    
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
      order: [['employee_name', 'ASC']],
      raw: true
    });
    
    console.log(`Found ${loadmen.length} loadmen`);
    
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
    
    // Get all package assignments directly from PackageLoadman for accurate earnings
    const packageWhere = {
      loadman_id: { [Op.in]: loadmanIds },
      is_active: 1
    };
    
    if (startDate && endDate) {
      packageWhere.created_at = {
        [Op.between]: [startDate + ' 00:00:00', endDate + ' 23:59:59']
      };
    }
    
    const packageAssignments = await PackageLoadman.findAll({
      where: packageWhere,
      attributes: [
        'loadman_id',
        'amount_earned',
        'created_at'
      ],
      include: [
        {
          model: BookingPackage,
          as: 'bookingPackage',
          attributes: ['quantity'],
          required: false
        }
      ],
      raw: false
    });
    
    console.log(`Found ${packageAssignments.length} package assignments`);
    
    // Group earnings by loadman from actual assignments
    const earningsByLoadman = {};
    const packagesByLoadman = {};
    const workingDaysByLoadman = {};
    
    packageAssignments.forEach(assignment => {
      const loadmanId = assignment.loadman_id;
      const amount = parseFloat(assignment.amount_earned || 0);
      const quantity = assignment.bookingPackage?.quantity || 1;
      const date = moment(assignment.created_at).format('YYYY-MM-DD');
      
      if (!earningsByLoadman[loadmanId]) {
        earningsByLoadman[loadmanId] = 0;
        packagesByLoadman[loadmanId] = 0;
        workingDaysByLoadman[loadmanId] = new Set();
      }
      
      earningsByLoadman[loadmanId] += amount;
      packagesByLoadman[loadmanId] += quantity;
      workingDaysByLoadman[loadmanId].add(date);
    });
    
    console.log("Earnings by loadman from PackageLoadman:", earningsByLoadman);
    
    // Get all expenses for these loadmen (by salary date)
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
    
    console.log(`Found ${expenses.length} expense records`);
    
    // Group expenses by loadman
    const paidByLoadman = {};
    expenses.forEach(expense => {
      if (!paidByLoadman[expense.employee_id]) {
        paidByLoadman[expense.employee_id] = 0;
      }
      paidByLoadman[expense.employee_id] += parseFloat(expense.paid_amount || 0);
    });
    
    // Build result
    const resultLoadmen = [];
    let totalEarningsAll = 0;
    let totalPaidAll = 0;
    let totalPendingAll = 0;
    
    loadmen.forEach(loadman => {
      // Use actual earnings from PackageLoadman, not from package charges
      const earnings = earningsByLoadman[loadman.employee_id] || 0;
      const paid = paidByLoadman[loadman.employee_id] || 0;
      const pending = earnings - paid;
      const workingDays = workingDaysByLoadman[loadman.employee_id]?.size || 0;
      const totalPackages = packagesByLoadman[loadman.employee_id] || 0;
      
      totalEarningsAll += earnings;
      totalPaidAll += paid;
      totalPendingAll += pending;
      
      // Determine status
      let loadmanStatus = 'no_work';
      if (earnings > 0) {
        if (pending <= 0.01 && pending >= -0.01) { // Allow for small floating point errors
          loadmanStatus = 'paid';
        } else if (paid > 0) {
          loadmanStatus = 'partial';
        } else {
          loadmanStatus = 'pending';
        }
      }
      
      // Handle overpayment case (negative pending)
      if (pending < -0.01) {
        loadmanStatus = 'overpaid';
      }
      
      // Apply status filter
      if (status && status !== 'all') {
        if (status === 'paid' && loadmanStatus !== 'paid') return;
        if (status === 'pending' && loadmanStatus !== 'pending') return;
        if (status === 'partial' && loadmanStatus !== 'partial') return;
        if (status === 'overpaid' && loadmanStatus !== 'overpaid') return;
        if (status === 'no_work' && loadmanStatus !== 'no_work') return;
      }
      
      resultLoadmen.push({
        loadmanId: loadman.employee_id,
        loadmanName: loadman.employee_name,
        mobileNo: loadman.mobile_no,
        totalEarnings: earnings.toFixed(2),
        totalPaid: paid.toFixed(2),
        totalPending: pending.toFixed(2),
        totalPackages: totalPackages,
        workingDays: workingDays,
        status: loadmanStatus
      });
    });
    
    // Sort by pending amount (highest first)
    resultLoadmen.sort((a, b) => Math.abs(parseFloat(b.totalPending)) - Math.abs(parseFloat(a.totalPending)));
    
    return {
      summary: {
        totalLoadmen: resultLoadmen.length,
        totalEarnings: totalEarningsAll.toFixed(2),
        totalPaid: totalPaidAll.toFixed(2),
        totalPending: totalPendingAll.toFixed(2),
        dateRange: startDate && endDate ? { startDate, endDate } : null
      },
      loadmen: resultLoadmen
    };
    
  } catch (error) {
    console.error("Error in getAllLoadmenSalarySummary:", error.message);
    throw new Error(error.message || messages.OPERATION_ERROR);
  }
}

// Get loadman payment history
async function getLoadmanPayments(query) {
  try {
    const { loadmanId, startDate, endDate, page = 1, limit = 20 } = query;
    
    console.log("Getting loadman payments with query:", query);
    
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
    console.error("Error in getLoadmanPayments:", error.message);
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