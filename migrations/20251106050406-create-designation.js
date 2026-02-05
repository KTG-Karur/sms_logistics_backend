'use strict';

const { migrationDefaults } = require('../sequelize/defaults');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('designation', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      designation_id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.STRING
      },
      designation_name: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      ...migrationDefaults(),
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('designation');
  }
};