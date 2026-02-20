'use strict';
const { migrationDefaults } = require('../sequelize/defaults');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('salary_adjustments', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      adjustment_id: {
        allowNull: false,
        unique: true,
        type: Sequelize.STRING
      },
      employee_id: {
        allowNull: false,
        type: Sequelize.STRING,
        references: {
          model: 'employees',
          key: 'employee_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      adjustment_date: {
        allowNull: false,
        type: Sequelize.DATEONLY
      },
      type: {
        allowNull: false,
        type: Sequelize.ENUM('deduction', 'extra'),
        defaultValue: 'deduction'
      },
      amount: {
        allowNull: false,
        type: Sequelize.DECIMAL(10, 2),
        validate: {
          min: 0
        }
      },
      reason: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      salary_month: {
        allowNull: false,
        type: Sequelize.STRING(7),
        comment: 'Month in YYYY-MM format'
      },
      ...migrationDefaults(),
    });

    // Add indexes
    await queryInterface.addIndex('salary_adjustments', ['employee_id', 'salary_month'], {
      name: 'idx_adjustment_employee_month'
    });
    
    await queryInterface.addIndex('salary_adjustments', ['employee_id'], {
      name: 'idx_adjustment_employee'
    });
    
    await queryInterface.addIndex('salary_adjustments', ['salary_month'], {
      name: 'idx_adjustment_month'
    });
    
    await queryInterface.addIndex('salary_adjustments', ['type'], {
      name: 'idx_adjustment_type'
    });
    
    await queryInterface.addIndex('salary_adjustments', ['adjustment_date'], {
      name: 'idx_adjustment_date'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('salary_adjustments');
  }
};