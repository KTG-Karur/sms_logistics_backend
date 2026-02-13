'use strict';
const { migrationDefaults } = require('../sequelize/defaults');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("employees", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      employee_id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.STRING,
        unique: true,
      },
      employee_name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      mobile_no: {
        type: Sequelize.STRING(10),
        allowNull: false,
      },
      address_i: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      pincode: {
        type: Sequelize.STRING(6),
        allowNull: true,
      },
      role_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      department_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      is_authenticated: {
        allowNull: false,
        type: Sequelize.BOOLEAN,
        defaultValue: 0,
      },
      is_driver: {
        allowNull: false,
        type: Sequelize.BOOLEAN,
        defaultValue: 0,
      },
      has_salary: {
        allowNull: false,
        type: Sequelize.BOOLEAN,
        defaultValue: 0,
      },
      is_loadman: {
        allowNull: false,
        type: Sequelize.BOOLEAN,
        defaultValue: 0,
      },
      salary: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      salary_type: {  // ✅ NEW FIELD ADDED
        type: Sequelize.STRING(50),
        allowNull: true,
        defaultValue: 'monthly',
        comment: 'Salary type: daily, weekly, monthly, yearly',
      },
      licence_number: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      licence_image: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'URL/link to the uploaded licence image',
      },
      user_id: {
        type: Sequelize.STRING,
        allowNull: true,
        references: {
          model: "users",
          key: "user_id",
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      ...migrationDefaults(),
    });

    // Add indexes for better performance
    await queryInterface.addIndex('employees', ['mobile_no'], { unique: true });
    await queryInterface.addIndex('employees', ['employee_name']);
    await queryInterface.addIndex('employees', ['role_id']);
    await queryInterface.addIndex('employees', ['is_driver']);
    await queryInterface.addIndex('employees', ['is_authenticated']);
    await queryInterface.addIndex('employees', ['licence_number']);
    await queryInterface.addIndex('employees', ['user_id']);
    await queryInterface.addIndex('employees', ['salary_type']); // ✅ NEW INDEX
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("employees");
  },
};