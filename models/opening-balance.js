// models/openingbalance.js
'use strict';

const { Model, UUIDV4 } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class OpeningBalance extends Model {
    /**
     * Helper method for defining associations.
     */
    static associate(models) {
      // Keep only employee associations
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

  OpeningBalance.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      opening_balance_id: {
        type: DataTypes.STRING,
        primaryKey: true,
        defaultValue: UUIDV4,
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        validate: {
          isDate: {
            msg: "Please provide a valid date"
          },
          notEmpty: {
            msg: "Date is required"
          }
        }
      },
      office_center_id: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "Office center ID is required"
          }
        }
      },
      opening_balance: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
        validate: {
          isDecimal: {
            msg: "Opening balance must be a valid decimal number"
          },
          min: {
            args: [0],
            msg: "Opening balance cannot be negative"
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
      modelName: "OpeningBalance",
      tableName: "opening_balance",
      timestamps: true,
      paranoid: true,
      indexes: [
        {
          fields: ['date'],
          name: 'idx_opening_balance_date'
        },
        {
          fields: ['office_center_id'],
          name: 'idx_opening_balance_office_center_id'
        },
        {
          fields: ['date', 'office_center_id'],
          name: 'idx_opening_balance_date_office_center',
          unique: true
        }
      ]
    }
  );

  return OpeningBalance;
};