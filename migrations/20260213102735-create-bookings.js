'use strict';

const { migrationDefaults } = require('../sequelize/defaults');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('bookings', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      booking_id: {
        allowNull: false,
        unique: true,
        type: Sequelize.STRING
      },
      booking_number: {
        allowNull: false,
        unique: true,
        type: Sequelize.STRING
      },
      llr_number: {
        allowNull: false,
        unique: true,
        type: Sequelize.STRING
      },
      booking_date: {
        allowNull: false,
        type: Sequelize.DATEONLY
      },
      from_center_id: {
        allowNull: false,
        type: Sequelize.STRING,
       
      },
      to_center_id: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      from_location_id: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      to_location_id: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      from_customer_id: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      to_customer_id: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      total_amount: {
        allowNull: false,
        type: Sequelize.DECIMAL(12, 2),
        defaultValue: 0.00
      },
      paid_amount: {
        allowNull: false,
        type: Sequelize.DECIMAL(12, 2),
        defaultValue: 0.00
      },
      due_amount: {
        allowNull: false,
        type: Sequelize.DECIMAL(12, 2),
        defaultValue: 0.00
      },
      payment_by: {
        allowNull: false,
        type: Sequelize.ENUM('sender', 'receiver'),
        defaultValue: 'sender'
      },
      payment_status: {
        allowNull: false,
        type: Sequelize.ENUM('pending', 'partial', 'completed'),
        defaultValue: 'pending'
      },
      delivery_status: {
        allowNull: false,
        type: Sequelize.ENUM('not_started', 'pickup_assigned', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled'),
        defaultValue: 'not_started'
      },
      actual_delivery_date: {
        allowNull: true,
        type: Sequelize.DATEONLY
      },
      special_instructions: {
        allowNull: true,
        type: Sequelize.TEXT
      },
      reference_number: {
        allowNull: true,
        type: Sequelize.STRING
      },
      ...migrationDefaults(),
    });

    // Add indexes for faster lookups
    await queryInterface.addIndex('bookings', ['booking_number'], { name: 'idx_booking_number' });
    await queryInterface.addIndex('bookings', ['llr_number'], { name: 'idx_llr_number' });
    await queryInterface.addIndex('bookings', ['booking_date'], { name: 'idx_booking_date' });
    await queryInterface.addIndex('bookings', ['from_center_id'], { name: 'idx_from_center' });
    await queryInterface.addIndex('bookings', ['to_center_id'], { name: 'idx_to_center' });
    await queryInterface.addIndex('bookings', ['from_customer_id'], { name: 'idx_from_customer' });
    await queryInterface.addIndex('bookings', ['to_customer_id'], { name: 'idx_to_customer' });
    await queryInterface.addIndex('bookings', ['delivery_status'], { name: 'idx_delivery_status' });
    await queryInterface.addIndex('bookings', ['payment_status'], { name: 'idx_payment_status' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('bookings');
  }
};