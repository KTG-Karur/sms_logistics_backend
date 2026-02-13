"use strict";

const { Model, UUIDV4 } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Customer extends Model {
    static associate(models) {
    //   this.hasMany(models.Vehicle, {
    //     foreignKey: 'customer_id',
    //     sourceKey: 'customer_id',
    //     as: 'vehicles'
    //   });

    //   this.hasMany(models.Booking, {
    //     foreignKey: 'customer_id',
    //     sourceKey: 'customer_id',
    //     as: 'bookings'
    //   });

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

  Customer.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      customer_id: {
        type: DataTypes.STRING,
        primaryKey: true,
        defaultValue: UUIDV4,
      },
      customer_name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "Customer name is required"
          },
          len: {
            args: [2, 100],
            msg: "Customer name must be between 2 and 100 characters"
          }
        }
      },
      customer_number: {
        type: DataTypes.STRING,
        allowNull: false,
        // unique: false,  // REMOVED - no longer unique
        validate: {
          notEmpty: {
            msg: "Customer number is required"
          },
          len: {
            args: [1, 50],
            msg: "Customer number must be between 1 and 50 characters"
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
      modelName: "Customer",
      tableName: "customer",
      timestamps: true,
      paranoid: true,
      indexes: [
        {
          fields: ['customer_number'],
          name: 'idx_customer_number',
          unique: false  // Changed to false
        },
        {
          fields: ['customer_name'],
          name: 'idx_customer_name'
        },
        {
          fields: ['customer_number', 'customer_name'],
          name: 'idx_customer_number_name',
          unique: false
        }
      ]
    }
  );

  return Customer;
};