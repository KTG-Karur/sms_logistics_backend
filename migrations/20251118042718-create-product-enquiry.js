"use strict";
const { migrationDefaults } = require("../sequelize/defaults");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("product_enquiries", {
      id: {
        allowNull: true,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      enquiry_id: {
        allowNull: true,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        unique: true,
      },
      enquiry_no: {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true,
      },
      expo_id: {
        type: Sequelize.STRING,
        allowNull: true,
        references: {
          model: "expos",
          key: "expo_id",
        },
      },
      visitor_name: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      visiting_card: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      company_name: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      city: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      country: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      contact_number: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      nature_of_enquiry: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      remarks: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM("active", "inactive"),
        defaultValue: "active",
      },
      enquiry_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      follow_up_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      products: {
        type: Sequelize.TEXT("long"),
        allowNull: true,
        comment: "JSON array of products with their details",
      },
      ...migrationDefaults(),
    });

    // Add indexes for better performance
    await queryInterface.addIndex("product_enquiries", ["enquiry_no"]);
    await queryInterface.addIndex("product_enquiries", ["expo_id"]);
    await queryInterface.addIndex("product_enquiries", ["visitor_name"]);
    await queryInterface.addIndex("product_enquiries", ["company_name"]);
    await queryInterface.addIndex("product_enquiries", ["email"]);
    await queryInterface.addIndex("product_enquiries", ["status"]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("product_enquiries");
  },
};
