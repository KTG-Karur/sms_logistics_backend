'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('pages', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      page_id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.STRING
      },
      is_title: {
        type: Sequelize.BOOLEAN,
        defaultValue: null,
      },
      title: {
        type: Sequelize.STRING,
        defaultValue: null,
      },
      parent_id: {
        type: Sequelize.STRING,
        defaultValue: null,
      },
      page_name: {
        type: Sequelize.STRING,
        defaultValue: null,
      },
      page_url: {
        type: Sequelize.STRING,
        defaultValue: null,
      },
      icon_name: {
        type: Sequelize.STRING,
        defaultValue: null,
      },
      access_ids: {
        type: Sequelize.STRING,
        defaultValue: null,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: 1,
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
    await queryInterface.dropTable('pages');
  }
};