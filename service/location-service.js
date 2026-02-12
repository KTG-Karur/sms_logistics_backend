"use strict";

const messages = require("../helpers/message");
const _ = require("lodash");
const { Op } = require("sequelize");
const { Location, OfficeCenter, Vehicle, Booking, sequelize } = require("../models");

async function getLocation(query, needIsActive = true) {
  try {
    let whereClause = {};
    
    if (query.locationId) {
      whereClause.location_id = query.locationId;
    }
    
    if (query.officeCenterId) {
      whereClause.office_center_id = query.officeCenterId;
    }
    
    if (needIsActive) {
      whereClause.is_active = 1;
    }
    
    if (query.search) {
      whereClause.location_name = { [Op.like]: `%${query.search}%` };
    }

    const locations = await Location.findAll({
      where: whereClause,
      attributes: [
        'location_id',
        'location_name',
        'office_center_id',
        'is_active',
        'created_at',
        'updated_at',
        'created_by',
        'updated_by'
      ],
    //   include: [
    //     {
    //       model: OfficeCenter,
    //       as: 'officeCenter',
    //       attributes: ['office_center_id', 'office_center_name'],
    //       where: { is_active: 1 },
    //       required: false
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
    
    return locations;
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

async function createLocation(postData) {
  const transaction = await sequelize.transaction();
  
  try {
    const excuteMethod = _.mapKeys(postData, (value, key) => _.snakeCase(key));
    
    // Check if office center exists
    if (excuteMethod.office_center_id) {
      const officeCenter = await OfficeCenter.findOne({
        where: {
          office_center_id: excuteMethod.office_center_id,
          is_active: 1
        },
        transaction
      });
      
      if (!officeCenter) {
        throw new Error("Office center not found");
      }
    }
    
    // Check for duplicate location name within the same office center
    if (excuteMethod.location_name && excuteMethod.office_center_id) {
      const existingLocation = await Location.findOne({
        where: {
          location_name: excuteMethod.location_name,
          office_center_id: excuteMethod.office_center_id,
          is_active: 1
        },
        transaction
      });
      
      if (existingLocation) {
        throw new Error("Location name already exists in this office center");
      }
    }
    
    const locationResult = await Location.create(
      excuteMethod,
      { transaction }
    );
    
    await transaction.commit();
    
    const result = await Location.findOne({
      where: { location_id: locationResult.location_id },
      attributes: [
        'location_id',
        'location_name',
        'office_center_id',
        'is_active',
        'created_at',
        'updated_at'
      ],
      include: [
        {
          model: OfficeCenter,
          as: 'officeCenter',
          attributes: ['office_center_id', 'office_center_name']
        }
      ]
    });
    
    return result;
  } catch (error) {
    await transaction.rollback();
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

async function updateLocation(locationId, putData) {
  const transaction = await sequelize.transaction();
  
  try {
    const excuteMethod = _.mapKeys(putData, (value, key) => _.snakeCase(key));
    
    // Check if office center exists (if being updated)
    if (excuteMethod.office_center_id) {
      const officeCenter = await OfficeCenter.findOne({
        where: {
          office_center_id: excuteMethod.office_center_id,
          is_active: 1
        },
        transaction
      });
      
      if (!officeCenter) {
        throw new Error("Office center not found");
      }
    }
    
    // Check for duplicate location name within the same office center (excluding current record)
    if (excuteMethod.location_name || excuteMethod.office_center_id) {
      // Get current location to know office_center_id if not provided in update
      let officeCenterId = excuteMethod.office_center_id;
      
      if (!officeCenterId) {
        const currentLocation = await Location.findOne({
          where: { location_id: locationId },
          transaction
        });
        officeCenterId = currentLocation?.office_center_id;
      }
      
      if (excuteMethod.location_name && officeCenterId) {
        const existingLocation = await Location.findOne({
          where: {
            location_name: excuteMethod.location_name,
            office_center_id: officeCenterId,
            location_id: { [Op.ne]: locationId },
            is_active: 1
          },
          transaction
        });
        
        if (existingLocation) {
          throw new Error("Location name already exists in this office center");
        }
      }
    }
    
    const [affectedCount] = await Location.update(
      excuteMethod,
      {
        where: { location_id: locationId },
        transaction
      }
    );
    
    if (affectedCount === 0) {
      throw new Error(messages.DATA_NOT_FOUND);
    }
    
    await transaction.commit();
    
    const result = await Location.findOne({
      where: { location_id: locationId },
      attributes: [
        'location_id',
        'location_name',
        'office_center_id',
        'is_active',
        'created_at',
        'updated_at'
      ],
      include: [
        {
          model: OfficeCenter,
          as: 'officeCenter',
          attributes: ['office_center_id', 'office_center_name']
        }
      ]
    });
    
    return result;
  } catch (error) {
    await transaction.rollback();
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

async function deleteLocation(locationId) {
  const transaction = await sequelize.transaction();
  
  try {
    // Check if location has associated vehicles
    // const vehicleCount = await Vehicle.count({
    //   where: { location_id: locationId, is_active: 1 },
    //   transaction
    // });
    
    // if (vehicleCount > 0) {
    //   throw new Error("Cannot delete location as it has associated vehicles");
    // }
    
    // // Check if location has active bookings
    // const bookingCount = await Booking.count({
    //   where: { 
    //     location_id: locationId,
    //     [Op.or]: [
    //       { status: 'pending' },
    //       { status: 'confirmed' },
    //       { status: 'in-progress' }
    //     ]
    //   },
    //   transaction
    // });
    
    // if (bookingCount > 0) {
    //   throw new Error("Cannot delete location as it has active bookings");
    // }
    
    const [affectedCount] = await Location.update(
      { is_active: 0 },
      {
        where: { location_id: locationId, is_active: 1 },
        transaction
      }
    );
    
    if (affectedCount === 0) {
      throw new Error(messages.DATA_NOT_FOUND);
    }
    
    await transaction.commit();
    
    return {
      success: true,
      message: "Location deleted successfully"
    };
  } catch (error) {
    await transaction.rollback();
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

async function getLocationById(locationId) {
  try {
    const location = await Location.findOne({
      where: { location_id: locationId, is_active: 1 },
      attributes: [
        'location_id',
        'location_name',
        'office_center_id',
        'is_active',
        'created_at',
        'updated_at'
      ],
      include: [
        {
          model: OfficeCenter,
          as: 'officeCenter',
          attributes: ['office_center_id', 'office_center_name']
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
    
    if (!location) {
      throw new Error(messages.DATA_NOT_FOUND);
    }
    
    return location;
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

async function getLocationsByOfficeCenter(officeCenterId, needIsActive = true) {
  try {
    let whereClause = {
      office_center_id: officeCenterId
    };
    
    if (needIsActive) {
      whereClause.is_active = 1;
    }
    
    const locations = await Location.findAll({
      where: whereClause,
      attributes: [
        'location_id',
        'location_name',
        'office_center_id',
        'is_active',
        'created_at',
        'updated_at'
      ],
      order: [['location_name', 'ASC']]
    });
    
    return locations;
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

module.exports = {
  getLocation,
  updateLocation,
  createLocation,
  deleteLocation,
  getLocationById,
  getLocationsByOfficeCenter
};