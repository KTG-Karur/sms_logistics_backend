"use strict";
const { ExtraIncome, OfficeCenter, Employee, sequelize } = require("../models");
const { Op } = require("sequelize");
const _ = require("lodash");

async function getExtraIncomes(query) {
  try {
    let whereClause = { is_active: 1 };
    const { income_date, startDate, endDate, officeCenterId, incomeType, page = 1, limit = 100 } = query;

    if (income_date) {
      whereClause.income_date = income_date;
    }
    
    if (officeCenterId) {
      whereClause.office_center_id = officeCenterId;
    }

    if (incomeType) {
      whereClause.income_type = incomeType;
    }
    
    if (startDate && endDate) {
      whereClause.income_date = {
        [Op.between]: [startDate, endDate]
      };
    } else if (startDate) {
      whereClause.income_date = { [Op.gte]: startDate };
    } else if (endDate) {
      whereClause.income_date = { [Op.lte]: endDate };
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const parsedLimit = parseInt(limit);

    const { count, rows } = await ExtraIncome.findAndCountAll({
      where: whereClause,
      attributes: ['extra_income_id', 'income_date', 'amount', 'income_type', 'description', 'created_at'],
      include: [
        {
          model: OfficeCenter,
          as: 'officeCenter',
          attributes: ['office_center_id', 'office_center_name']
        },
        {
          model: Employee,
          as: 'createdBy',
          attributes: ['employee_id', 'employee_name']
        }
      ],
      order: [['income_date', 'DESC'], ['created_at', 'DESC']],
      limit: parsedLimit,
      offset: offset,
      distinct: true
    });

    return {
      total: count,
      page: parseInt(page),
      limit: parsedLimit,
      totalPages: Math.ceil(count / parsedLimit),
      data: rows
    };
  } catch (error) {
    throw new Error(error.message || "Error fetching extra incomes");
  }
}

async function getExtraIncomeById(extraIncomeId) {
  try {
    const extraIncome = await ExtraIncome.findOne({
      where: { 
        extra_income_id: extraIncomeId,
        is_active: 1 
      },
      attributes: ['extra_income_id', 'income_date', 'amount', 'income_type', 'description', 'created_at'],
      include: [
        {
          model: OfficeCenter,
          as: 'officeCenter',
          attributes: ['office_center_id', 'office_center_name']
        },
        {
          model: Employee,
          as: 'createdBy',
          attributes: ['employee_id', 'employee_name']
        },
        {
          model: Employee,
          as: 'updatedBy',
          attributes: ['employee_id', 'employee_name']
        }
      ]
    });

    if (!extraIncome) {
      throw new Error("Extra income not found");
    }

    return extraIncome;
  } catch (error) {
    throw new Error(error.message || "Error fetching extra income");
  }
}

async function createExtraIncome(postData) {
  try {
    const excuteMethod = _.mapKeys(postData, (value, key) => _.snakeCase(key));
    
    // Validate office center exists
    const officeCenter = await OfficeCenter.findOne({
      where: { office_center_id: excuteMethod.office_center_id, is_active: 1 }
    });
    
    if (!officeCenter) {
      throw new Error("Invalid office center");
    }

    const result = await ExtraIncome.create(excuteMethod);
    return await getExtraIncomeById(result.extra_income_id);
  } catch (error) {
    throw new Error(error.message || "Error creating extra income");
  }
}

async function updateExtraIncome(extraIncomeId, putData) {
  try {
    const excuteMethod = _.mapKeys(putData, (value, key) => _.snakeCase(key));

    const existingIncome = await ExtraIncome.findOne({
      where: { extra_income_id: extraIncomeId, is_active: 1 }
    });

    if (!existingIncome) {
      throw new Error("Extra income not found");
    }

    // Validate office center if being updated
    if (excuteMethod.office_center_id) {
      const officeCenter = await OfficeCenter.findOne({
        where: { office_center_id: excuteMethod.office_center_id, is_active: 1 }
      });
      
      if (!officeCenter) {
        throw new Error("Invalid office center");
      }
    }

    const [affectedCount] = await ExtraIncome.update(
      excuteMethod,
      { where: { extra_income_id: extraIncomeId } }
    );

    if (affectedCount === 0) {
      throw new Error("Update failed");
    }

    return await getExtraIncomeById(extraIncomeId); 
  } catch (error) {
    throw new Error(error.message || "Error updating extra income");
  }
}

async function deleteExtraIncome(extraIncomeId) {
  try {
    const [affectedCount] = await ExtraIncome.update(
      { is_active: 0 },
      { where: { extra_income_id: extraIncomeId, is_active: 1 } }
    );

    if (affectedCount === 0) {
      throw new Error("Extra income not found");
    }

    return { success: true, message: "Extra income deleted successfully" };
  } catch (error) {
    throw new Error(error.message || "Error deleting extra income");
  }
}

module.exports = {
  getExtraIncomes,
  getExtraIncomeById,
  createExtraIncome,
  updateExtraIncome,
  deleteExtraIncome
};