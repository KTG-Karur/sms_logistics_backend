"use strict";
const { Model, UUIDV4 } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class SalaryAdjustment extends Model {
    static associate(models) {
      // Salary Adjustment belongs to Employee
      this.belongsTo(models.Employee, {
        foreignKey: 'employee_id',
        targetKey: 'employee_id',
        as: 'employee'
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

  SalaryAdjustment.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      adjustment_id: {
        type: DataTypes.STRING,
        primaryKey: true,
        defaultValue: UUIDV4,
      },
      employee_id: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "Employee ID is required"
          }
        }
      },
      adjustment_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "Adjustment date is required"
          },
          isDate: {
            msg: "Invalid date format"
          }
        }
      },
      type: {
        type: DataTypes.ENUM('deduction', 'extra'),
        allowNull: false,
        defaultValue: 'deduction',
        validate: {
          isIn: {
            args: [['deduction', 'extra']],
            msg: "Type must be either 'deduction' or 'extra'"
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
      reason: {
        type: DataTypes.STRING(255),
        allowNull: true,
        validate: {
          len: {
            args: [0, 255],
            msg: "Reason cannot exceed 255 characters"
          }
        }
      },
      salary_month: {
        type: DataTypes.STRING(7),
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "Salary month is required"
          },
          isValidMonth(value) {
            if (!/^\d{4}-\d{2}$/.test(value)) {
              throw new Error("Salary month must be in YYYY-MM format");
            }
            // Validate that it's a valid month (01-12)
            const month = parseInt(value.split('-')[1]);
            if (month < 1 || month > 12) {
              throw new Error("Invalid month. Month must be between 01 and 12");
            }
          }
        }
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
      modelName: "SalaryAdjustment",
      tableName: "salary_adjustments",
      timestamps: true,
      paranoid: true,
      hooks: {
        beforeCreate: async (adjustment, options) => {
          // Check if employee exists and is active
          const employee = await sequelize.models.Employee.findOne({
            where: { 
              employee_id: adjustment.employee_id,
              is_active: 1 
            }
          });
          
          if (!employee) {
            throw new Error("Employee not found or inactive");
          }
        },
        beforeUpdate: async (adjustment, options) => {
          // Don't allow changing employee_id after creation
          if (adjustment.changed('employee_id')) {
            throw new Error("Cannot change employee ID after adjustment is created");
          }
        }
      },
      indexes: [
        { fields: ['employee_id', 'salary_month'], name: 'idx_adjustment_employee_month' },
        { fields: ['employee_id'], name: 'idx_adjustment_employee' },
        { fields: ['salary_month'], name: 'idx_adjustment_month' },
        { fields: ['type'], name: 'idx_adjustment_type' },
        { fields: ['adjustment_date'], name: 'idx_adjustment_date' }
      ]
    }
  );

  return SalaryAdjustment;
};