'use strict';

const access = require('../models/access');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    return queryInterface.bulkInsert('access', [
      {
        access_name: "View",
        is_active: 1,
      },
      {
        access_name: "Create",
        is_active: 1,
      },
      {
        access_name: "Update",
        is_active: 1,
      },
      {
        access_name: "Delete",
        is_active: 1,
      },
      {
        access_name: "Download",
        is_active: 1,
      },
      {
        access_name: "Kyc",
        is_active: 1,
      },
      {
        access_name: "Auction Winner Selection",
        is_active: 1,
      },
      {
        access_name: "Calculate",
        is_active: 1,
      },
      {
        access_name: "Print",
        is_active: 1,
      },
      {
        access_name: "Search",
        is_active: 1,
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    return queryInterface.bulkDelete('access', {}, null)
  }
};
