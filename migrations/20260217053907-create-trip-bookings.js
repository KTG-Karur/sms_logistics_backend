'use strict';

const { migrationDefaults } = require('../sequelize/defaults');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('trip_bookings', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      trip_booking_id: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      trip_id: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'trips',
          key: 'trip_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      booking_id: {
        type: Sequelize.STRING(255), // CHANGED: from STRING(50) to STRING(255) to match bookings table
        allowNull: false,
        references: {
          model: 'bookings',
          key: 'booking_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      delivery_status: {
        type: Sequelize.ENUM('pending', 'picked_up', 'in_transit', 'delivered'),
        allowNull: false,
        defaultValue: 'pending'
      },
      ...migrationDefaults({ withUser: true }),
    });

    // Add indexes
    await queryInterface.addIndex('trip_bookings', ['trip_id'], { name: 'idx_trip_booking_trip' });
    await queryInterface.addIndex('trip_bookings', ['booking_id'], { name: 'idx_trip_booking_booking' });
    await queryInterface.addIndex('trip_bookings', ['trip_id', 'booking_id'], { 
      name: 'idx_trip_booking_unique', 
      unique: true 
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('trip_bookings');
  }
};