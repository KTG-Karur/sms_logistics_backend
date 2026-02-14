'use strict';

const { migrationDefaults } = require('../sequelize/defaults');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('payments', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      payment_id: {
        allowNull: false,
        unique: true,
        type: Sequelize.STRING
      },
      payment_number: {
        allowNull: false,
        unique: true,
        type: Sequelize.STRING
      },
      booking_id: {
        allowNull: false,
        type: Sequelize.STRING,
            },
      customer_id: {
        allowNull: false,
        type: Sequelize.STRING,
            },
      amount: {
        allowNull: false,
        type: Sequelize.DECIMAL(12, 2)
      },
      payment_date: {
        allowNull: false,
        type: Sequelize.DATEONLY
      },
      payment_mode: {
        allowNull: false,
        type: Sequelize.ENUM('cash', 'card', 'upi', 'bank_transfer', 'cheque', 'wallet')
      },
      payment_type: {
        allowNull: false,
        type: Sequelize.ENUM('advance', 'partial', 'full', 'refund'),
        defaultValue: 'full'
      },
      description: {
        allowNull: true,
        type: Sequelize.TEXT
      },
      collected_by: {
        allowNull: true,
        type: Sequelize.STRING,
      
      },
      collected_at_center: {
        allowNull: true,
        type: Sequelize.STRING,
      
      },
      status: {
        allowNull: false,
        type: Sequelize.ENUM('pending', 'completed', 'failed', 'refunded'),
        defaultValue: 'completed'
      },
      ...migrationDefaults(),
    });

    // Add indexes for faster lookups
    await queryInterface.addIndex('payments', ['payment_number'], { name: 'idx_payment_number' });
    await queryInterface.addIndex('payments', ['booking_id'], { name: 'idx_booking_id' });
    await queryInterface.addIndex('payments', ['customer_id'], { name: 'idx_customer_id' });
    await queryInterface.addIndex('payments', ['payment_date'], { name: 'idx_payment_date' });
    await queryInterface.addIndex('payments', ['payment_mode'], { name: 'idx_payment_mode' });
    await queryInterface.addIndex('payments', ['status'], { name: 'idx_status' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('payments');
  }
};