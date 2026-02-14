"use strict";

const { Model, UUIDV4 } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class BookingPackage extends Model {
    static associate(models) {
      // Booking package belongs to booking
      this.belongsTo(models.Booking, {
        foreignKey: 'booking_id',
        targetKey: 'booking_id',
        as: 'booking',
        constraints: false
      });

      // Booking package belongs to package type
      this.belongsTo(models.PackageType, {
        foreignKey: 'package_type_id',
        targetKey: 'package_type_id',
        as: 'packageType',
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

  BookingPackage.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      booking_package_id: {
        type: DataTypes.STRING(255),
        primaryKey: true,
        defaultValue: UUIDV4,
      },
      booking_id: {
        type: DataTypes.STRING(50),
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "Booking ID is required"
          }
        }
      },
      package_type_id: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "Package type is required"
          }
        }
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        validate: {
          isInt: {
            msg: "Quantity must be an integer"
          },
          min: {
            args: [1],
            msg: "Quantity must be at least 1"
          }
        }
      },
      pickup_charge: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      drop_charge: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      handling_charge: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      total_package_charge: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.00
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
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      updated_by: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "BookingPackage",
      tableName: "booking_packages",
      timestamps: true,
      paranoid: true,
      hooks: {
        beforeSave: (bookingPackage, options) => {
          // Calculate total package charge
          const quantity = bookingPackage.quantity || 1;
          const pickupCharge = parseFloat(bookingPackage.pickup_charge || 0);
          const dropCharge = parseFloat(bookingPackage.drop_charge || 0);
          const handlingCharge = parseFloat(bookingPackage.handling_charge || 0);
          
          bookingPackage.total_package_charge = 
            (pickupCharge + dropCharge + handlingCharge) * quantity;
        }
      }
    }
  );

  return BookingPackage;
};