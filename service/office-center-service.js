"use strict";

const messages = require("../helpers/message");
const _ = require("lodash");
const { Op } = require("sequelize");
const { OfficeCenter, Employee, Vehicle, Booking, sequelize } = require("../models");

async function getOfficeCenter(query, needIsActive = true) {
  try {
    let whereClause = {};
    
    if (query.officeCenterId) {
      whereClause.office_center_id = query.officeCenterId;
    }
    
    if (needIsActive) {
      whereClause.is_active = 1;
    }
    
    if (query.search) {
      whereClause.office_center_name = { [Op.like]: `%${query.search}%` };
    }

    const officeCenters = await OfficeCenter.findAll({
      where: whereClause,
      attributes: [
        'office_center_id',
        'office_center_name',
        'is_active',
        'created_at',
        'updated_at',
        'created_by',
        'updated_by'
      ],
    //   include: [
    //     {
    //       model: Employee,
    //       as: 'employees',
    //       attributes: ['employee_id', 'employee_name', 'employee_number'],
    //       where: { is_active: 1 },
    //       required: false,
    //       limit: 10
    //     },
    //     {
    //       model: Vehicle,
    //       as: 'vehicles',
    //       attributes: ['vehicle_id', 'registration_number', 'model'],
    //       where: { is_active: 1 },
    //       required: false,
    //       limit: 10
    //     }
    //   ],
      order: [['created_at', 'DESC']]
    });
    
    return officeCenters;
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

async function createOfficeCenter(postData) {
  const transaction = await sequelize.transaction();
  
  try {
    const excuteMethod = _.mapKeys(postData, (value, key) => _.snakeCase(key));
    
    // Check for duplicate office center name
    if (excuteMethod.office_center_name) {
      const existingOfficeCenter = await OfficeCenter.findOne({
        where: {
          office_center_name: excuteMethod.office_center_name,
          is_active: 1
        },
        transaction
      });
      
      if (existingOfficeCenter) {
        throw new Error("Office center name already exists");
      }
    }
    
    const officeCenterResult = await OfficeCenter.create(
      excuteMethod,
      { transaction }
    );
    
    await transaction.commit();
    
    const result = await OfficeCenter.findOne({
      where: { office_center_id: officeCenterResult.office_center_id },
      attributes: [
        'office_center_id',
        'office_center_name',
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

async function updateOfficeCenter(officeCenterId, putData) {
  const transaction = await sequelize.transaction();
  
  try {
    const excuteMethod = _.mapKeys(putData, (value, key) => _.snakeCase(key));
    
    // Check for duplicate office center name (excluding current record)
    if (excuteMethod.office_center_name) {
      const existingOfficeCenter = await OfficeCenter.findOne({
        where: {
          office_center_name: excuteMethod.office_center_name,
          office_center_id: { [Op.ne]: officeCenterId },
          is_active: 1
        },
        transaction
      });
      
      if (existingOfficeCenter) {
        throw new Error("Office center name already exists");
      }
    }
    
    const [affectedCount] = await OfficeCenter.update(
      excuteMethod,
      {
        where: { office_center_id: officeCenterId },
        transaction
      }
    );
    
    if (affectedCount === 0) {
      throw new Error(messages.DATA_NOT_FOUND);
    }
    
    await transaction.commit();
    
    const result = await OfficeCenter.findOne({
      where: { office_center_id: officeCenterId },
      attributes: [
        'office_center_id',
        'office_center_name',
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

async function deleteOfficeCenter(officeCenterId) {
  const transaction = await sequelize.transaction();
  
  try {
    // Check if office center has associated employees
    // const employeeCount = await Employee.count({
    //   where: { office_center_id: officeCenterId, is_active: 1 },
    //   transaction
    // });
    
    // if (employeeCount > 0) {
    //   throw new Error("Cannot delete office center as it has associated employees");
    // }
    
    // // Check if office center has associated vehicles
    // const vehicleCount = await Vehicle.count({
    //   where: { office_center_id: officeCenterId, is_active: 1 },
    //   transaction
    // });
    
    // if (vehicleCount > 0) {
    //   throw new Error("Cannot delete office center as it has associated vehicles");
    // }
    
    // Check if office center has active bookings
    // const bookingCount = await Booking.count({
    //   where: { 
    //     office_center_id: officeCenterId,
    //     [Op.or]: [
    //       { status: 'pending' },
    //       { status: 'confirmed' },
    //       { status: 'in-progress' }
    //     ]
    //   },
    //   transaction
    // });
    
    // if (bookingCount > 0) {
    //   throw new Error("Cannot delete office center as it has active bookings");
    // }
    
    const [affectedCount] = await OfficeCenter.update(
      { is_active: 0 },
      {
        where: { office_center_id: officeCenterId, is_active: 1 },
        transaction
      }
    );
    
    if (affectedCount === 0) {
      throw new Error(messages.DATA_NOT_FOUND);
    }
    
    await transaction.commit();
    
    return {
      success: true,
      message: "Office center deleted successfully"
    };
  } catch (error) {
    await transaction.rollback();
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

async function getOfficeCenterById(officeCenterId) {
  try {
    const officeCenter = await OfficeCenter.findOne({
      where: { office_center_id: officeCenterId, is_active: 1 },
      attributes: [
        'office_center_id',
        'office_center_name',
        'is_active',
        'created_at',
        'updated_at'
      ],
      include: [
        {
          model: Employee,
          as: 'employees',
          attributes: ['employee_id', 'employee_name', 'employee_number', 'designation'],
          where: { is_active: 1 },
          required: false,
          limit: 20
        },
        {
          model: Vehicle,
          as: 'vehicles',
          attributes: ['vehicle_id', 'registration_number', 'model', 'brand'],
          where: { is_active: 1 },
          required: false,
          limit: 20
        },
        {
          model: Booking,
          as: 'bookings',
          attributes: ['booking_id', 'booking_date', 'status', 'total_amount'],
          required: false,
          limit: 10,
          order: [['created_at', 'DESC']]
        }
      ]
    });
    
    if (!officeCenter) {
      throw new Error(messages.DATA_NOT_FOUND);
    }
    
    return officeCenter;
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

module.exports = {
  getOfficeCenter,
  updateOfficeCenter,
  createOfficeCenter,
  deleteOfficeCenter,
  getOfficeCenterById
};