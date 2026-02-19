'use strict';

const { migrationDefaults } = require('../sequelize/defaults');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('loadman_salaries', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      loadman_salary_id: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
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
      trip_id: {
        type: Sequelize.STRING,
        allowNull: true,
        references: {
          model: 'trips',
          key: 'trip_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      salary_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      total_pickup_charges: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      total_drop_charges: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      total_handling_charges: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      total_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      package_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      booking_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      status: {
        type: Sequelize.ENUM('pending', 'processed', 'paid'),
        allowNull: false,
        defaultValue: 'pending'
      },
      payment_date: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      payment_reference: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: 1,
      },
      ...migrationDefaults({ withUser: true }),
    });

    // Add indexes
    await queryInterface.addIndex('loadman_salaries', ['loadman_id'], { name: 'idx_loadman_salaries_loadman' });
    await queryInterface.addIndex('loadman_salaries', ['trip_id'], { name: 'idx_loadman_salaries_trip' });
    await queryInterface.addIndex('loadman_salaries', ['salary_date'], { name: 'idx_loadman_salaries_date' });
    await queryInterface.addIndex('loadman_salaries', ['status'], { name: 'idx_loadman_salaries_status' });
    await queryInterface.addIndex('loadman_salaries', ['loadman_id', 'salary_date'], { 
      name: 'idx_loadman_salaries_loadman_date' 
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('loadman_salaries');
  }
};