'use strict';

const { migrationDefaults } = require('../sequelize/defaults');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('trip_loadmen', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      trip_loadman_id: {
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
      loadman_id: {
        type: Sequelize.STRING(255), // Explicitly set to STRING(255) to match employees table
        allowNull: false,
        references: {
          model: 'employees',
          key: 'employee_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      ...migrationDefaults({ withUser: true }),
    });

    // Add indexes
    await queryInterface.addIndex('trip_loadmen', ['trip_id'], { name: 'idx_trip_loadman_trip' });
    await queryInterface.addIndex('trip_loadmen', ['loadman_id'], { name: 'idx_trip_loadman_employee' });
    await queryInterface.addIndex('trip_loadmen', ['trip_id', 'loadman_id'], { 
      name: 'idx_trip_loadman_unique', 
      unique: true 
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('trip_loadmen');
  }
};