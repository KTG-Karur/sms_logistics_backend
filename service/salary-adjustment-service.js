"use strict";

const messages = require("../helpers/message");
const _ = require("lodash");
const { Op } = require("sequelize");
const { SalaryAdjustment, Employee, sequelize } = require("../models");

async function getSalaryAdjustment(query, needIsActive = true) {
  try {
    let whereClause = {};
    
    // Filter by adjustment ID
    if (query.adjustmentId) {
      whereClause.adjustment_id = query.adjustmentId;
    }
    
    // Filter by employee ID
    if (query.employeeId) {
      whereClause.employee_id = query.employeeId;
    }
    
    // Filter by type (deduction/extra)
    if (query.type) {
      whereClause.type = query.type;
    }
    
    // Filter by salary month (YYYY-MM)
    if (query.salaryMonth) {
      whereClause.salary_month = query.salaryMonth;
    }
    
    // Filter by date range
    if (query.startDate && query.endDate) {
      whereClause.adjustment_date = {
        [Op.between]: [query.startDate, query.endDate]
      };
    } else if (query.startDate) {
      whereClause.adjustment_date = {
        [Op.gte]: query.startDate
      };
    } else if (query.endDate) {
      whereClause.adjustment_date = {
        [Op.lte]: query.endDate
      };
    }
    
    // Search by reason
    if (query.search) {
      whereClause[Op.or] = [
        { reason: { [Op.like]: `%${query.search}%` } },
        { '$Employee.employee_name$': { [Op.like]: `%${query.search}%` } }
      ];
    }
    
    // Filter by active status
    if (needIsActive) {
      whereClause.is_active = 1;
    }

    // Pagination
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 100;
    const offset = (page - 1) * limit;

    const { count, rows } = await SalaryAdjustment.findAndCountAll({
      where: whereClause,
      attributes: [
        'adjustment_id',
        'employee_id',
        'adjustment_date',
        'type',
        'amount',
        'reason',
        'salary_month',
        'is_active',
        'created_at',
        'updated_at',
        'created_by',
        'updated_by'
      ],
      include: [
        {
          model: Employee,
          as: 'employee',
          // ✅ Removed employee_number and using only available fields
          attributes: ['employee_id', 'employee_name', 'mobile_no'], 
          where: needIsActive ? { is_active: 1 } : {},
          required: false
        }
      ],
      order: [
        ['salary_month', 'DESC'],
        ['adjustment_date', 'DESC'],
        ['created_at', 'DESC']
      ],
      limit: limit,
      offset: offset,
      distinct: true
    });

    // If single record requested, return first item
    if (query.adjustmentId && rows.length === 1) {
      return rows[0];
    }

    // If pagination requested, return with metadata
    if (query.page || query.limit) {
      return {
        total: count,
        page: page,
        limit: limit,
        totalPages: Math.ceil(count / limit),
        data: rows
      };
    }

    return rows;
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

async function createSalaryAdjustment(postData) {
  const transaction = await sequelize.transaction();
  
  try {
    const excuteMethod = _.mapKeys(postData, (value, key) => _.snakeCase(key));
    
    // Check if employee exists and is active
    if (excuteMethod.employee_id) {
      const employee = await Employee.findOne({
        where: {
          employee_id: excuteMethod.employee_id,
          is_active: 1
        },
        transaction
      });
      
      if (!employee) {
        throw new Error("Employee not found or inactive");
      }
    }
    
    // Validate that the adjustment date falls within the salary month
    const adjustmentDate = new Date(excuteMethod.adjustment_date);
    const [year, month] = excuteMethod.salary_month.split('-').map(Number);
    
    if (adjustmentDate.getFullYear() !== year || (adjustmentDate.getMonth() + 1) !== month) {
      throw new Error("Adjustment date must be within the specified salary month");
    }
    
    const adjustmentResult = await SalaryAdjustment.create(
      excuteMethod,
      { transaction }
    );
    
    await transaction.commit();
    
    // Return created record with employee details - ✅ removed employee_number
    const result = await SalaryAdjustment.findOne({
      where: { adjustment_id: adjustmentResult.adjustment_id },
      attributes: [
        'adjustment_id',
        'employee_id',
        'adjustment_date',
        'type',
        'amount',
        'reason',
        'salary_month',
        'is_active',
        'created_at',
        'updated_at'
      ],
      include: [
        {
          model: Employee,
          as: 'employee',
          attributes: ['employee_id', 'employee_name', 'mobile_no'] // ✅ Using mobile_no instead
        }
      ]
    });
    
    return result;
  } catch (error) {
    await transaction.rollback();
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

async function updateSalaryAdjustment(adjustmentId, putData) {
  const transaction = await sequelize.transaction();
  
  try {
    const excuteMethod = _.mapKeys(putData, (value, key) => _.snakeCase(key));
    
    // Get existing adjustment
    const existingAdjustment = await SalaryAdjustment.findOne({
      where: { adjustment_id: adjustmentId, is_active: 1 },
      transaction
    });
    
    if (!existingAdjustment) {
      throw new Error(messages.DATA_NOT_FOUND);
    }
    
    // Don't allow changing employee_id
    if (excuteMethod.employee_id && excuteMethod.employee_id !== existingAdjustment.employee_id) {
      throw new Error("Cannot change employee ID after adjustment is created");
    }
    
    // If updating salary_month, validate that adjustment_date falls within new month
    if (excuteMethod.salary_month || excuteMethod.adjustment_date) {
      const adjustmentDate = excuteMethod.adjustment_date 
        ? new Date(excuteMethod.adjustment_date) 
        : new Date(existingAdjustment.adjustment_date);
      
      const salaryMonth = excuteMethod.salary_month || existingAdjustment.salary_month;
      const [year, month] = salaryMonth.split('-').map(Number);
      
      if (adjustmentDate.getFullYear() !== year || (adjustmentDate.getMonth() + 1) !== month) {
        throw new Error("Adjustment date must be within the specified salary month");
      }
    }
    
    const [affectedCount] = await SalaryAdjustment.update(
      excuteMethod,
      {
        where: { adjustment_id: adjustmentId },
        transaction
      }
    );
    
    if (affectedCount === 0) {
      throw new Error(messages.DATA_NOT_FOUND);
    }
    
    await transaction.commit();
    
    // Return updated record - ✅ removed employee_number
    const result = await SalaryAdjustment.findOne({
      where: { adjustment_id: adjustmentId },
      attributes: [
        'adjustment_id',
        'employee_id',
        'adjustment_date',
        'type',
        'amount',
        'reason',
        'salary_month',
        'is_active',
        'created_at',
        'updated_at'
      ],
      include: [
        {
          model: Employee,
          as: 'employee',
          attributes: ['employee_id', 'employee_name', 'mobile_no'] // ✅ Using mobile_no instead
        }
      ]
    });
    
    return result;
  } catch (error) {
    await transaction.rollback();
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

async function deleteSalaryAdjustment(adjustmentId) {
  const transaction = await sequelize.transaction();
  
  try {
    const [affectedCount] = await SalaryAdjustment.update(
      { is_active: 0 },
      {
        where: { adjustment_id: adjustmentId, is_active: 1 },
        transaction
      }
    );
    
    if (affectedCount === 0) {
      throw new Error(messages.DATA_NOT_FOUND);
    }
    
    await transaction.commit();
    
    return {
      success: true,
      message: "Salary adjustment deleted successfully"
    };
  } catch (error) {
    await transaction.rollback();
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

module.exports = {
  getSalaryAdjustment,
  createSalaryAdjustment,
  updateSalaryAdjustment,
  deleteSalaryAdjustment
};