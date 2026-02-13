"use strict";
const sequelize = require('../models/index').sequelize;
const messages = require("../helpers/message");
const _ = require('lodash');
const { QueryTypes } = require('sequelize');

async function getHoliday(query) {
    try {
        let iql = "";
        let replacements = {}; // Add replacements for parameterized query
        
        // Build WHERE clause
        if (query && Object.keys(query).length > 0) {
            const conditions = [];
            
            if (query.holidayId) {
                conditions.push(`holiday_id = :holidayId`);
                replacements.holidayId = query.holidayId;
            }
            
            if (query.isActive !== undefined && query.isActive !== '') {
                conditions.push(`is_active = :isActive`);
                replacements.isActive = query.isActive;
            }
            
            if (query.holidayDate) {
                conditions.push(`DATE(holiday_date) = :holidayDate`);
                replacements.holidayDate = query.holidayDate;
            }
            
            if (conditions.length > 0) {
                iql = `WHERE ${conditions.join(' AND ')}`;
            }
        }

        // Add ordering
        const orderBy = ` ORDER BY holiday_date DESC`;

        const queryString = `
            SELECT 
                holiday_id AS "holidayId", 
                is_active AS "isActive", 
                holiday_date AS "holidayDate", 
                reason, 
                created_at AS "createdAt", 
                created_by AS "createdBy", 
                updated_at AS "updatedAt", 
                updated_by AS "updatedBy", 
                deleted_at AS "deletedAt" 
            FROM holidays 
            ${iql} 
            ${orderBy}
        `;

        console.log('SQL Query:', queryString); // For debugging
        console.log('Replacements:', replacements); // For debugging

        const result = await sequelize.query(
            queryString, 
            {
                type: QueryTypes.SELECT,
                raw: true,
                nest: false,
                replacements: replacements // Use parameterized query to prevent SQL injection
            }
        );
        
        return result;
    } catch (error) {
        console.error('Error in getHoliday:', error);
        throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
    }
}

async function createHoliday(postData) {
    try {
        // Convert camelCase to snake_case
        const excuteMethod = _.mapKeys(postData, (value, key) => _.snakeCase(key));
        
        // Add created_at timestamp
        excuteMethod.created_at = new Date();
        
        const holidayResult = await sequelize.models.holiday.create(excuteMethod);
        
        // Fetch the created holiday
        const req = { holidayId: holidayResult.holiday_id };
        return await getHoliday(req);
    } catch (error) {
        console.error('Error in createHoliday:', error);
        throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
    }
}

async function updateHoliday(holidayId, putData) {
    try {
        // Convert camelCase to snake_case
        const excuteMethod = _.mapKeys(putData, (value, key) => _.snakeCase(key));
        
        // Add updated_at timestamp
        excuteMethod.updated_at = new Date();
        
        await sequelize.models.holiday.update(excuteMethod, { 
            where: { holiday_id: holidayId } 
        });
        
        // Fetch the updated holiday
        const req = { holidayId: holidayId };
        return await getHoliday(req);
    } catch (error) {
        console.error('Error in updateHoliday:', error);
        throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
    }
}

// Add delete holiday function (missing from your backend)
async function deleteHoliday(holidayId) {
    try {
        // Soft delete (since paranoid: true)
        await sequelize.models.holiday.destroy({
            where: { holiday_id: holidayId }
        });
        
        return { success: true, message: 'Holiday deleted successfully' };
    } catch (error) {
        console.error('Error in deleteHoliday:', error);
        throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
    }
}

module.exports = {
    getHoliday,
    updateHoliday,
    createHoliday,
    deleteHoliday  // Export the new function
};