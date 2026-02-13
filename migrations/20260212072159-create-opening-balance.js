// migrations/YYYYMMDDHHMMSS-create-opening-balance.js
'use strict';

const { migrationDefaults } = require('../sequelize/defaults');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('opening_balance', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      opening_balance_id: {
        allowNull: false,
        unique: true,
        type: Sequelize.STRING
      },
      date: {
        allowNull: false,
        type: Sequelize.DATEONLY
      },
      office_center_id: {
        allowNull: false,
        type: Sequelize.STRING
        // Removed foreign key constraint
      },
      opening_balance: {
        allowNull: false,
        type: Sequelize.DECIMAL(15, 2),
        defaultValue: 0.00
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      ...migrationDefaults(),
    });

    // Add indexes for faster lookups
    await queryInterface.addIndex('opening_balance', ['date'], {
      name: 'idx_opening_balance_date'
    });

    await queryInterface.addIndex('opening_balance', ['office_center_id'], {
      name: 'idx_opening_balance_office_center_id'
    });

    // Add composite index for unique constraint per office center per date
    await queryInterface.addIndex('opening_balance', ['date', 'office_center_id'], {
      name: 'idx_opening_balance_date_office_center',
      unique: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('opening_balance');
  }
};