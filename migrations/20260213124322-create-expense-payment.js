'use strict';
const { migrationDefaults } = require('../sequelize/defaults');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('expense_payment', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      expense_payment_id: {
        allowNull: false,
        unique: true,
        type: Sequelize.STRING
      },
      expense_id: {
        allowNull: false,
        type: Sequelize.STRING,
        references: {
          model: 'expense',
          key: 'expense_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      payment_date: {
        allowNull: false,
        type: Sequelize.DATEONLY
      },
      amount: {
        allowNull: false,
        type: Sequelize.DECIMAL(10, 2)
      },
      payment_type: {
        allowNull: false,
        type: Sequelize.ENUM('cash', 'gpay', 'bank_transfer', 'cheque', 'other'),
        defaultValue: 'cash'
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      ...migrationDefaults(),
    });

    await queryInterface.addIndex('expense_payment', ['expense_id'], {
      name: 'idx_expense_payment_expense_id'
    });
    
    await queryInterface.addIndex('expense_payment', ['payment_date'], {
      name: 'idx_expense_payment_date'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('expense_payment');
  }
};