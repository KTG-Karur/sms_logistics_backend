'use strict';

const { migrationDefaults } = require('../sequelize/defaults');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('vehicle', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      vehicle_id: {
        allowNull: false,
        unique: true,
        type: Sequelize.STRING
      },
      vehicle_number_plate: {
        allowNull: false,
        unique: true,
        type: Sequelize.STRING(20)
      },
      vehicle_type_id: {
        allowNull: false,
        type: Sequelize.STRING,
        references: {
          model: 'vehicle_type',
          key: 'vehicle_type_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      rc_number: {
        allowNull: false,
        unique: true,
        type: Sequelize.STRING(50)
      },
      rc_expiry_date: {
        allowNull: false,
        type: Sequelize.DATEONLY
      },
      insurance_number: {
        allowNull: false,
        type: Sequelize.STRING(50)
      },
      insurance_expiry_date: {
        allowNull: false,
        type: Sequelize.DATEONLY
      },
      rc_upload: {
        type: Sequelize.STRING(500),
        comment: 'URL/link to the uploaded RC document'
      },
      ...migrationDefaults(),
    });

    await queryInterface.addIndex('vehicle', ['vehicle_number_plate']);
    await queryInterface.addIndex('vehicle', ['rc_number']);
    await queryInterface.addIndex('vehicle', ['vehicle_type_id']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('vehicle');
  }
};