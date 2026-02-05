'use strict';
const {
  Model,
  UUIDV4
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class role_permission extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
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
  role_permission.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    role_permission_id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: UUIDV4
    },
    access_ids: DataTypes.STRING,
    role_id: DataTypes.INTEGER,
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
  }, {
    sequelize,
    modelName: 'role_permission',
    tableName: 'role_permission',
  });
  return role_permission;
};