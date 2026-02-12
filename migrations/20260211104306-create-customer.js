'use strict';

const { migrationDefaults } = require('../sequelize/defaults');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('customer', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      customer_id: {
        allowNull: false,
        unique: true,
        type: Sequelize.STRING
      },
      customer_name: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      customer_number: {
        allowNull: false,
        // unique: true,  // REMOVED - no longer unique
        type: Sequelize.STRING,
      },
      ...migrationDefaults(),
    });

    // Remove the unique index on customer_number
    await queryInterface.addIndex('customer', ['customer_number'], {
      name: 'idx_customer_number',
      unique: false  // Changed to false
    });

    await queryInterface.addIndex('customer', ['customer_name'], {
      name: 'idx_customer_name'
    });
    
    // Add composite index for faster duplicate checking
    await queryInterface.addIndex('customer', ['customer_number', 'customer_name'], {
      name: 'idx_customer_number_name',
      unique: false
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('customer');
  }
};