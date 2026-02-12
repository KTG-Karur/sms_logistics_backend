'use strict';
const { migrationDefaults } = require('../sequelize/defaults');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('holidays', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      holiday_id: {
        allowNull: false,
        unique: true,
        type: Sequelize.STRING
      },
      holiday_date: {
        type: Sequelize.DATE
      },
      reason: {
        type: Sequelize.STRING
      },
      ...migrationDefaults()
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('holidays');
  }
};