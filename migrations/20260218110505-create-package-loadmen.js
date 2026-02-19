'use strict';

const { migrationDefaults } = require('../sequelize/defaults');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('package_loadmen', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      package_loadman_id: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      trip_booking_id: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'trip_bookings',
          key: 'trip_booking_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      booking_package_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
        references: {
          model: 'booking_packages',
          key: 'booking_package_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      loadman_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
        references: {
          model: 'employees',
          key: 'employee_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      loadman_type: {
        type: Sequelize.ENUM('pickup', 'drop', 'both'),
        allowNull: false,
        defaultValue: 'both',
        comment: 'Whether loadman worked for pickup, drop, or both'
      },
      amount_earned: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Amount earned for this package assignment'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: 1,
      },
      ...migrationDefaults({ withUser: true }),
    });

    // Add indexes
    await queryInterface.addIndex('package_loadmen', ['trip_booking_id'], { name: 'idx_package_loadmen_trip_booking' });
    await queryInterface.addIndex('package_loadmen', ['booking_package_id'], { name: 'idx_package_loadmen_booking_package' });
    await queryInterface.addIndex('package_loadmen', ['loadman_id'], { name: 'idx_package_loadmen_loadman' });
    await queryInterface.addIndex('package_loadmen', ['trip_booking_id', 'booking_package_id', 'loadman_id'], { 
      name: 'idx_package_loadmen_unique', 
      unique: true 
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('package_loadmen');
  }
};