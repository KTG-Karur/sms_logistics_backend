"use strict";

const { Model, UUIDV4 } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class TripBooking extends Model {
    static associate(models) {
       this.belongsTo(models.Trip, {
    foreignKey: 'trip_id',
    targetKey: 'trip_id',  // Important: use trip_id, not id
    as: 'trip'
  });
    this.hasMany(models.PackageLoadman, {
    foreignKey: 'trip_booking_id',
    sourceKey: 'trip_booking_id',
    as: 'packageLoadmen'
  });
  
  this.belongsTo(models.Booking, {
    foreignKey: 'booking_id',
    targetKey: 'booking_id',  // Important: use booking_id, not id
    as: 'booking'
  });
    }
  }

  TripBooking.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      trip_booking_id: {
        type: DataTypes.STRING,
        primaryKey: true,
        defaultValue: UUIDV4,
      },
      trip_id: {
        type: DataTypes.STRING,
        allowNull: false
      },
      booking_id: {
        type: DataTypes.STRING(255), // CHANGED: from STRING(50) to STRING(255) to match bookings table
        allowNull: false
      },
      delivery_status: {
        type: DataTypes.ENUM('pending', 'picked_up', 'in_transit', 'delivered'),
        allowNull: false,
        defaultValue: 'pending'
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
    },
    {
      sequelize,
      modelName: "TripBooking",
      tableName: "trip_bookings",
      timestamps: true,
      paranoid: true,
    }
  );

  return TripBooking;
};