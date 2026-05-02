'use strict';
const { migrationDefaults } = require('../sequelize/defaults');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // First, check if table exists and drop it to start fresh
    await queryInterface.dropTable('extra_income').catch(() => {});
    
    await queryInterface.createTable('extra_income', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      extra_income_id: {
        allowNull: false,
        unique: true,
        type: Sequelize.STRING
      },
      income_date: {
        allowNull: false,
        type: Sequelize.DATEONLY
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
      income_type: {
        allowNull: false,
        type: Sequelize.ENUM('cash', 'upi', 'bank_transfer', 'cheque', 'other'),
        defaultValue: 'cash'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      },
      deleted_at: {
        allowNull: true,
        type: Sequelize.DATE
      },
      created_by: {
        type: Sequelize.STRING,
        allowNull: true
      },
      updated_by: {
        type: Sequelize.STRING,
        allowNull: true
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('extra_income');
  }
};