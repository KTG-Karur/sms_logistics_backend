'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert('users', [
      {
        user_id: '14337a8b-d015-4c86-a406-1eb5258ddba2',
        role_id: 'd8ec3751-ff2a-48fe-b54f-98e846995cbc',
        user_name: 'admin@k3chitfunds',
        password: 'U2FsdGVkX19NpiswBHkNJ1THku/+No3Gh/daZZyO4CQ='
      },
    ], {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('users', null, {});
  }
};