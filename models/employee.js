"use strict";

const { Model, UUIDV4 } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Employee extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // Employee belongs to role
      this.belongsTo(models.Role, {
        foreignKey: "role_id",
        targetKey: "role_id",
        as: "role",
        constraints: false,
      });

      // Employee belongs to user
      this.belongsTo(models.User, {
        foreignKey: "user_id",
        targetKey: "user_id",
        as: "user",
        constraints: false,
      });

      // // Employee belongs to department
      // this.belongsTo(models.Department, {
      //   foreignKey: "department_id",
      //   targetKey: "department_id",
      //   as: "department",
      //   constraints: false,
      // });

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

  Employee.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      employee_id: {
        type: DataTypes.STRING,
        primaryKey: true,
        defaultValue: UUIDV4,
      },
      employee_name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "Employee name is required",
          },
          len: {
            args: [2, 100],
            msg: "Employee name must be between 2 and 100 characters",
          },
        },
      },
      mobile_no: {
        type: DataTypes.STRING(10),
        allowNull: false,
        unique: true,
        validate: {
          notEmpty: {
            msg: "Mobile number is required",
          },
          len: {
            args: [10, 10],
            msg: "Mobile number must be exactly 10 digits",
          },
          isNumeric: {
            msg: "Mobile number must contain only numbers",
          },
        },
      },
      address_i: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      pincode: {
        type: DataTypes.STRING(6),
        allowNull: true,
        validate: {
          len: {
            args: [6, 6],
            msg: "Pincode must be exactly 6 digits",
          },
          isNumeric: {
            msg: "Pincode must contain only numbers",
          },
        },
      },
      role_id: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      department_id: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      is_authenticated: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      is_driver: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      has_salary: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      is_loadman: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      salary: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        validate: {
          isDecimal: {
            msg: "Salary must be a valid decimal number",
          },
          min: {
            args: [0],
            msg: "Salary must be greater than or equal to 0",
          },
        },
      },
       salary_type: { 
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: 'monthly',
        validate: {
          isIn: {
            args: [['daily', 'weekly', 'monthly', 'yearly', 'hourly', 'per_hour']],
            msg: "Salary type must be one of: daily, weekly, monthly, yearly, hourly, per_hour",
          },
        },
      },
      licence_number: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      licence_image: {
        type: DataTypes.STRING(500),
        allowNull: true,
        // validate: {
        //   isUrl: {
        //     msg: "Licence image must be a valid URL",
        //     args: {
        //       protocols: ["http", "https"],
        //       require_protocol: true,
        //     },
        //   },
        // },
      },
      user_id: {
        type: DataTypes.STRING,
        allowNull: true,
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
      modelName: "Employee",
      tableName: "employees",
      timestamps: true,
      paranoid: true,
    }
  );

  return Employee;
};