"use strict";

const { Model, UUIDV4 } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Booking extends Model {
    static associate(models) {
      // Booking belongs to from center
      this.belongsTo(models.OfficeCenter, {
        foreignKey: 'from_center_id',
        targetKey: 'office_center_id',
        as: 'fromCenter',
        constraints: false
      });

      // Booking belongs to to center
      this.belongsTo(models.OfficeCenter, {
        foreignKey: 'to_center_id',
        targetKey: 'office_center_id',
        as: 'toCenter',
        constraints: false
      });

      // Booking belongs to from location
      this.belongsTo(models.Location, {
        foreignKey: 'from_location_id',
        targetKey: 'location_id',
        as: 'fromLocation',
        constraints: false
      });

      // Booking belongs to to location
      this.belongsTo(models.Location, {
        foreignKey: 'to_location_id',
        targetKey: 'location_id',
        as: 'toLocation',
        constraints: false
      });

      // Booking belongs to from customer
      this.belongsTo(models.Customer, {
        foreignKey: 'from_customer_id',
        targetKey: 'customer_id',
        as: 'fromCustomer',
        constraints: false
      });

      // Booking belongs to to customer
      this.belongsTo(models.Customer, {
        foreignKey: 'to_customer_id',
        targetKey: 'customer_id',
        as: 'toCustomer',
        constraints: false
      });

      // Booking has many booking packages
      this.hasMany(models.BookingPackage, {
        foreignKey: 'booking_id',
        sourceKey: 'booking_id',
        as: 'packages'
      });

      // Booking has many payments
      this.hasMany(models.Payment, {
        foreignKey: 'booking_id',
        sourceKey: 'booking_id',
        as: 'payments'
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

    // Generate LLR Number
    static generateLLRNumber() {
      const date = new Date();
      const year = date.getFullYear().toString().slice(-2);
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      return `LLR${year}${month}${day}${random}`;
    }

    // Generate Booking Number
    static generateBookingNumber() {
      const date = new Date();
      const year = date.getFullYear().toString().slice(-2);
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      return `BK${year}${month}${day}${random}`;
    }
  }

  Booking.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      booking_id: {
        type: DataTypes.STRING(50),
        primaryKey: true,
        defaultValue: UUIDV4,
      },
      booking_number: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        validate: {
          notEmpty: {
            msg: "Booking number is required"
          }
        }
      },
      llr_number: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        validate: {
          notEmpty: {
            msg: "LLR number is required"
          }
        }
      },
      booking_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        validate: {
          isDate: {
            msg: "Valid booking date is required"
          }
        }
      },
      from_center_id: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "From center is required"
          }
        }
      },
      to_center_id: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "To center is required"
          }
        }
      },
      from_location_id: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "From location is required"
          }
        }
      },
      to_location_id: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "To location is required"
          }
        }
      },
      from_customer_id: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "Sender customer is required"
          }
        }
      },
      to_customer_id: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "Receiver customer is required"
          }
        }
      },
      total_amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.00,
        validate: {
          isDecimal: {
            msg: "Total amount must be a valid decimal"
          }
        }
      },
      paid_amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      due_amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      payment_by: {
        type: DataTypes.ENUM('sender', 'receiver'),
        allowNull: false,
        defaultValue: 'sender'
      },
      payment_status: {
        type: DataTypes.ENUM('pending', 'partial', 'completed'),
        allowNull: false,
        defaultValue: 'pending'
      },
      delivery_status: {
        type: DataTypes.ENUM('not_started', 'pickup_assigned', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled'),
        allowNull: false,
        defaultValue: 'not_started'
      },
      actual_delivery_date: {
        type: DataTypes.DATEONLY,
        allowNull: true
      },
      special_instructions: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      reference_number: {
        type: DataTypes.STRING(100),
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
      modelName: "Booking",
      tableName: "bookings",
      timestamps: true,
      paranoid: true,
      hooks: {
        beforeValidate: (booking, options) => {
          // Generate booking number if not provided
          if (!booking.booking_number) {
            booking.booking_number = Booking.generateBookingNumber();
          }
          // Generate LLR number if not provided
          if (!booking.llr_number) {
            booking.llr_number = Booking.generateLLRNumber();
          }
          // Set booking date if not provided
          if (!booking.booking_date) {
            booking.booking_date = new Date().toISOString().split('T')[0];
          }
        },
        beforeSave: (booking, options) => {
          // Calculate due amount
          booking.due_amount = parseFloat(booking.total_amount) - parseFloat(booking.paid_amount);
          
          // Update payment status based on paid amount
          if (booking.due_amount <= 0) {
            booking.payment_status = 'completed';
          } else if (booking.paid_amount > 0) {
            booking.payment_status = 'partial';
          } else {
            booking.payment_status = 'pending';
          }
        }
      }
    }
  );

  return Booking;
};