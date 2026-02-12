"use strict";
const { Model, UUIDV4 } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class staff_attendance extends Model {
    static associate(models) {
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
  
  staff_attendance.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      staff_attendance_id: {
        type: DataTypes.STRING,
        primaryKey: true,
        defaultValue: UUIDV4,
      },
      attendance_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      staff_id: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      attendance_status: {
        type: DataTypes.ENUM('present', 'absent'),
        defaultValue: 'absent',
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
    {
      sequelize,
      modelName: "staff_attendance",
      tableName: "staff_attendances",
      underscored: true,
      paranoid: true,
    }
  );
  return staff_attendance;
};