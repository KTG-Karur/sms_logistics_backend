"use strict";
const { Model, UUIDV4 } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class ExtraIncome extends Model {
    static associate(models) {
      // Extra Income belongs to Office Center
      this.belongsTo(models.OfficeCenter, {
        foreignKey: 'office_center_id',
        targetKey: 'office_center_id',
        as: 'officeCenter'
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

  ExtraIncome.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      extra_income_id: {
        type: DataTypes.STRING,
        defaultValue: UUIDV4,
        allowNull: false,
        unique: true,
      },
      income_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "Income date is required"
          },
          isDate: {
            msg: "Invalid date format"
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
      income_type: {
        type: DataTypes.ENUM('cash', 'upi', 'bank_transfer', 'cheque', 'other'),
        allowNull: false,
        defaultValue: 'cash',
        validate: {
          isIn: {
            args: [['cash', 'upi', 'bank_transfer', 'cheque', 'other']],
            msg: "Invalid income type"
          }
        }
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: 1,
      },
      created_at: {
        type: DataTypes.DATE,
        field: "created_at",
      },
      updated_at: {
        type: DataTypes.DATE,
        field: "updated_at",
      },
      deleted_at: {
        type: DataTypes.DATE,
        field: "deleted_at",
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
      modelName: "ExtraIncome",
      tableName: "extra_income",
      timestamps: true,
      paranoid: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      deletedAt: 'deleted_at',
    }
  );

  return ExtraIncome;
};