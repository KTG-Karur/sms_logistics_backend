"use strict";
const { Model } = require("sequelize");
const { defaultKeys, modelDefaults } = require("../sequelize/defaults");

module.exports = (sequelize, DataTypes) => {
  class expo extends Model {
    static associate(models) {
      // createdBy relationship
      this.belongsTo(models.Employee, {
        foreignKey: "created_by",
        targetKey: "employee_id",
        as: "createdBy",
        constraints: false,
      });
      // updatedBy relationship
      this.belongsTo(models.Employee, {
        foreignKey: "updated_by",
        targetKey: "employee_id",
        as: "updatedBy",
        constraints: false,
      });
    }
  }
  expo.init(
    {
      ...defaultKeys("expo_id"),
      expo_name: DataTypes.STRING,
      country: DataTypes.STRING,
      place: DataTypes.STRING,

      from_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },

      to_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },

      year: {
        type: DataTypes.STRING(4),
        allowNull: true,
      },

      is_completed: {
        type: DataTypes.BOOLEAN,
        defaultValue: 0,
      },
      staff: {
        type: DataTypes.TEXT("long"),
        allowNull: true,
        get() {
          const raw = this.getDataValue("staff");
          try {
            return raw ? JSON.parse(raw) : [];
          } catch {
            return raw;
          }
        },
        set(value) {
          this.setDataValue("staff", JSON.stringify(value ?? []));
        },
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: 1,
      },
      createdAt: {
        type: DataTypes.DATE,
        field: "created_at",
      },
      updatedAt: {
        type: DataTypes.DATE,
        field: "updated_at",
      },
      deletedAt: {
        type: DataTypes.DATE,
        field: "deleted_at",
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
    modelDefaults(sequelize, "expos")
  );

  return expo;
};
