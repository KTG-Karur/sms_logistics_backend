'use strict';

const { migrationDefaults } = require('../sequelize/defaults');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('booking_packages', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      booking_package_id: {
        allowNull: false,
        unique: true,
        type: Sequelize.STRING
      },
      booking_id: {
        allowNull: false,
        type: Sequelize.STRING,
      
      },
      package_type_id: {
        allowNull: false,
        type: Sequelize.STRING,
      
      },
      quantity: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: 1
      },
      pickup_charge: {
        allowNull: false,
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0.00
      },
      drop_charge: {
        allowNull: false,
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0.00
      },
      handling_charge: {
        allowNull: false,
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0.00
      },
      total_package_charge: {
        allowNull: false,
        type: Sequelize.DECIMAL(12, 2),
        defaultValue: 0.00
      },
      ...migrationDefaults(),
    });

    // Add indexes for faster lookups
    await queryInterface.addIndex('booking_packages', ['booking_id'], { name: 'idx_booking_id' });
    await queryInterface.addIndex('booking_packages', ['package_type_id'], { name: 'idx_package_type_id' });
    
    // Add composite index for duplicate checking
    await queryInterface.addIndex('booking_packages', ['booking_id', 'package_type_id'], { 
      name: 'idx_booking_package_unique', 
      unique: false 
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('booking_packages');
  }
};