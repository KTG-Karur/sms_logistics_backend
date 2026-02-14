"use strict";
const messages = require("../helpers/message");
const _ = require("lodash");
const { Op } = require("sequelize");
const { ExpensePayment, Expense, Employee, sequelize } = require("../models");

/**
 * Create new expense payment with validation
 */
async function createExpensePayment(postData) {
  const transaction = await sequelize.transaction();
  try {
    const excuteMethod = _.mapKeys(postData, (value, key) => _.snakeCase(key));

    // Get the expense with lock to prevent race conditions
    const expense = await Expense.findOne({
      where: { 
        expense_id: excuteMethod.expense_id,
        is_active: 1 
      },
      lock: transaction.LOCK,
      transaction
    });

    if (!expense) {
      throw new Error("Expense not found");
    }

    // Calculate current total paid amount
    const currentTotalPaid = await ExpensePayment.sum('amount', {
      where: { 
        expense_id: excuteMethod.expense_id,
        is_active: 1 
      },
      transaction
    }) || 0;

    const expenseAmount = parseFloat(expense.amount);
    const newPaymentAmount = parseFloat(excuteMethod.amount);
    const newTotalPaid = currentTotalPaid + newPaymentAmount;

    console.log('Payment Validation:', {
      expenseAmount,
      currentTotalPaid,
      newPaymentAmount,
      newTotalPaid,
      remainingAmount: expenseAmount - currentTotalPaid
    });

    // Strict validation - don't allow any overpayment
    if (newTotalPaid > expenseAmount) {
      const remainingAmount = expenseAmount - currentTotalPaid;
      throw new Error(
        `Cannot exceed expense amount. ` +
        `Expense amount: ₹${expenseAmount}, ` +
        `Already paid: ₹${currentTotalPaid}, ` +
        `Remaining: ₹${remainingAmount}, ` +
        `You tried to pay: ₹${newPaymentAmount}`
      );
    }

    // Create the payment
    const paymentResult = await ExpensePayment.create(excuteMethod, { transaction });

    await transaction.commit();

    // Get updated expense with all payments
    const result = await getExpensePaymentById(paymentResult.expense_payment_id);
    
    // Check if expense is now fully paid
    const updatedExpense = await Expense.findOne({
      where: { expense_id: excuteMethod.expense_id },
      attributes: ['amount', 'paid_amount', 'is_paid']
    });

    return {
      ...result.dataValues,
      expense_status: {
        is_fully_paid: updatedExpense.is_paid,
        total_paid: updatedExpense.paid_amount,
        remaining: updatedExpense.amount - updatedExpense.paid_amount
      }
    };
  } catch (error) {
    await transaction.rollback();
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

/**
 * Update expense payment with validation
 */
async function updateExpensePayment(paymentId, putData) {
  const transaction = await sequelize.transaction();
  try {
    const excuteMethod = _.mapKeys(putData, (value, key) => _.snakeCase(key));

    // Get existing payment with lock
    const existingPayment = await ExpensePayment.findOne({
      where: { 
        expense_payment_id: paymentId,
        is_active: 1 
      },
      lock: transaction.LOCK,
      transaction
    });

    if (!existingPayment) {
      throw new Error(messages.DATA_NOT_FOUND);
    }

    // If amount is being changed, validate against expense total
    if (excuteMethod.amount && excuteMethod.amount !== existingPayment.amount) {
      const expense = await Expense.findOne({
        where: { 
          expense_id: existingPayment.expense_id,
          is_active: 1 
        },
        lock: transaction.LOCK,
        transaction
      });

      // Calculate total paid excluding current payment
      const totalOtherPayments = await ExpensePayment.sum('amount', {
        where: { 
          expense_id: existingPayment.expense_id,
          expense_payment_id: { [Op.ne]: paymentId },
          is_active: 1 
        },
        transaction
      }) || 0;

      const newPaymentAmount = parseFloat(excuteMethod.amount);
      const newTotalPaid = totalOtherPayments + newPaymentAmount;
      const expenseAmount = parseFloat(expense.amount);

      if (newTotalPaid > expenseAmount) {
        const remainingAmount = expenseAmount - totalOtherPayments;
        throw new Error(
          `Cannot exceed expense amount. ` +
          `Expense amount: ₹${expenseAmount}, ` +
          `Other payments: ₹${totalOtherPayments}, ` +
          `Remaining: ₹${remainingAmount}, ` +
          `You tried to set payment to: ₹${newPaymentAmount}`
        );
      }
    }

    const [affectedCount] = await ExpensePayment.update(
      excuteMethod,
      { 
        where: { expense_payment_id: paymentId },
        transaction 
      }
    );

    if (affectedCount === 0) {
      throw new Error(messages.DATA_NOT_FOUND);
    }

    await transaction.commit();

    return await getExpensePaymentById(paymentId);
  } catch (error) {
    await transaction.rollback();
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

/**
 * Delete expense payment with validation
 */
async function deleteExpensePayment(paymentId) {
  const transaction = await sequelize.transaction();
  try {
    const [affectedCount] = await ExpensePayment.update(
      { is_active: 0 },
      { 
        where: { 
          expense_payment_id: paymentId,
          is_active: 1 
        },
        transaction 
      }
    );

    if (affectedCount === 0) {
      throw new Error(messages.DATA_NOT_FOUND);
    }

    await transaction.commit();

    return { success: true, message: "Payment deleted successfully" };
  } catch (error) {
    await transaction.rollback();
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

/**
 * Get payment summary for an expense
 */
async function getExpensePaymentSummary(expenseId) {
  try {
    const expense = await Expense.findOne({
      where: { 
        expense_id: expenseId,
        is_active: 1 
      },
      attributes: ['expense_id', 'amount', 'paid_amount', 'is_paid', 'description'],
      include: [
        {
          model: ExpensePayment,
          as: 'payments',
          where: { is_active: 1 },
          required: false,
          attributes: ['expense_payment_id', 'payment_date', 'amount', 'payment_type', 'notes'],
          order: [['payment_date', 'DESC']]
        }
      ]
    });

    if (!expense) {
      throw new Error(messages.DATA_NOT_FOUND);
    }

    const expenseAmount = parseFloat(expense.amount);
    const paidAmount = parseFloat(expense.paid_amount);
    const remaining = expenseAmount - paidAmount;

    return {
      expense_id: expense.expense_id,
      description: expense.description,
      total_amount: expenseAmount,
      paid_amount: paidAmount,
      remaining_amount: remaining,
      is_fully_paid: expense.is_paid,
      payment_count: expense.payments?.length || 0,
      payments: expense.payments || []
    };
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

/**
 * Get payments for a specific expense
 */
async function getPaymentsByExpenseId(expenseId) {
  try {
    const payments = await ExpensePayment.findAll({
      where: { 
        expense_id: expenseId,
        is_active: 1 
      },
      attributes: [
        'expense_payment_id',
        'payment_date',
        'amount',
        'payment_type',
        'notes',
        'created_at'
      ],
      include: [
        {
          model: Employee,
          as: 'createdBy',
          attributes: ['employee_id', 'employee_name'],
          required: false
        }
      ],
      order: [['payment_date', 'DESC'], ['created_at', 'DESC']]
    });

    return payments;
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

/**
 * Get single expense payment by ID
 */
async function getExpensePaymentById(paymentId) {
  try {
    const payment = await ExpensePayment.findOne({
      where: { 
        expense_payment_id: paymentId,
        is_active: 1 
      },
      attributes: [
        'expense_payment_id',
        'payment_date',
        'amount',
        'payment_type',
        'notes',
        'created_at',
        'updated_at'
      ],
      include: [
        {
          model: Expense,
          as: 'expense',
          attributes: ['expense_id', 'expense_date', 'amount', 'paid_amount', 'is_paid', 'description']
        },
        {
          model: Employee,
          as: 'createdBy',
          attributes: ['employee_id', 'employee_name']
        }
      ]
    });

    if (!payment) {
      throw new Error(messages.DATA_NOT_FOUND);
    }

    return payment;
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

/**
 * Bulk create expense payments for multiple expense IDs
 */
async function bulkCreateExpensePayments(paymentsData) {
  const transaction = await sequelize.transaction();
  try {
    const results = {
      successful: [],
      failed: []
    };

    // Process each payment sequentially to validate properly
    for (const paymentData of paymentsData) {
      try {
        const excuteMethod = _.mapKeys(paymentData, (value, key) => _.snakeCase(key));

        // Get the expense with lock to prevent race conditions
        const expense = await Expense.findOne({
          where: { 
            expense_id: excuteMethod.expense_id,
            is_active: 1 
          },
          lock: transaction.LOCK,
          transaction
        });

        if (!expense) {
          throw new Error(`Expense not found for ID: ${excuteMethod.expense_id}`);
        }

        // Calculate current total paid amount
        const currentTotalPaid = await ExpensePayment.sum('amount', {
          where: { 
            expense_id: excuteMethod.expense_id,
            is_active: 1 
          },
          transaction
        }) || 0;

        const expenseAmount = parseFloat(expense.amount);
        const newPaymentAmount = parseFloat(excuteMethod.amount);
        const newTotalPaid = currentTotalPaid + newPaymentAmount;

        // Strict validation - don't allow any overpayment
        if (newTotalPaid > expenseAmount) {
          const remainingAmount = expenseAmount - currentTotalPaid;
          throw new Error(
            `Cannot exceed expense amount for expense ${excuteMethod.expense_id}. ` +
            `Expense amount: ₹${expenseAmount}, ` +
            `Already paid: ₹${currentTotalPaid}, ` +
            `Remaining: ₹${remainingAmount}, ` +
            `You tried to pay: ₹${newPaymentAmount}`
          );
        }

        // Create the payment
        const paymentResult = await ExpensePayment.create(excuteMethod, { transaction });
        
        // Instead of calling getExpensePaymentById (which might fail due to transaction state),
        // construct the payment object directly from the result and expense data
        const paymentObject = {
          expense_payment_id: paymentResult.expense_payment_id,
          payment_date: paymentResult.payment_date,
          amount: paymentResult.amount,
          payment_type: paymentResult.payment_type,
          notes: paymentResult.notes,
          created_at: paymentResult.created_at,
          expense: {
            expense_id: expense.expense_id,
            amount: expense.amount,
            paid_amount: expense.paid_amount,
            is_paid: expense.is_paid,
            description: expense.description
          }
        };

        // Calculate updated paid amounts (since the hook will update expense after commit)
        const updatedTotalPaid = currentTotalPaid + newPaymentAmount;
        const isFullyPaid = updatedTotalPaid >= expenseAmount;

        results.successful.push({
          ...paymentObject,
          expense_status: {
            expense_id: excuteMethod.expense_id,
            is_fully_paid: isFullyPaid,
            total_paid: updatedTotalPaid,
            remaining: expenseAmount - updatedTotalPaid
          }
        });

      } catch (error) {
        // Track failed payments with error message
        results.failed.push({
          payment_data: paymentData,
          error: error.message
        });
      }
    }

    // If at least one payment was successful, commit the transaction
    if (results.successful.length > 0) {
      await transaction.commit();
      
      // Now that transaction is committed, we can fetch complete details if needed
      // But we already have the data from our constructed objects
      
      return results;
    } else {
      // If all payments failed, rollback
      await transaction.rollback();
      throw new Error("All payments failed. No transactions were committed.");
    }

  } catch (error) {
    await transaction.rollback();
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

// Add this to module.exports
module.exports = {
  createExpensePayment,
  updateExpensePayment,
  deleteExpensePayment,
  getExpensePaymentSummary,
  getPaymentsByExpenseId,
  getExpensePaymentById,
  bulkCreateExpensePayments  
};