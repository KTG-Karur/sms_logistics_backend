"use strict";
const { Model } = require("sequelize");
const { defaultKeys, modelDefaults } = require("../sequelize/defaults");

module.exports = (sequelize, DataTypes) => {
  class ProductEnquiry extends Model {
    static associate(models) {
      // Association with Expo
      this.belongsTo(models.expo, {
        foreignKey: "expo_id",
        targetKey: "expo_id",
        as: "expo",
      });

      // Created by relationship
      this.belongsTo(models.Employee, {
        foreignKey: "created_by",
        targetKey: "employee_id",
        as: "createdBy",
        constraints: true,
      });

      // Updated by relationship
      this.belongsTo(models.Employee, {
        foreignKey: "updated_by",
        targetKey: "employee_id",
        as: "updatedBy",
        constraints: true,
      });
    }
  }

  ProductEnquiry.init(
    {
      ...defaultKeys("enquiry_id"),
      enquiry_no: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          notEmpty: true,
        },
      },
      expo_id: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          notEmpty: true,
        },
      },
      visitor_name: {
        type: DataTypes.STRING,
        allowNull: true,
        allowNull: true,
      },
      company_name: {
        type: DataTypes.STRING,
        allowNull: true,
        allowNull: true,
      },
      contact_number: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      visiting_card: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      city: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      country: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          isEmail: true,
        },
      },
      nature_of_enquiry: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("active", "inactive"),
        defaultValue: "active",
      },
      enquiry_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      follow_up_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      products: {
        type: DataTypes.TEXT("long"),
        allowNull: true,
        get() {
          const raw = this.getDataValue("products");
          try {
            return raw ? JSON.parse(raw) : [];
          } catch {
            return raw || [];
          }
        },
        set(value) {
          this.setDataValue("products", JSON.stringify(value || []));
        },
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
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
    modelDefaults(sequelize, "product_enquiries", "ProductEnquiry")
  );

  return ProductEnquiry;
};
