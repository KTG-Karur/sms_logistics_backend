"use strict";
const { Model, UUIDV4 } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
    class holiday extends Model {
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

    holiday.init(
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            holiday_id: {
                type: DataTypes.STRING,
                primaryKey: true,
                defaultValue: UUIDV4,
            },
            holiday_date: {
                type: DataTypes.DATEONLY, // Changed from DATE to DATEONLY
                allowNull: false,
            },
            reason: {
                type: DataTypes.STRING,
                allowNull: false,
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
        {
            sequelize,
            modelName: "holiday",
            tableName: "holidays",
            underscored: true,
            paranoid: true,
        }
    );

    return holiday;
};