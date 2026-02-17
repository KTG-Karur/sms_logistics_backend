'use strict';

const { migrationDefaults } = require('../sequelize/defaults');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('trips', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      trip_id: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      trip_number: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true
      },
      from_center_id: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'office_center',
          key: 'office_center_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      to_center_id: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'office_center',
          key: 'office_center_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      vehicle_id: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'vehicle',
          key: 'vehicle_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      driver_id: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'employees',
          key: 'employee_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      trip_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      estimated_departure: {
        type: Sequelize.TIME,
        allowNull: false
      },
      estimated_arrival: {
        type: Sequelize.TIME,
        allowNull: false
      },
      actual_departure: {
        type: Sequelize.TIME,
        allowNull: true
      },
      actual_arrival: {
        type: Sequelize.TIME,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('scheduled', 'in_progress', 'completed', 'cancelled'),
        allowNull: false,
        defaultValue: 'scheduled'
      },
      remarks: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      total_weight: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      total_packages: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      total_amount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0
      },
      ...migrationDefaults({ withUser: true }),
    });

    // Add indexes
    await queryInterface.addIndex('trips', ['trip_number'], { name: 'idx_trip_number' });
    await queryInterface.addIndex('trips', ['trip_date'], { name: 'idx_trip_date' });
    await queryInterface.addIndex('trips', ['status'], { name: 'idx_trip_status' });
    await queryInterface.addIndex('trips', ['from_center_id'], { name: 'idx_from_center' });
    await queryInterface.addIndex('trips', ['to_center_id'], { name: 'idx_to_center' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('trips');
  }
};