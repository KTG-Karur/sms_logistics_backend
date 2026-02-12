'use strict';

const { migrationDefaults } = require('../sequelize/defaults');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('office_center', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      office_center_id: {
        allowNull: false,
        unique: true,
        type: Sequelize.STRING
      },
      office_center_name: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      ...migrationDefaults(),
    });

    // Add index for faster lookups
    await queryInterface.addIndex('office_center', ['office_center_name'], {
      name: 'idx_office_center_name'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('office_center');
  }
};