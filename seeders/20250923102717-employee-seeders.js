"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert(
      "employees",
      [
        {
          employee_id: "d947bcd2-3f73-4df0-8623-b4baf26d9682",
          employee_name: "KTG",
          mobile_no: "9876543210",
          address_i: "Karur",
          address_ii: "",
          pincode: "639002",
          role_id: "d8ec3751-ff2a-48fe-b54f-98e846995cbc",
          branch_id: "8c2f6bd5-0e49-43c0-a720-a8d0fbe49f94",
          is_authenticated: true,
          user_id: "14337a8b-d015-4c86-a406-1eb5258ddba2",
        },
      ],
      {}
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete("employees", null, {});
  },
};
