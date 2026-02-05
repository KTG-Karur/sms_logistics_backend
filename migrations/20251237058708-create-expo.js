"use strict";
const { migrationDefaults } = require("../sequelize/defaults");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("expos", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      expo_id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.STRING,
        unique: true,
      },

      expo_name: {
        type: Sequelize.STRING,
      },

      country: {
        type: Sequelize.STRING,
      },

      place: {
        type: Sequelize.STRING,
      },

      from_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },

      to_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },

      year: {
        type: Sequelize.STRING(4),
        allowNull: true,
      },

      is_completed: {
        allowNull: false,
        type: Sequelize.BOOLEAN,
        defaultValue: 0,
      },
      staff: {
        type: Sequelize.TEXT("long"),
        allowNull: true,
        defaultValue: null,
      },

      ...migrationDefaults(),
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("expos");
  },
};
