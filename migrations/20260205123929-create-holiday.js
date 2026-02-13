'use strict';
const { migrationDefaults } = require('../sequelize/defaults');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('holidays', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            holiday_id: {
                allowNull: false,
                unique: true,
                type: Sequelize.STRING
            },
            holiday_date: {
                type: Sequelize.DATEONLY, // Changed from DATE to DATEONLY
                allowNull: false
            },
            reason: {
                type: Sequelize.STRING,
                allowNull: false
            },
            is_active: {
                type: Sequelize.BOOLEAN,
                defaultValue: 1
            },
            ...migrationDefaults()
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('holidays');
    }
};