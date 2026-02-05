"use strict";

const { migrationDefaults } = require("../sequelize/defaults");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("role_permission", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      role_permission_id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.STRING,
      },
      access_ids: {
        type: Sequelize.TEXT,
      },
      role_id: {
        type: Sequelize.TEXT,
      },
      ...migrationDefaults(),
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("role_permission");
  },
};
