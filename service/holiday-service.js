"use strict";
const sequelize = require('../models/index').sequelize;
const messages = require("../helpers/message");
const _ = require('lodash');
const { QueryTypes } = require('sequelize');

async function getHoliday(query) {
  try {
    let iql = "";
    let replacements = {};
    
    // Always filter by is_active = 1 unless specifically requested otherwise
    let conditions = ["is_active = 1"];
    
    // Build WHERE clause with existing conditions
    if (query && Object.keys(query).length > 0) {
      if (query.holidayId) {
        conditions.push(`holiday_id = :holidayId`);
        replacements.holidayId = query.holidayId;
      }
      if (query.isActive !== undefined && query.isActive !== '') {
        // Override the default if isActive is explicitly provided
        conditions = conditions.filter(c => !c.includes('is_active'));
        conditions.push(`is_active = :isActive`);
        replacements.isActive = query.isActive;
      }
      if (query.holidayDate) {
        conditions.push(`DATE(holiday_date) = :holidayDate`);
        replacements.holidayDate = query.holidayDate;
      }
    }
    
    iql = `WHERE ${conditions.join(' AND ')}`;
    
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
    
    console.log('SQL Query:', queryString);
    console.log('Replacements:', replacements);
    
    const result = await sequelize.query(
      queryString,
      { 
        type: QueryTypes.SELECT, 
        raw: true, 
        nest: false, 
        replacements: replacements 
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

// Replace your deleteHoliday function with this:

async function deleteHoliday(holidayId) {
  try {
    // Instead of destroy, update is_active to 0
    await sequelize.models.holiday.update(
      { 
        is_active: 0,
        updated_at: new Date() 
      },
      { 
        where: { holiday_id: holidayId } 
      }
    );
    
    return { success: true, message: 'Holiday deactivated successfully' };
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