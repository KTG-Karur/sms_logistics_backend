"use strict";
const { Model } = require("sequelize");
const { defaultKeys, modelDefaults } = require("../sequelize/defaults");
module.exports = (sequelize, DataTypes) => {
  class employee extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here

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
  employee.init(
    {
      ...defaultKeys("employee_id"),
      employee_name: DataTypes.STRING,
      mobile_no: DataTypes.STRING,
      address_i: DataTypes.STRING,
      address_ii: DataTypes.STRING,
      pincode: DataTypes.STRING,
      role_id: DataTypes.STRING,
      department_id: DataTypes.STRING,
      is_authenticated: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      user_id: {
        type: DataTypes.STRING,
        references: {
          model: "users",
          key: "user_id",
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
      }
    },
    modelDefaults(sequelize, "employees")
  );
  return employee;
};
