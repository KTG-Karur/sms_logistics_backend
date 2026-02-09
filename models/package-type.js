"use strict";

const { Model, UUIDV4 } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class PackageType extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // package type has many packages
    //   this.hasMany(models.Package, {
    //     foreignKey: "package_type_id",
    //     sourceKey: "package_type_id",
    //     as: "packages",
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

  PackageType.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      package_type_id: {
        type: DataTypes.STRING,
        primaryKey: true,
        defaultValue: UUIDV4,
      },
      package_type_name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "Package type name is required",
          },
          len: {
            args: [2, 100],
            msg: "Package type name must be between 2 and 100 characters",
          },
        },
      },
      package_pickup_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
          isDecimal: {
            msg: "Pickup price must be a valid decimal number",
          },
          min: {
            args: [0],
            msg: "Pickup price must be greater than or equal to 0",
          },
        },
      },
      package_drop_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
          isDecimal: {
            msg: "Drop price must be a valid decimal number",
          },
          min: {
            args: [0],
            msg: "Drop price must be greater than or equal to 0",
          },
        },
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: 1,
      },
      created_at: {
        type: DataTypes.DATE,
        field: "created_at",
      },
      deleted_at: {
        type: DataTypes.DATE,
        field: "deleted_at",
      },
      updated_at: {
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
      modelName: "PackageType",
      tableName: "package_type",
      timestamps: true,
      paranoid: true,
      underscored: true, // This ensures Sequelize uses snake_case for timestamps
    }
  );

  return PackageType;
};