'use strict';

const { migrationDefaults } = require('../sequelize/defaults');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('location', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      location_id: {
        allowNull: false,
        unique: true,
        type: Sequelize.STRING
      },
      location_name: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      office_center_id: {
        allowNull: false,
        type: Sequelize.STRING,
        references: {
          model: 'office_center',
          key: 'office_center_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      ...migrationDefaults(),
    });

    // Add indexes for faster lookups
    await queryInterface.addIndex('location', ['location_name'], {
      name: 'idx_location_name'
    });

    await queryInterface.addIndex('location', ['office_center_id'], {
      name: 'idx_location_office_center_id'
    });

    // Add composite index for duplicate checking
    await queryInterface.addIndex('location', ['location_name', 'office_center_id'], {
      name: 'idx_location_name_office_center',
      unique: false
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('location');
  }
};