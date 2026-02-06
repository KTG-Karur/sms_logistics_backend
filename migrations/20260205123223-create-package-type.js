'use strict';

const { migrationDefaults } = require('../sequelize/defaults');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('package_type', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      package_type_id: {
        allowNull: false,
        unique: true,
        type: Sequelize.STRING
      },
      package_pickup_price: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      package_drop_price: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      package_type_name: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      ...migrationDefaults(),
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('package_type');
  }
};