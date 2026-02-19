"use strict";

const { Model, UUIDV4 } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class PackageLoadman extends Model {
    static associate(models) {
      // PackageLoadman belongs to TripBooking
      this.belongsTo(models.TripBooking, {
        foreignKey: 'trip_booking_id',
        targetKey: 'trip_booking_id',
        as: 'tripBooking',
        constraints: false
      });

      // PackageLoadman belongs to BookingPackage
      this.belongsTo(models.BookingPackage, {
        foreignKey: 'booking_package_id',
        targetKey: 'booking_package_id',
        as: 'bookingPackage',
        constraints: false
      });

      // PackageLoadman belongs to Employee (loadman)
      this.belongsTo(models.Employee, {
        foreignKey: 'loadman_id',
        targetKey: 'employee_id',
        as: 'loadman',
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

  PackageLoadman.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      package_loadman_id: {
        type: DataTypes.STRING,
        primaryKey: true,
        defaultValue: UUIDV4,
      },
      trip_booking_id: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "Trip booking ID is required"
          }
        }
      },
      booking_package_id: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "Booking package ID is required"
          }
        }
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
      loadman_type: {
        type: DataTypes.ENUM('pickup', 'drop', 'both'),
        allowNull: false,
        defaultValue: 'both',
      },
      amount_earned: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
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
      modelName: "PackageLoadman",
      tableName: "package_loadmen",
      timestamps: true,
      paranoid: true,
    }
  );

  return PackageLoadman;
};