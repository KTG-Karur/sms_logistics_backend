"use strict";
const { Model, UUIDV4 } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Expense extends Model {
    static associate(models) {
      // Expense belongs to Expense Type
      this.belongsTo(models.expence_type, {
        foreignKey: 'expense_type_id',
        targetKey: 'expence_type_id',
        as: 'expenseType'
      });

      // Expense belongs to Office Center
      this.belongsTo(models.OfficeCenter, {
        foreignKey: 'office_center_id',
        targetKey: 'office_center_id',
        as: 'officeCenter'
      });

      // Expense has many payments - THIS IS THE IMPORTANT ONE
      this.hasMany(models.ExpensePayment, {
        foreignKey: 'expense_id',
        sourceKey: 'expense_id',
        as: 'payments'
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

  Expense.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      expense_id: {
        type: DataTypes.STRING,
        primaryKey: true,
        defaultValue: UUIDV4,
      },
      expense_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "Expense date is required"
          },
          isDate: {
            msg: "Invalid date format"
          }
        }
      },
      expense_type_id: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "Expense type is required"
          }
        }
      },
      office_center_id: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "Office center is required"
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
            args: [0],
            msg: "Amount must be greater than or equal to 0"
          }
        }
      },
      paid_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        validate: {
          isDecimal: {
            msg: "Paid amount must be a valid number"
          },
          min: {
            args: [0],
            msg: "Paid amount must be greater than or equal to 0"
          }
        }
      },
      is_paid: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      description: {
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
      modelName: "Expense",
      tableName: "expense",
      timestamps: true,
      paranoid: true,
      hooks: {
        beforeValidate: (expense, options) => {
          if (expense.paid_amount > expense.amount) {
            throw new Error("Paid amount cannot exceed expense amount");
          }
          if (expense.paid_amount > 0) {
            expense.is_paid = expense.paid_amount >= expense.amount;
          } else {
            expense.is_paid = false;
          }
        },
        beforeUpdate: (expense, options) => {
          if (expense.paid_amount > expense.amount) {
            throw new Error("Paid amount cannot exceed expense amount");
          }
          if (expense.paid_amount > 0) {
            expense.is_paid = expense.paid_amount >= expense.amount;
          } else {
            expense.is_paid = false;
          }
        }
      },
      indexes: [
        { fields: ['expense_date'], name: 'idx_expense_date' },
        { fields: ['expense_type_id'], name: 'idx_expense_type_id' },
        { fields: ['office_center_id'], name: 'idx_office_center_id' },
        { fields: ['is_paid'], name: 'idx_is_paid' }
      ]
    }
  );

  return Expense;
};