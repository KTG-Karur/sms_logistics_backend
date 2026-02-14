"use strict";
const messages = require("../helpers/message");
const _ = require("lodash");
const { Op } = require("sequelize");
const { Expense, expence_type, OfficeCenter, Employee, ExpensePayment, sequelize } = require("../models");

/**
 * Get expenses with filters
 */
async function getExpenses(query, needIsActive = true) {
  try {
    let whereClause = {};
    const { 
      expenseDate, 
      expenseTypeId, 
      officeCenterId,
      isPaid,
      search,
      startDate,
      endDate,
      page = 1,
      limit = 100
    } = query;

    if (expenseDate) {
      whereClause.expense_date = expenseDate;
    }
    
    if (expenseTypeId) {
      whereClause.expense_type_id = expenseTypeId;
    }
    
    if (officeCenterId) {
      whereClause.office_center_id = officeCenterId;
    }
    
    if (isPaid !== undefined) {
      whereClause.is_paid = isPaid === 'true' || isPaid === true;
    }
    
    if (startDate && endDate) {
      whereClause.expense_date = {
        [Op.between]: [startDate, endDate]
      };
    } else if (startDate) {
      whereClause.expense_date = {
        [Op.gte]: startDate
      };
    } else if (endDate) {
      whereClause.expense_date = {
        [Op.lte]: endDate
      };
    }
    
    if (needIsActive) {
      whereClause.is_active = 1;
    }

    if (search) {
      whereClause[Op.or] = [
        { description: { [Op.like]: `%${search}%` } },
        { '$expenseType.expence_type_name$': { [Op.like]: `%${search}%` } }
      ];
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const parsedLimit = parseInt(limit);

    const { count, rows } = await Expense.findAndCountAll({
      where: whereClause,
      attributes: [
        'expense_id',
        'expense_date',
        'amount',
        'paid_amount',
        'is_paid',
        'description',
        'is_active',
        'created_at',
        'updated_at'
      ],
      include: [
        {
          model: expence_type,
          as: 'expenseType',
          attributes: ['expence_type_id', 'expence_type_name', 'is_active'],
          where: needIsActive ? { is_active: 1 } : {},
          required: false
        },
        {
          model: OfficeCenter,
          as: 'officeCenter',
          attributes: ['office_center_id', 'office_center_name', 'is_active'],
          where: needIsActive ? { is_active: 1 } : {},
          required: false
        },
        {
          model: Employee,
          as: 'createdBy',
          attributes: ['employee_id', 'employee_name', 'employee_number'],
          required: false
        }
      ],
      order: [['expense_date', 'DESC'], ['created_at', 'DESC']],
      limit: parsedLimit,
      offset: offset,
      distinct: true
    });

    return {
      total: count,
      page: parseInt(page),
      limit: parsedLimit,
      totalPages: Math.ceil(count / parsedLimit),
      data: rows
    };
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

/**
 * Get expense with all details including payments
 */
async function getExpenseWithDetails(expenseId) {
  try {
    const expense = await Expense.findOne({
      where: { 
        expense_id: expenseId,
        is_active: 1 
      },
      attributes: [
        'expense_id',
        'expense_date',
        'amount',
        'paid_amount',
        'is_paid',
        'description',
        'created_at',
        'updated_at'
      ],
      include: [
        {
          model: expence_type,
          as: 'expenseType',
          attributes: ['expence_type_id', 'expence_type_name']
        },
        {
          model: OfficeCenter,
          as: 'officeCenter',
          attributes: ['office_center_id', 'office_center_name']
        },
        {
          model: Employee,
          as: 'createdBy',
          attributes: ['employee_id', 'employee_name']
        },
        {
          model: Employee,
          as: 'updatedBy',
          attributes: ['employee_id', 'employee_name']
        },
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
          ],
          include: [
            {
              model: Employee,
              as: 'createdBy',
              attributes: ['employee_id', 'employee_name']
            }
          ],
          order: [['payment_date', 'DESC'], ['created_at', 'DESC']]
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
      ...expense.toJSON(),
      payment_summary: {
        total_paid: paidAmount,
        remaining_amount: remaining,
        is_fully_paid: expense.is_paid,
        payment_count: expense.payments?.length || 0
      }
    };
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

/**
 * Create new expense with optional payment
 */
async function createExpense(postData) {
  let transaction;
  try {
    transaction = await sequelize.transaction();
    
    const { payment, ...expenseData } = postData;
    const excuteMethod = _.mapKeys(expenseData, (value, key) => _.snakeCase(key));

    // Validate expense type exists
    const expenseType = await sequelize.models.expence_type.findOne({
      where: { 
        expence_type_id: excuteMethod.expense_type_id,
        is_active: 1 
      },
      transaction
    });
    
    if (!expenseType) {
      throw new Error("Invalid expense type");
    }

    // Validate office center exists
    const officeCenter = await OfficeCenter.findOne({
      where: { 
        office_center_id: excuteMethod.office_center_id,
        is_active: 1 
      },
      transaction
    });
    
    if (!officeCenter) {
      throw new Error("Invalid office center");
    }

    // Initialize with zero paid amount
    excuteMethod.paid_amount = 0;
    excuteMethod.is_paid = false;

    // Create the expense
    const expenseResult = await Expense.create(excuteMethod, { transaction });

    // If payment is provided, create it
    if (payment) {
      const paymentData = _.mapKeys(payment, (value, key) => _.snakeCase(key));
      paymentData.expense_id = expenseResult.expense_id;
      
      // Validate payment amount doesn't exceed expense amount
      if (parseFloat(paymentData.amount) > parseFloat(excuteMethod.amount)) {
        throw new Error("Payment amount cannot exceed expense amount");
      }

      await ExpensePayment.create(paymentData, { transaction });
    }

    await transaction.commit();
    
    // Get the complete expense with details WITHOUT using the transaction
    const result = await getExpenseWithDetails(expenseResult.expense_id);
    return result;
    
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

/**
 * Update expense with optional payment
 */
async function updateExpense(expenseId, putData) {
  let transaction;
  try {
    transaction = await sequelize.transaction();
    
    const { payment, ...expenseData } = putData;
    const excuteMethod = _.mapKeys(expenseData, (value, key) => _.snakeCase(key));

    // Get existing expense with lock
    const existingExpense = await Expense.findOne({
      where: { 
        expense_id: expenseId,
        is_active: 1 
      },
      lock: transaction.LOCK,
      transaction
    });

    if (!existingExpense) {
      throw new Error(messages.DATA_NOT_FOUND);
    }

    // Check if trying to update amount when payments exist
    if (excuteMethod.amount && excuteMethod.amount !== existingExpense.amount) {
      const paymentCount = await ExpensePayment.count({
        where: { 
          expense_id: expenseId,
          is_active: 1 
        },
        transaction
      });

      if (paymentCount > 0) {
        throw new Error("Cannot update expense amount after payments have been made");
      }
    }

    // Validate expense type if being updated
    if (excuteMethod.expense_type_id) {
      const expenseType = await sequelize.models.expence_type.findOne({
        where: { 
          expence_type_id: excuteMethod.expense_type_id,
          is_active: 1 
        },
        transaction
      });
      
      if (!expenseType) {
        throw new Error("Invalid expense type");
      }
    }

    // Validate office center if being updated
    if (excuteMethod.office_center_id) {
      const officeCenter = await OfficeCenter.findOne({
        where: { 
          office_center_id: excuteMethod.office_center_id,
          is_active: 1 
        },
        transaction
      });
      
      if (!officeCenter) {
        throw new Error("Invalid office center");
      }
    }

    // Update expense if there are fields to update
    if (Object.keys(excuteMethod).length > 0) {
      const [affectedCount] = await Expense.update(
        excuteMethod,
        { 
          where: { expense_id: expenseId },
          transaction 
        }
      );

      if (affectedCount === 0) {
        throw new Error(messages.DATA_NOT_FOUND);
      }
    }

    // If payment is provided, create it
    if (payment) {
      const paymentData = _.mapKeys(payment, (value, key) => _.snakeCase(key));
      paymentData.expense_id = expenseId;
      
      // Calculate current total paid amount
      const currentTotalPaid = await ExpensePayment.sum('amount', {
        where: { 
          expense_id: expenseId,
          is_active: 1 
        },
        transaction
      }) || 0;

      const expenseAmount = excuteMethod.amount || existingExpense.amount;
      const newPaymentAmount = parseFloat(paymentData.amount);
      const newTotalPaid = currentTotalPaid + newPaymentAmount;

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

      await ExpensePayment.create(paymentData, { transaction });
    }

    await transaction.commit();
    
    // Get the updated expense with details WITHOUT using the transaction
    const result = await getExpenseWithDetails(expenseId);
    return result;
    
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

/**
 * Get all payments for an expense
 */
async function getExpensePayments(expenseId) {
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
 * Delete a payment from expense
 */
async function deleteExpensePayment(expenseId, paymentId) {
  let transaction;
  try {
    transaction = await sequelize.transaction();
    
    // Verify payment belongs to expense
    const payment = await ExpensePayment.findOne({
      where: { 
        expense_payment_id: paymentId,
        expense_id: expenseId,
        is_active: 1 
      },
      transaction
    });

    if (!payment) {
      throw new Error("Payment not found for this expense");
    }

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
    
    const result = await getExpenseWithDetails(expenseId);
    return result;
    
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

/**
 * Delete expense (soft delete)
 */
async function deleteExpense(expenseId) {
  let transaction;
  try {
    transaction = await sequelize.transaction();
    
    // Check if expense has payments
    const paymentCount = await ExpensePayment.count({
      where: { 
        expense_id: expenseId,
        is_active: 1 
      },
      transaction
    });

    if (paymentCount > 0) {
      throw new Error("Cannot delete expense with existing payments. Delete payments first.");
    }

    const [affectedCount] = await Expense.update(
      { is_active: 0 },
      { 
        where: { 
          expense_id: expenseId,
          is_active: 1 
        },
        transaction 
      }
    );

    if (affectedCount === 0) {
      throw new Error(messages.DATA_NOT_FOUND);
    }

    await transaction.commit();

    return { success: true, message: "Expense deleted successfully" };
    
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

module.exports = {
  getExpenses,
  getExpenseWithDetails,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpensePayments,
  deleteExpensePayment
};