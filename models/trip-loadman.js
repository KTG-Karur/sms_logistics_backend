"use strict";

const { Model, UUIDV4 } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class TripLoadman extends Model {
    static associate(models) {
      this.belongsTo(models.Trip, {
    foreignKey: 'trip_id',
    targetKey: 'trip_id',  // Important: use trip_id, not id
    as: 'trip'
  });
  
  this.belongsTo(models.Employee, {
    foreignKey: 'loadman_id',
    targetKey: 'employee_id',  // Important: use employee_id, not id
    as: 'loadman'
  });
    }
  }

  TripLoadman.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      trip_loadman_id: {
        type: DataTypes.STRING,
        primaryKey: true,
        defaultValue: UUIDV4,
      },
      trip_id: {
        type: DataTypes.STRING,
        allowNull: false
      },
      loadman_id: {
        type: DataTypes.STRING(255), // Ensure this matches employee_id type
        allowNull: false
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
      modelName: "TripLoadman",
      tableName: "trip_loadmen",
      timestamps: true,
      paranoid: true,
    }
  );

  return TripLoadman;
};