"use strict";
const { defaultKeys, migrationDefaults } = require("../sequelize/defaults");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("products", {
      product_id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        unique: true,
      },
      product_no: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      product_name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      product_composition: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      size: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      fabric_name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      washing_details: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      filling_material: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      low_quantity_price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      medium_quantity_price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      high_quantity_price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      moq: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      packaging: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      product_image: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      ...migrationDefaults(),
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("products");
  },
};
