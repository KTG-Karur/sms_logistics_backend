'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert('roles', [
      {
        role_id: 'd8ec3751-ff2a-48fe-b54f-98e846995cbc',
        role_name: 'Super Admin',
      },
      {
        role_id: 'b8c2d2bb-c922-435c-ad83-457eefe8f8e0',
        role_name: 'Collection Agent',
      },
      {
        role_id: '2810e291-bfcb-4336-9e60-a1ee730f44c1',
        role_name: 'Foreman'
      }
    ], {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('roles', null, {});
  }
};