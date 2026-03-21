"use strict";

const messages = require("../helpers/message");
const _ = require("lodash");
const { Op, fn, col, literal } = require("sequelize");
const { 
  Booking, 
  BookingPackage, 
  Payment, 
  Trip, 
  TripBooking,Vehicle,
  Expense,
  ExpensePayment,
  OpeningBalance,
  OfficeCenter,
  Customer,Location,PackageType,TripStage,
  Employee,
  sequelize 
} = require("../models");

// =============================================
// PROFIT & LOSS REPORT
// =============================================

/**
 * Get daily profit & loss report
 */
async function getDailyProfitLoss(date, centerId = null) {
  try {
    const reportDate = date || new Date().toISOString().split('T')[0];
    
    // Get opening balance for the date
    const openingBalance = await OpeningBalance.findOne({
      where: {
        date: reportDate,
        ...(centerId && { office_center_id: centerId }),
        is_active: 1
      }
    });

    // Get all payments received on this date
    const paymentsWhere = {
      payment_date: reportDate,
      is_active: 1,
      status: 'completed'
    };
    if (centerId) {
      paymentsWhere.collected_at_center = centerId;
    }

    const payments = await Payment.findAll({
      where: paymentsWhere,
      attributes: [
        'payment_id',
        'payment_number',
        'amount',
        'payment_mode',
        'booking_id',
        'collected_at_center'
      ],
      include: [
        {
          model: Booking,
          as: 'booking',
          attributes: ['booking_id', 'booking_number']
        }
      ]
    });

    // Get all expenses on this date
    const expensesWhere = {
      expense_date: reportDate,
      is_active: 1
    };
    if (centerId) {
      expensesWhere.office_center_id = centerId;
    }

    const expenses = await Expense.findAll({
      where: expensesWhere,
      attributes: [
        'expense_id',
        'expense_date',
        'amount',
        'paid_amount',
        'description'
      ],
      include: [
        {
          model: ExpensePayment,
          as: 'payments',
          attributes: ['amount', 'payment_type'],
          where: { 
            payment_date: reportDate,
            is_active: 1 
          },
          required: false
        },
        {
          model: sequelize.models.expence_type,
          as: 'expenseType',
          attributes: ['expence_type_id', 'expence_type_name']
        }
      ]
    });

    // Calculate totals
    const totalPayments = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.paid_amount || e.amount || 0), 0);
    
    // Get expense payments separately
    const expensePayments = await ExpensePayment.findAll({
      where: {
        payment_date: reportDate,
        is_active: 1
      },
      include: [
        {
          model: Expense,
          as: 'expense',
          attributes: ['expense_id', 'description'],
          where: centerId ? { office_center_id: centerId } : {}
        }
      ]
    });

    const totalExpensePayments = expensePayments.reduce((sum, ep) => sum + parseFloat(ep.amount || 0), 0);

    // Calculate net profit/loss
    const openingAmount = parseFloat(openingBalance?.opening_balance || 0);
    const closingAmount = openingAmount + totalPayments - totalExpensePayments;
    const profitLoss = totalPayments - totalExpensePayments;

    return {
      date: reportDate,
      center_id: centerId,
      center_name: centerId ? (await OfficeCenter.findOne({
      where: { office_center_id:centerId},
      attributes: [
        'office_center_id',
        'office_center_name',
        'is_active',
        'created_at',
        'updated_at'
      ]
    }))?.office_center_name : 'All Centers',
      opening_balance: openingAmount.toFixed(2),
      summary: {
        total_payments: payments.length,
        total_payment_amount: totalPayments.toFixed(2),
        total_expenses: expenses.length,
        total_expense_amount: totalExpenses.toFixed(2),
        total_expense_payments: totalExpensePayments.toFixed(2),
        profit_loss: profitLoss.toFixed(2),
        profit_loss_status: profitLoss >= 0 ? 'profit' : 'loss',
        closing_balance: closingAmount.toFixed(2)
      },
      payments: payments.map(p => ({
        payment_id: p.payment_id,
        payment_number: p.payment_number,
        amount: p.amount,
        mode: p.payment_mode,
        booking_number: p.booking?.booking_number
      })),
      expenses: expenses.map(e => ({
        expense_id: e.expense_id,
        type: e.expenseType?.expence_type_name,
        amount: e.amount,
        paid: e.paid_amount,
        description: e.description,
        payments: e.payments
      }))
    };
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

/**
 * Get date range profit & loss report
 */

async function getDateRangeProfitLoss1(startDate, endDate, centerId = null) {
  try {
    // Get opening balance for start date
    const openingBalance = await OpeningBalance.findAll({
      where: {
        date: startDate,
        ...(centerId && { office_center_id: centerId }),
        is_active: 1
      }
    });

    // Get all payments in date range with customer details
    const paymentsWhere = {
      payment_date: {
        [Op.between]: [startDate, endDate]
      },
      is_active: 1,
      status: 'completed'
    };
    
    if (centerId) {
      paymentsWhere.collected_at_center = centerId;
    }

    const payments = await Payment.findAll({
      where: paymentsWhere,
      attributes: [
        'payment_id',
        'payment_number',
        [sequelize.col('Payment.amount'), 'amount'],
        'payment_date',
        'payment_mode',
        'payment_type',
        'booking_id',
        'customer_id',
        'description'
      ],
      include: [
        {
          model: Customer,
          as: 'customer',
          attributes: ['customer_id', 'customer_name', 'customer_number']
        },
        {
          model: Booking,
          as: 'booking',
          attributes: ['booking_id', 'booking_number', 'total_amount', 'due_amount'],
          include: [
            {
              model: Customer,
              as: 'fromCustomer',
              attributes: ['customer_id', 'customer_name', 'customer_number']
            },
            {
              model: Customer,
              as: 'toCustomer',
              attributes: ['customer_id', 'customer_name', 'customer_number']
            }
          ]
        },
        {
          model: Employee,
          as: 'collector',
          attributes: ['employee_id', 'employee_name']
        },
        {
          model: OfficeCenter,
          as: 'collectionCenter',
          attributes: ['office_center_id', 'office_center_name']
        }
      ],
      order: [['payment_date', 'ASC']]
    });

    // Get all expense payments in date range
    const expensePaymentsWhere = {
      payment_date: {
        [Op.between]: [startDate, endDate]
      },
      is_active: 1
    };

    const expensePayments = await ExpensePayment.findAll({
      where: expensePaymentsWhere,
      attributes: [
        'expense_payment_id',
        [sequelize.col('ExpensePayment.amount'), 'amount'],
        'payment_date',
        'payment_type',
        'notes'
      ],
      include: [
        {
          model: Expense,
          as: 'expense',
          attributes: ['expense_id', 'description', 'expense_type_id'],
          where: centerId ? { office_center_id: centerId } : {},
          include: [
            {
              model: sequelize.models.expence_type,
              as: 'expenseType',
              attributes: ['expence_type_id', 'expence_type_name']
            }
          ]
        }
      ],
      order: [['payment_date', 'ASC']]
    });

    // Group by date
    const dailyBreakdown = {};
    const allDates = [...new Set([
      ...payments.map(p => p.payment_date),
      ...expensePayments.map(ep => ep.payment_date)
    ])].sort();

    for (const date of allDates) {
      const dayPayments = payments.filter(p => p.payment_date === date);
      const dayExpenses = expensePayments.filter(ep => ep.payment_date === date);
      
      const dayPaymentTotal = dayPayments.reduce((sum, p) => sum + parseFloat(p.getDataValue('amount') || 0), 0);
      const dayExpenseTotal = dayExpenses.reduce((sum, ep) => sum + parseFloat(ep.getDataValue('amount') || 0), 0);
      
      dailyBreakdown[date] = {
        date,
        payments: dayPayments.length,
        payment_total: dayPaymentTotal.toFixed(2),
        expenses: dayExpenses.length,
        expense_total: dayExpenseTotal.toFixed(2),
        net: (dayPaymentTotal - dayExpenseTotal).toFixed(2)
      };
    }

    // Calculate totals
    const totalPayments = payments.reduce((sum, p) => sum + parseFloat(p.getDataValue('amount') || 0), 0);
    const totalExpenses = expensePayments.reduce((sum, ep) => sum + parseFloat(ep.getDataValue('amount') || 0), 0);
    const profitLoss = totalPayments - totalExpenses;

    // Group by expense type
    const expenseByType = {};
    expensePayments.forEach(ep => {
      const typeName = ep.expense?.expenseType?.expence_type_name || 'Other';
      if (!expenseByType[typeName]) {
        expenseByType[typeName] = {
          type: typeName,
          total: 0,
          count: 0
        };
      }
      expenseByType[typeName].total += parseFloat(ep.getDataValue('amount') || 0);
      expenseByType[typeName].count += 1;
    });

    // Group payments by mode
    const paymentsByMode = {};
    payments.forEach(p => {
      const mode = p.payment_mode || 'other';
      if (!paymentsByMode[mode]) {
        paymentsByMode[mode] = {
          mode,
          total: 0,
          count: 0
        };
      }
      paymentsByMode[mode].total += parseFloat(p.getDataValue('amount') || 0);
      paymentsByMode[mode].count += 1;
    });

    // Group payments by customer
    const paymentsByCustomer = {};
    payments.forEach(p => {
      const customerId = p.customer?.customer_id || 'unknown';
      const customerName = p.customer?.customer_name || 'Unknown Customer';
      
      if (!paymentsByCustomer[customerId]) {
        paymentsByCustomer[customerId] = {
          customer_id: customerId,
          customer_name: customerName,
          customer_number: p.customer?.customer_number,
          total_amount: 0,
          payment_count: 0,
          payments: []
        };
      }
      
      const amount = parseFloat(p.getDataValue('amount') || 0);
      paymentsByCustomer[customerId].total_amount += amount;
      paymentsByCustomer[customerId].payment_count += 1;
      paymentsByCustomer[customerId].payments.push({
        payment_id: p.payment_id,
        payment_number: p.payment_number,
        amount: amount,
        date: p.payment_date,
        mode: p.payment_mode,
        booking_number: p.booking?.booking_number
      });
    });

    return {
      date_range: {
        start_date: startDate,
        end_date: endDate
      },
      center_id: centerId,
      center_name: centerId ? (await OfficeCenter.findOne({
      where: { office_center_id:centerId},
      attributes: [
        'office_center_id',
        'office_center_name',
        'is_active',
        'created_at',
        'updated_at'
      ]
    }))?.office_center_name : 'All Centers',
      opening_balance: parseFloat(openingBalance?.opening_balance || 0).toFixed(2),
      summary: {
        total_payments: payments.length,
        total_payment_amount: totalPayments.toFixed(2),
        total_expense_payments: expensePayments.length,
        total_expense_amount: totalExpenses.toFixed(2),
        profit_loss: profitLoss.toFixed(2),
        profit_loss_status: profitLoss >= 0 ? 'profit' : 'loss',
        closing_balance: (parseFloat(openingBalance?.opening_balance || 0) + profitLoss).toFixed(2),
        unique_customers: Object.keys(paymentsByCustomer).length
      },
      breakdown: {
        daily: Object.values(dailyBreakdown),
        by_payment_mode: Object.values(paymentsByMode),
        by_expense_type: Object.values(expenseByType),
        by_customer: Object.values(paymentsByCustomer)
      },
      payments: payments.map(p => ({
        payment_id: p.payment_id,
        payment_number: p.payment_number,
        date: p.payment_date,
        amount: p.getDataValue('amount'),
        mode: p.payment_mode,
        type: p.payment_type,
        description: p.description,
        customer: p.customer ? {
          id: p.customer.customer_id,
          name: p.customer.customer_name,
          number: p.customer.customer_number
        } : null,
        booking: p.booking ? {
          id: p.booking.booking_id,
          number: p.booking.booking_number
        } : null,
        collector: p.collector ? {
          id: p.collector.employee_id,
          name: p.collector.employee_name
        } : null,
        collection_center: p.collectionCenter ? {
          id: p.collectionCenter.office_center_id,
          name: p.collectionCenter.office_center_name
        } : null
      })),
      expenses: expensePayments.map(ep => ({
        date: ep.payment_date,
        type: ep.expense?.expenseType?.expence_type_name,
        amount: ep.getDataValue('amount'),
        description: ep.expense?.description,
        notes: ep.notes
      }))
    };
  } catch (error) {
    console.error("Error in getDateRangeProfitLoss:", error);
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

async function getDateRangeProfitLoss1(startDate, endDate, centerId = null) {
  try {
    // ===== GET OPENING BALANCE FOR START DATE (considering IN/OUT) =====
    const previousDay = new Date(startDate);
    previousDay.setDate(previousDay.getDate() - 1);
    const previousDayStr = previousDay.toISOString().split('T')[0];
    
    let openingBalanceData = { total: 0, net_investment: 0 };
    let centerWiseOpening = [];
    let runningBalance = 0;
    let totalInvestment = 0;
    
    if (centerId) {
      // Specific center - get all opening balance transactions on or before previous day
      const allTransactions = await OpeningBalance.findAll({
        where: {
          date: {
            [Op.lte]: previousDayStr
          },
          office_center_id: centerId,
          is_active: 1
        },
        order: [['date', 'ASC']],
        include: [
          {
            model: OfficeCenter,
            as: 'officeCenter',
            attributes: ['office_center_id', 'office_center_name']
          }
        ]
      });
      
      // Calculate net balance from all IN/OUT transactions
      let netBalance = 0;
      allTransactions.forEach(trans => {
        if (trans.in_out === 'IN') {
          netBalance += parseFloat(trans.opening_balance || 0);
        } else {
          netBalance -= parseFloat(trans.opening_balance || 0);
        }
      });
      
      // Get the latest transaction for metadata
      const lastTransaction = allTransactions[allTransactions.length - 1];
      
      openingBalanceData = {
        total: netBalance,
        net_investment: netBalance,
        last_updated: lastTransaction?.date,
        center_id: centerId,
        center_name: lastTransaction?.officeCenter?.office_center_name,
        transaction_count: allTransactions.length
      };
      
      runningBalance = netBalance;
      totalInvestment = netBalance;
    } else {
      // All centers - get all opening balance transactions for each center
      const allCenters = await OfficeCenter.findAll({
        where: { is_active: 1 },
        attributes: ['office_center_id', 'office_center_name']
      });
      
      let totalNetBalance = 0;
      
      for (const center of allCenters) {
        const centerTransactions = await OpeningBalance.findAll({
          where: {
            date: {
              [Op.lte]: previousDayStr
            },
            office_center_id: center.office_center_id,
            is_active: 1
          },
          order: [['date', 'ASC']]
        });
        
        let centerNetBalance = 0;
        centerTransactions.forEach(trans => {
          if (trans.in_out === 'IN') {
            centerNetBalance += parseFloat(trans.opening_balance || 0);
          } else {
            centerNetBalance -= parseFloat(trans.opening_balance || 0);
          }
        });
        
        totalNetBalance += centerNetBalance;
        
        centerWiseOpening.push({
          center_id: center.office_center_id,
          center_name: center.office_center_name,
          opening_balance: centerNetBalance.toFixed(2),
          transaction_count: centerTransactions.length,
          last_updated: centerTransactions[centerTransactions.length - 1]?.date
        });
      }
      
      openingBalanceData = {
        total: totalNetBalance,
        net_investment: totalNetBalance,
        as_of_date: previousDayStr
      };
      
      runningBalance = totalNetBalance;
      totalInvestment = totalNetBalance;
    }

    // Get all payments in date range with customer details
    const paymentsWhere = {
      payment_date: {
        [Op.between]: [startDate, endDate]
      },
      is_active: 1,
      status: 'completed'
    };
    
    if (centerId) {
      paymentsWhere.collected_at_center = centerId;
    }

    const payments = await Payment.findAll({
      where: paymentsWhere,
      attributes: [
        'payment_id',
        'payment_number',
        [sequelize.col('Payment.amount'), 'amount'],
        'payment_date',
        'payment_mode',
        'payment_type',
        'booking_id',
        'customer_id',
        'description',
        'collected_at_center'
      ],
      include: [
        {
          model: Customer,
          as: 'customer',
          attributes: ['customer_id', 'customer_name', 'customer_number']
        },
        {
          model: Booking,
          as: 'booking',
          attributes: ['booking_id', 'booking_number', 'total_amount', 'due_amount'],
          include: [
            {
              model: Customer,
              as: 'fromCustomer',
              attributes: ['customer_id', 'customer_name', 'customer_number']
            },
            {
              model: Customer,
              as: 'toCustomer',
              attributes: ['customer_id', 'customer_name', 'customer_number']
            }
          ]
        },
        {
          model: Employee,
          as: 'collector',
          attributes: ['employee_id', 'employee_name']
        },
        {
          model: OfficeCenter,
          as: 'collectionCenter',
          attributes: ['office_center_id', 'office_center_name']
        }
      ],
      order: [['payment_date', 'ASC']]
    });

    // Get all expense payments in date range
    const expensePaymentsWhere = {
      payment_date: {
        [Op.between]: [startDate, endDate]
      },
      is_active: 1
    };

    const expensePayments = await ExpensePayment.findAll({
      where: expensePaymentsWhere,
      attributes: [
        'expense_payment_id',
        [sequelize.col('ExpensePayment.amount'), 'amount'],
        'payment_date',
        'payment_type',
        'notes'
      ],
      include: [
        {
          model: Expense,
          as: 'expense',
          attributes: ['expense_id', 'description', 'expense_type_id', 'office_center_id'],
          where: centerId ? { office_center_id: centerId } : {},
          include: [
            {
              model: sequelize.models.expence_type,
              as: 'expenseType',
              attributes: ['expence_type_id', 'expence_type_name']
            },
            {
              model: OfficeCenter,
              as: 'officeCenter',
              attributes: ['office_center_id', 'office_center_name']
            }
          ]
        }
      ],
      order: [['payment_date', 'ASC']]
    });

    // Get opening balance transactions within the date range (for tracking investments/withdrawals)
    const openingTransactionsWhere = {
      date: {
        [Op.between]: [startDate, endDate]
      },
      is_active: 1
    };
    if (centerId) {
      openingTransactionsWhere.office_center_id = centerId;
    }
    
    const openingTransactions = await OpeningBalance.findAll({
      where: openingTransactionsWhere,
      attributes: [
        'opening_balance_id',
        'date',
        'office_center_id',
        'in_out',
        'opening_balance',
        'notes'
      ],
      include: [
        {
          model: OfficeCenter,
          as: 'officeCenter',
          attributes: ['office_center_id', 'office_center_name']
        }
      ],
      order: [['date', 'ASC']]
    });

    // Group by date with running balance calculation
    const allDates = [...new Set([
      ...payments.map(p => p.payment_date),
      ...expensePayments.map(ep => ep.payment_date),
      ...openingTransactions.map(ot => ot.date)
    ])].sort();

    const dailyBreakdown = {};
    let currentRunningBalance = runningBalance;
    let totalInvestments = 0;
    let totalWithdrawals = 0;

    for (const date of allDates) {
      const dayPayments = payments.filter(p => p.payment_date === date);
      const dayExpenses = expensePayments.filter(ep => ep.payment_date === date);
      const dayOpeningTrans = openingTransactions.filter(ot => ot.date === date);
      
      const dayPaymentTotal = dayPayments.reduce((sum, p) => sum + parseFloat(p.getDataValue('amount') || 0), 0);
      const dayExpenseTotal = dayExpenses.reduce((sum, ep) => sum + parseFloat(ep.getDataValue('amount') || 0), 0);
      
      // Calculate opening balance adjustments (IN/OUT)
      let dayInvestmentTotal = 0;
      let dayWithdrawalTotal = 0;
      const dayInvestments = [];
      const dayWithdrawals = [];
      
      dayOpeningTrans.forEach(trans => {
        const amount = parseFloat(trans.opening_balance || 0);
        if (trans.in_out === 'IN') {
          dayInvestmentTotal += amount;
          dayInvestments.push({
            id: trans.opening_balance_id,
            amount: amount,
            notes: trans.notes
          });
        } else {
          dayWithdrawalTotal += amount;
          dayWithdrawals.push({
            id: trans.opening_balance_id,
            amount: amount,
            notes: trans.notes
          });
        }
      });
      
      totalInvestments += dayInvestmentTotal;
      totalWithdrawals += dayWithdrawalTotal;
      
      // Net change = payments - expenses + investments - withdrawals
      const dayNet = dayPaymentTotal - dayExpenseTotal + dayInvestmentTotal - dayWithdrawalTotal;
      const dayOpeningBalance = currentRunningBalance;
      const dayClosingBalance = dayOpeningBalance + dayNet;
      
      dailyBreakdown[date] = {
        date,
        opening_balance: dayOpeningBalance.toFixed(2),
        payments: dayPayments.length,
        payment_total: dayPaymentTotal.toFixed(2),
        expenses: dayExpenses.length,
        expense_total: dayExpenseTotal.toFixed(2),
        investments: dayInvestments.length,
        investment_total: dayInvestmentTotal.toFixed(2),
        withdrawals: dayWithdrawals.length,
        withdrawal_total: dayWithdrawalTotal.toFixed(2),
        net_change: dayNet.toFixed(2),
        closing_balance: dayClosingBalance.toFixed(2),
        investment_details: dayInvestments,
        withdrawal_details: dayWithdrawals
      };
      
      // Update running balance for next day
      currentRunningBalance = dayClosingBalance;
    }

    // Calculate totals
    const totalPayments = payments.reduce((sum, p) => sum + parseFloat(p.getDataValue('amount') || 0), 0);
    const totalExpenses = expensePayments.reduce((sum, ep) => sum + parseFloat(ep.getDataValue('amount') || 0), 0);
    const operationalProfitLoss = totalPayments - totalExpenses;
    const netInvestmentChange = totalInvestments - totalWithdrawals;
    const totalProfitLoss = operationalProfitLoss + netInvestmentChange;
    const finalClosingBalance = runningBalance + totalProfitLoss;

    // Group by expense type
    const expenseByType = {};
    expensePayments.forEach(ep => {
      const typeName = ep.expense?.expenseType?.expence_type_name || 'Other';
      if (!expenseByType[typeName]) {
        expenseByType[typeName] = {
          type: typeName,
          total: 0,
          count: 0
        };
      }
      expenseByType[typeName].total += parseFloat(ep.getDataValue('amount') || 0);
      expenseByType[typeName].count += 1;
    });

    // Group payments by mode
    const paymentsByMode = {};
    payments.forEach(p => {
      const mode = p.payment_mode || 'other';
      if (!paymentsByMode[mode]) {
        paymentsByMode[mode] = {
          mode,
          total: 0,
          count: 0
        };
      }
      paymentsByMode[mode].total += parseFloat(p.getDataValue('amount') || 0);
      paymentsByMode[mode].count += 1;
    });

    // Group payments by customer
    const paymentsByCustomer = {};
    payments.forEach(p => {
      const customerId = p.customer?.customer_id || 'unknown';
      const customerName = p.customer?.customer_name || 'Unknown Customer';
      
      if (!paymentsByCustomer[customerId]) {
        paymentsByCustomer[customerId] = {
          customer_id: customerId,
          customer_name: customerName,
          customer_number: p.customer?.customer_number,
          total_amount: 0,
          payment_count: 0,
          payments: []
        };
      }
      
      const amount = parseFloat(p.getDataValue('amount') || 0);
      paymentsByCustomer[customerId].total_amount += amount;
      paymentsByCustomer[customerId].payment_count += 1;
      paymentsByCustomer[customerId].payments.push({
        payment_id: p.payment_id,
        payment_number: p.payment_number,
        amount: amount,
        date: p.payment_date,
        mode: p.payment_mode,
        booking_number: p.booking?.booking_number
      });
    });

    // Group payments by center
    const paymentsByCenter = {};
    payments.forEach(p => {
      const centerId = p.collected_at_center || 'unknown';
      const centerName = p.collectionCenter?.office_center_name || 'Unknown Center';
      
      if (!paymentsByCenter[centerId]) {
        paymentsByCenter[centerId] = {
          center_id: centerId,
          center_name: centerName,
          total_amount: 0,
          payment_count: 0
        };
      }
      
      paymentsByCenter[centerId].total_amount += parseFloat(p.getDataValue('amount') || 0);
      paymentsByCenter[centerId].payment_count += 1;
    });

    // Group investments/withdrawals by center
    const investmentsByCenter = {};
    openingTransactions.forEach(ot => {
      const cId = ot.office_center_id;
      const centerName = ot.officeCenter?.office_center_name || 'Unknown Center';
      
      if (!investmentsByCenter[cId]) {
        investmentsByCenter[cId] = {
          center_id: cId,
          center_name: centerName,
          total_investments: 0,
          total_withdrawals: 0,
          net_investment: 0,
          transactions: []
        };
      }
      
      const amount = parseFloat(ot.opening_balance || 0);
      if (ot.in_out === 'IN') {
        investmentsByCenter[cId].total_investments += amount;
        investmentsByCenter[cId].net_investment += amount;
      } else {
        investmentsByCenter[cId].total_withdrawals += amount;
        investmentsByCenter[cId].net_investment -= amount;
      }
      
      investmentsByCenter[cId].transactions.push({
        id: ot.opening_balance_id,
        date: ot.date,
        type: ot.in_out,
        amount: amount,
        notes: ot.notes
      });
    });

    // Get center name for response
    let centerName = 'All Centers';
    if (centerId) {
      const center = await OfficeCenter.findOne({ 
        where: { office_center_id: centerId }, 
        attributes: ['office_center_id', 'office_center_name'] 
      });
      centerName = center?.office_center_name || 'Unknown Center';
    }

    return {
      date_range: {
        start_date: startDate,
        end_date: endDate,
        opening_balance_as_of: previousDayStr
      },
      center: {
        id: centerId,
        name: centerName
      },
      opening_balance: {
        total: openingBalanceData.total.toFixed(2),
        net_investment: openingBalanceData.net_investment.toFixed(2),
        as_of_date: previousDayStr,
        ...(centerId ? { 
          center_id: centerId, 
          center_name: centerName, 
          last_updated: openingBalanceData.last_updated,
          transaction_count: openingBalanceData.transaction_count
        } : { 
          center_wise: centerWiseOpening 
        })
      },
      summary: {
        total_payments: payments.length,
        total_payment_amount: totalPayments.toFixed(2),
        total_expense_payments: expensePayments.length,
        total_expense_amount: totalExpenses.toFixed(2),
        operational_profit_loss: operationalProfitLoss.toFixed(2),
        total_investments: totalInvestments.toFixed(2),
        total_withdrawals: totalWithdrawals.toFixed(2),
        net_investment_change: netInvestmentChange.toFixed(2),
        total_profit_loss: totalProfitLoss.toFixed(2),
        profit_loss_status: totalProfitLoss >= 0 ? 'profit' : 'loss',
        closing_balance: finalClosingBalance.toFixed(2),
        closing_balance_as_of: endDate,
        unique_customers: Object.keys(paymentsByCustomer).length,
        centers_involved: Object.keys(paymentsByCenter).length,
        days_in_range: allDates.length
      },
      breakdown: {
        daily: Object.values(dailyBreakdown),
        by_payment_mode: Object.values(paymentsByMode),
        by_expense_type: Object.values(expenseByType),
        by_customer: Object.values(paymentsByCustomer),
        by_center: Object.values(paymentsByCenter),
        by_investment_center: Object.values(investmentsByCenter)
      },
      transactions: {
        payments: payments.map(p => ({
          payment_id: p.payment_id,
          payment_number: p.payment_number,
          date: p.payment_date,
          amount: p.getDataValue('amount'),
          mode: p.payment_mode,
          type: p.payment_type,
          description: p.description,
          center: p.collectionCenter ? {
            id: p.collectionCenter.office_center_id,
            name: p.collectionCenter.office_center_name
          } : null,
          customer: p.customer ? {
            id: p.customer.customer_id,
            name: p.customer.customer_name,
            number: p.customer.customer_number
          } : null,
          booking: p.booking ? {
            id: p.booking.booking_id,
            number: p.booking.booking_number,
            total_amount: p.booking.total_amount,
            due_amount: p.booking.due_amount
          } : null,
          collector: p.collector ? {
            id: p.collector.employee_id,
            name: p.collector.employee_name
          } : null
        })),
        expenses: expensePayments.map(ep => ({
          expense_payment_id: ep.expense_payment_id,
          date: ep.payment_date,
          type: ep.expense?.expenseType?.expence_type_name,
          amount: ep.getDataValue('amount'),
          description: ep.expense?.description,
          notes: ep.notes,
          payment_type: ep.payment_type,
          center: ep.expense?.officeCenter ? {
            id: ep.expense.officeCenter.office_center_id,
            name: ep.expense.officeCenter.office_center_name
          } : null
        })),
        investments: openingTransactions.map(ot => ({
          id: ot.opening_balance_id,
          date: ot.date,
          type: ot.in_out,
          amount: ot.opening_balance,
          notes: ot.notes,
          center: ot.officeCenter ? {
            id: ot.officeCenter.office_center_id,
            name: ot.officeCenter.office_center_name
          } : null
        }))
      }
    };
  } catch (error) {
    console.error("Error in getDateRangeProfitLoss:", error);
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

async function getDateRangeProfitLoss(startDate, endDate, centerId = null) {
  try {
    // ===== GET OPENING BALANCE FOR START DATE (considering IN/OUT) =====
    const previousDay = new Date(startDate);
    previousDay.setDate(previousDay.getDate() - 1);
    const previousDayStr = previousDay.toISOString().split('T')[0];
    
    let openingBalanceData = { total: 0, net_investment: 0 };
    let centerWiseOpening = [];
    let runningBalance = 0;
    let totalInvestment = 0;
    
    if (centerId) {
      // Specific center - get all opening balance transactions on or before previous day
      const allTransactions = await OpeningBalance.findAll({
        where: {
          date: {
            [Op.lte]: previousDayStr
          },
          office_center_id: centerId,
          is_active: 1
        },
        order: [['date', 'ASC']],
        include: [
          {
            model: OfficeCenter,
            as: 'officeCenter',
            attributes: ['office_center_id', 'office_center_name']
          }
        ]
      });
      
      // Calculate net balance from all IN/OUT transactions
      let netBalance = 0;
      allTransactions.forEach(trans => {
        if (trans.in_out === 'IN') {
          netBalance += parseFloat(trans.opening_balance || 0);
        } else {
          netBalance -= parseFloat(trans.opening_balance || 0);
        }
      });
      
      // Get the latest transaction for metadata
      const lastTransaction = allTransactions[allTransactions.length - 1];
      
      openingBalanceData = {
        total: netBalance,
        net_investment: netBalance,
        last_updated: lastTransaction?.date,
        center_id: centerId,
        center_name: lastTransaction?.officeCenter?.office_center_name,
        transaction_count: allTransactions.length
      };
      
      runningBalance = netBalance;
      totalInvestment = netBalance;
    } else {
      // All centers - get all opening balance transactions for each center
      const allCenters = await OfficeCenter.findAll({
        where: { is_active: 1 },
        attributes: ['office_center_id', 'office_center_name']
      });
      
      let totalNetBalance = 0;
      
      for (const center of allCenters) {
        const centerTransactions = await OpeningBalance.findAll({
          where: {
            date: {
              [Op.lte]: previousDayStr
            },
            office_center_id: center.office_center_id,
            is_active: 1
          },
          order: [['date', 'ASC']]
        });
        
        let centerNetBalance = 0;
        centerTransactions.forEach(trans => {
          if (trans.in_out === 'IN') {
            centerNetBalance += parseFloat(trans.opening_balance || 0);
          } else {
            centerNetBalance -= parseFloat(trans.opening_balance || 0);
          }
        });
        
        totalNetBalance += centerNetBalance;
        
        centerWiseOpening.push({
          center_id: center.office_center_id,
          center_name: center.office_center_name,
          opening_balance: centerNetBalance.toFixed(2),
          transaction_count: centerTransactions.length,
          last_updated: centerTransactions[centerTransactions.length - 1]?.date
        });
      }
      
      openingBalanceData = {
        total: totalNetBalance,
        net_investment: totalNetBalance,
        as_of_date: previousDayStr
      };
      
      runningBalance = totalNetBalance;
      totalInvestment = totalNetBalance;
    }

    // ===== FIXED: Get all payments in date range - filter by booking's from_center_id =====
    // First, get all bookings that match the center filter
    const bookingWhere = {
      booking_date: {
        [Op.between]: [startDate, endDate]
      },
      is_active: 1
    };
    
    if (centerId) {
      bookingWhere.from_center_id = centerId; // Filter by booking's origin center
    }
    
    const relevantBookings = await Booking.findAll({
      where: bookingWhere,
      attributes: ['booking_id']
    });
    
    const bookingIds = relevantBookings.map(b => b.booking_id);
    
    // Get payments for these bookings
    const paymentsWhere = {
      payment_date: {
        [Op.between]: [startDate, endDate]
      },
      is_active: 1,
      status: 'completed'
    };
    
    if (bookingIds.length > 0) {
      paymentsWhere.booking_id = { [Op.in]: bookingIds };
    } else if (centerId) {
      // No bookings found for this center, return empty result
      return {
        date_range: {
          start_date: startDate,
          end_date: endDate,
          opening_balance_as_of: previousDayStr
        },
        center: {
          id: centerId,
          // name: centerName?centerName:""
        },
        opening_balance: {
          total: openingBalanceData.total.toFixed(2),
          net_investment: openingBalanceData.net_investment.toFixed(2),
          as_of_date: previousDayStr,
          ...(centerId ? { 
            center_id: centerId, 
            // center_name: centerName?centerName:"", 
            last_updated: openingBalanceData.last_updated,
            transaction_count: openingBalanceData.transaction_count
          } : { 
            center_wise: centerWiseOpening 
          })
        },
        summary: {
          total_payments: 0,
          total_payment_amount: "0.00",
          total_expense_payments: 0,
          total_expense_amount: "0.00",
          operational_profit_loss: "0.00",
          total_investments: "0.00",
          total_withdrawals: "0.00",
          net_investment_change: "0.00",
          total_profit_loss: "0.00",
          profit_loss_status: 'profit',
          closing_balance: openingBalanceData.total.toFixed(2),
          closing_balance_as_of: endDate,
          unique_customers: 0,
          centers_involved: 0,
          days_in_range: 0
        },
        breakdown: {
          daily: [],
          by_payment_mode: [],
          by_expense_type: [],
          by_customer: [],
          by_center: [],
          // by_investment_center: Object.values(investmentsByCenter)
        },
        transactions: {
          payments: [],
          expenses: [],
          // investments: openingTransactions.map(ot => ({
          //   id: ot.opening_balance_id,
          //   date: ot.date,
          //   type: ot.in_out,
          //   amount: ot.opening_balance,
          //   notes: ot.notes,
          //   center: ot.officeCenter ? {
          //     id: ot.officeCenter.office_center_id,
          //     name: ot.officeCenter.office_center_name
          //   } : null
          // }))
        }
      };
    }

    const payments = await Payment.findAll({
      where: paymentsWhere,
      attributes: [
        'payment_id',
        'payment_number',
        [sequelize.col('Payment.amount'), 'amount'],
        'payment_date',
        'payment_mode',
        'payment_type',
        'booking_id',
        'customer_id',
        'description',
        'collected_at_center'
      ],
      include: [
        {
          model: Customer,
          as: 'customer',
          attributes: ['customer_id', 'customer_name', 'customer_number']
        },
        {
          model: Booking,
          as: 'booking',
          attributes: ['booking_id', 'booking_number', 'total_amount', 'due_amount', 'from_center_id', 'to_center_id'],
          include: [
            {
              model: Customer,
              as: 'fromCustomer',
              attributes: ['customer_id', 'customer_name', 'customer_number']
            },
            {
              model: Customer,
              as: 'toCustomer',
              attributes: ['customer_id', 'customer_name', 'customer_number']
            },
            {
              model: OfficeCenter,
              as: 'fromCenter',
              attributes: ['office_center_id', 'office_center_name']
            },
            {
              model: OfficeCenter,
              as: 'toCenter',
              attributes: ['office_center_id', 'office_center_name']
            }
          ]
        },
        {
          model: Employee,
          as: 'collector',
          attributes: ['employee_id', 'employee_name']
        },
        {
          model: OfficeCenter,
          as: 'collectionCenter',
          attributes: ['office_center_id', 'office_center_name']
        }
      ],
      order: [['payment_date', 'ASC']]
    });

    // ===== FIXED: Get all expense payments - filter by expense's office_center_id =====
    const expensePaymentsWhere = {
      payment_date: {
        [Op.between]: [startDate, endDate]
      },
      is_active: 1
    };

    const expensePayments = await ExpensePayment.findAll({
      where: expensePaymentsWhere,
      attributes: [
        'expense_payment_id',
        [sequelize.col('ExpensePayment.amount'), 'amount'],
        'payment_date',
        'payment_type',
        'notes'
      ],
      include: [
        {
          model: Expense,
          as: 'expense',
          attributes: ['expense_id', 'description', 'expense_type_id', 'office_center_id'],
          where: centerId ? { office_center_id: centerId } : {},
          required: centerId ? true : false, // Only require if filtering by center
          include: [
            {
              model: sequelize.models.expence_type,
              as: 'expenseType',
              attributes: ['expence_type_id', 'expence_type_name']
            },
            {
              model: OfficeCenter,
              as: 'officeCenter',
              attributes: ['office_center_id', 'office_center_name']
            }
          ]
        }
      ],
      order: [['payment_date', 'ASC']]
    });

    // Get opening balance transactions within the date range (for tracking investments/withdrawals)
    const openingTransactionsWhere = {
      date: {
        [Op.between]: [startDate, endDate]
      },
      is_active: 1
    };
    if (centerId) {
      openingTransactionsWhere.office_center_id = centerId;
    }
    
    const openingTransactions = await OpeningBalance.findAll({
      where: openingTransactionsWhere,
      attributes: [
        'opening_balance_id',
        'date',
        'office_center_id',
        'in_out',
        'opening_balance',
        'notes'
      ],
      include: [
        {
          model: OfficeCenter,
          as: 'officeCenter',
          attributes: ['office_center_id', 'office_center_name']
        }
      ],
      order: [['date', 'ASC']]
    });

    // Group by date with running balance calculation
    const allDates = [...new Set([
      ...payments.map(p => p.payment_date),
      ...expensePayments.map(ep => ep.payment_date),
      ...openingTransactions.map(ot => ot.date)
    ])].sort();

    const dailyBreakdown = {};
    let currentRunningBalance = runningBalance;
    let totalInvestments = 0;
    let totalWithdrawals = 0;

    for (const date of allDates) {
      const dayPayments = payments.filter(p => p.payment_date === date);
      const dayExpenses = expensePayments.filter(ep => ep.payment_date === date);
      const dayOpeningTrans = openingTransactions.filter(ot => ot.date === date);
      
      const dayPaymentTotal = dayPayments.reduce((sum, p) => sum + parseFloat(p.getDataValue('amount') || 0), 0);
      const dayExpenseTotal = dayExpenses.reduce((sum, ep) => sum + parseFloat(ep.getDataValue('amount') || 0), 0);
      
      // Calculate opening balance adjustments (IN/OUT)
      let dayInvestmentTotal = 0;
      let dayWithdrawalTotal = 0;
      const dayInvestments = []; 
      const dayWithdrawals = [];
      
      dayOpeningTrans.forEach(trans => {
        const amount = parseFloat(trans.opening_balance || 0);
        if (trans.in_out === 'IN') {
          dayInvestmentTotal += amount;
          dayInvestments.push({
            id: trans.opening_balance_id,
            amount: amount,
            notes: trans.notes
          });
        } else {
          dayWithdrawalTotal += amount;
          dayWithdrawals.push({
            id: trans.opening_balance_id,
            amount: amount,
            notes: trans.notes
          });
        }
      });
      
      totalInvestments += dayInvestmentTotal;
      totalWithdrawals += dayWithdrawalTotal;
      
      // Net change = payments - expenses + investments - withdrawals
      const dayNet = dayPaymentTotal - dayExpenseTotal + dayInvestmentTotal - dayWithdrawalTotal;
      const dayOpeningBalance = currentRunningBalance;
      const dayClosingBalance = dayOpeningBalance + dayNet;
      
      dailyBreakdown[date] = {
        date,
        opening_balance: dayOpeningBalance.toFixed(2),
        payments: dayPayments.length,
        payment_total: dayPaymentTotal.toFixed(2),
        expenses: dayExpenses.length,
        expense_total: dayExpenseTotal.toFixed(2),
        investments: dayInvestments.length,
        investment_total: dayInvestmentTotal.toFixed(2),
        withdrawals: dayWithdrawals.length,
        withdrawal_total: dayWithdrawalTotal.toFixed(2),
        net_change: dayNet.toFixed(2),
        closing_balance: dayClosingBalance.toFixed(2),
        investment_details: dayInvestments,
        withdrawal_details: dayWithdrawals
      };
      
      // Update running balance for next day
      currentRunningBalance = dayClosingBalance;
    }

    // Calculate totals
    const totalPayments = payments.reduce((sum, p) => sum + parseFloat(p.getDataValue('amount') || 0), 0);
    const totalExpenses = expensePayments.reduce((sum, ep) => sum + parseFloat(ep.getDataValue('amount') || 0), 0);
    const operationalProfitLoss = totalPayments - totalExpenses;
    const netInvestmentChange = totalInvestments - totalWithdrawals;
    const totalProfitLoss = operationalProfitLoss + netInvestmentChange;
    const finalClosingBalance = runningBalance + totalProfitLoss;

    // Group by expense type
    const expenseByType = {};
    expensePayments.forEach(ep => {
      const typeName = ep.expense?.expenseType?.expence_type_name || 'Other';
      if (!expenseByType[typeName]) {
        expenseByType[typeName] = {
          type: typeName,
          total: 0,
          count: 0
        };
      }
      expenseByType[typeName].total += parseFloat(ep.getDataValue('amount') || 0);
      expenseByType[typeName].count += 1;
    });

    // Group payments by mode
    const paymentsByMode = {};
    payments.forEach(p => {
      const mode = p.payment_mode || 'other';
      if (!paymentsByMode[mode]) {
        paymentsByMode[mode] = {
          mode,
          total: 0,
          count: 0
        };
      }
      paymentsByMode[mode].total += parseFloat(p.getDataValue('amount') || 0);
      paymentsByMode[mode].count += 1;
    });

    // Group payments by customer
    const paymentsByCustomer = {};
    payments.forEach(p => {
      const customerId = p.customer?.customer_id || 'unknown';
      const customerName = p.customer?.customer_name || 'Unknown Customer';
      
      if (!paymentsByCustomer[customerId]) {
        paymentsByCustomer[customerId] = {
          customer_id: customerId,
          customer_name: customerName,
          customer_number: p.customer?.customer_number,
          total_amount: 0,
          payment_count: 0,
          payments: []
        };
      }
      
      const amount = parseFloat(p.getDataValue('amount') || 0);
      paymentsByCustomer[customerId].total_amount += amount;
      paymentsByCustomer[customerId].payment_count += 1;
      paymentsByCustomer[customerId].payments.push({
        payment_id: p.payment_id,
        payment_number: p.payment_number,
        amount: amount,
        date: p.payment_date,
        mode: p.payment_mode,
        booking_number: p.booking?.booking_number,
        booking_center: p.booking?.fromCenter?.office_center_name
      });
    });

    // Group payments by booking center
    const paymentsByBookingCenter = {};
    payments.forEach(p => {
      const centerId = p.booking?.from_center_id || 'unknown';
      const centerName = p.booking?.fromCenter?.office_center_name || 'Unknown Center';
      
      if (!paymentsByBookingCenter[centerId]) {
        paymentsByBookingCenter[centerId] = {
          center_id: centerId,
          center_name: centerName,
          total_amount: 0,
          payment_count: 0,
          bookings: new Set()
        };
      }
      
      paymentsByBookingCenter[centerId].total_amount += parseFloat(p.getDataValue('amount') || 0);
      paymentsByBookingCenter[centerId].payment_count += 1;
      if (p.booking?.booking_id) {
        paymentsByBookingCenter[centerId].bookings.add(p.booking.booking_id);
      }
    });

    // Convert Set to count for each center
    Object.values(paymentsByBookingCenter).forEach(center => {
      center.unique_bookings = center.bookings.size;
      delete center.bookings;
    });

    // Group investments/withdrawals by center
    const investmentsByCenter = {};
    openingTransactions.forEach(ot => {
      const cId = ot.office_center_id;
      const centerName = ot.officeCenter?.office_center_name || 'Unknown Center';
      
      if (!investmentsByCenter[cId]) {
        investmentsByCenter[cId] = {
          center_id: cId,
          center_name: centerName,
          total_investments: 0,
          total_withdrawals: 0,
          net_investment: 0,
          transactions: []
        };
      }
      
      const amount = parseFloat(ot.opening_balance || 0);
      if (ot.in_out === 'IN') {
        investmentsByCenter[cId].total_investments += amount;
        investmentsByCenter[cId].net_investment += amount;
      } else {
        investmentsByCenter[cId].total_withdrawals += amount;
        investmentsByCenter[cId].net_investment -= amount;
      }
      
      investmentsByCenter[cId].transactions.push({
        id: ot.opening_balance_id,
        date: ot.date,
        type: ot.in_out,
        amount: amount,
        notes: ot.notes
      });
    });

    // Get center name for response
    let centerName = 'All Centers';
    if (centerId) {
      const center = await OfficeCenter.findOne({ 
        where: { office_center_id: centerId }, 
        attributes: ['office_center_id', 'office_center_name'] 
      });
      centerName = center?.office_center_name || 'Unknown Center';
    }

    return {
      date_range: {
        start_date: startDate,
        end_date: endDate,
        opening_balance_as_of: previousDayStr
      },
      center: {
        id: centerId,
        name: centerName
      },
      opening_balance: {
        total: openingBalanceData.total.toFixed(2),
        net_investment: openingBalanceData.net_investment.toFixed(2),
        as_of_date: previousDayStr,
        ...(centerId ? { 
          center_id: centerId, 
          center_name: centerName, 
          last_updated: openingBalanceData.last_updated,
          transaction_count: openingBalanceData.transaction_count
        } : { 
          center_wise: centerWiseOpening 
        })
      },
      summary: {
        total_payments: payments.length,
        total_payment_amount: totalPayments.toFixed(2),
        total_expense_payments: expensePayments.length,
        total_expense_amount: totalExpenses.toFixed(2),
        operational_profit_loss: operationalProfitLoss.toFixed(2),
        total_investments: totalInvestments.toFixed(2),
        total_withdrawals: totalWithdrawals.toFixed(2),
        net_investment_change: netInvestmentChange.toFixed(2),
        total_profit_loss: totalProfitLoss.toFixed(2),
        profit_loss_status: totalProfitLoss >= 0 ? 'profit' : 'loss',
        closing_balance: finalClosingBalance.toFixed(2),
        closing_balance_as_of: endDate,
        unique_customers: Object.keys(paymentsByCustomer).length,
        centers_involved: Object.keys(paymentsByBookingCenter).length,
        days_in_range: allDates.length
      },
      breakdown: {
        daily: Object.values(dailyBreakdown),
        by_payment_mode: Object.values(paymentsByMode),
        by_expense_type: Object.values(expenseByType),
        by_customer: Object.values(paymentsByCustomer),
        by_booking_center: Object.values(paymentsByBookingCenter),
        by_investment_center: Object.values(investmentsByCenter)
      },
      transactions: {
        payments: payments.map(p => ({
          payment_id: p.payment_id,
          payment_number: p.payment_number,
          date: p.payment_date,
          amount: p.getDataValue('amount'),
          mode: p.payment_mode,
          type: p.payment_type,
          description: p.description,
          collection_center: p.collectionCenter ? {
            id: p.collectionCenter.office_center_id,
            name: p.collectionCenter.office_center_name
          } : null,
          booking_center: p.booking?.fromCenter ? {
            id: p.booking.fromCenter.office_center_id,
            name: p.booking.fromCenter.office_center_name
          } : null,
          customer: p.customer ? {
            id: p.customer.customer_id,
            name: p.customer.customer_name,
            number: p.customer.customer_number
          } : null,
          booking: p.booking ? {
            id: p.booking.booking_id,
            number: p.booking.booking_number,
            total_amount: p.booking.total_amount,
            due_amount: p.booking.due_amount
          } : null,
          collector: p.collector ? {
            id: p.collector.employee_id,
            name: p.collector.employee_name
          } : null
        })),
        expenses: expensePayments.map(ep => ({
          expense_payment_id: ep.expense_payment_id,
          date: ep.payment_date,
          type: ep.expense?.expenseType?.expence_type_name,
          amount: ep.getDataValue('amount'),
          description: ep.expense?.description,
          notes: ep.notes,
          payment_type: ep.payment_type,
          center: ep.expense?.officeCenter ? {
            id: ep.expense.officeCenter.office_center_id,
            name: ep.expense.officeCenter.office_center_name
          } : null
        })),
        investments: openingTransactions.map(ot => ({
          id: ot.opening_balance_id,
          date: ot.date,
          type: ot.in_out,
          amount: ot.opening_balance,
          notes: ot.notes,
          center: ot.officeCenter ? {
            id: ot.officeCenter.office_center_id,
            name: ot.officeCenter.office_center_name
          } : null
        }))
      }
    };
  } catch (error) {
    console.error("Error in getDateRangeProfitLoss:", error);
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

// =============================================
// PACKAGE REPORT
// =============================================

/**
 * Get package report with filters
 */
async function getPackageReport(filters = {}) {
  try {
    const {
      startDate,
      endDate,
      centerId,
      packageTypeId,
      customerId,
      status,
      page = 1,
      limit = 20
    } = filters;

    const offset = (page - 1) * limit;

    // Build where clause for bookings
    const bookingWhere = { is_active: 1 };
    if (startDate && endDate) {
      bookingWhere.booking_date = {
        [Op.between]: [startDate, endDate]
      };
    }
    if (centerId) {
      bookingWhere[Op.or] = [
        { from_center_id: centerId },
        { to_center_id: centerId }
      ];
    }
    if (customerId) {
      bookingWhere[Op.or] = [
        { from_customer_id: customerId },
        { to_customer_id: customerId }
      ];
    }
    if (status) {
      bookingWhere.delivery_status = status;
    }

    // Get packages with their bookings
    const packages = await BookingPackage.findAndCountAll({
      where: { is_active: 1 },
      attributes: [
        'booking_package_id',
        'package_type_id',
        'quantity',
        'pickup_charge',
        'drop_charge',
        'handling_charge',
        'total_package_charge',
        'created_at'
      ],
      include: [
        {
          model: Booking,
          as: 'booking',
          where: bookingWhere,
          attributes: [
            'booking_id',
            'booking_number',
            'booking_date',
            'from_center_id',
            'to_center_id',
            'from_customer_id',
            'to_customer_id',
            'delivery_status'
          ],
          include: [
            {
              model: OfficeCenter,
              as: 'fromCenter',
              attributes: ['office_center_id', 'office_center_name']
            },
            {
              model: OfficeCenter,
              as: 'toCenter',
              attributes: ['office_center_id', 'office_center_name']
            },
            {
              model: Customer,
              as: 'fromCustomer',
              attributes: ['customer_id', 'customer_name', 'customer_number']
            },
            {
              model: Customer,
              as: 'toCustomer',
              attributes: ['customer_id', 'customer_name', 'customer_number']
            }
          ]
        },
        {
          model: sequelize.models.PackageType,
          as: 'packageType',
          where: packageTypeId ? { package_type_id: packageTypeId } : {},
          attributes: ['package_type_id', 'package_type_name']
        }
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset,
      distinct: true
    });

    // Calculate summary statistics
    const totalPickupCharges = packages.rows.reduce((sum, p) => sum + parseFloat(p.pickup_charge || 0) * p.quantity, 0);
    const totalDropCharges = packages.rows.reduce((sum, p) => sum + parseFloat(p.drop_charge || 0) * p.quantity, 0);
    const totalHandlingCharges = packages.rows.reduce((sum, p) => sum + parseFloat(p.handling_charge || 0) * p.quantity, 0);
    const totalAmount = packages.rows.reduce((sum, p) => sum + parseFloat(p.total_package_charge || 0), 0);
    const totalQuantity = packages.rows.reduce((sum, p) => sum + p.quantity, 0);

    // Group by package type
    const byPackageType = {};
    packages.rows.forEach(pkg => {
      const typeId = pkg.packageType?.package_type_id;
      const typeName = pkg.packageType?.package_type_name || 'Unknown';
      if (!byPackageType[typeId]) {
        byPackageType[typeId] = {
          package_type_id: typeId,
          package_type_name: typeName,
          count: 0,
          quantity: 0,
          total_amount: 0
        };
      }
      byPackageType[typeId].count += 1;
      byPackageType[typeId].quantity += pkg.quantity;
      byPackageType[typeId].total_amount += parseFloat(pkg.total_package_charge || 0);
    });

    return {
      summary: {
        total_packages: packages.count,
        total_quantity: totalQuantity,
        total_pickup_charges: totalPickupCharges.toFixed(2),
        total_drop_charges: totalDropCharges.toFixed(2),
        total_handling_charges: totalHandlingCharges.toFixed(2),
        total_amount: totalAmount.toFixed(2),
        average_per_package: packages.count > 0 ? (totalAmount / packages.count).toFixed(2) : 0
      },
      by_package_type: Object.values(byPackageType),
      packages: packages.rows,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(packages.count / limit),
        total_records: packages.count,
        limit
      }
    };
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

// =============================================
// TRIP REPORT
// =============================================

/**
 * Get trip report with filters
 */
async function getTripReport(filters = {}) {
  try {
    const {
      startDate,
      endDate,
      centerId,
      driverId,
      vehicleId,
      status,
      page = 1,
      limit = 20
    } = filters;

    const offset = (page - 1) * limit;

    const whereClause = { is_active: 1 };
    
    if (startDate && endDate) {
      whereClause.trip_date = {
        [Op.between]: [startDate, endDate]
      };
    }
    if (centerId) {
      whereClause[Op.or] = [
        { from_center_id: centerId },
        { to_center_id: centerId }
      ];
    }
    if (driverId) {
      whereClause.driver_id = driverId;
    }
    if (vehicleId) {
      whereClause.vehicle_id = vehicleId;
    }
    if (status) {
      whereClause.status = status;
    }

    const trips = await Trip.findAndCountAll({
      where: whereClause,
      attributes: [
        'trip_id',
        'trip_number',
        'trip_date',
        'from_center_id',
        'to_center_id',
        'vehicle_id',
        'driver_id',
        'estimated_departure',
        'estimated_arrival',
        'actual_departure',
        'actual_arrival',
        'status',
        'total_packages',
        'total_amount',
        'created_at'
      ],
      include: [
        {
          model: OfficeCenter,
          as: 'fromCenter',
          attributes: ['office_center_id', 'office_center_name']
        },
        {
          model: OfficeCenter,
          as: 'toCenter',
          attributes: ['office_center_id', 'office_center_name']
        },
        {
          model: Vehicle,
          as: 'vehicle',
          attributes: ['vehicle_id', 'vehicle_number_plate']
        },
        {
          model: Employee,
          as: 'driver',
          attributes: ['employee_id', 'employee_name', 'mobile_no']
        },
        {
          model: Employee,
          as: 'loadmen',
          through: { attributes: [] },
          attributes: ['employee_id', 'employee_name']
        },
        {
          model: Booking,
          as: 'bookings',
          through: { attributes: [] },
          attributes: ['booking_id', 'booking_number']
        }
      ],
      order: [['trip_date', 'DESC'], ['created_at', 'DESC']],
      limit,
      offset,
      distinct: true
    });

    // Calculate summary statistics
    const totalTrips = trips.count;
    const totalPackages = trips.rows.reduce((sum, t) => sum + (t.total_packages || 0), 0);
    const totalAmount = trips.rows.reduce((sum, t) => sum + parseFloat(t.total_amount || 0), 0);
    
    const statusCount = {
      scheduled: trips.rows.filter(t => t.status === 'scheduled').length,
      in_progress: trips.rows.filter(t => t.status === 'in_progress').length,
      completed: trips.rows.filter(t => t.status === 'completed').length,
      cancelled: trips.rows.filter(t => t.status === 'cancelled').length
    };

    // Group by center
    const byCenter = {};
    trips.rows.forEach(trip => {
      const centerId = trip.from_center_id;
      const centerName = trip.fromCenter?.office_center_name || 'Unknown';
      if (!byCenter[centerId]) {
        byCenter[centerId] = {
          center_id: centerId,
          center_name: centerName,
          trip_count: 0,
          package_count: 0,
          total_amount: 0
        };
      }
      byCenter[centerId].trip_count += 1;
      byCenter[centerId].package_count += trip.total_packages || 0;
      byCenter[centerId].total_amount += parseFloat(trip.total_amount || 0);
    });

    return {
      summary: {
        total_trips: totalTrips,
        total_packages: totalPackages,
        total_amount: totalAmount.toFixed(2),
        average_packages_per_trip: totalTrips > 0 ? (totalPackages / totalTrips).toFixed(2) : 0,
        average_amount_per_trip: totalTrips > 0 ? (totalAmount / totalTrips).toFixed(2) : 0,
        by_status: statusCount
      },
      by_center: Object.values(byCenter),
      trips: trips.rows,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(totalTrips / limit),
        total_records: totalTrips,
        limit
      }
    };
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

// =============================================
// OPENING & CLOSING BALANCE REPORT
// =============================================

/**
 * Get opening and closing balance report
 */
async function getBalanceReport1(filters = {}) {
  try {
    const {
      startDate,
      endDate,
      centerId,
      page = 1,
      limit = 31 // Default to month view
    } = filters;

    const offset = (page - 1) * limit;

    // Get all opening balances in date range
    const openingBalancesWhere = {
      date: {
        [Op.between]: [startDate, endDate]
      },
      is_active: 1
    };
    if (centerId) {
      openingBalancesWhere.office_center_id = centerId;
    }

    const openingBalances = await OpeningBalance.findAll({
      where: openingBalancesWhere,
      attributes: [
        'opening_balance_id',
        'date',
        'office_center_id',
        'opening_balance',
        'notes'
      ],
      include: [
        {
          model: OfficeCenter,
          as: 'officeCenter',
          attributes: ['office_center_id', 'office_center_name']
        }
      ],
      order: [['date', 'ASC']]
    });

    // If no opening balances, create default for each day
    const dates = [];
    let currentDate = new Date(startDate);
    const endDateTime = new Date(endDate);
    
    while (currentDate <= endDateTime) {
      dates.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Get daily transactions
    const dailyData = [];
    
    for (const date of dates) {
      const openingBal = openingBalances.find(ob => ob.date === date);
      
      // Get payments for this date
      const payments = await Payment.sum('amount', {
        where: {
          payment_date: date,
          is_active: 1,
          status: 'completed',
          ...(centerId && { collected_at_center: centerId })
        }
      });

      // Get expenses for this date
      const expenses = await ExpensePayment.sum('amount', {
        where: {
          payment_date: date,
          is_active: 1,
          ...(centerId && {
            '$expense.office_center_id$': centerId
          })
        },
        include: [
          {
            model: Expense,
            as: 'expense',
            attributes: []
          }
        ]
      });

      const openingAmount = parseFloat(openingBal?.opening_balance || 0);
      const paymentTotal = parseFloat(payments || 0);
      const expenseTotal = parseFloat(expenses || 0);
      const netChange = paymentTotal - expenseTotal;
      const closingAmount = openingAmount + netChange;

      dailyData.push({
        date,
        center_id: centerId,
        center_name: centerId ? openingBal?.officeCenter?.office_center_name : 'All Centers',
        opening_balance: openingAmount.toFixed(2),
        payments: paymentTotal.toFixed(2),
        expenses: expenseTotal.toFixed(2),
        net_change: netChange.toFixed(2),
        closing_balance: closingAmount.toFixed(2),
        has_opening_entry: !!openingBal
      });
    }

    // Calculate summary
    const totalOpening = dailyData.reduce((sum, d) => sum + parseFloat(d.opening_balance), 0);
    const totalPayments = dailyData.reduce((sum, d) => sum + parseFloat(d.payments), 0);
    const totalExpenses = dailyData.reduce((sum, d) => sum + parseFloat(d.expenses), 0);
    const totalClosing = dailyData.reduce((sum, d) => sum + parseFloat(d.closing_balance), 0);

    // Get paginated data
    const paginatedData = dailyData.slice(offset, offset + limit);

    return {
      summary: {
        total_opening: totalOpening.toFixed(2),
        total_payments: totalPayments.toFixed(2),
        total_expenses: totalExpenses.toFixed(2),
        total_closing: totalClosing.toFixed(2),
        net_profit_loss: (totalPayments - totalExpenses).toFixed(2),
        days_covered: dailyData.length
      },
      daily_data: paginatedData,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(dailyData.length / limit),
        total_records: dailyData.length,
        limit
      }
    };
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}
async function getBalanceReport(filters = {}) {
  try {
    const {
      startDate,
      endDate,
      centerId,
      page = 1,
      limit = 31 // Default to month view
    } = filters;

    const offset = (page - 1) * limit;

    // Get all opening balances in date range
    const openingBalancesWhere = {
      date: {
        [Op.between]: [startDate, endDate]
      },
      is_active: 1
    };
    if (centerId) {
      openingBalancesWhere.office_center_id = centerId;
    }

    const openingBalances = await OpeningBalance.findAll({
      where: openingBalancesWhere,
      attributes: [
        'opening_balance_id',
        'date',
        'office_center_id',
        'opening_balance',
        'notes'
      ],
      include: [
        {
          model: OfficeCenter,
          as: 'officeCenter',
          attributes: ['office_center_id', 'office_center_name']
        }
      ],
      order: [['date', 'ASC']]
    });

    // If no opening balances, create default for each day
    const dates = [];
    let currentDate = new Date(startDate);
    const endDateTime = new Date(endDate);
    
    while (currentDate <= endDateTime) {
      dates.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Get daily transactions
    const dailyData = [];
    
    for (const date of dates) {
      const openingBal = openingBalances.find(ob => ob.date === date);
      
      // Get payments for this date
      const payments = await Payment.sum('amount', {
        where: {
          payment_date: date,
          is_active: 1,
          status: 'completed',
          ...(centerId && { collected_at_center: centerId })
        }
      });

      // FIXED: Get expenses for this date - use a different approach to avoid ambiguity
      let expenseTotal = 0;
      
      if (centerId) {
        // If center filter is applied, we need to join with Expense
        const expensePayments = await ExpensePayment.findAll({
          where: {
            payment_date: date,
            is_active: 1
          },
          attributes: ['amount'],
          include: [
            {
              model: Expense,
              as: 'expense',
              where: { office_center_id: centerId, is_active: 1 },
              attributes: [], // Don't fetch any attributes
              required: true // INNER JOIN to ensure only matching records
            }
          ]
        });
        
        expenseTotal = expensePayments.reduce((sum, ep) => sum + parseFloat(ep.amount || 0), 0);
      } else {
        // No center filter - simpler query
        expenseTotal = await ExpensePayment.sum('amount', {
          where: {
            payment_date: date,
            is_active: 1
          }
        }) || 0;
      }

      const openingAmount = parseFloat(openingBal?.opening_balance || 0);
      const paymentTotal = parseFloat(payments || 0);
      const expenseTotal_float = parseFloat(expenseTotal || 0);
      const netChange = paymentTotal - expenseTotal_float;
      const closingAmount = openingAmount + netChange;

      dailyData.push({
        date,
        center_id: centerId,
        center_name: centerId ? openingBal?.officeCenter?.office_center_name : 'All Centers',
        opening_balance: openingAmount.toFixed(2),
        payments: paymentTotal.toFixed(2),
        expenses: expenseTotal_float.toFixed(2),
        net_change: netChange.toFixed(2),
        closing_balance: closingAmount.toFixed(2),
        has_opening_entry: !!openingBal
      });
    }

    // Calculate summary
    const totalOpening = dailyData.reduce((sum, d) => sum + parseFloat(d.opening_balance), 0);
    const totalPayments = dailyData.reduce((sum, d) => sum + parseFloat(d.payments), 0);
    const totalExpenses = dailyData.reduce((sum, d) => sum + parseFloat(d.expenses), 0);
    const totalClosing = dailyData.reduce((sum, d) => sum + parseFloat(d.closing_balance), 0);

    // Get paginated data
    const paginatedData = dailyData.slice(offset, offset + limit);

    return {
      summary: {
        total_opening: totalOpening.toFixed(2),
        total_payments: totalPayments.toFixed(2),
        total_expenses: totalExpenses.toFixed(2),
        total_closing: totalClosing.toFixed(2),
        net_profit_loss: (totalPayments - totalExpenses).toFixed(2),
        days_covered: dailyData.length
      },
      daily_data: paginatedData,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(dailyData.length / limit),
        total_records: dailyData.length,
        limit
      }
    };
  } catch (error) {
    console.error("Error in getBalanceReport:", error);
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}
// =============================================
// DASHBOARD STATISTICS
// =============================================

/**
 * Get dashboard statistics
 */
async function getDashboardStats(centerId = null) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    const monthStart = startOfMonth.toISOString().split('T')[0];
    
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const weekStart = startOfWeek.toISOString().split('T')[0];

    // Common where conditions
    const bookingWhere = { is_active: 1 };
    const tripWhere = { is_active: 1 };
    const paymentWhere = { is_active: 1, status: 'completed' };
    
    if (centerId) {
      bookingWhere[Op.or] = [
        { from_center_id: centerId },
        { to_center_id: centerId }
      ];
      tripWhere[Op.or] = [
        { from_center_id: centerId },
        { to_center_id: centerId }
      ];
      paymentWhere.collected_at_center = centerId;
    }

    // Today's statistics
    const todayBookings = await Booking.count({
      where: {
        ...bookingWhere,
        booking_date: today
      }
    });

    const todayTrips = await Trip.count({
      where: {
        ...tripWhere,
        trip_date: today
      }
    });

    const todayPayments = await Payment.sum('amount', {
      where: {
        ...paymentWhere,
        payment_date: today
      }
    });

    // Week statistics
    const weekBookings = await Booking.count({
      where: {
        ...bookingWhere,
        booking_date: {
          [Op.between]: [weekStart, today]
        }
      }
    });

    const weekPayments = await Payment.sum('amount', {
      where: {
        ...paymentWhere,
        payment_date: {
          [Op.between]: [weekStart, today]
        }
      }
    });

    // Month statistics
    const monthBookings = await Booking.count({
      where: {
        ...bookingWhere,
        booking_date: {
          [Op.between]: [monthStart, today]
        }
      }
    });

    const monthTrips = await Trip.count({
      where: {
        ...tripWhere,
        trip_date: {
          [Op.between]: [monthStart, today]
        }
      }
    });

    const monthPayments = await Payment.sum('amount', {
      where: {
        ...paymentWhere,
        payment_date: {
          [Op.between]: [monthStart, today]
        }
      }
    });

    // Status counts
    const bookingStatus = await Booking.findAll({
      where: bookingWhere,
      attributes: [
        'delivery_status',
        [fn('COUNT', col('delivery_status')), 'count']
      ],
      group: ['delivery_status']
    });

    const tripStatus = await Trip.findAll({
      where: tripWhere,
      attributes: [
        'status',
        [fn('COUNT', col('status')), 'count']
      ],
      group: ['status']
    });

    // Upcoming trips
    const upcomingTrips = await Trip.findAll({
      where: {
        ...tripWhere,
        trip_date: {
          [Op.gte]: today
        },
        status: 'scheduled'
      },
      attributes: [
        'trip_id',
        'trip_number',
        'trip_date',
        'from_center_id',
        'to_center_id',
        'total_packages'
      ],
      include: [
        {
          model: OfficeCenter,
          as: 'fromCenter',
          attributes: ['office_center_name']
        },
        {
          model: OfficeCenter,
          as: 'toCenter',
          attributes: ['office_center_name']
        }
      ],
      limit: 10,
      order: [['trip_date', 'ASC']]
    });

    // Recent payments
    const recentPayments = await Payment.findAll({
      where: paymentWhere,
      attributes: [
        'payment_id',
        'payment_number',
        'amount',
        'payment_date',
        'payment_mode'
      ],
      include: [
        {
          model: Booking,
          as: 'booking',
          attributes: ['booking_number']
        }
      ],
      limit: 10,
      order: [['payment_date', 'DESC'], ['created_at', 'DESC']]
    });

    // Top customers
    const topCustomers = await Booking.findAll({
      where: bookingWhere,
      attributes: [
        'from_customer_id',
        [fn('COUNT', col('booking_id')), 'booking_count'],
        [fn('SUM', col('total_amount')), 'total_amount']
      ],
      include: [
        {
          model: Customer,
          as: 'fromCustomer',
          attributes: ['customer_name', 'customer_number']
        }
      ],
      group: ['from_customer_id'],
      order: [[literal('total_amount'), 'DESC']],
      limit: 5
    });

    return {
      date: today,
      center_id: centerId,
      center_name: centerId ? (await OfficeCenter.findOne({
      where: { office_center_id:centerId},
      attributes: [
        'office_center_id',
        'office_center_name',
        'is_active',
        'created_at',
        'updated_at'
      ]
    }))?.office_center_name : 'All Centers',
      today: {
        bookings: todayBookings,
        trips: todayTrips,
        payments: parseFloat(todayPayments || 0).toFixed(2)
      },
      this_week: {
        bookings: weekBookings,
        payments: parseFloat(weekPayments || 0).toFixed(2)
      },
      this_month: {
        bookings: monthBookings,
        trips: monthTrips,
        payments: parseFloat(monthPayments || 0).toFixed(2)
      },
      status_breakdown: {
        bookings: bookingStatus.reduce((acc, curr) => {
          acc[curr.delivery_status] = parseInt(curr.dataValues.count);
          return acc;
        }, {}),
        trips: tripStatus.reduce((acc, curr) => {
          acc[curr.status] = parseInt(curr.dataValues.count);
          return acc;
        }, {})
      },
      upcoming_trips: upcomingTrips,
      recent_payments: recentPayments,
      top_customers: topCustomers.map(c => ({
        customer_id: c.from_customer_id,
        customer_name: c.fromCustomer?.customer_name,
        customer_number: c.fromCustomer?.customer_number,
        booking_count: c.dataValues.booking_count,
        total_amount: parseFloat(c.dataValues.total_amount || 0).toFixed(2)
      }))
    };
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

// =============================================
// BOOKING WITH TRIP, DRIVER, AND PAYMENT DETAILS
// =============================================

/**
 * Get booking details with complete information
 */
async function getBookingWithDetails(bookingId, options = {}) {
  try {
    const {
      includeTrip = true,
      includePayments = true,
      includePackages = true
    } = options;
    
    // Build include array
    const include = [
      {
        model: OfficeCenter,
        as: 'fromCenter',
        attributes: ['office_center_id', 'office_center_name']
      },
      {
        model: OfficeCenter,
        as: 'toCenter',
        attributes: ['office_center_id', 'office_center_name']
      },
      {
        model: Location,
        as: 'fromLocation',
        attributes: ['location_id', 'location_name']
      },
      {
        model: Location,
        as: 'toLocation',
        attributes: ['location_id', 'location_name']
      },
      {
        model: Customer,
        as: 'fromCustomer',
        attributes: ['customer_id', 'customer_name', 'customer_number']
      },
      {
        model: Customer,
        as: 'toCustomer',
        attributes: ['customer_id', 'customer_name', 'customer_number']
      }
    ];
    
    // Include packages if requested
    if (includePackages) {
      include.push({
        model: BookingPackage,
        as: 'packages',
        where: { is_active: 1 },
        required: false,
        attributes: [
          'booking_package_id',
          'package_type_id',
          'quantity',
          'pickup_charge',
          'drop_charge',
          'handling_charge',
          'total_package_charge'
        ],
        include: [
          {
            model: PackageType,
            as: 'packageType',
            attributes: ['package_type_id', 'package_type_name']
          }
        ]
      });
    }
    
    // Include payments if requested
    if (includePayments) {
      include.push({
        model: Payment,
        as: 'payments',
        where: { is_active: 1 },
        required: false,
        attributes: [
          'payment_id',
          'payment_number',
          'amount',
          'payment_date',
          'payment_mode',
          'payment_type',
          'status',
          'description'
        ],
        include: [
          {
            model: Employee,
            as: 'collector',
            attributes: ['employee_id', 'employee_name']
          },
          {
            model: OfficeCenter,
            as: 'collectionCenter',
            attributes: ['office_center_id', 'office_center_name']
          }
        ],
        order: [['payment_date', 'DESC']]
      });
    }
    
    // Get the booking
    const booking = await Booking.findOne({
      where: { 
        booking_id: bookingId, 
        is_active: 1 
      },
      attributes: [
        'booking_id',
        'booking_number',
        'llr_number',
        'booking_date',
        'from_center_id',
        'to_center_id',
        'from_location_id',
        'to_location_id',
        'from_customer_id',
        'to_customer_id',
        'total_amount',
        'paid_amount',
        'due_amount',
        'payment_by',
        'payment_status',
        'delivery_status',
        'actual_delivery_date',
        'special_instructions',
        'reference_number',
        'created_at',
        'updated_at'
      ],
      include
    });
    
    if (!booking) {
      throw new Error(messages.DATA_NOT_FOUND);
    }
    
    // Convert to JSON for manipulation
    const bookingJson = booking.toJSON();
    
    // Find trip information if requested
    if (includeTrip) {
      // Find which trip this booking is assigned to
      const tripBooking = await TripBooking.findOne({
        where: { 
          booking_id: bookingId,
          is_active: 1 
        },
        include: [
          {
            model: Trip,
            as: 'trip',
            attributes: [
              'trip_id',
              'trip_number',
              'trip_date',
              'from_center_id',
              'to_center_id',
              'estimated_departure',
              'estimated_arrival',
              'actual_departure',
              'actual_arrival',
              'status',
              'remarks',
              'total_packages',
              'total_amount'
            ],
            include: [
              {
                model: Vehicle,
                as: 'vehicle',
                attributes: ['vehicle_id', 'vehicle_number_plate']
              },
              {
                model: Employee,
                as: 'driver',
                attributes: ['employee_id', 'employee_name', 'mobile_no']
              },
              {
                model: Employee,
                as: 'loadmen',
                through: { attributes: [] },
                attributes: ['employee_id', 'employee_name', 'mobile_no']
              },
              {
                model: OfficeCenter,
                as: 'fromCenter',
                attributes: ['office_center_id', 'office_center_name']
              },
              {
                model: OfficeCenter,
                as: 'toCenter',
                attributes: ['office_center_id', 'office_center_name']
              }
            ]
          }
        ]
      });
      
      if (tripBooking) {
        bookingJson.trip = {
          ...tripBooking.trip.toJSON(),
          delivery_status_in_trip: tripBooking.delivery_status
        };
      } else {
        bookingJson.trip = null;
      }
    }
    
    // Calculate payment summary
    if (bookingJson.payments && bookingJson.payments.length > 0) {
      const totalPayments = bookingJson.payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
      const paymentsByMode = {};
      
      bookingJson.payments.forEach(p => {
        const mode = p.payment_mode || 'other';
        if (!paymentsByMode[mode]) {
          paymentsByMode[mode] = {
            mode,
            total: 0,
            count: 0
          };
        }
        paymentsByMode[mode].total += parseFloat(p.amount || 0);
        paymentsByMode[mode].count += 1;
      });
      
      bookingJson.payment_summary = {
        total_payments: bookingJson.payments.length,
        total_amount: totalPayments.toFixed(2),
        by_mode: Object.values(paymentsByMode),
        last_payment_date: bookingJson.payments[0]?.payment_date
      };
    } else {
      bookingJson.payment_summary = {
        total_payments: 0,
        total_amount: "0.00",
        by_mode: [],
        last_payment_date: null
      };
    }
    
    return bookingJson;
    
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

/**
 * Get all bookings with optional filters and include trip/driver/payment details
 */
async function getAllBookingsWithDetails(filters = {}) {
  try {
    const {
      startDate,
      endDate,
      centerId,
      customerId,
      status,
      paymentStatus,
      tripStatus,
      search,
      page = 1,
      limit = 20,
      includeTrip = true,
      includePayments = true
    } = filters;
    
    const offset = (page - 1) * limit;
    
    // Build where clause
    const whereClause = { is_active: 1 };
    
    if (startDate && endDate) {
      whereClause.booking_date = {
        [Op.between]: [startDate, endDate]
      };
    } else if (startDate) {
      whereClause.booking_date = {
        [Op.gte]: startDate
      };
    } else if (endDate) {
      whereClause.booking_date = {
        [Op.lte]: endDate
      };
    }
    
    if (centerId) {
      whereClause[Op.or] = [
        { from_center_id: centerId },
        { to_center_id: centerId }
      ];
    }
    
    if (customerId) {
      whereClause[Op.or] = [
        { from_customer_id: customerId },
        { to_customer_id: customerId }
      ];
    }
    
    if (status) {
      whereClause.delivery_status = status;
    }
    
    if (paymentStatus) {
      whereClause.payment_status = paymentStatus;
    }
    
    if (search) {
      whereClause[Op.or] = [
        { booking_number: { [Op.like]: `%${search}%` } },
        { llr_number: { [Op.like]: `%${search}%` } },
        { reference_number: { [Op.like]: `%${search}%` } }
      ];
    }
    
    // Base include
    const include = [
      {
        model: OfficeCenter,
        as: 'fromCenter',
        attributes: ['office_center_id', 'office_center_name']
      },
      {
        model: OfficeCenter,
        as: 'toCenter',
        attributes: ['office_center_id', 'office_center_name']
      },
      {
        model: Customer,
        as: 'fromCustomer',
        attributes: ['customer_id', 'customer_name', 'customer_number']
      },
      {
        model: Customer,
        as: 'toCustomer',
        attributes: ['customer_id', 'customer_name', 'customer_number']
      },
      {
        model: BookingPackage,
        as: 'packages',
        where: { is_active: 1 },
        required: false,
        attributes: [
          'booking_package_id',
          'package_type_id',
          'quantity',
          'total_package_charge'
        ],
        include: [
          {
            model: PackageType,
            as: 'packageType',
            attributes: ['package_type_id', 'package_type_name']
          }
        ]
      }
    ];
    
    // Get all bookings
    const { count, rows: bookings } = await Booking.findAndCountAll({
      where: whereClause,
      attributes: [
        'booking_id',
        'booking_number',
        'llr_number',
        'booking_date',
        'from_center_id',
        'to_center_id',
        'total_amount',
        'paid_amount',
        'due_amount',
        'payment_by',
        'payment_status',
        'delivery_status',
        'created_at'
      ],
      include,
      order: [['booking_date', 'DESC'], ['created_at', 'DESC']],
      limit,
      offset,
      distinct: true
    });
    
    // Get all trip assignments for these bookings
    const bookingIds = bookings.map(b => b.booking_id);
    
    const tripBookings = await TripBooking.findAll({
      where: {
        booking_id: { [Op.in]: bookingIds },
        is_active: 1
      },
      include: [
        {
          model: Trip,
          as: 'trip',
          attributes: [
            'trip_id',
            'trip_number',
            'trip_date',
            'status',
            'vehicle_id',
            'driver_id'
          ],
          include: [
            {
              model: Vehicle,
              as: 'vehicle',
              attributes: ['vehicle_id', 'vehicle_number_plate']
            },
            {
              model: Employee,
              as: 'driver',
              attributes: ['employee_id', 'employee_name']
            }
          ]
        }
      ]
    });
    
    // Create a map of booking to trip
    const bookingTripMap = {};
    tripBookings.forEach(tb => {
      bookingTripMap[tb.booking_id] = tb.trip;
    });
    
    // Get payments if requested
    let paymentsByBooking = {};
    if (includePayments) {
      const payments = await Payment.findAll({
        where: {
          booking_id: { [Op.in]: bookingIds },
          is_active: 1,
          status: 'completed'
        },
        attributes: [
          'payment_id',
          'payment_number',
          'booking_id',
          'amount',
          'payment_date',
          'payment_mode'
        ],
        order: [['payment_date', 'DESC']]
      });
      
      // Group payments by booking
      payments.forEach(payment => {
        if (!paymentsByBooking[payment.booking_id]) {
          paymentsByBooking[payment.booking_id] = [];
        }
        paymentsByBooking[payment.booking_id].push(payment);
      });
    }
    
    // Filter by trip status if requested
    let filteredBookings = bookings;
    if (tripStatus && includeTrip) {
      filteredBookings = bookings.filter(booking => {
        const trip = bookingTripMap[booking.booking_id];
        if (!trip) return tripStatus === 'not_assigned';
        return trip.status === tripStatus;
      });
    }
    
    // Enhance bookings with trip and payment info
    const enhancedBookings = filteredBookings.map(booking => {
      const bookingJson = booking.toJSON();
      
      if (includeTrip) {
        bookingJson.trip = bookingTripMap[booking.booking_id] || null;
      }
      
      if (includePayments) {
        bookingJson.payments = paymentsByBooking[booking.booking_id] || [];
        
        // Add payment summary
        const totalPayments = bookingJson.payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
        bookingJson.payment_summary = {
          count: bookingJson.payments.length,
          total: totalPayments.toFixed(2)
        };
      }
      
      return bookingJson;
    });
    
    // Calculate summary statistics
    const totalAmount = enhancedBookings.reduce((sum, b) => sum + parseFloat(b.total_amount || 0), 0);
    const totalPaid = enhancedBookings.reduce((sum, b) => sum + parseFloat(b.paid_amount || 0), 0);
    const totalPending = enhancedBookings.reduce((sum, b) => sum + parseFloat(b.due_amount || 0), 0);
    
    const statusCount = {
      not_delivered: enhancedBookings.filter(b => b.delivery_status === 'not_delivered').length,
      in_transit: enhancedBookings.filter(b => ['pickup_assigned', 'picked_up', 'in_transit', 'out_for_delivery'].includes(b.delivery_status)).length,
      delivered: enhancedBookings.filter(b => b.delivery_status === 'delivered').length,
      cancelled: enhancedBookings.filter(b => b.delivery_status === 'cancelled').length
    };
    
    const tripStatusCount = {
      assigned: enhancedBookings.filter(b => b.trip).length,
      not_assigned: enhancedBookings.filter(b => !b.trip).length
    };
    
    return {
      summary: {
        total_bookings: enhancedBookings.length,
        total_amount: totalAmount.toFixed(2),
        total_paid: totalPaid.toFixed(2),
        total_pending: totalPending.toFixed(2),
        payment_progress: totalAmount > 0 ? ((totalPaid / totalAmount) * 100).toFixed(2) : 0,
        by_status: statusCount,
        by_trip_status: tripStatusCount
      },
      pagination: {
        current_page: page,
        total_pages: Math.ceil(filteredBookings.length / limit),
        total_records: filteredBookings.length,
        limit
      },
      bookings: enhancedBookings
    };
    
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

/**
 * Get booking trip timeline - shows all stages of trip for this booking
 */
async function getBookingTripTimeline(bookingId) {
  try {
    // Find which trip this booking is assigned to
    const tripBooking = await TripBooking.findOne({
      where: { 
        booking_id: bookingId,
        is_active: 1 
      },
      include: [
        {
          model: Trip,
          as: 'trip',
          attributes: [
            'trip_id',
            'trip_number',
            'trip_date',
            'from_center_id',
            'to_center_id',
            'estimated_departure',
            'estimated_arrival',
            'actual_departure',
            'actual_arrival',
            'status',
            'current_stage'
          ],
          include: [
            {
              model: TripStage,
              as: 'stages',
              attributes: [
                'stage_id',
                'stage_number',
                'stage_name',
                'from_center_id',
                'to_center_id',
                'estimated_departure',
                'estimated_arrival',
                'actual_departure',
                'actual_arrival',
                'status',
                'remarks'
              ],
              include: [
                {
                  model: OfficeCenter,
                  as: 'fromCenter',
                  attributes: ['office_center_id', 'office_center_name']
                },
                {
                  model: OfficeCenter,
                  as: 'toCenter',
                  attributes: ['office_center_id', 'office_center_name']
                }
              ],
              order: [['stage_number', 'ASC']]
            }
          ]
        }
      ]
    });
    
    if (!tripBooking || !tripBooking.trip) {
      return {
        booking_id: bookingId,
        assigned_to_trip: false,
        message: "This booking is not assigned to any trip"
      };
    }
    
    const trip = tripBooking.trip;
    
    // Find which stage this booking belongs to
    const bookingStage = await TripBooking.findOne({
      where: { booking_id: bookingId },
      attributes: ['stage_id']
    });
    
    let currentStageInfo = null;
    if (bookingStage?.stage_id) {
      const stage = await TripStage.findOne({
        where: { stage_id: bookingStage.stage_id },
        attributes: ['stage_number', 'stage_name', 'status']
      });
      currentStageInfo = stage;
    }
    
    // Build timeline
    const timeline = [];
    
    if (trip.stages && trip.stages.length > 0) {
      trip.stages.forEach((stage, index) => {
        const isCurrentStage = currentStageInfo && 
          stage.stage_number === currentStageInfo.stage_number;
        
        const stageStatus = stage.status;
        let statusIcon = '⏳';
        let statusColor = 'gray';
        
        if (stageStatus === 'completed') {
          statusIcon = '✅';
          statusColor = 'green';
        } else if (stageStatus === 'in_progress') {
          statusIcon = '🚚';
          statusColor = 'blue';
        } else if (stageStatus === 'scheduled') {
          statusIcon = '📅';
          statusColor = 'orange';
        } else if (stageStatus === 'delayed') {
          statusIcon = '⚠️';
          statusColor = 'red';
        }
        
        timeline.push({
          stage_number: stage.stage_number,
          stage_name: stage.stage_name,
          from_center: stage.fromCenter?.office_center_name,
          to_center: stage.toCenter?.office_center_name,
          estimated_departure: stage.estimated_departure,
          estimated_arrival: stage.estimated_arrival,
          actual_departure: stage.actual_departure,
          actual_arrival: stage.actual_arrival,
          status: stage.status,
          status_icon: statusIcon,
          status_color: statusColor,
          is_current_stage: isCurrentStage,
          remarks: stage.remarks
        });
      });
    }
    
    return {
      booking_id: bookingId,
      assigned_to_trip: true,
      trip: {
        trip_id: trip.trip_id,
        trip_number: trip.trip_number,
        trip_date: trip.trip_date,
        status: trip.status,
        current_stage: trip.current_stage,
        from_center: trip.fromCenter?.office_center_name,
        to_center: trip.toCenter?.office_center_name,
        estimated_departure: trip.estimated_departure,
        estimated_arrival: trip.estimated_arrival,
        actual_departure: trip.actual_departure,
        actual_arrival: trip.actual_arrival
      },
      booking_stage: currentStageInfo ? {
        stage_number: currentStageInfo.stage_number,
        stage_name: currentStageInfo.stage_name,
        status: currentStageInfo.status
      } : null,
      timeline
    };
    
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}


module.exports = {
  getDailyProfitLoss,
  getDateRangeProfitLoss,
  getPackageReport,
  getTripReport,
  getBalanceReport,
  getDashboardStats,
   getBookingWithDetails,
  getAllBookingsWithDetails,
  getBookingTripTimeline
};