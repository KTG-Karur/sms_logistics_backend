"use strict";

const { Model, UUIDV4 } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Vehicle extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // Vehicle belongs to vehicle type
      this.belongsTo(models.VehicleType, {
        foreignKey: "vehicle_type_id",
        targetKey: "vehicle_type_id",
        as: "vehicleType",
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

  Vehicle.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      vehicle_id: {
        type: DataTypes.STRING,
        primaryKey: true,
        defaultValue: UUIDV4,
      },
      vehicle_number_plate: {
        type: DataTypes.STRING(20),
        allowNull: false,
        unique: true,
        validate: {
          notEmpty: {
            msg: "Vehicle number plate is required",
          },
          len: {
            args: [5, 20],
            msg: "Vehicle number plate must be between 5 and 20 characters",
          },
        },
      },
      vehicle_type_id: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "Vehicle type is required",
          },
        },
      },
      rc_number: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        validate: {
          notEmpty: {
            msg: "RC number is required",
          },
        },
      },
      rc_expiry_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        validate: {
          isDate: {
            msg: "RC expiry date must be a valid date",
          },
          notEmpty: {
            msg: "RC expiry date is required",
          },
        },
      },
      insurance_number: {
        type: DataTypes.STRING(50),
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "Insurance number is required",
          },
        },
      },
      insurance_expiry_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        validate: {
          isDate: {
            msg: "Insurance expiry date must be a valid date",
          },
          notEmpty: {
            msg: "Insurance expiry date is required",
          },
        },
      },
      rc_upload: {
        type: DataTypes.STRING(500),
        allowNull: true,
        // validate: {
        //   isUrl: {
        //     msg: "RC upload must be a valid URL",
        //     args: {
        //       protocols: ["http", "https"],
        //       require_protocol: true,
        //     },
        //   },
        // },
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
      modelName: "Vehicle",
      tableName: "vehicle",
      timestamps: true,
      paranoid: true,
    }
  );

  return Vehicle;
};