"use strict";

const { Model, UUIDV4 } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class OfficeCenter extends Model {
    /**
     * Helper method for defining associations.
     */
    static associate(models) {
      // office center has many employees
    //   this.hasMany(models.Employee, {
    //     foreignKey: 'office_center_id',
    //     sourceKey: 'office_center_id',
    //     as: 'employees'
    //   });

      // office center has many vehicles
    //   this.hasMany(models.Vehicle, {
    //     foreignKey: 'office_center_id',
    //     sourceKey: 'office_center_id',
    //     as: 'vehicles'
    //   });

      // office center has many bookings
    //   this.hasMany(models.Booking, {
    //     foreignKey: 'office_center_id',
    //     sourceKey: 'office_center_id',
    //     as: 'bookings'
    //   });
      this.hasMany(models.Location, {
    foreignKey: 'office_center_id',
    sourceKey: 'office_center_id',
    as: 'locations'
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

  OfficeCenter.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      office_center_id: {
        type: DataTypes.STRING,
        primaryKey: true,
        defaultValue: UUIDV4,
      },
      office_center_name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "Office center name is required"
          },
          len: {
            args: [2, 100],
            msg: "Office center name must be between 2 and 100 characters"
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
      modelName: "OfficeCenter",
      tableName: "office_center",
      timestamps: true,
      paranoid: true,
      indexes: [
        {
          fields: ['office_center_name'],
          name: 'idx_office_center_name'
        }
      ]
    }
  );

  return OfficeCenter;
};