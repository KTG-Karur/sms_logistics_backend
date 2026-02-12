"use strict";

const messages = require("../helpers/message");
const _ = require("lodash");
const { Op } = require("sequelize");
const { Customer, Vehicle, Booking, sequelize } = require("../models");

async function getCustomer(query, needIsActive = true) {
  try {
    let whereClause = {};
    
    if (query.customerId) {
      whereClause.customer_id = query.customerId;
    }
    
    if (query.customerNumber) {
      whereClause.customer_number = query.customerNumber;
    }
    
    if (needIsActive) {
      whereClause.is_active = 1;
    }
    
    if (query.search) {
      whereClause[Op.or] = [
        { customer_name: { [Op.like]: `%${query.search}%` } },
        { customer_number: { [Op.like]: `%${query.search}%` } }
      ];
    }

    const customers = await Customer.findAll({
      where: whereClause,
      attributes: [
        'customer_id',
        'customer_name',
        'customer_number',
        'is_active',
        'created_at',
        'updated_at',
        'created_by',
        'updated_by'
      ],
    //   include: [
    //     {
    //       model: Vehicle,
    //       as: 'vehicles',
    //       attributes: ['vehicle_id', 'registration_number', 'model'],
    //       where: { is_active: 1 },
    //       required: false
    //     }
    //   ],
      order: [['created_at', 'DESC']]
    });
    
    return customers;
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

async function createCustomer(postData) {
  const transaction = await sequelize.transaction();
  
  try {
    const excuteMethod = _.mapKeys(postData, (value, key) => _.snakeCase(key));
    
    // Check for duplicate combination of customer number AND customer name
    if (excuteMethod.customer_number && excuteMethod.customer_name) {
      const existingCustomer = await Customer.findOne({
        where: {
          customer_number: excuteMethod.customer_number,
          customer_name: excuteMethod.customer_name,
          is_active: 1
        },
        transaction
      });
      
      if (existingCustomer) {
        throw new Error("Customer with same number and name already exists");
      }
    }
    
    const customerResult = await Customer.create(
      excuteMethod,
      { transaction }
    );
    
    await transaction.commit();
    
    const result = await Customer.findOne({
      where: { customer_id: customerResult.customer_id },
      attributes: [
        'customer_id',
        'customer_name',
        'customer_number',
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

async function updateCustomer(customerId, putData) {
  const transaction = await sequelize.transaction();
  
  try {
    const excuteMethod = _.mapKeys(putData, (value, key) => _.snakeCase(key));
    
    // Check for duplicate combination of customer number AND customer name (excluding current record)
    if (excuteMethod.customer_number && excuteMethod.customer_name) {
      const existingCustomer = await Customer.findOne({
        where: {
          customer_number: excuteMethod.customer_number,
          customer_name: excuteMethod.customer_name,
          customer_id: { [Op.ne]: customerId },
          is_active: 1
        },
        transaction
      });
      
      if (existingCustomer) {
        throw new Error("Customer with same number and name already exists");
      }
    }
    
    const [affectedCount] = await Customer.update(
      excuteMethod,
      {
        where: { customer_id: customerId },
        transaction
      }
    );
    
    if (affectedCount === 0) {
      throw new Error(messages.DATA_NOT_FOUND);
    }
    
    await transaction.commit();
    
    const result = await Customer.findOne({
      where: { customer_id: customerId },
      attributes: [
        'customer_id',
        'customer_name',
        'customer_number',
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

async function deleteCustomer(customerId) {
  const transaction = await sequelize.transaction();
  
  try {
    // Check if customer has associated vehicles
    const vehicleCount = await Vehicle.count({
      where: { customer_id: customerId, is_active: 1 },
      transaction
    });
    
    if (vehicleCount > 0) {
      throw new Error("Cannot delete customer as they have associated vehicles");
    }
    
    // Check if customer has active bookings
    const bookingCount = await Booking.count({
      where: { 
        customer_id: customerId,
        [Op.or]: [
          { status: 'pending' },
          { status: 'confirmed' },
          { status: 'in-progress' }
        ]
      },
      transaction
    });
    
    if (bookingCount > 0) {
      throw new Error("Cannot delete customer as they have active bookings");
    }
    
    const [affectedCount] = await Customer.update(
      { is_active: 0 },
      {
        where: { customer_id: customerId, is_active: 1 },
        transaction
      }
    );
    
    if (affectedCount === 0) {
      throw new Error(messages.DATA_NOT_FOUND);
    }
    
    await transaction.commit();
    
    return {
      success: true,
      message: "Customer deleted successfully"
    };
  } catch (error) {
    await transaction.rollback();
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

async function getCustomerById(customerId) {
  try {
    const customer = await Customer.findOne({
      where: { customer_id: customerId, is_active: 1 },
      attributes: [
        'customer_id',
        'customer_name',
        'customer_number',
        'is_active',
        'created_at',
        'updated_at'
      ],
      include: [
        {
          model: Vehicle,
          as: 'vehicles',
          attributes: ['vehicle_id', 'registration_number', 'model', 'brand'],
          where: { is_active: 1 },
          required: false
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
    
    if (!customer) {
      throw new Error(messages.DATA_NOT_FOUND);
    }
    
    return customer;
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

module.exports = {
  getCustomer,
  updateCustomer,
  createCustomer,
  deleteCustomer,
  getCustomerById
};