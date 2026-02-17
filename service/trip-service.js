"use strict";

const messages = require("../helpers/message");
const _ = require("lodash");
const { Op } = require("sequelize");
const { 
  Trip, 
  TripBooking, 
  TripLoadman,
  Booking,
  BookingPackage,
  Vehicle,
  Employee,
  OfficeCenter,
  Customer,
  sequelize 
} = require("../models");
const { v4: uuidv4 } = require('uuid');

/**
 * Get all trips with filtering
 */
async function getTrips(query, needIsActive = true) {
  try {
    let whereClause = {};
    
    if (query.tripId) {
      whereClause.trip_id = query.tripId;
    }
    
    if (query.tripNumber) {
      whereClause.trip_number = query.tripNumber;
    }
    
    if (query.status) {
      whereClause.status = query.status;
    }
    
    if (query.fromCenterId) {
      whereClause.from_center_id = query.fromCenterId;
    }
    
    if (query.toCenterId) {
      whereClause.to_center_id = query.toCenterId;
    }
    
    if (query.vehicleId) {
      whereClause.vehicle_id = query.vehicleId;
    }
    
    if (query.driverId) {
      whereClause.driver_id = query.driverId;
    }
    
    if (query.fromDate && query.toDate) {
      whereClause.trip_date = {
        [Op.between]: [query.fromDate, query.toDate]
      };
    } else if (query.fromDate) {
      whereClause.trip_date = {
        [Op.gte]: query.fromDate
      };
    } else if (query.toDate) {
      whereClause.trip_date = {
        [Op.lte]: query.toDate
      };
    }
    
    if (needIsActive) {
      whereClause.is_active = 1;
    }
    
    if (query.search) {
      whereClause[Op.or] = [
        { trip_number: { [Op.like]: `%${query.search}%` } },
        { remarks: { [Op.like]: `%${query.search}%` } }
      ];
    }

    const trips = await Trip.findAll({
      where: whereClause,
      attributes: [
        'trip_id',
        'trip_number',
        'from_center_id',
        'to_center_id',
        'vehicle_id',
        'driver_id',
        'trip_date',
        'estimated_departure',
        'estimated_arrival',
        'actual_departure',
        'actual_arrival',
        'status',
        'remarks',
        'total_weight',
        'total_packages',
        'total_amount',
        'created_at',
        'updated_at'
      ],
      include: [
        {
          model: OfficeCenter,
          as: 'fromCenter',
          attributes: ['office_center_id', 'office_center_name']
        },
        {
          model: OfficeCenter,
          as: 'toCenter',
          attributes: ['office_center_id', 'office_center_name']
        },
        {
          model: Vehicle,
          as: 'vehicle',
          attributes: ['vehicle_id', 'vehicle_number_plate']
        },
        {
          model: Employee,
          as: 'driver',
          attributes: ['employee_id', 'employee_name', 'mobile_no']
        },
        {
          model: Employee,
          as: 'loadmen',
          through: { attributes: [] },
          attributes: ['employee_id', 'employee_name', 'mobile_no']
        },
        {
          model: Booking,
          as: 'bookings',
          through: { 
            attributes: ['delivery_status']
          },
          attributes: [
            'booking_id', 'booking_number', 'from_center_id', 'to_center_id',
            'total_amount', 'paid_amount', 'due_amount', 'delivery_status'
          ]
        }
      ],
      order: [['trip_date', 'DESC'], ['created_at', 'DESC']]
    });
    
    return trips;
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

/**
 * Get trip by ID
 */
async function getTripById(tripId) {
  try {
    const trip = await Trip.findOne({
      where: { trip_id: tripId, is_active: 1 },
      attributes: [
        'trip_id',
        'trip_number',
        'from_center_id',
        'to_center_id',
        'vehicle_id',
        'driver_id',
        'trip_date',
        'estimated_departure',
        'estimated_arrival',
        'actual_departure',
        'actual_arrival',
        'status',
        'remarks',
        'total_weight',
        'total_packages',
        'total_amount',
        'created_at',
        'updated_at'
      ],
      include: [
        {
          model: OfficeCenter,
          as: 'fromCenter',
          attributes: ['office_center_id', 'office_center_name']
        },
        {
          model: OfficeCenter,
          as: 'toCenter',
          attributes: ['office_center_id', 'office_center_name']
        },
        {
          model: Vehicle,
          as: 'vehicle',
          attributes: ['vehicle_id', 'vehicle_number_plate']
        },
        {
          model: Employee,
          as: 'driver',
          attributes: ['employee_id', 'employee_name', 'mobile_no']
        },
        {
          model: Employee,
          as: 'loadmen',
          through: { 
            model: TripLoadman, 
            attributes: [] 
          },
          attributes: ['employee_id', 'employee_name', 'mobile_no'],
          required: false
        },
        {
          model: Booking,
          as: 'bookings',
          through: { 
            model: TripBooking, 
            attributes: ['delivery_status'] 
          },
          attributes: [
            'booking_id',
            'booking_number',
            'llr_number',
            'from_center_id',
            'to_center_id',
            'total_amount',
            'paid_amount',
            'due_amount',
            'delivery_status'
          ],
          required: false
        }
      ]
    });

    if (!trip) {
      throw new Error(messages.DATA_NOT_FOUND);
    }

    // Log to verify data is coming through
    console.log("Loadmen count:", trip.loadmen?.length || 0);
    console.log("Bookings count:", trip.bookings?.length || 0);

    return trip;
  } catch (error) {
    console.error("Error in getTripById:", error);
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

/**
 * Create a new trip
 */
async function createTripre(postData) {
  const transaction = await sequelize.transaction();
  
  try {
    const excuteMethod = _.mapKeys(postData, (value, key) => _.snakeCase(key));
    
    // Extract arrays
    const bookingIds = excuteMethod.booking_ids || [];
    const loadmanIds = excuteMethod.loadman_ids || [];
    delete excuteMethod.booking_ids;
    delete excuteMethod.loadman_ids;
    
    // Validate from center
    if (excuteMethod.from_center_id) {
      const fromCenter = await OfficeCenter.findOne({
        where: { office_center_id: excuteMethod.from_center_id, is_active: 1 },
        transaction
      });
      if (!fromCenter) throw new Error("From center not found");
    }
    
    // Validate to center
    if (excuteMethod.to_center_id) {
      const toCenter = await OfficeCenter.findOne({
        where: { office_center_id: excuteMethod.to_center_id, is_active: 1 },
        transaction
      });
      if (!toCenter) throw new Error("To center not found");
    }
    
    // Validate vehicle
    if (excuteMethod.vehicle_id) {
      const vehicle = await Vehicle.findOne({
        where: { vehicle_id: excuteMethod.vehicle_id, is_active: 1 },
        transaction
      });
      if (!vehicle) throw new Error("Vehicle not found");
    }
    
    // Validate driver
    if (excuteMethod.driver_id) {
      const driver = await Employee.findOne({
        where: { 
          employee_id: excuteMethod.driver_id, 
          is_driver: true,
          is_active: 1 
        },
        transaction
      });
      if (!driver) throw new Error("Driver not found or is not a driver");
    }
    
    // Validate at least one booking
    if (bookingIds.length === 0) {
      throw new Error("At least one booking must be selected");
    }
    
    // Validate bookings and calculate totals
    let totalWeight = 0;
    let totalPackages = 0;
    let totalAmount = 0;
    const validBookings = [];
    
    const bookings = await Booking.findAll({
      where: { 
        booking_id: { [Op.in]: bookingIds },
        delivery_status: 'not_started',
        is_active: 1 
      },
      include: [{
        model: BookingPackage,
        as: 'packages',
        attributes: ['quantity', 'total_package_charge']
      }],
      transaction
    });
    
    if (bookings.length !== bookingIds.length) {
      throw new Error("Some bookings not found or are not available");
    }
    
    // Calculate totals from bookings
    bookings.forEach(booking => {
      const bookingPackages = booking.packages?.reduce((sum, pkg) => 
        sum + (pkg.quantity || 1), 0) || 1;
      
      totalPackages += bookingPackages;
      totalAmount += parseFloat(booking.total_amount || 0);
      
      validBookings.push(booking);
    });
    
    // Validate loadmen
    if (loadmanIds.length > 0) {
      const loadmen = await Employee.findAll({
        where: { 
          employee_id: { [Op.in]: loadmanIds },
          is_loadman: true,
          is_active: 1 
        },
        transaction
      });
      if (loadmen.length !== loadmanIds.length) {
        throw new Error("Some loadmen not found or are not loadmen");
      }
    } else {
      throw new Error("At least one loadman must be selected");
    }
    
    // Set calculated totals
    excuteMethod.total_packages = totalPackages;
    excuteMethod.total_amount = totalAmount;
    excuteMethod.status = 'scheduled';
    
    // Create trip
    const tripResult = await Trip.create(excuteMethod, { transaction });
    
    // Create trip bookings
    for (const booking of validBookings) {
      await TripBooking.create({
        trip_booking_id: uuidv4(),
        trip_id: tripResult.trip_id,
        booking_id: booking.booking_id,
        delivery_status: 'pending'
      }, { transaction });
    }
    
    // Create trip loadmen
    for (const loadmanId of loadmanIds) {
      await TripLoadman.create({
        trip_loadman_id: uuidv4(),
        trip_id: tripResult.trip_id,
        loadman_id: loadmanId
      }, { transaction });
    }
    
    await transaction.commit();
    
    // Return created trip with all details
    const result = await getTripById(tripResult.trip_id);
    return result;
    
  } catch (error) {
    await transaction.rollback();
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

async function createTrip(postData) {
  const transaction = await sequelize.transaction();
  
  try {
    const excuteMethod = _.mapKeys(postData, (value, key) => _.snakeCase(key));
    
    // Extract arrays
    const bookingIds = excuteMethod.booking_ids || [];
    const loadmanIds = excuteMethod.loadman_ids || [];
    delete excuteMethod.booking_ids;
    delete excuteMethod.loadman_ids;
    
    // Validate from center
    if (excuteMethod.from_center_id) {
      const fromCenter = await OfficeCenter.findOne({
        where: { office_center_id: excuteMethod.from_center_id, is_active: 1 },
        transaction
      });
      if (!fromCenter) throw new Error("From center not found");
    }
    
    // Validate to center
    if (excuteMethod.to_center_id) {
      const toCenter = await OfficeCenter.findOne({
        where: { office_center_id: excuteMethod.to_center_id, is_active: 1 },
        transaction
      });
      if (!toCenter) throw new Error("To center not found");
    }
    
    // Validate vehicle
    if (excuteMethod.vehicle_id) {
      const vehicle = await Vehicle.findOne({
        where: { vehicle_id: excuteMethod.vehicle_id, is_active: 1 },
        transaction
      });
      if (!vehicle) throw new Error("Vehicle not found");
    }
    
    // Validate driver
    if (excuteMethod.driver_id) {
      const driver = await Employee.findOne({
        where: { 
          employee_id: excuteMethod.driver_id, 
          is_driver: true,
          is_active: 1 
        },
        transaction
      });
      if (!driver) throw new Error("Driver not found or is not a driver");
    }
    
    // Validate at least one booking
    if (bookingIds.length === 0) {
      throw new Error("At least one booking must be selected");
    }
    
    // Validate bookings and calculate totals
    let totalPackages = 0;
    let totalAmount = 0;
    const validBookings = [];
    
    const bookings = await Booking.findAll({
      where: { 
        booking_id: { [Op.in]: bookingIds },
        delivery_status: 'not_started',
        is_active: 1 
      },
      include: [{
        model: BookingPackage,
        as: 'packages',
        attributes: ['quantity', 'total_package_charge']
      }],
      transaction
    });
    
    if (bookings.length !== bookingIds.length) {
      throw new Error("Some bookings not found or are not available");
    }
    
    // Calculate totals from bookings
    bookings.forEach(booking => {
      const bookingPackages = booking.packages?.reduce((sum, pkg) => 
        sum + (pkg.quantity || 1), 0) || 1;
      
      totalPackages += bookingPackages;
      totalAmount += parseFloat(booking.total_amount || 0);
      
      validBookings.push(booking);
    });
    
    // Validate loadmen
    if (loadmanIds.length === 0) {
      throw new Error("At least one loadman must be selected");
    }
    
    const loadmen = await Employee.findAll({
      where: { 
        employee_id: { [Op.in]: loadmanIds },
        is_loadman: true,
        is_active: 1 
      },
      transaction
    });
    
    if (loadmen.length !== loadmanIds.length) {
      throw new Error("Some loadmen not found or are not loadmen");
    }
    
    // Set calculated totals
    excuteMethod.total_packages = totalPackages;
    excuteMethod.total_amount = totalAmount;
    excuteMethod.status = 'scheduled';
    
    // Create trip
    const tripResult = await Trip.create(excuteMethod, { transaction });
    
    console.log("Trip created with ID:", tripResult.trip_id); // Debug log
    
    // IMPORTANT: Create trip bookings (associate bookings with trip)
    if (validBookings.length > 0) {
      for (const booking of validBookings) {
        const tripBookingData = {
          trip_booking_id: uuidv4(),
          trip_id: tripResult.trip_id,
          booking_id: booking.booking_id,
          delivery_status: 'pending',
          created_at: new Date(),
          updated_at: new Date()
        };
        
        console.log("Creating trip booking:", tripBookingData); // Debug log
        
        await TripBooking.create(tripBookingData, { transaction });
      }
    }
    
    // IMPORTANT: Create trip loadmen (associate loadmen with trip)
    if (loadmanIds.length > 0) {
      for (const loadmanId of loadmanIds) {
        const tripLoadmanData = {
          trip_loadman_id: uuidv4(),
          trip_id: tripResult.trip_id,
          loadman_id: loadmanId,
          created_at: new Date(),
          updated_at: new Date()
        };
        
        console.log("Creating trip loadman:", tripLoadmanData); // Debug log
        
        await TripLoadman.create(tripLoadmanData, { transaction });
      }
    }
    
    await transaction.commit();
    
    // Return created trip with all details
    const result = await getTripById(tripResult.trip_id);
    return result;
    
  } catch (error) {
    await transaction.rollback();
    console.error("Error creating trip:", error); // Debug log
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

/**
 * Update trip
 */
async function updateTrip(tripId, putData) {
  const transaction = await sequelize.transaction();
  
  try {
    // Check if trip exists
    const existingTrip = await Trip.findOne({
      where: { trip_id: tripId, is_active: 1 },
      transaction
    });
    
    if (!existingTrip) {
      throw new Error(messages.DATA_NOT_FOUND);
    }
    
    // Only allow updates if trip is scheduled
    if (existingTrip.status !== 'scheduled') {
      throw new Error("Only scheduled trips can be updated");
    }
    
    const excuteMethod = _.mapKeys(putData, (value, key) => _.snakeCase(key));
    
    // Validate from center if being updated
    if (excuteMethod.from_center_id) {
      const fromCenter = await OfficeCenter.findOne({
        where: { office_center_id: excuteMethod.from_center_id, is_active: 1 },
        transaction
      });
      if (!fromCenter) throw new Error("From center not found");
    }
    
    // Validate to center if being updated
    if (excuteMethod.to_center_id) {
      const toCenter = await OfficeCenter.findOne({
        where: { office_center_id: excuteMethod.to_center_id, is_active: 1 },
        transaction
      });
      if (!toCenter) throw new Error("To center not found");
    }
    
    // Validate vehicle if being updated
    if (excuteMethod.vehicle_id) {
      const vehicle = await Vehicle.findOne({
        where: { vehicle_id: excuteMethod.vehicle_id, is_active: 1 },
        transaction
      });
      if (!vehicle) throw new Error("Vehicle not found");
    }
    
    // Validate driver if being updated
    if (excuteMethod.driver_id) {
      const driver = await Employee.findOne({
        where: { 
          employee_id: excuteMethod.driver_id, 
          is_driver: true,
          is_active: 1 
        },
        transaction
      });
      if (!driver) throw new Error("Driver not found or is not a driver");
    }
    
    // Handle booking updates if provided
    if (putData.bookingIds) {
      const bookingIds = putData.bookingIds;
      
      // Validate bookings
      const bookings = await Booking.findAll({
        where: { 
          booking_id: { [Op.in]: bookingIds },
          delivery_status: 'not_started',
          is_active: 1 
        },
        transaction
      });
      
      if (bookings.length !== bookingIds.length) {
        throw new Error("Some bookings not found or are not available");
      }
      
      // Calculate new totals
      let totalPackages = 0;
      let totalAmount = 0;
      
      for (const booking of bookings) {
        const bookingPackages = booking.packages?.reduce((sum, pkg) => 
          sum + (pkg.quantity || 1), 0) || 1;
        
        totalPackages += bookingPackages;
        totalAmount += parseFloat(booking.total_amount || 0);
      }
      
      excuteMethod.total_packages = totalPackages;
      excuteMethod.total_amount = totalAmount;
      
      // Delete existing trip bookings
      await TripBooking.destroy({
        where: { trip_id: tripId },
        transaction
      });
      
      // Create new trip bookings
      for (const booking of bookings) {
        await TripBooking.create({
          trip_booking_id: uuidv4(),
          trip_id: tripId,
          booking_id: booking.booking_id,
          delivery_status: 'pending'
        }, { transaction });
      }
    }
    
    // Handle loadman updates if provided
    if (putData.loadmanIds) {
      const loadmanIds = putData.loadmanIds;
      
      // Validate loadmen
      const loadmen = await Employee.findAll({
        where: { 
          employee_id: { [Op.in]: loadmanIds },
          is_loadman: true,
          is_active: 1 
        },
        transaction
      });
      
      if (loadmen.length !== loadmanIds.length) {
        throw new Error("Some loadmen not found or are not loadmen");
      }
      
      // Delete existing trip loadmen
      await TripLoadman.destroy({
        where: { trip_id: tripId },
        transaction
      });
      
      // Create new trip loadmen
      for (const loadmanId of loadmanIds) {
        await TripLoadman.create({
          trip_loadman_id: uuidv4(),
          trip_id: tripId,
          loadman_id: loadmanId
        }, { transaction });
      }
    }
    
    // Update trip
    await Trip.update(excuteMethod, {
      where: { trip_id: tripId },
      transaction
    });
    
    await transaction.commit();
    
    // Return updated trip
    const result = await getTripById(tripId);
    return result;
    
  } catch (error) {
    await transaction.rollback();
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

/**
 * Update trip status
 */
async function updateTripStatus(tripId, statusData) {
  const transaction = await sequelize.transaction();
  
  try {
    const trip = await Trip.findOne({
      where: { trip_id: tripId, is_active: 1 },
      transaction
    });
    
    if (!trip) {
      throw new Error(messages.DATA_NOT_FOUND);
    }
    
    const updateData = {
      status: statusData.status
    };
    
    if (statusData.actual_departure) {
      updateData.actual_departure = statusData.actual_departure;
    }
    
    if (statusData.actual_arrival) {
      updateData.actual_arrival = statusData.actual_arrival;
    }
    
    // If starting trip
    if (statusData.status === 'in_progress' && trip.status === 'scheduled') {
      updateData.actual_departure = statusData.actual_departure || 
        new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    }
    
    // If completing trip
    if (statusData.status === 'completed') {
      updateData.actual_arrival = statusData.actual_arrival ||
        new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
      
      // Update all associated bookings delivery status
      await TripBooking.update(
        { delivery_status: 'delivered' },
        { where: { trip_id: tripId }, transaction }
      );
    }
    
    await Trip.update(updateData, {
      where: { trip_id: tripId },
      transaction
    });
    
    await transaction.commit();
    
    return await getTripById(tripId);
  } catch (error) {
    await transaction.rollback();
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

/**
 * Delete trip (soft delete)
 */
async function deleteTrip(tripId) {
  const transaction = await sequelize.transaction();
  
  try {
    const trip = await Trip.findOne({
      where: { trip_id: tripId, is_active: 1 },
      transaction
    });
    
    if (!trip) {
      throw new Error(messages.DATA_NOT_FOUND);
    }
    
    // Only allow delete if trip is scheduled
    if (trip.status !== 'scheduled') {
      throw new Error("Only scheduled trips can be deleted");
    }
    
    // Soft delete trip
    await Trip.update(
      { is_active: 0 },
      { where: { trip_id: tripId }, transaction }
    );
    
    // Soft delete associated records
    await TripBooking.update(
      { is_active: 0 },
      { where: { trip_id: tripId }, transaction }
    );
    
    await TripLoadman.update(
      { is_active: 0 },
      { where: { trip_id: tripId }, transaction }
    );
    
    await transaction.commit();
    
    return {
      success: true,
      message: "Trip deleted successfully"
    };
  } catch (error) {
    await transaction.rollback();
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

/**
 * Get available bookings for trip
 */
async function getAvailableBookings() {
  try {
    const bookings = await Booking.findAll({
      where: { 
        delivery_status: 'not_started',
        is_active: 1 
      },
      attributes: [
        'booking_id',
        'booking_number',
        'from_center_id',
        'to_center_id',
        'total_amount'
      ],
      include: [
        {
          model: OfficeCenter,
          as: 'fromCenter',
          attributes: ['office_center_id', 'office_center_name']
        },
        {
          model: OfficeCenter,
          as: 'toCenter',
          attributes: ['office_center_id', 'office_center_name']
        },
        {
          model: BookingPackage,
          as: 'packages',
          attributes: ['package_type_id', 'quantity']
        }
      ],
      order: [['booking_date', 'ASC']]
    });
    
    return bookings;
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

/**
 * Get available vehicles for a date
 */
async function getAvailableVehicles(tripDate) {
  try {
    // Find vehicles that are not assigned to any trip on the given date
    const assignedVehicleIds = await Trip.findAll({
      where: {
        trip_date: tripDate,
        status: { [Op.in]: ['scheduled', 'in_progress'] },
        is_active: 1
      },
      attributes: ['vehicle_id'],
      group: ['vehicle_id']
    });
    
    const vehicles = await Vehicle.findAll({
      where: {
        is_active: 1,
        vehicle_id: assignedVehicleIds.length > 0 ? 
          { [Op.notIn]: assignedVehicleIds.map(v => v.vehicle_id) } : 
          { [Op.not]: null }
      },
      attributes: [
        'vehicle_id',
        'vehicle_number_plate'
      ]
    });
    
    return vehicles;
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

/**
 * Get available drivers for a date
 */
async function getAvailableDrivers(tripDate) {
  try {
    // Find drivers that are not assigned to any trip on the given date
    const assignedDriverIds = await Trip.findAll({
      where: {
        trip_date: tripDate,
        status: { [Op.in]: ['scheduled', 'in_progress'] },
        is_active: 1
      },
      attributes: ['driver_id'],
      group: ['driver_id']
    });
    
    const drivers = await Employee.findAll({
      where: {
        is_driver: true,
        is_active: 1,
        employee_id: assignedDriverIds.length > 0 ? 
          { [Op.notIn]: assignedDriverIds.map(d => d.driver_id) } : 
          { [Op.not]: null }
      },
      attributes: [
        'employee_id',
        'employee_name',
        'mobile_no'
      ]
    });
    
    return drivers;
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

/**
 * Get available loadmen for a date
 */
async function getAvailableLoadmen(tripDate) {
  try {
    // Find loadmen that are not assigned to any trip on the given date
    const assignedLoadmanIds = await TripLoadman.findAll({
      include: [
        {
          model: Trip,
          as: 'trip',
          where: {
            trip_date: tripDate,
            status: { [Op.in]: ['scheduled', 'in_progress'] },
            is_active: 1
          },
          attributes: []
        }
      ],
      attributes: ['loadman_id'],
      group: ['loadman_id']
    });
    
    const loadmen = await Employee.findAll({
      where: {
        is_loadman: true,
        is_active: 1,
        employee_id: assignedLoadmanIds.length > 0 ? 
          { [Op.notIn]: assignedLoadmanIds.map(l => l.loadman_id) } : 
          { [Op.not]: null }
      },
      attributes: [
        'employee_id',
        'employee_name',
        'mobile_no'
      ]
    });
    
    return loadmen;
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

module.exports = {
  getTrips,
  getTripById,
  createTrip,
  updateTrip,
  updateTripStatus,
  deleteTrip,
  getAvailableBookings,
  getAvailableVehicles,
  getAvailableDrivers,
  getAvailableLoadmen
};