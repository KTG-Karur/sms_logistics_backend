"use strict";
const { defaultKeys, migrationDefaults } = require("../sequelize/defaults");
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("employees", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      employee_id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.STRING,
        unique: true,
      },
      employee_name: {
        type: Sequelize.STRING,
      },
      mobile_no: {
        type: Sequelize.STRING,
      },
      address_i: {
        type: Sequelize.STRING,
      },
      address_ii: {
        type: Sequelize.STRING,
      },
      pincode: {
        type: Sequelize.STRING,
      },
      role_id: {
        type: Sequelize.STRING,
      },
      department_id: {
        type: Sequelize.STRING,
      },
      is_authenticated: {
        allowNull: false,
        type: Sequelize.BOOLEAN,
        defaultValue: 0,
      },
      user_id: {
        type: Sequelize.STRING,
        references: {
          model: "users",
          key: "user_id",
        },
      },
      ...migrationDefaults(),
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("employees");
  },
};
