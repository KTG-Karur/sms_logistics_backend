'use strict';
const { migrationDefaults } = require('../sequelize/defaults');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('expense', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      expense_id: {
        allowNull: false,
        unique: true,
        type: Sequelize.STRING
      },
      expense_date: {
        allowNull: false,
        type: Sequelize.DATEONLY
      },
      expense_type_id: {
        allowNull: false,
        type: Sequelize.STRING,
        references: {
          model: 'expence_type',
          key: 'expence_type_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
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
      amount: {
        allowNull: false,
        type: Sequelize.DECIMAL(10, 2)
      },
      paid_amount: {
        allowNull: false,
        defaultValue: 0,
        type: Sequelize.DECIMAL(10, 2)
      },
      is_paid: {
        allowNull: false,
        defaultValue: false,
        type: Sequelize.BOOLEAN
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      ...migrationDefaults(),
    });

    // Add indexes for faster queries
    await queryInterface.addIndex('expense', ['expense_date'], {
      name: 'idx_expense_date'
    });
    
    await queryInterface.addIndex('expense', ['expense_type_id'], {
      name: 'idx_expense_type_id'
    });
    
    await queryInterface.addIndex('expense', ['office_center_id'], {
      name: 'idx_office_center_id'
    });
    
    await queryInterface.addIndex('expense', ['is_paid'], {
      name: 'idx_is_paid'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('expense');
  }
};