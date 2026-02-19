"use strict";

const { Model, UUIDV4 } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class LoadmanSalary extends Model {
    static associate(models) {
      // LoadmanSalary belongs to Employee
      this.belongsTo(models.Employee, {
        foreignKey: 'loadman_id',
        targetKey: 'employee_id',
        as: 'loadman',
        constraints: false
      });

      // LoadmanSalary belongs to Trip
      this.belongsTo(models.Trip, {
        foreignKey: 'trip_id',
        targetKey: 'trip_id',
        as: 'trip',
        constraints: false
      });

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

  LoadmanSalary.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      loadman_salary_id: {
        type: DataTypes.STRING,
        primaryKey: true,
        defaultValue: UUIDV4,
      },
      loadman_id: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "Loadman ID is required"
          }
        }
      },
      trip_id: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      salary_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        validate: {
          isDate: {
            msg: "Valid salary date is required"
          }
        }
      },
      total_pickup_charges: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
      },
      total_drop_charges: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
      },
      total_handling_charges: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
      },
      total_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
      },
      package_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      booking_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      status: {
        type: DataTypes.ENUM('pending', 'processed', 'paid'),
        allowNull: false,
        defaultValue: 'pending',
      },
      payment_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      payment_reference: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
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
      modelName: "LoadmanSalary",
      tableName: "loadman_salaries",
      timestamps: true,
      paranoid: true,
    }
  );

  return LoadmanSalary;
};