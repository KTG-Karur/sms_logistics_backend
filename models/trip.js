"use strict";

const { Model, UUIDV4 } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Trip extends Model {
    static associate(models) {
      // Trip belongs to from center
      this.belongsTo(models.OfficeCenter, {
        foreignKey: 'from_center_id',
        targetKey: 'office_center_id',
        as: 'fromCenter',
        constraints: false
      });
      

      // Trip belongs to to center
      this.belongsTo(models.OfficeCenter, {
        foreignKey: 'to_center_id',
        targetKey: 'office_center_id',
        as: 'toCenter',
        constraints: false
      });

      // Trip belongs to vehicle
      this.belongsTo(models.Vehicle, {
        foreignKey: 'vehicle_id',
        targetKey: 'vehicle_id',
        as: 'vehicle',
        constraints: false
      });

      // Trip belongs to driver
      this.belongsTo(models.Employee, {
        foreignKey: 'driver_id',
        targetKey: 'employee_id',
        as: 'driver',
        constraints: false
      });

        // Trip has many bookings through trip_bookings
  this.belongsToMany(models.Booking, {
    through: models.TripBooking,
    foreignKey: 'trip_id',      // Foreign key in TripBooking table
    otherKey: 'booking_id',       // Foreign key in TripBooking table to Booking
    sourceKey: 'trip_id',         // Key in Trip table
    targetKey: 'booking_id',      // Key in Booking table
    as: 'bookings'
  });

  // Trip has many loadmen through trip_loadmen
 this.belongsToMany(models.Employee, {
    through: models.TripLoadman,
    foreignKey: 'trip_id',        // Foreign key in TripLoadman table
    otherKey: 'loadman_id',        // Foreign key in TripLoadman table to Employee
    sourceKey: 'trip_id',          // Key in Trip table
    targetKey: 'employee_id',      // Key in Employee table
    as: 'loadmen'
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

    // Generate Trip Number
    static generateTripNumber() {
      const date = new Date();
      const year = date.getFullYear().toString().slice(-2);
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      return `TRIP${year}${month}${day}${random}`;
    }
  }

  Trip.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      trip_id: {
        type: DataTypes.STRING,
        primaryKey: true,
        defaultValue: UUIDV4,
      },
      trip_number: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
      },
      from_center_id: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      to_center_id: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      vehicle_id: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      driver_id: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      trip_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      estimated_departure: {
        type: DataTypes.TIME,
        allowNull: false,
      },
      estimated_arrival: {
        type: DataTypes.TIME,
        allowNull: false,
      },
      actual_departure: {
        type: DataTypes.TIME,
        allowNull: true
      },
      actual_arrival: {
        type: DataTypes.TIME,
        allowNull: true
      },
      status: {
        type: DataTypes.ENUM('scheduled', 'in_progress', 'completed', 'cancelled'),
        allowNull: false,
        defaultValue: 'scheduled'
      },
      remarks: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      total_weight: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      total_packages: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      total_amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0
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
      modelName: "Trip",
      tableName: "trips",
      timestamps: true,
      paranoid: true,
      hooks: {
        beforeValidate: (trip, options) => {
          if (!trip.trip_number) {
            trip.trip_number = Trip.generateTripNumber();
          }
        }
      }
    }
  );

  return Trip;
};