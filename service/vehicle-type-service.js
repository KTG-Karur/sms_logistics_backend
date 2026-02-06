"use strict";

const messages = require("../helpers/message");
const _ = require("lodash");
const { Op } = require("sequelize");
const { VehicleType, sequelize, Vehicle } = require("../models");

async function getVehicleType(query, needIsActive = true) {
  try {
    let whereClause = {};
    
    if (query.vehicleTypeId) {
      whereClause.vehicle_type_id = query.vehicleTypeId;
    }
    
    if (needIsActive) {
      whereClause.is_active = 1;
    }
    
    if (query.search) {
      whereClause.vehicle_type_name = {
        [Op.like]: `%${query.search}%`
      };
    }
    
    const vehicleTypes = await VehicleType.findAll({
      where: whereClause,
      attributes: [
        'vehicle_type_id',
        'vehicle_type_name',
        'is_active',
        'created_at',
        'updated_at',
        'created_by',
        'updated_by'
      ],
      order: [['created_at', 'DESC']]
    });
    
    return vehicleTypes;
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

async function createVehicleType(postData) {
  const transaction = await sequelize.transaction();
  
  try {
    const excuteMethod = _.mapKeys(postData, (value, key) => _.snakeCase(key));
    
    // Check for duplicate vehicle type name
    if (excuteMethod.vehicle_type_name) {
      const existingVehicleType = await VehicleType.findOne({
        where: {
          vehicle_type_name: excuteMethod.vehicle_type_name,
          is_active: 1
        },
        transaction
      });
      
      if (existingVehicleType) {
        throw new Error(messages.DUPLICATE_ENTRY);
      }
    }
    
    const vehicleTypeResult = await VehicleType.create(
      excuteMethod,
      { transaction }
    );
    
    await transaction.commit();
    
    const result = await VehicleType.findOne({
      where: {
        vehicle_type_id: vehicleTypeResult.vehicle_type_id
      },
      attributes: [
        'vehicle_type_id',
        'vehicle_type_name',
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

async function updateVehicleType(vehicleTypeId, putData) {
  const transaction = await sequelize.transaction();
  
  try {
    const excuteMethod = _.mapKeys(putData, (value, key) => _.snakeCase(key));
    
    // Check for duplicate vehicle type name (excluding current record)
    if (excuteMethod.vehicle_type_name) {
      const existingVehicleType = await VehicleType.findOne({
        where: {
          vehicle_type_name: excuteMethod.vehicle_type_name,
          vehicle_type_id: { [Op.ne]: vehicleTypeId },
          is_active: 1
        },
        transaction
      });
      
      if (existingVehicleType) {
        throw new Error(messages.DUPLICATE_ENTRY);
      }
    }
    
    const [affectedCount] = await VehicleType.update(
      excuteMethod,
      {
        where: { vehicle_type_id: vehicleTypeId },
        transaction
      }
    );
    
    if (affectedCount === 0) {
      throw new Error(messages.DATA_NOT_FOUND);
    }
    
    await transaction.commit();
    
    const result = await VehicleType.findOne({
      where: {
        vehicle_type_id: vehicleTypeId
      },
      attributes: [
        'vehicle_type_id',
        'vehicle_type_name',
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

async function deleteVehicleType(vehicleTypeId) {
  const transaction = await sequelize.transaction();
  
  try {
    // Check if vehicle type has associated vehicles
    const vehicleCount = await Vehicle.count({
      where: { vehicle_type_id: vehicleTypeId },
      transaction
    });
    
    if (vehicleCount > 0) {
      throw new Error("Cannot delete vehicle type as it has associated vehicles");
    }
    
    const [affectedCount] = await VehicleType.update(
      { is_active: 0 },
      {
        where: { 
          vehicle_type_id: vehicleTypeId,
          is_active: 1 
        },
        transaction
      }
    );
    
    if (affectedCount === 0) {
      throw new Error(messages.DATA_NOT_FOUND);
    }
    
    await transaction.commit();
    
    return { success: true, message: "Vehicle type deleted successfully" };
  } catch (error) {
    await transaction.rollback();
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

module.exports = {
  getVehicleType,
  updateVehicleType,
  createVehicleType,
  deleteVehicleType,
};