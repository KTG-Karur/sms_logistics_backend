"use strict";

const { Model, UUIDV4 } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Payment extends Model {
    static associate(models) {
      // Payment belongs to booking
      this.belongsTo(models.Booking, {
        foreignKey: 'booking_id',
        targetKey: 'booking_id',
        as: 'booking',
        constraints: false
      });

      // Payment belongs to customer
      this.belongsTo(models.Customer, {
        foreignKey: 'customer_id',
        targetKey: 'customer_id',
        as: 'customer',
        constraints: false
      });

      // Payment belongs to employee who collected
      this.belongsTo(models.Employee, {
        foreignKey: 'collected_by',
        targetKey: 'employee_id',
        as: 'collector',
        constraints: false
      });

      // Payment belongs to center where collected
      this.belongsTo(models.OfficeCenter, {
        foreignKey: 'collected_at_center',
        targetKey: 'office_center_id',
        as: 'collectionCenter',
        constraints: false
      });
    }

    // Generate Payment Number
    static generatePaymentNumber() {
      const date = new Date();
      const year = date.getFullYear().toString().slice(-2);
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      return `PAY${year}${month}${day}${random}`;
    }
  }

  Payment.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      payment_id: {
        type: DataTypes.STRING(255),
        primaryKey: true,
        defaultValue: UUIDV4,
      },
      payment_number: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        validate: {
          notEmpty: {
            msg: "Payment number is required"
          }
        }
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
      customer_id: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "Customer ID is required"
          }
        }
      },
      amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        validate: {
          isDecimal: {
            msg: "Amount must be a valid decimal"
          },
          min: {
            args: [0.01],
            msg: "Amount must be greater than 0"
          }
        }
      },
      payment_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        validate: {
          isDate: {
            msg: "Valid payment date is required"
          }
        }
      },
      payment_mode: {
        type: DataTypes.ENUM('cash', 'card', 'upi', 'bank_transfer', 'cheque', 'wallet'),
        allowNull: false,
        validate: {
          isIn: {
            args: [['cash', 'card', 'upi', 'bank_transfer', 'cheque', 'wallet']],
            msg: "Invalid payment mode"
          }
        }
      },
      payment_type: {
        type: DataTypes.ENUM('advance', 'partial', 'full', 'refund'),
        allowNull: false,
        defaultValue: 'full'
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      collected_by: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      collected_at_center: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      status: {
        type: DataTypes.ENUM('pending', 'completed', 'failed', 'refunded'),
        allowNull: false,
        defaultValue: 'completed'
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
      modelName: "Payment",
      tableName: "payments",
      timestamps: true,
      paranoid: true,
      hooks: {
        beforeValidate: (payment, options) => {
          // Generate payment number if not provided
          if (!payment.payment_number) {
            payment.payment_number = Payment.generatePaymentNumber();
          }
          // Set payment date if not provided
          if (!payment.payment_date) {
            payment.payment_date = new Date().toISOString().split('T')[0];
          }
        }
      }
    }
  );

  return Payment;
};