// service/opening-balance-service.js
'use strict';

const messages = require("../helpers/message");
const _ = require("lodash");
const { Op } = require("sequelize");
const { OpeningBalance, sequelize } = require("../models");

async function getOpeningBalance(query, needIsActive = true) {
  try {
    let whereClause = {};
    
    // Filter by opening_balance_id if provided
    if (query.openingBalanceId) {
      whereClause.opening_balance_id = query.openingBalanceId;
    }
    
    // Filter by office_center_id if provided
    if (query.officeCenterId) {
      whereClause.office_center_id = query.officeCenterId;
    }
    
    // Filter by date if provided
    if (query.date) {
      whereClause.date = query.date;
    }
    
    // Filter by date range if provided
    if (query.startDate && query.endDate) {
      whereClause.date = {
        [Op.between]: [query.startDate, query.endDate]
      };
    }
    
    if (needIsActive) {
      whereClause.is_active = 1;
    }

    const openingBalances = await OpeningBalance.findAll({
      where: whereClause,
      attributes: [
        'opening_balance_id',
        'date',
        'office_center_id',
        'opening_balance',
        'notes',
        'is_active',
        'created_at',
        'updated_at',
        'created_by',
        'updated_by'
      ],
      order: [['date', 'DESC'], ['created_at', 'DESC']]
    });
    
    return openingBalances;
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

async function createOpeningBalance(postData) {
  const transaction = await sequelize.transaction();
  
  try {
    const executeMethod = _.mapKeys(postData, (value, key) => _.snakeCase(key));
    
    // Check for duplicate opening balance for same office center and date
    if (executeMethod.date && executeMethod.office_center_id) {
      const existingBalance = await OpeningBalance.findOne({
        where: {
          date: executeMethod.date,
          office_center_id: executeMethod.office_center_id,
          is_active: 1
        },
        transaction
      });
      
      if (existingBalance) {
        throw new Error("Opening balance already exists for this date and office center");
      }
    }
    
    const openingBalanceResult = await OpeningBalance.create(
      executeMethod,
      { transaction }
    );
    
    await transaction.commit();
    
    const result = await OpeningBalance.findOne({
      where: { opening_balance_id: openingBalanceResult.opening_balance_id },
      attributes: [
        'opening_balance_id',
        'date',
        'office_center_id',
        'opening_balance',
        'notes',
        'is_active',
        'created_at',
        'updated_at'
      ]
    });
    
    return result;
  } catch (error) {
    await transaction.rollback();
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

async function updateOpeningBalance(openingBalanceId, putData) {
  const transaction = await sequelize.transaction();
  
  try {
    const executeMethod = _.mapKeys(putData, (value, key) => _.snakeCase(key));
    
    // Check for duplicate opening balance for same office center and date (excluding current record)
    if (executeMethod.date || executeMethod.office_center_id) {
      // Get current opening balance to know date and office_center_id if not provided in update
      let date = executeMethod.date;
      let officeCenterId = executeMethod.office_center_id;
      
      if (!date || !officeCenterId) {
        const currentBalance = await OpeningBalance.findOne({
          where: { opening_balance_id: openingBalanceId },
          transaction
        });
        
        date = date || currentBalance?.date;
        officeCenterId = officeCenterId || currentBalance?.office_center_id;
      }
      
      if (date && officeCenterId) {
        const existingBalance = await OpeningBalance.findOne({
          where: {
            date: date,
            office_center_id: officeCenterId,
            opening_balance_id: { [Op.ne]: openingBalanceId },
            is_active: 1
          },
          transaction
        });
        
        if (existingBalance) {
          throw new Error("Opening balance already exists for this date and office center");
        }
      }
    }
    
    const [affectedCount] = await OpeningBalance.update(
      executeMethod,
      {
        where: { opening_balance_id: openingBalanceId },
        transaction
      }
    );
    
    if (affectedCount === 0) {
      throw new Error(messages.DATA_NOT_FOUND);
    }
    
    await transaction.commit();
    
    const result = await OpeningBalance.findOne({
      where: { opening_balance_id: openingBalanceId },
      attributes: [
        'opening_balance_id',
        'date',
        'office_center_id',
        'opening_balance',
        'notes',
        'is_active',
        'created_at',
        'updated_at'
      ]
    });
    
    return result;
  } catch (error) {
    await transaction.rollback();
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

async function deleteOpeningBalance(openingBalanceId) {
  const transaction = await sequelize.transaction();
  
  try {
    const [affectedCount] = await OpeningBalance.update(
      { is_active: 0 },
      {
        where: { opening_balance_id: openingBalanceId, is_active: 1 },
        transaction
      }
    );
    
    if (affectedCount === 0) {
      throw new Error(messages.DATA_NOT_FOUND);
    }
    
    await transaction.commit();
    
    return {
      success: true,
      message: "Opening balance deleted successfully"
    };
  } catch (error) {
    await transaction.rollback();
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

module.exports = {
  getOpeningBalance,
  createOpeningBalance,
  updateOpeningBalance,
  deleteOpeningBalance
};