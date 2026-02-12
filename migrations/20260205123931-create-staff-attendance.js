'use strict';
const { migrationDefaults } = require('../sequelize/defaults');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('staff_attendances', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      staff_attendance_id: {
        allowNull: false,
        unique: true,
        type: Sequelize.STRING
      },
      attendance_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      staff_id: {
        type: Sequelize.STRING,
        allowNull: false
      },
      attendance_status: {
        type: Sequelize.ENUM('present', 'absent'),
        defaultValue: 'absent'
      },
      ...migrationDefaults(),
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('staff_attendances');
  }
};