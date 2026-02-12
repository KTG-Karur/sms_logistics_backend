"use strict";

const { Model, UUIDV4 } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Location extends Model {
    /**
     * Helper method for defining associations.
     */
    static associate(models) {
      // location belongs to office center
      this.belongsTo(models.OfficeCenter, {
        foreignKey: 'office_center_id',
        targetKey: 'office_center_id',
        as: 'officeCenter',
        constraints: false
      });

    //   // location has many vehicles
    //   this.hasMany(models.Vehicle, {
    //     foreignKey: 'location_id',
    //     sourceKey: 'location_id',
    //     as: 'vehicles'
    //   });

    //   // location has many bookings
    //   this.hasMany(models.Booking, {
    //     foreignKey: 'location_id',
    //     sourceKey: 'location_id',
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

  Location.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      location_id: {
        type: DataTypes.STRING,
        primaryKey: true,
        defaultValue: UUIDV4,
      },
      location_name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "Location name is required"
          },
          len: {
            args: [2, 100],
            msg: "Location name must be between 2 and 100 characters"
          }
        }
      },
      office_center_id: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "Office center ID is required"
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
      modelName: "Location",
      tableName: "location",
      timestamps: true,
      paranoid: true,
      indexes: [
        {
          fields: ['location_name'],
          name: 'idx_location_name'
        },
        {
          fields: ['office_center_id'],
          name: 'idx_location_office_center_id'
        },
        {
          fields: ['location_name', 'office_center_id'],
          name: 'idx_location_name_office_center',
          unique: false
        }
      ]
    }
  );

  return Location;
};