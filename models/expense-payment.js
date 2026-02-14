"use strict";
const { Model, UUIDV4 } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class ExpensePayment extends Model {
    static associate(models) {
      // ExpensePayment belongs to Expense
      this.belongsTo(models.Expense, {
        foreignKey: 'expense_id',
        targetKey: 'expense_id',
        as: 'expense'
      });

      // Audit fields
      this.belongsTo(models.Employee, {
        foreignKey: "created_by",
        targetKey: "employee_id",
        as: "createdBy",
        constraints: false,
      });

      this.belongsTo(models.Employee, {
        foreignKey: "updated_by",
        targetKey: "employee_id",
        as: "updatedBy",
        constraints: false,
      });
    }
  }

  ExpensePayment.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      expense_payment_id: {
        type: DataTypes.STRING,
        primaryKey: true,
        defaultValue: UUIDV4,
      },
      expense_id: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "Expense ID is required"
          }
        }
      },
      payment_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "Payment date is required"
          },
          isDate: {
            msg: "Invalid date format"
          }
        }
      },
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "Amount is required"
          },
          isDecimal: {
            msg: "Amount must be a valid number"
          },
          min: {
            args: [0.01],
            msg: "Amount must be greater than 0"
          }
        }
      },
      payment_type: {
        type: DataTypes.ENUM('cash', 'gpay', 'bank_transfer', 'cheque', 'other'),
        allowNull: false,
        defaultValue: 'cash',
        validate: {
          isIn: {
            args: [['cash', 'gpay', 'bank_transfer', 'cheque', 'other']],
            msg: "Invalid payment type"
          }
        }
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: 1,
      },
      createdAt: {
        type: DataTypes.DATE,
        field: "created_at",
      },
      deletedAt: {
        type: DataTypes.DATE,
        field: "deleted_at",
      },
      updatedAt: {
        type: DataTypes.DATE,
        field: "updated_at",
      },
      created_by: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      updated_by: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "ExpensePayment",
      tableName: "expense_payment",
      timestamps: true,
      paranoid: true,
      hooks: {
        afterCreate: async (payment, options) => {
          await updateExpensePaymentStatus(payment.expense_id, options.transaction);
        },
        afterUpdate: async (payment, options) => {
          await updateExpensePaymentStatus(payment.expense_id, options.transaction);
        },
        afterDestroy: async (payment, options) => {
          await updateExpensePaymentStatus(payment.expense_id, options.transaction);
        }
      },
      indexes: [
        { fields: ['expense_id'], name: 'idx_expense_payment_expense_id' },
        { fields: ['payment_date'], name: 'idx_expense_payment_date' },
        { fields: ['payment_type'], name: 'idx_expense_payment_type' }
      ]
    }
  );

  async function updateExpensePaymentStatus(expenseId, transaction) {
    const Expense = sequelize.models.Expense;
    
    const totalPaid = await ExpensePayment.sum('amount', {
      where: { 
        expense_id: expenseId,
        is_active: 1 
      },
      transaction
    });

    const expense = await Expense.findOne({
      where: { expense_id: expenseId },
      transaction
    });

    if (expense) {
      const paidAmount = totalPaid || 0;
      await expense.update({
        paid_amount: paidAmount,
        is_paid: paidAmount >= expense.amount
      }, { transaction });
    }
  }

  return ExpensePayment;
};