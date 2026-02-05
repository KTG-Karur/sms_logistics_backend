'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('companies', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      company_id: {
        type: Sequelize.STRING
      },
      company_name: {
        type: Sequelize.STRING
      },
      company_mobile: {
        type: Sequelize.STRING
      },
      company_alt_mobile: {
        type: Sequelize.STRING
      },
      company_mail: {
        type: Sequelize.STRING
      },
      company_gst_no: {
        type: Sequelize.STRING
      },
      company_address_one: {
        type: Sequelize.STRING
      },
      company_address_two: {
        type: Sequelize.STRING
      },
      company_logo: {
        type: Sequelize.STRING
      },
      user_id: {
        type: Sequelize.STRING,
        references: {
          model: "users",
          key: "user_id",
        },
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('companies');
  }
};