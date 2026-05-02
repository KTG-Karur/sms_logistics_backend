"use strict";

const messages = require("../helpers/message");
const _ = require("lodash");
const { Op } = require("sequelize");
const { 
  Booking, 
  BookingPackage, 
  Payment, 
  OfficeCenter, 
  Location, 
  Customer, 
  PackageType,
  Trip,  
  TripBooking,
  sequelize 
} = require("../models");
const { v4: uuidv4 } = require('uuid');

async function getBooking(query, needIsActive = true) {
  try {
    let whereClause = {};
    
    if (query.bookingId) {
      whereClause.booking_id = query.bookingId;
    }
    
    if (query.bookingNumber) {
      whereClause.booking_number = query.bookingNumber;
    }
    
    if (query.llrNumber) {
      whereClause.llr_number = query.llrNumber;
    }
    
    if (query.fromCenterId) {
      whereClause.from_center_id = query.fromCenterId;
    }
    
    if (query.toCenterId) {
      whereClause.to_center_id = query.toCenterId;
    }
    
    if (query.fromCustomerId) {
      whereClause.from_customer_id = query.fromCustomerId;
    }
    
    if (query.toCustomerId) {
      whereClause.to_customer_id = query.toCustomerId;
    }
    
    if (query.deliveryStatus) {
      whereClause.delivery_status = query.deliveryStatus;
    }
    
    if (query.paymentStatus) {
      whereClause.payment_status = query.paymentStatus;
    }
    
    if (query.fromDate && query.toDate) {
      whereClause.booking_date = {
        [Op.between]: [query.fromDate, query.toDate]
      };
    } else if (query.fromDate) {
      whereClause.booking_date = {
        [Op.gte]: query.fromDate
      };
    } else if (query.toDate) {
      whereClause.booking_date = {
        [Op.lte]: query.toDate
      };
    }
    
    if (needIsActive) {
      whereClause.is_active = 1;
    }
    
    if (query.search) {
      whereClause[Op.or] = [
        { booking_number: { [Op.like]: `%${query.search}%` } },
        { llr_number: { [Op.like]: `%${query.search}%` } },
        { reference_number: { [Op.like]: `%${query.search}%` } }
      ];
    }

    const bookings = await Booking.findAll({
      where: whereClause,
      attributes: [
        'booking_id',
        'booking_number',
        'llr_number',
        'booking_date',
        'from_center_id',
        'to_center_id',
        'from_location_id',
        'to_location_id',
        'from_customer_id',
        'to_customer_id',
        'total_amount',
        'paid_amount',
        'due_amount',
        'payment_by',
        'payment_status',
        'delivery_status',
        'actual_delivery_date',
        'special_instructions',
        'reference_number',
        'is_active',
        'created_at',
        'updated_at'
      ],
      include: [
        {
          model: BookingPackage,
          as: 'packages',
          attributes: [
            'booking_package_id',
            'package_type_id',
            'quantity',
            'pickup_charge',
            'drop_charge',
            'handling_charge',
            'total_package_charge'
          ],
          where: { is_active: 1 },
          required: false,
          include: [
            {
              model: PackageType,
              as: 'packageType',
              attributes: ['package_type_id', 'package_type_name']
            }
          ]
        },
        {
          model: Payment,
          as: 'payments',
          attributes: [
            'payment_id',
            'payment_number',
            'amount',
            'payment_date',
            'payment_mode',
            'payment_type',
            'status'
          ],
          where: { is_active: 1 },
          required: false,
          limit: 10,
          order: [['payment_date', 'DESC']]
        },
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
          model: Location,
          as: 'fromLocation',
          attributes: ['location_id', 'location_name']
        },
        {
          model: Location,
          as: 'toLocation',
          attributes: ['location_id', 'location_name']
        },
        {
          model: Customer,
          as: 'fromCustomer',
          attributes: ['customer_id', 'customer_name', 'customer_number']
        },
        {
          model: Customer,
          as: 'toCustomer',
          attributes: ['customer_id', 'customer_name', 'customer_number']
        }
      ],
      order: [['booking_date', 'DESC'], ['created_at', 'DESC']]
    });
    
    return bookings;
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

async function createBooking1(postData) {
  const transaction = await sequelize.transaction();
  
  try {
    const excuteMethod = _.mapKeys(postData, (value, key) => _.snakeCase(key));
    
    // Extract packages from postData
    const packages = excuteMethod.packages || [];
    delete excuteMethod.packages;
    
    // Validate centers exist
    if (excuteMethod.from_center_id) {
      const fromCenter = await OfficeCenter.findOne({
        where: { office_center_id: excuteMethod.from_center_id, is_active: 1 },
        transaction
      });
      if (!fromCenter) throw new Error("From center not found");
    }
    
    if (excuteMethod.to_center_id) {
      const toCenter = await OfficeCenter.findOne({
        where: { office_center_id: excuteMethod.to_center_id, is_active: 1 },
        transaction
      });
      if (!toCenter) throw new Error("To center not found");
    }
    
    // Validate locations exist
    if (excuteMethod.from_location_id) {
      const fromLocation = await Location.findOne({
        where: { location_id: excuteMethod.from_location_id, is_active: 1 },
        transaction
      });
      if (!fromLocation) throw new Error("From location not found");
    }
    
    if (excuteMethod.to_location_id) {
      const toLocation = await Location.findOne({
        where: { location_id: excuteMethod.to_location_id, is_active: 1 },
        transaction
      });
      if (!toLocation) throw new Error("To location not found");
    }
    
    // Validate customers exist
    if (excuteMethod.from_customer_id) {
      const fromCustomer = await Customer.findOne({
        where: { customer_id: excuteMethod.from_customer_id, is_active: 1 },
        transaction
      });
      if (!fromCustomer) throw new Error("Sender customer not found");
    }
    
    if (excuteMethod.to_customer_id) {
      const toCustomer = await Customer.findOne({
        where: { customer_id: excuteMethod.to_customer_id, is_active: 1 },
        transaction
      });
      if (!toCustomer) throw new Error("Receiver customer not found");
    }
    
    // Check for duplicate LLR number
    if (excuteMethod.llr_number) {
      const existingBooking = await Booking.findOne({
        where: { llr_number: excuteMethod.llr_number },
        transaction
      });
      if (existingBooking) {
        throw new Error("LLR number already exists");
      }
    }
    
    // Check for duplicate booking number
    if (excuteMethod.booking_number) {
      const existingBooking = await Booking.findOne({
        where: { booking_number: excuteMethod.booking_number },
        transaction
      });
      if (existingBooking) {
        throw new Error("Booking number already exists");
      }
    }
    
    // Calculate total amount from packages
    let totalAmount = 0;
    if (packages.length > 0) {
      totalAmount = packages.reduce((sum, pkg) => {
        const pkgTotal = (parseFloat(pkg.pickupCharge || 0) + 
                         parseFloat(pkg.dropCharge || 0) + 
                         parseFloat(pkg.handlingCharge || 0)) * 
                         (parseInt(pkg.quantity) || 1);
        return sum + pkgTotal;
      }, 0);
    }
    
    excuteMethod.total_amount = totalAmount;
    excuteMethod.due_amount = totalAmount - parseFloat(excuteMethod.paid_amount || 0);
    
    // Create booking
    const bookingResult = await Booking.create(excuteMethod, { transaction });
    
    // Create booking packages
    if (packages.length > 0) {
      const packagePromises = packages.map(pkg => {
        const pkgData = _.mapKeys(pkg, (value, key) => _.snakeCase(key));
        pkgData.booking_id = bookingResult.booking_id;
        
        // Calculate package total
        const quantity = parseInt(pkgData.quantity) || 1;
        const pickupCharge = parseFloat(pkgData.pickup_charge) || 0;
        const dropCharge = parseFloat(pkgData.drop_charge) || 0;
        const handlingCharge = parseFloat(pkgData.handling_charge) || 0;
        
        pkgData.total_package_charge = (pickupCharge + dropCharge + handlingCharge) * quantity;
        
        return BookingPackage.create(pkgData, { transaction });
      });
      
      await Promise.all(packagePromises);
    }
    
    await transaction.commit();
    
    // Return created booking with associations
    const result = await Booking.findOne({
      where: { booking_id: bookingResult.booking_id },
      attributes: [
        'booking_id',
        'booking_number',
        'llr_number',
        'booking_date',
        'from_center_id',
        'to_center_id',
        'from_location_id',
        'to_location_id',
        'from_customer_id',
        'to_customer_id',
        'total_amount',
        'paid_amount',
        'due_amount',
        'payment_by',
        'payment_status',
        'delivery_status',
        'special_instructions',
        'reference_number'
      ],
      include: [
        {
          model: BookingPackage,
          as: 'packages',
          attributes: [
            'booking_package_id',
            'package_type_id',
            'quantity',
            'pickup_charge',
            'drop_charge',
            'handling_charge',
            'total_package_charge'
          ],
          include: [
            {
              model: PackageType,
              as: 'packageType',
              attributes: ['package_type_id', 'package_type_name']
            }
          ]
        }
      ]
    });
    
    return result;
  } catch (error) {
    await transaction.rollback();
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

async function createBooking(postData) {
  const transaction = await sequelize.transaction();
  
  try {
    const excuteMethod = _.mapKeys(postData, (value, key) => _.snakeCase(key));
    
    // Extract packages from postData
    const packages = excuteMethod.packages || [];
    delete excuteMethod.packages;
    
    // Extract payment info if needed
    const paidAmount = parseFloat(excuteMethod.paid_amount) || 0;
    const paymentBy = excuteMethod.payment_by || 'sender';
    
    // Validate centers exist
    if (excuteMethod.from_center_id) {
      const fromCenter = await OfficeCenter.findOne({
        where: { office_center_id: excuteMethod.from_center_id, is_active: 1 },
        transaction
      });
      if (!fromCenter) throw new Error("From center not found");
    }
    
    if (excuteMethod.to_center_id) {
      const toCenter = await OfficeCenter.findOne({
        where: { office_center_id: excuteMethod.to_center_id, is_active: 1 },
        transaction
      });
      if (!toCenter) throw new Error("To center not found");
    }
    
    // Validate locations exist
    if (excuteMethod.from_location_id) {
      const fromLocation = await Location.findOne({
        where: { location_id: excuteMethod.from_location_id, is_active: 1 },
        transaction
      });
      if (!fromLocation) throw new Error("From location not found");
    }
    
    if (excuteMethod.to_location_id) {
      const toLocation = await Location.findOne({
        where: { location_id: excuteMethod.to_location_id, is_active: 1 },
        transaction
      });
      if (!toLocation) throw new Error("To location not found");
    }
    
    // Validate customers exist
    if (excuteMethod.from_customer_id) {
      const fromCustomer = await Customer.findOne({
        where: { customer_id: excuteMethod.from_customer_id, is_active: 1 },
        transaction
      });
      if (!fromCustomer) throw new Error("Sender customer not found");
    }
    
    if (excuteMethod.to_customer_id) {
      const toCustomer = await Customer.findOne({
        where: { customer_id: excuteMethod.to_customer_id, is_active: 1 },
        transaction
      });
      if (!toCustomer) throw new Error("Receiver customer not found");
    }
    
    // Check for duplicate LLR number
    if (excuteMethod.llr_number) {
      const existingBooking = await Booking.findOne({
        where: { llr_number: excuteMethod.llr_number },
        transaction
      });
      if (existingBooking) {
        throw new Error("LLR number already exists");
      }
    }
    
    // Check for duplicate booking number
    if (excuteMethod.booking_number) {
      const existingBooking = await Booking.findOne({
        where: { booking_number: excuteMethod.booking_number },
        transaction
      });
      if (existingBooking) {
        throw new Error("Booking number already exists");
      }
    }
    
    // Calculate total amount from packages
    let totalAmount = 0;
    if (packages.length > 0) {
      totalAmount = packages.reduce((sum, pkg) => {
        const pkgTotal = (parseFloat(pkg.pickupCharge || 0) + 
                         parseFloat(pkg.dropCharge || 0) + 
                         parseFloat(pkg.handlingCharge || 0)) * 
                         (parseInt(pkg.quantity) || 1);
        return sum + pkgTotal;
      }, 0);
    }
    
    excuteMethod.total_amount = totalAmount;
    excuteMethod.paid_amount = paidAmount;
    excuteMethod.due_amount = totalAmount - paidAmount;
    
    // Create booking
    const bookingResult = await Booking.create(excuteMethod, { transaction });
    
    // Create booking packages
    if (packages.length > 0) {
      const packagePromises = packages.map(pkg => {
        const pkgData = _.mapKeys(pkg, (value, key) => _.snakeCase(key));
        pkgData.booking_id = bookingResult.booking_id;
        
        // Calculate package total
        const quantity = parseInt(pkgData.quantity) || 1;
        const pickupCharge = parseFloat(pkgData.pickup_charge) || 0;
        const dropCharge = parseFloat(pkgData.drop_charge) || 0;
        const handlingCharge = parseFloat(pkgData.handling_charge) || 0;
        
        pkgData.total_package_charge = (pickupCharge + dropCharge + handlingCharge) * quantity;
        
        return BookingPackage.create(pkgData, { transaction });
      });
      
      await Promise.all(packagePromises);
    }
    
    // CREATE PAYMENT RECORD IF PAID AMOUNT > 0
    if (paidAmount > 0) {
      const paymentData = {
        payment_id: uuidv4(), // This will be auto-generated
        payment_number: Payment.generatePaymentNumber(), // Use the static method
        booking_id: bookingResult.booking_id,
        customer_id: excuteMethod.from_customer_id, // Default to sender
        amount: paidAmount,
        payment_date: new Date().toISOString().split('T')[0],
        payment_mode: 'cash', // Default payment mode - you might want to add this to your request
        payment_type: paidAmount >= totalAmount ? 'full' : (paidAmount < totalAmount ? 'partial' : 'advance'),
        description: `Payment for booking ${bookingResult.booking_number}`,
        status: 'completed',
        is_active: 1
      };
      
      // You can also allow payment_mode in the request
      if (postData.paymentMode) {
        paymentData.payment_mode = postData.paymentMode;
      }
      
      // If payment is by receiver, use to_customer_id instead
      if (paymentBy === 'receiver') {
        paymentData.customer_id = excuteMethod.to_customer_id;
      }
      
      await Payment.create(paymentData, { transaction });
    }
    
    await transaction.commit();
    
    // Return created booking with associations including payments
    const result = await Booking.findOne({
      where: { booking_id: bookingResult.booking_id },
      attributes: [
        'booking_id',
        'booking_number',
        'llr_number',
        'booking_date',
        'from_center_id',
        'to_center_id',
        'from_location_id',
        'to_location_id',
        'from_customer_id',
        'to_customer_id',
        'total_amount',
        'paid_amount',
        'due_amount',
        'payment_by',
        'payment_status',
        'delivery_status',
        'special_instructions',
        'reference_number'
      ],
      include: [
        {
          model: BookingPackage,
          as: 'packages',
          attributes: [
            'booking_package_id',
            'package_type_id',
            'quantity',
            'pickup_charge',
            'drop_charge',
            'handling_charge',
            'total_package_charge'
          ],
          include: [
            {
              model: PackageType,
              as: 'packageType',
              attributes: ['package_type_id', 'package_type_name']
            }
          ]
        },
        {
          model: Payment,
          as: 'payments',
          attributes: [
            'payment_id',
            'payment_number',
            'amount',
            'payment_date',
            'payment_mode',
            'payment_type',
            'status'
          ],
          required: false
        }
      ]
    });
    
    return result;
  } catch (error) {
    await transaction.rollback();
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

async function updateBooking(bookingId, putData) {
  const transaction = await sequelize.transaction();
  
  try {
    const excuteMethod = _.mapKeys(putData, (value, key) => _.snakeCase(key));
    
    // Check if booking exists
    const existingBooking = await Booking.findOne({
      where: { booking_id: bookingId },
      transaction
    });
    
    if (!existingBooking) {
      throw new Error(messages.DATA_NOT_FOUND);
    }
    
    // Extract packages from putData
    const packages = excuteMethod.packages || [];
    delete excuteMethod.packages;
    
    // Check for duplicate LLR number (excluding current)
    if (excuteMethod.llr_number && excuteMethod.llr_number !== existingBooking.llr_number) {
      const duplicateLLR = await Booking.findOne({
        where: { 
          llr_number: excuteMethod.llr_number,
          booking_id: { [Op.ne]: bookingId }
        },
        transaction
      });
      if (duplicateLLR) {
        throw new Error("LLR number already exists");
      }
    }
    
    // Calculate total amount from packages if packages are being updated
    let totalAmount = existingBooking.total_amount;
    if (packages.length > 0) {
      totalAmount = packages.reduce((sum, pkg) => {
        const pkgTotal = (parseFloat(pkg.pickupCharge || 0) + 
                         parseFloat(pkg.dropCharge || 0) + 
                         parseFloat(pkg.handlingCharge || 0)) * 
                         (parseInt(pkg.quantity) || 1);
        return sum + pkgTotal;
      }, 0);
      
      excuteMethod.total_amount = totalAmount;
      
      // Recalculate due amount if paid amount changed
      const paidAmount = parseFloat(excuteMethod.paid_amount) || parseFloat(existingBooking.paid_amount);
      excuteMethod.due_amount = totalAmount - paidAmount;
      
      // Update payment status based on new amounts
      if (excuteMethod.due_amount <= 0) {
        excuteMethod.payment_status = 'completed';
      } else if (paidAmount > 0 && excuteMethod.due_amount > 0) {
        excuteMethod.payment_status = 'partial';
      } else {
        excuteMethod.payment_status = 'pending';
      }
    }
    
    // Update booking
    const [affectedCount] = await Booking.update(
      excuteMethod,
      {
        where: { booking_id: bookingId },
        transaction
      }
    );
    
    if (affectedCount === 0) {
      throw new Error(messages.DATA_NOT_FOUND);
    }
    
    // Update packages if provided
    if (packages.length > 0) {
      // Delete existing packages
      await BookingPackage.destroy({
        where: { booking_id: bookingId },
        transaction
      });
      
      // Create new packages
      const packagePromises = packages.map(pkg => {
        const pkgData = _.mapKeys(pkg, (value, key) => _.snakeCase(key));
        pkgData.booking_id = bookingId;
        
        // Calculate package total
        const quantity = parseInt(pkgData.quantity) || 1;
        const pickupCharge = parseFloat(pkgData.pickup_charge) || 0;
        const dropCharge = parseFloat(pkgData.drop_charge) || 0;
        const handlingCharge = parseFloat(pkgData.handling_charge) || 0;
        
        pkgData.total_package_charge = (pickupCharge + dropCharge + handlingCharge) * quantity;
        
        return BookingPackage.create(pkgData, { transaction });
      });
      
      await Promise.all(packagePromises);
    }
    
    await transaction.commit();
    
    // Return updated booking with associations
    const result = await Booking.findOne({
      where: { booking_id: bookingId },
      attributes: [
        'booking_id',
        'booking_number',
        'llr_number',
        'booking_date',
        'from_center_id',
        'to_center_id',
        'from_location_id',
        'to_location_id',
        'from_customer_id',
        'to_customer_id',
        'total_amount',
        'paid_amount',
        'due_amount',
        'payment_by',
        'payment_status',
        'delivery_status',
        'actual_delivery_date',
        'special_instructions',
        'reference_number'
      ],
      include: [
        {
          model: BookingPackage,
          as: 'packages',
          attributes: [
            'booking_package_id',
            'package_type_id',
            'quantity',
            'pickup_charge',
            'drop_charge',
            'handling_charge',
            'total_package_charge'
          ],
          include: [
            {
              model: PackageType,
              as: 'packageType',
              attributes: ['package_type_id', 'package_type_name']
            }
          ]
        },
        {
          model: Payment,
          as: 'payments',
          attributes: [
            'payment_id',
            'payment_number',
            'amount',
            'payment_date',
            'payment_mode',
            'payment_type',
            'status'
          ],
          where: { is_active: 1 },
          required: false,
          limit: 10,
          order: [['payment_date', 'DESC']]
        }
      ]
    });
    
    return result;
  } catch (error) {
    await transaction.rollback();
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

async function updateDeliveryStatus(bookingId, deliveryStatus, actualDeliveryDate = null) {
  const transaction = await sequelize.transaction();
  
  try {
    const updateData = {
      delivery_status: deliveryStatus
    };
    
    if (actualDeliveryDate) {
      updateData.actual_delivery_date = actualDeliveryDate;
    }
    
    const [affectedCount] = await Booking.update(
      updateData,
      {
        where: { booking_id: bookingId, is_active: 1 },
        transaction
      }
    );
    
    if (affectedCount === 0) {
      throw new Error(messages.DATA_NOT_FOUND);
    }
    
    await transaction.commit();
    
    return {
      success: true,
      message: `Delivery status updated to ${deliveryStatus}`
    };
  } catch (error) {
    await transaction.rollback();
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

async function deleteBooking(bookingId) {
  const transaction = await sequelize.transaction();
  
  try {
    // First, check if booking exists and is active
    const booking = await Booking.findOne({
      where: { booking_id: bookingId, is_active: 1 },
      transaction
    });
    
    if (!booking) {
      throw new Error(messages.DATA_NOT_FOUND);
    }
    
    // Check if booking has any associated payments
    const paymentCount = await Payment.count({
      where: { booking_id: bookingId, is_active: 1 },
      transaction
    });
    
    if (paymentCount > 0) {
      throw new Error("Cannot delete booking: Payment(s) have been made against this booking");
    }
    
    // Check if booking is associated with any trip
    const tripBookingCount = await sequelize.models.TripBooking.count({
      where: { booking_id: bookingId, is_active: 1 },
      transaction
    });
    
    if (tripBookingCount > 0) {
      throw new Error("Cannot delete booking: Booking is already assigned to a trip");
    }
    
    // Additional check: Also check TripBookings that might not have is_active flag
    const tripBookingAltCount = await sequelize.models.TripBooking.count({
      where: { booking_id: bookingId },
      transaction
    });
    
    if (tripBookingAltCount > 0) {
      // If there are inactive trip bookings, still prevent deletion
      const activeTrips = await sequelize.models.TripBooking.findAll({
        where: { booking_id: bookingId },
        include: [{
          model: sequelize.models.Trip,
          as: 'trip',
          where: { is_active: 1 },
          required: false
        }],
        transaction
      });
      
      if (activeTrips.length > 0) {
        throw new Error("Cannot delete booking: Booking is or was associated with an active trip");
      }
    }
    
    // Check if booking has any payment status that's not 'pending'
    if (booking.paid_amount > 0 || booking.payment_status !== 'pending') {
      throw new Error("Cannot delete booking: Payment has been initiated for this booking");
    }
    
    // Proceed with soft deletion
    const [affectedCount] = await Booking.update(
      { is_active: 0 },
      {
        where: { booking_id: bookingId, is_active: 1 },
        transaction
      }
    );
    
    if (affectedCount === 0) {
      throw new Error(messages.DATA_NOT_FOUND);
    }
    
    // Soft delete associated packages
    await BookingPackage.update(
      { is_active: 0 },
      {
        where: { booking_id: bookingId, is_active: 1 },
        transaction
      }
    );
    
    await transaction.commit();
    
    return {
      success: true,
      message: "Booking deleted successfully"
    };
  } catch (error) {
    await transaction.rollback();
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

async function getBookingById(bookingId) {
  try {
    const booking = await Booking.findOne({
      where: { booking_id: bookingId, is_active: 1 },
      attributes: [
        'booking_id',
        'booking_number',
        'llr_number',
        'booking_date',
        'from_center_id',
        'to_center_id',
        'from_location_id',
        'to_location_id',
        'from_customer_id',
        'to_customer_id',
        'total_amount',
        'paid_amount',
        'due_amount',
        'payment_by',
        'payment_status',
        'delivery_status',
        'actual_delivery_date',
        'special_instructions',
        'reference_number',
        'created_at',
        'updated_at'
      ],
      include: [
        {
          model: BookingPackage,
          as: 'packages',
          attributes: [
            'booking_package_id',
            'package_type_id',
            'quantity',
            'pickup_charge',
            'drop_charge',
            'handling_charge',
            'total_package_charge'
          ],
          where: { is_active: 1 },
          required: false,
          include: [
            {
              model: PackageType,
              as: 'packageType',
              attributes: ['package_type_id', 'package_type_name']
            }
          ]
        },
        {
          model: Payment,
          as: 'payments',
          attributes: [
            'payment_id',
            'payment_number',
            'amount',
            'payment_date',
            'payment_mode',
            'payment_type',
            'status',
            'description',
            'collected_by',
            'collected_at_center'
          ],
          where: { is_active: 1 },
          required: false,
          order: [['payment_date', 'DESC']]
        },
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
          model: Location,
          as: 'fromLocation',
          attributes: ['location_id', 'location_name']
        },
        {
          model: Location,
          as: 'toLocation',
          attributes: ['location_id', 'location_name']
        },
        {
          model: Customer,
          as: 'fromCustomer',
          attributes: ['customer_id', 'customer_name', 'customer_number']
        },
        {
          model: Customer,
          as: 'toCustomer',
          attributes: ['customer_id', 'customer_name', 'customer_number']
        }
      ]
    });
    
    if (!booking) {
      throw new Error(messages.DATA_NOT_FOUND);
    }
    
    return booking;
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

async function getBookingsByCustomer(customerId, type = 'sender') {
  try {
    const whereClause = type === 'sender' 
      ? { from_customer_id: customerId }
      : { to_customer_id: customerId };
    
    whereClause.is_active = 1;
    
    const bookings = await Booking.findAll({
      where: whereClause,
      attributes: [
        'booking_id',
        'booking_number',
        'llr_number',
        'booking_date',
        'total_amount',
        'paid_amount',
        'due_amount',
        'payment_status',
        'delivery_status'
      ],
      include: [
        {
          model: BookingPackage,
          as: 'packages',
          attributes: ['quantity', 'total_package_charge'],
          required: false
        }
      ],
      order: [['booking_date', 'DESC']]
    });
    
    return bookings;
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

/**
 * Add additional payment to an existing booking
 */
async function addBookingPayment(bookingId, paymentData) {
  const transaction = await sequelize.transaction();
  
  try {
    // Find the booking
    const booking = await Booking.findOne({
      where: { booking_id: bookingId, is_active: 1 },
      transaction
    });
    
    if (!booking) {
      throw new Error(messages.DATA_NOT_FOUND);
    }
    
    // Check if booking is already fully paid
    if (booking.due_amount <= 0) {
      throw new Error("Booking is already fully paid");
    }
    
    const paymentAmount = parseFloat(paymentData.amount);
    
    // Validate payment amount
    if (paymentAmount <= 0) {
      throw new Error("Payment amount must be greater than 0");
    }
    
    if (paymentAmount > booking.due_amount) {
      throw new Error(`Payment amount exceeds due amount. Due amount: ${booking.due_amount}`);
    }
    
    // Determine payment type
    let paymentType = 'partial';
    if (paymentAmount >= booking.due_amount) {
      paymentType = 'full';
    }
    
    // Create payment record
    const paymentRecord = {
      payment_id: uuidv4(),
      payment_number: Payment.generatePaymentNumber(),
      booking_id: bookingId,
      customer_id: paymentData.customerId || booking.from_customer_id, // Default to sender
      amount: paymentAmount,
      payment_date: paymentData.paymentDate || new Date().toISOString().split('T')[0],
      payment_mode: paymentData.paymentMode || 'cash',
      payment_type: paymentType,
      description: paymentData.description || `Additional payment for booking ${booking.booking_number}`,
      collected_by: paymentData.collectedBy || null,
      collected_at_center: paymentData.collectedAtCenter || null,
      status: 'completed',
      is_active: 1
    };
    
    const createdPayment = await Payment.create(paymentRecord, { transaction });
    
    // Update booking paid_amount and due_amount
    const newPaidAmount = parseFloat(booking.paid_amount) + paymentAmount;
    const newDueAmount = parseFloat(booking.total_amount) - newPaidAmount;
    
    await Booking.update(
      {
        paid_amount: newPaidAmount,
        due_amount: newDueAmount,
        payment_status: newDueAmount <= 0 ? 'completed' : (newPaidAmount > 0 ? 'partial' : 'pending')
      },
      {
        where: { booking_id: bookingId },
        transaction
      }
    );
    
    await transaction.commit();
    
    // Return updated booking with payments
    const updatedBooking = await Booking.findOne({
      where: { booking_id: bookingId },
      attributes: [
        'booking_id',
        'booking_number',
        'llr_number',
        'total_amount',
        'paid_amount',
        'due_amount',
        'payment_status'
      ],
      include: [
        {
          model: Payment,
          as: 'payments',
          attributes: [
            'payment_id',
            'payment_number',
            'amount',
            'payment_date',
            'payment_mode',
            'payment_type',
            'status',
            'description'
          ],
          where: { is_active: 1 },
          required: false,
          order: [['payment_date', 'DESC']]
        }
      ]
    });
    
    return updatedBooking;
  } catch (error) {
    await transaction.rollback();
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

// =============================================
// NEW SERVICE FUNCTIONS FOR CUSTOMER PAYMENTS
// =============================================

/**
 * Get customer pending amount and payment history by date range
 */
async function getCustomerPaymentsByDate(customerId, startDate, endDate, type = 'sender') {
  try {
    // Build where clause based on customer type (sender or receiver)
    const customerWhereClause = type === 'sender' 
      ? { from_customer_id: customerId }
      : { to_customer_id: customerId };
    
    // Get all bookings for this customer
    const bookings = await Booking.findAll({
      where: {
        ...customerWhereClause,
        is_active: 1,
        booking_date: {
          [Op.between]: [startDate, endDate]
        }
      },
      attributes: [
        'booking_id',
        'booking_number',
        'booking_date',
        'total_amount',
        'paid_amount',
        'due_amount',
        'payment_status',
        'delivery_status'
      ],
      include: [
        {
          model: Payment,
          as: 'payments',
          attributes: [
            'payment_id',
            'payment_number',
            'amount',
            'payment_date',
            'payment_mode',
            'payment_type',
            'status'
          ],
          where: { is_active: 1 },
          required: false,
          order: [['payment_date', 'DESC']]
        },
        {
          model: Customer,
          as: type === 'sender' ? 'fromCustomer' : 'toCustomer',
          attributes: ['customer_id', 'customer_name', 'customer_number']
        }
      ],
      order: [['booking_date', 'DESC']]
    });

    // Calculate totals
    const totalPending = bookings.reduce((sum, booking) => sum + parseFloat(booking.due_amount || 0), 0);
    const totalPaid = bookings.reduce((sum, booking) => sum + parseFloat(booking.paid_amount || 0), 0);
    const totalAmount = bookings.reduce((sum, booking) => sum + parseFloat(booking.total_amount || 0), 0);

    // Get all payments for this customer in date range
    const payments = await Payment.findAll({
      where: {
        customer_id: customerId,
        payment_date: {
          [Op.between]: [startDate, endDate]
        },
        is_active: 1
      },
      attributes: [
        'payment_id',
        'payment_number',
        'amount',
        'payment_date',
        'payment_mode',
        'payment_type',
        'status',
        'description'
      ],
      include: [
        {
          model: Booking,
          as: 'booking',
          attributes: ['booking_id', 'booking_number', 'booking_date']
        }
      ],
      order: [['payment_date', 'DESC']]
    });

    return {
      customer_id: customerId,
      customer_type: type,
      date_range: {
        start_date: startDate,
        end_date: endDate
      },
      summary: {
        total_bookings: bookings.length,
        total_amount: totalAmount.toFixed(2),
        total_paid: totalPaid.toFixed(2),
        total_pending: totalPending.toFixed(2),
        total_payments: payments.length,
        total_payment_amount: payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0).toFixed(2)
      },
      bookings: bookings,
      payments: payments
    };
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}



/**
 * Get customer bookings and payment list with proper payment_by logic
 * If customer is sender (payment_by = 'sender'), show bookings where from_customer_id matches
 * If customer is receiver (payment_by = 'receiver'), show bookings where to_customer_id matches
 * If type not specified, show both (as sender and as receiver)
 */
async function getCustomerBookingsAndPayments(customerId, type = null) {
  try {
    // Build where clause based on customer type and payment_by logic
    let bookingWhereClause = { is_active: 1 };
    
    if (type === 'sender') {
      // Customer as sender - only show bookings where they are sender AND payment_by is sender
      bookingWhereClause = {
        ...bookingWhereClause,
        from_customer_id: customerId,
        payment_by: 'sender'
      };
    } else if (type === 'receiver') {
      // Customer as receiver - only show bookings where they are receiver AND payment_by is receiver
      bookingWhereClause = {
        ...bookingWhereClause,
        to_customer_id: customerId,
        payment_by: 'receiver'
      };
    } else {
      // No type specified - show both scenarios
      bookingWhereClause = {
        ...bookingWhereClause,
        [Op.or]: [
          { 
            from_customer_id: customerId,
            payment_by: 'sender'
          },
          { 
            to_customer_id: customerId,
            payment_by: 'receiver'
          }
        ]
      };
    }
    
    // Get all bookings for this customer based on payment_by logic
    const bookings = await Booking.findAll({
      where: bookingWhereClause,
      attributes: [
        'booking_id',
        'booking_number',
        'llr_number',
        'booking_date',
        'from_center_id',
        'to_center_id',
        'from_customer_id',
        'to_customer_id',
        'total_amount',
        'paid_amount',
        'due_amount',
        'payment_by',
        'payment_status',
        'delivery_status',
        'actual_delivery_date'
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
          model: Customer,
          as: 'fromCustomer',
          attributes: ['customer_id', 'customer_name', 'customer_number']
        },
        {
          model: Customer,
          as: 'toCustomer',
          attributes: ['customer_id', 'customer_name', 'customer_number']
        },
        {
          model: BookingPackage,
          as: 'packages',
          attributes: [
            'booking_package_id',
            'package_type_id',
            'quantity',
            'pickup_charge',
            'drop_charge',
            'handling_charge',
            'total_package_charge'
          ],
          include: [
            {
              model: PackageType,
              as: 'packageType',
              attributes: ['package_type_id', 'package_type_name']
            }
          ]
        },
        {
          model: Payment,
          as: 'payments',
          attributes: [
            'payment_id',
            'payment_number',
            'amount',
            'payment_date',
            'payment_mode',
            'payment_type',
            'status',
            'description'
          ],
          where: { is_active: 1 },
          required: false,
          order: [['payment_date', 'DESC']]
        }
      ],
      order: [['booking_date', 'DESC']]
    });

    // Get all payments for this customer (regardless of booking type)
    const payments = await Payment.findAll({
      where: {
        customer_id: customerId,
        is_active: 1
      },
      attributes: [
        'payment_id',
        'payment_number',
        'amount',
        'payment_date',
        'payment_mode',
        'payment_type',
        'status',
        'description',
        'created_at'
      ],
      include: [
        {
          model: Booking,
          as: 'booking',
          attributes: [
            'booking_id', 
            'booking_number', 
            'booking_date', 
            'total_amount', 
            'due_amount',
            'payment_by',
            'from_customer_id',
            'to_customer_id'
          ]
        }
      ],
      order: [['payment_date', 'DESC']]
    });

    // Separate bookings by role (as sender vs as receiver)
    const asSenderBookings = bookings.filter(b => 
      b.from_customer_id === customerId && b.payment_by === 'sender'
    );
    
    const asReceiverBookings = bookings.filter(b => 
      b.to_customer_id === customerId && b.payment_by === 'receiver'
    );

    // Calculate summary statistics
    const totalBookings = bookings.length;
    const completedBookings = bookings.filter(b => b.delivery_status === 'delivered').length;
    const pendingBookings = bookings.filter(b => b.delivery_status !== 'delivered').length;
    
    // Calculate financial totals
    const totalAmount = bookings.reduce((sum, b) => sum + parseFloat(b.total_amount || 0), 0);
    const totalPaid = bookings.reduce((sum, b) => sum + parseFloat(b.paid_amount || 0), 0);
    const totalPending = bookings.reduce((sum, b) => sum + parseFloat(b.due_amount || 0), 0);
    
    // Calculate as sender totals
    const asSenderTotal = asSenderBookings.reduce((sum, b) => sum + parseFloat(b.total_amount || 0), 0);
    const asSenderPaid = asSenderBookings.reduce((sum, b) => sum + parseFloat(b.paid_amount || 0), 0);
    const asSenderPending = asSenderBookings.reduce((sum, b) => sum + parseFloat(b.due_amount || 0), 0);
    
    // Calculate as receiver totals
    const asReceiverTotal = asReceiverBookings.reduce((sum, b) => sum + parseFloat(b.total_amount || 0), 0);
    const asReceiverPaid = asReceiverBookings.reduce((sum, b) => sum + parseFloat(b.paid_amount || 0), 0);
    const asReceiverPending = asReceiverBookings.reduce((sum, b) => sum + parseFloat(b.due_amount || 0), 0);

    // Calculate payment totals
    const totalPayments = payments.length;
    const totalPaymentAmount = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

    return {
      customer_id: customerId,
      requested_type: type || 'all', // 'sender', 'receiver', or 'all'
      summary: {
        total_bookings: totalBookings,
        completed_bookings: completedBookings,
        pending_bookings: pendingBookings,
        total_amount: totalAmount.toFixed(2),
        total_paid: totalPaid.toFixed(2),
        total_pending: totalPending.toFixed(2),
        payment_progress: totalAmount > 0 ? ((totalPaid / totalAmount) * 100).toFixed(2) : 0,
        total_payments: totalPayments,
        total_payment_amount: totalPaymentAmount.toFixed(2),
        as_sender: {
          bookings_count: asSenderBookings.length,
          total_amount: asSenderTotal.toFixed(2),
          paid_amount: asSenderPaid.toFixed(2),
          pending_amount: asSenderPending.toFixed(2)
        },
        as_receiver: {
          bookings_count: asReceiverBookings.length,
          total_amount: asReceiverTotal.toFixed(2),
          paid_amount: asReceiverPaid.toFixed(2),
          pending_amount: asReceiverPending.toFixed(2)
        }
      },
      bookings: bookings,
      payments: payments,
      // Add separated lists for clarity
      as_sender_bookings: asSenderBookings,
      as_receiver_bookings: asReceiverBookings
    };
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}
/**
 * Make bulk payment for a customer - customer can pay for any bookings they are responsible for
 * Based on payment_by logic:
 * - If payment_by = 'sender', customer must be the from_customer_id to pay
 * - If payment_by = 'receiver', customer must be the to_customer_id to pay
 */
async function makeCustomerBulkPayment(customerId, paymentData) {
  const transaction = await sequelize.transaction();
  
  try {
    // Find all pending bookings where this customer is responsible for payment
    // based on payment_by logic
    const whereClause = {
      is_active: 1,
      due_amount: { [Op.gt]: 0 },
      [Op.or]: [
        // Customer is sender AND payment_by is 'sender' - customer pays
        { 
          from_customer_id: customerId, 
          payment_by: 'sender' 
        },
        // Customer is receiver AND payment_by is 'receiver' - customer pays
        { 
          to_customer_id: customerId, 
          payment_by: 'receiver' 
        }
      ]
    };
    
    // If specific booking IDs are provided, filter by them
    if (paymentData.bookingIds && paymentData.bookingIds.length > 0) {
      whereClause.booking_id = { [Op.in]: paymentData.bookingIds };
    }
    
    const pendingBookings = await Booking.findAll({
      where: whereClause,
      attributes: [
        'booking_id', 
        'booking_number', 
        'total_amount', 
        'paid_amount', 
        'due_amount',
        'payment_by',
        'from_customer_id',
        'to_customer_id'
      ],
      order: [['booking_date', 'ASC']],
      transaction
    });
    
    if (pendingBookings.length === 0) {
      throw new Error("No pending bookings found where this customer is responsible for payment");
    }
    
    const totalPendingAmount = pendingBookings.reduce((sum, b) => sum + parseFloat(b.due_amount || 0), 0);
    const paymentAmount = parseFloat(paymentData.amount);
    
    // Validate payment amount
    if (paymentAmount <= 0) {
      throw new Error("Payment amount must be greater than 0");
    }
    
    if (paymentAmount > totalPendingAmount) {
      throw new Error(`Payment amount (${paymentAmount}) exceeds total pending amount (${totalPendingAmount})`);
    }
    
    // Distribute payment across bookings
    let remainingAmount = paymentAmount;
    const updatedBookings = [];
    const createdPayments = [];
    
    for (const booking of pendingBookings) {
      if (remainingAmount <= 0) break;
      
      const bookingDue = parseFloat(booking.due_amount);
      let amountForThisBooking = Math.min(remainingAmount, bookingDue);
      
      // Determine if customer is sender or receiver for this booking
      const isSender = booking.from_customer_id === customerId;
      const isReceiver = booking.to_customer_id === customerId;
      
      // Update booking
      const newPaidAmount = parseFloat(booking.paid_amount) + amountForThisBooking;
      const newDueAmount = parseFloat(booking.total_amount) - newPaidAmount;
      
      await Booking.update(
        {
          paid_amount: newPaidAmount,
          due_amount: newDueAmount,
          payment_status: newDueAmount <= 0 ? 'completed' : 'partial'
        },
        {
          where: { booking_id: booking.booking_id },
          transaction
        }
      );
      
      // Create payment record for this booking
      const paymentRecord = {
        payment_id: uuidv4(),
        payment_number: Payment.generatePaymentNumber(),
        booking_id: booking.booking_id,
        customer_id: customerId,
        amount: amountForThisBooking,
        payment_date: paymentData.paymentDate || new Date().toISOString().split('T')[0],
        payment_mode: paymentData.paymentMode,
        payment_type: amountForThisBooking >= bookingDue ? 'full' : 'partial',
        description: paymentData.description || `Payment for booking ${booking.booking_number}`,
        collected_by: paymentData.collectedBy || null,
        collected_at_center: paymentData.collectedAtCenter || null,
        status: 'completed',
        is_active: 1
      };
      
      const payment = await Payment.create(paymentRecord, { transaction });
      
      updatedBookings.push({
        booking_id: booking.booking_id,
        booking_number: booking.booking_number,
        amount_paid: amountForThisBooking,
        previous_due: bookingDue,
        new_due: newDueAmount,
        payment_by: booking.payment_by,
        role: isSender ? 'sender' : 'receiver'
      });
      
      createdPayments.push(payment);
      
      remainingAmount -= amountForThisBooking;
    }
    
    await transaction.commit();
    
    return {
      success: true,
      message: `Successfully processed payment of ${paymentAmount} for ${updatedBookings.length} bookings`,
      summary: {
        customer_id: customerId,
        total_paid: paymentAmount,
        bookings_updated: updatedBookings.length,
        remaining_pending: remainingAmount,
        total_pending_before: totalPendingAmount,
        total_pending_after: totalPendingAmount - paymentAmount
      },
      updated_bookings: updatedBookings,
      payments: createdPayments.map(p => ({
        payment_id: p.payment_id,
        payment_number: p.payment_number,
        amount: p.amount,
        booking_id: p.booking_id
      }))
    };
  } catch (error) {
    await transaction.rollback();
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

// =============================================
// CUSTOMER PAYMENT RECORDS SERVICES
// =============================================

/**
 * Get all customer payment records with paid and pending amounts
 */
async function getAllCustomerPaymentRecords(filters = {}) {
  try {
    const {
      customerId,
      startDate,
      endDate,
      paymentStatus,
      page = 1,
      limit = 20
    } = filters;
    
    const offset = (page - 1) * limit;
    
    // Build where clause for payments
    const paymentWhereClause = { is_active: 1 };
    
    if (customerId) {
      paymentWhereClause.customer_id = customerId;
    }
    
    if (startDate && endDate) {
      paymentWhereClause.payment_date = {
        [Op.between]: [startDate, endDate]
      };
    } else if (startDate) {
      paymentWhereClause.payment_date = {
        [Op.gte]: startDate
      };
    } else if (endDate) {
      paymentWhereClause.payment_date = {
        [Op.lte]: endDate
      };
    }
    
    if (paymentStatus) {
      paymentWhereClause.status = paymentStatus;
    }
    
    // Get all payments with their associated bookings
    const payments = await Payment.findAndCountAll({
      where: paymentWhereClause,
      attributes: [
        'payment_id',
        'payment_number',
        'amount',
        'payment_date',
        'payment_mode',
        'payment_type',
        'status',
        'description',
        'created_at'
      ],
      include: [
        {
          model: Booking,
          as: 'booking',
          attributes: [
            'booking_id',
            'booking_number',
            'llr_number',
            'booking_date',
            'total_amount',
            'paid_amount',
            'due_amount',
            'payment_status',
            'delivery_status'
          ],
          include: [
            {
              model: Customer,
              as: 'fromCustomer',
              attributes: ['customer_id', 'customer_name', 'customer_number']
            },
            {
              model: Customer,
              as: 'toCustomer',
              attributes: ['customer_id', 'customer_name', 'customer_number']
            }
          ]
        },
        {
          model: Customer,
          as: 'customer',
          attributes: ['customer_id', 'customer_name', 'customer_number']
        }
      ],
      order: [['payment_date', 'DESC'], ['created_at', 'DESC']],
      limit,
      offset,
      distinct: true
    });
    
    // Calculate summary statistics
    const totalPaidAmount = payments.rows.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    
    // Get all unique customers from payments
    const customerIds = [...new Set(payments.rows.map(p => p.customer_id).filter(id => id))];
    
    // Get pending amounts for these customers
    const pendingAmounts = {};
    
    if (customerIds.length > 0) {
      const pendingBookings = await Booking.findAll({
        where: {
          [Op.or]: [
            { from_customer_id: { [Op.in]: customerIds } },
            { to_customer_id: { [Op.in]: customerIds } }
          ],
          is_active: 1,
          due_amount: { [Op.gt]: 0 }
        },
        attributes: [
          'from_customer_id',
          'to_customer_id',
          'due_amount'
        ]
      });
      
      pendingBookings.forEach(booking => {
        // Add to sender's pending amount
        if (booking.from_customer_id) {
          pendingAmounts[booking.from_customer_id] = (pendingAmounts[booking.from_customer_id] || 0) + parseFloat(booking.due_amount || 0);
        }
        // Add to receiver's pending amount if payment is by receiver
        if (booking.to_customer_id) {
          // You might want to check payment_by field to determine who should pay
          pendingAmounts[booking.to_customer_id] = (pendingAmounts[booking.to_customer_id] || 0) + parseFloat(booking.due_amount || 0);
        }
      });
    }
    
    // Format the response
    const formattedPayments = payments.rows.map(payment => {
      const paymentJson = payment.toJSON();
      
      // Determine which customer this payment belongs to (sender or receiver)
      const isSenderPayment = paymentJson.booking?.from_customer_id === payment.customer_id;
      
      return {
        ...paymentJson,
        customer_type: isSenderPayment ? 'sender' : 'receiver',
        pending_amount: pendingAmounts[payment.customer_id] || 0
      };
    });
    
    // Group by customer for summary
    const customerSummary = {};
    
    formattedPayments.forEach(payment => {
      const custId = payment.customer_id;
      if (!customerSummary[custId]) {
        customerSummary[custId] = {
          customer_id: custId,
          customer_name: payment.customer?.customer_name || 'Unknown',
          customer_number: payment.customer?.customer_number || 'Unknown',
          total_paid: 0,
          total_pending: 0,
          payment_count: 0,
          last_payment_date: null
        };
      }
      
      customerSummary[custId].total_paid += parseFloat(payment.amount || 0);
      customerSummary[custId].payment_count += 1;
      customerSummary[custId].total_pending = pendingAmounts[custId] || 0;
      
      const paymentDate = payment.payment_date;
      if (!customerSummary[custId].last_payment_date || paymentDate > customerSummary[custId].last_payment_date) {
        customerSummary[custId].last_payment_date = paymentDate;
      }
    });
    
    return {
      summary: {
        total_payments: payments.count,
        total_paid_amount: totalPaidAmount.toFixed(2),
        unique_customers: Object.keys(customerSummary).length,
        current_page: page,
        total_pages: Math.ceil(payments.count / limit),
        limit
      },
      customer_summary: Object.values(customerSummary),
      records: formattedPayments
    };
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

/**
 * Get customer payment summary (dashboard view)
 */
async function getCustomerPaymentSummary(customerId, type = 'sender') {
  try {
    // Build where clause based on customer type
    const customerWhereClause = type === 'sender' 
      ? { from_customer_id: customerId }
      : { to_customer_id: customerId };
    
    // Get all bookings for this customer
    const bookings = await Booking.findAll({
      where: {
        ...customerWhereClause,
        is_active: 1
      },
      attributes: [
        'booking_id',
        'booking_number',
        'booking_date',
        'total_amount',
        'paid_amount',
        'due_amount',
        'payment_status',
        'delivery_status'
      ],
      order: [['booking_date', 'DESC']]
    });
    
    // Get all payments for this customer
    const payments = await Payment.findAll({
      where: {
        customer_id: customerId,
        is_active: 1
      },
      attributes: [
        'payment_id',
        'payment_number',
        'amount',
        'payment_date',
        'payment_mode',
        'payment_type',
        'status',
        'description'
      ],
      include: [
        {
          model: Booking,
          as: 'booking',
          attributes: ['booking_id', 'booking_number']
        }
      ],
      order: [['payment_date', 'DESC']]
    });
    
    // Calculate statistics
    const totalBookings = bookings.length;
    const completedBookings = bookings.filter(b => b.delivery_status === 'delivered').length;
    const pendingBookings = bookings.filter(b => b.delivery_status !== 'delivered').length;
    
    const totalAmount = bookings.reduce((sum, b) => sum + parseFloat(b.total_amount || 0), 0);
    const totalPaid = bookings.reduce((sum, b) => sum + parseFloat(b.paid_amount || 0), 0);
    const totalPending = bookings.reduce((sum, b) => sum + parseFloat(b.due_amount || 0), 0);
    
    const totalPayments = payments.length;
    const totalPaymentAmount = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    
    // Get recent payments (last 5)
    const recentPayments = payments.slice(0, 5);
    
    // Group payments by month for chart data
    const paymentsByMonth = {};
    payments.forEach(payment => {
      const month = payment.payment_date.substring(0, 7); // YYYY-MM
      if (!paymentsByMonth[month]) {
        paymentsByMonth[month] = {
          month,
          total: 0,
          count: 0
        };
      }
      paymentsByMonth[month].total += parseFloat(payment.amount || 0);
      paymentsByMonth[month].count += 1;
    });
    
    // Get pending bookings (with due amount > 0)
    const pendingBookingsList = bookings
      .filter(b => parseFloat(b.due_amount) > 0)
      .map(b => ({
        booking_id: b.booking_id,
        booking_number: b.booking_number,
        booking_date: b.booking_date,
        total_amount: b.total_amount,
        paid_amount: b.paid_amount,
        due_amount: b.due_amount,
        payment_status: b.payment_status
      }));
    
    return {
      customer_id: customerId,
      customer_type: type,
      summary: {
        total_bookings: totalBookings,
        completed_bookings: completedBookings,
        pending_bookings: pendingBookings,
        total_amount: totalAmount.toFixed(2),
        total_paid: totalPaid.toFixed(2),
        total_pending: totalPending.toFixed(2),
        payment_progress: totalAmount > 0 ? ((totalPaid / totalAmount) * 100).toFixed(2) : 0,
        total_payments: totalPayments,
        total_payment_amount: totalPaymentAmount.toFixed(2)
      },
      pending_bookings: pendingBookingsList,
      recent_payments: recentPayments,
      payment_trends: Object.values(paymentsByMonth).sort((a, b) => a.month.localeCompare(b.month))
    };
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}


// =============================================
// ALL CUSTOMERS PAYMENT SUMMARY SERVICE
// =============================================

/**
 * Get all customers payment summary with proper payment_by logic
 * For payment_by = 'sender', the from_customer_id is responsible for payment
 * For payment_by = 'receiver', the to_customer_id is responsible for payment
 */
async function getAllCustomersPaymentSummary(filters = {}) {
  try {
    const {
      search,
      status, // 'all', 'paid', 'pending', 'partial'
      sortBy = 'customer_name',
      sortOrder = 'ASC',
      page,
      limit
    } = filters;
    
    // Check if pagination is requested - ONLY if BOTH page AND limit are provided
    const isPaginated = (page !== undefined && page !== null && page !== '' && 
                         limit !== undefined && limit !== null && limit !== '');
    
    // Build customer where clause
    const customerWhereClause = { is_active: 1 };
    
    if (search) {
      customerWhereClause[Op.or] = [
        { customer_name: { [Op.like]: `%${search}%` } },
        { customer_number: { [Op.like]: `%${search}%` } }
      ];
    }
    
    // Get all customers (without pagination first)
    const { count: totalCustomers, rows: customers } = await Customer.findAndCountAll({
      where: customerWhereClause,
      attributes: [
        'customer_id',
        'customer_name',
        'customer_number',
        'is_active',
        'created_at'
      ],
      order: [[sortBy, sortOrder]],
      distinct: true
    });
    
    if (customers.length === 0) {
      const response = {
        overall: {
          total_customers: 0,
          total_bookings: 0,
          total_amount: "0.00",
          total_paid: "0.00",
          total_pending: "0.00",
          total_responsible_amount: "0.00",
          total_responsible_paid: "0.00",
          total_responsible_pending: "0.00",
          total_payments: 0,
          total_payment_amount: "0.00"
        },
        status_breakdown: {
          fully_paid: 0,
          partial: 0,
          pending: 0,
          not_responsible: 0,
          no_bookings: 0
        },
        customers: []
      };
      
      // Only add pagination if requested
      if (isPaginated) {
        response.pagination = {
          current_page: parseInt(page),
          total_pages: 0,
          total_customers: 0,
          limit: parseInt(limit)
        };
      }
      
      return response;
    }
    
    // Get all customer IDs
    const customerIds = customers.map(c => c.customer_id);
    
    // Get all bookings for these customers with payment_by logic
    const allBookings = await Booking.findAll({
      where: {
        [Op.or]: [
          { from_customer_id: { [Op.in]: customerIds } },
          { to_customer_id: { [Op.in]: customerIds } }
        ],
        is_active: 1
      },
      attributes: [
        'booking_id',
        'from_customer_id',
        'to_customer_id',
        'total_amount',
        'paid_amount',
        'due_amount',
        'payment_by',
        'payment_status',
        'delivery_status'
      ]
    });
    
    // Get all payments for these customers
    const payments = await Payment.findAll({
      where: {
        customer_id: { [Op.in]: customerIds },
        is_active: 1
      },
      attributes: [
        'customer_id',
        'payment_id',
        'amount',
        'payment_date',
        'status'
      ]
    });
    
    // Group bookings by customer with payment_by logic
    const customerBookings = {};
    
    allBookings.forEach(booking => {
      // Case 1: Customer is sender AND payment_by is 'sender' - customer is responsible for payment
      if (customerIds.includes(booking.from_customer_id) && booking.payment_by === 'sender') {
        const custId = booking.from_customer_id;
        if (!customerBookings[custId]) {
          customerBookings[custId] = {
            as_payer: { total: 0, paid: 0, pending: 0, count: 0 },
            as_recipient: { total: 0, paid: 0, pending: 0, count: 0 },
            all: { total: 0, paid: 0, pending: 0, count: 0 }
          };
        }
        
        customerBookings[custId].as_payer.total += parseFloat(booking.total_amount || 0);
        customerBookings[custId].as_payer.paid += parseFloat(booking.paid_amount || 0);
        customerBookings[custId].as_payer.pending += parseFloat(booking.due_amount || 0);
        customerBookings[custId].as_payer.count += 1;
        
        customerBookings[custId].all.total += parseFloat(booking.total_amount || 0);
        customerBookings[custId].all.paid += parseFloat(booking.paid_amount || 0);
        customerBookings[custId].all.pending += parseFloat(booking.due_amount || 0);
        customerBookings[custId].all.count += 1;
      }
      
      // Case 2: Customer is receiver AND payment_by is 'receiver' - customer is responsible for payment
      if (customerIds.includes(booking.to_customer_id) && booking.payment_by === 'receiver') {
        const custId = booking.to_customer_id;
        if (!customerBookings[custId]) {
          customerBookings[custId] = {
            as_payer: { total: 0, paid: 0, pending: 0, count: 0 },
            as_recipient: { total: 0, paid: 0, pending: 0, count: 0 },
            all: { total: 0, paid: 0, pending: 0, count: 0 }
          };
        }
        
        customerBookings[custId].as_payer.total += parseFloat(booking.total_amount || 0);
        customerBookings[custId].as_payer.paid += parseFloat(booking.paid_amount || 0);
        customerBookings[custId].as_payer.pending += parseFloat(booking.due_amount || 0);
        customerBookings[custId].as_payer.count += 1;
        
        customerBookings[custId].all.total += parseFloat(booking.total_amount || 0);
        customerBookings[custId].all.paid += parseFloat(booking.paid_amount || 0);
        customerBookings[custId].all.pending += parseFloat(booking.due_amount || 0);
        customerBookings[custId].all.count += 1;
      }
      
      // Case 3: Customer is sender but payment_by is 'receiver' - receiver pays
      if (customerIds.includes(booking.from_customer_id) && booking.payment_by === 'receiver') {
        const custId = booking.from_customer_id;
        if (!customerBookings[custId]) {
          customerBookings[custId] = {
            as_payer: { total: 0, paid: 0, pending: 0, count: 0 },
            as_recipient: { total: 0, paid: 0, pending: 0, count: 0 },
            all: { total: 0, paid: 0, pending: 0, count: 0 }
          };
        }
        
        customerBookings[custId].as_recipient.total += parseFloat(booking.total_amount || 0);
        customerBookings[custId].as_recipient.paid += parseFloat(booking.paid_amount || 0);
        customerBookings[custId].as_recipient.pending += parseFloat(booking.due_amount || 0);
        customerBookings[custId].as_recipient.count += 1;
        
        customerBookings[custId].all.total += parseFloat(booking.total_amount || 0);
        customerBookings[custId].all.paid += parseFloat(booking.paid_amount || 0);
        customerBookings[custId].all.pending += parseFloat(booking.due_amount || 0);
        customerBookings[custId].all.count += 1;
      }
      
      // Case 4: Customer is receiver but payment_by is 'sender' - sender pays
      if (customerIds.includes(booking.to_customer_id) && booking.payment_by === 'sender') {
        const custId = booking.to_customer_id;
        if (!customerBookings[custId]) {
          customerBookings[custId] = {
            as_payer: { total: 0, paid: 0, pending: 0, count: 0 },
            as_recipient: { total: 0, paid: 0, pending: 0, count: 0 },
            all: { total: 0, paid: 0, pending: 0, count: 0 }
          };
        }
        
        customerBookings[custId].as_recipient.total += parseFloat(booking.total_amount || 0);
        customerBookings[custId].as_recipient.paid += parseFloat(booking.paid_amount || 0);
        customerBookings[custId].as_recipient.pending += parseFloat(booking.due_amount || 0);
        customerBookings[custId].as_recipient.count += 1;
        
        customerBookings[custId].all.total += parseFloat(booking.total_amount || 0);
        customerBookings[custId].all.paid += parseFloat(booking.paid_amount || 0);
        customerBookings[custId].all.pending += parseFloat(booking.due_amount || 0);
        customerBookings[custId].all.count += 1;
      }
    });
    
    // Group payments by customer
    const customerPayments = {};
    
    payments.forEach(payment => {
      const custId = payment.customer_id;
      if (!customerPayments[custId]) {
        customerPayments[custId] = {
          total: 0,
          count: 0,
          last_payment_date: null
        };
      }
      
      customerPayments[custId].total += parseFloat(payment.amount || 0);
      customerPayments[custId].count += 1;
      
      const paymentDate = payment.payment_date;
      if (!customerPayments[custId].last_payment_date || paymentDate > customerPayments[custId].last_payment_date) {
        customerPayments[custId].last_payment_date = paymentDate;
      }
    });
    
    // Build customer summary
    let customerSummaries = customers.map(customer => {
      const custId = customer.customer_id;
      const bookingData = customerBookings[custId] || { 
        as_payer: { total: 0, paid: 0, pending: 0, count: 0 },
        as_recipient: { total: 0, paid: 0, pending: 0, count: 0 },
        all: { total: 0, paid: 0, pending: 0, count: 0 }
      };
      const paymentData = customerPayments[custId] || { total: 0, count: 0, last_payment_date: null };
      
      const totalBookings = bookingData.all.count;
      const totalAmount = bookingData.all.total;
      const totalPaid = bookingData.all.paid;
      const totalPending = bookingData.all.pending;
      
      const responsibleAmount = bookingData.as_payer.total;
      const responsiblePaid = bookingData.as_payer.paid;
      const responsiblePending = bookingData.as_payer.pending;
      
      let paymentStatus = 'no_bookings';
      if (responsibleAmount > 0) {
        if (responsiblePending <= 0) {
          paymentStatus = 'fully_paid';
        } else if (responsiblePaid > 0 && responsiblePending > 0) {
          paymentStatus = 'partial';
        } else if (responsiblePaid <= 0 && responsiblePending > 0) {
          paymentStatus = 'pending';
        }
      } else if (totalBookings > 0) {
        paymentStatus = 'not_responsible';
      }
      
      const paymentProgress = responsibleAmount > 0 ? ((responsiblePaid / responsibleAmount) * 100).toFixed(2) : 0;
      
      return {
        customer_id: custId,
        customer_name: customer.customer_name,
        customer_number: customer.customer_number,
        created_at: customer.created_at,
        summary: {
          total_bookings: totalBookings,
          total_amount: totalAmount.toFixed(2),
          total_paid: totalPaid.toFixed(2),
          total_pending: totalPending.toFixed(2),
          responsible_amount: responsibleAmount.toFixed(2),
          responsible_paid: responsiblePaid.toFixed(2),
          responsible_pending: responsiblePending.toFixed(2),
          payment_progress: paymentProgress,
          payment_status: paymentStatus,
          as_payer: {
            bookings: bookingData.as_payer.count,
            total: bookingData.as_payer.total.toFixed(2),
            paid: bookingData.as_payer.paid.toFixed(2),
            pending: bookingData.as_payer.pending.toFixed(2)
          },
          as_recipient: {
            bookings: bookingData.as_recipient.count,
            total: bookingData.as_recipient.total.toFixed(2),
            paid: bookingData.as_recipient.paid.toFixed(2),
            pending: bookingData.as_recipient.pending.toFixed(2)
          },
          payments: {
            total_count: paymentData.count,
            total_amount: paymentData.total.toFixed(2),
            last_payment_date: paymentData.last_payment_date
          }
        }
      };
    });
    
    // Filter by payment status if requested
    if (status && status !== 'all') {
      customerSummaries = customerSummaries.filter(c => {
        if (status === 'paid') return c.summary.payment_status === 'fully_paid';
        if (status === 'pending') return c.summary.payment_status === 'pending' || c.summary.payment_status === 'partial';
        if (status === 'partial') return c.summary.payment_status === 'pending' || c.summary.payment_status === 'partial';
        if (status === 'not_responsible') return c.summary.payment_status === 'not_responsible';
        return true;
      });
    }
    
    // Calculate overall statistics
    const overallStats = {
      total_customers: customerSummaries.length,
      total_bookings: customerSummaries.reduce((sum, c) => sum + c.summary.total_bookings, 0),
      total_amount: customerSummaries.reduce((sum, c) => sum + parseFloat(c.summary.total_amount), 0).toFixed(2),
      total_paid: customerSummaries.reduce((sum, c) => sum + parseFloat(c.summary.total_paid), 0).toFixed(2),
      total_pending: customerSummaries.reduce((sum, c) => sum + parseFloat(c.summary.total_pending), 0).toFixed(2),
      total_responsible_amount: customerSummaries.reduce((sum, c) => sum + parseFloat(c.summary.responsible_amount), 0).toFixed(2),
      total_responsible_paid: customerSummaries.reduce((sum, c) => sum + parseFloat(c.summary.responsible_paid), 0).toFixed(2),
      total_responsible_pending: customerSummaries.reduce((sum, c) => sum + parseFloat(c.summary.responsible_pending), 0).toFixed(2),
      total_payments: customerSummaries.reduce((sum, c) => sum + c.summary.payments.total_count, 0),
      total_payment_amount: customerSummaries.reduce((sum, c) => sum + parseFloat(c.summary.payments.total_amount), 0).toFixed(2)
    };
    
    // Status breakdown
    const statusBreakdown = {
      fully_paid: customerSummaries.filter(c => c.summary.payment_status === 'fully_paid').length,
      partial: customerSummaries.filter(c => c.summary.payment_status === 'partial').length,
      pending: customerSummaries.filter(c => c.summary.payment_status === 'pending').length,
      not_responsible: customerSummaries.filter(c => c.summary.payment_status === 'not_responsible').length,
      no_bookings: customerSummaries.filter(c => c.summary.payment_status === 'no_bookings').length
    };
    
    // Prepare response
    const response = {
      overall: overallStats,
      status_breakdown: statusBreakdown
    };
    
    // ONLY apply pagination if explicitly requested
    if (isPaginated) {
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;
      
      response.pagination = {
        current_page: pageNum,
        total_pages: Math.ceil(customerSummaries.length / limitNum),
        total_customers: customerSummaries.length,
        limit: limitNum
      };
      
      // Apply pagination to customers array
      response.customers = customerSummaries.slice(offset, offset + limitNum);
    } else {
      // Return all customers without pagination
      response.customers = customerSummaries;
    }
    
    return response;
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

async function getCustomerPendingPayments(customerId) {
  try {
    const bookings = await Booking.findAll({
      where: {
        [Op.or]: [
          { from_customer_id: customerId },
          { to_customer_id: customerId }
        ],
        is_active: 1,
        [Op.or]: [
          { due_amount: { [Op.gt]: 0 } },  // Has pending amount
          { payment_status: 'pending' },    // Payment status pending
          { payment_status: 'partial' }     // Payment status partial
        ]
      },
      attributes: [
        'booking_id',
        'booking_number',
        'llr_number',
        'booking_date',
        'from_center_id',
        'to_center_id',
        'from_customer_id',
        'to_customer_id',
        'total_amount',
        'paid_amount',
        'due_amount',
        'payment_by',        // 'sender' or 'receiver' - tells who is responsible
        'payment_status',
        'delivery_status',
        'special_instructions',
        'reference_number',
        'created_at'
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
          model: Customer,
          as: 'fromCustomer',
          attributes: ['customer_id', 'customer_name', 'customer_number']  // Sender info
        },
        {
          model: Customer,
          as: 'toCustomer',
          attributes: ['customer_id', 'customer_name', 'customer_number']  // Receiver info
        },
        {
          model: BookingPackage,
          as: 'packages',
          attributes: [
            'booking_package_id',
            'package_type_id',
            'quantity',
            'pickup_charge',
            'drop_charge',
            'handling_charge',
            'total_package_charge'
          ],
          include: [
            {
              model: PackageType,
              as: 'packageType',
              attributes: ['package_type_id', 'package_type_name']
            }
          ]
        }
      ],
      order: [['booking_date', 'DESC'], ['created_at', 'DESC']]
    });

    if (!bookings || bookings.length === 0) {
      return {
        customer_id: customerId,
        customer_info: null,
        message: "No pending payments found for this customer",
        total_pending_amount: 0,
        pending_bookings: []
      };
    }

    const customerInfo = await Customer.findOne({
      where: { customer_id: customerId, is_active: 1 },
      attributes: ['customer_id', 'customer_name', 'customer_number']
    });

    const processedBookings = bookings.map(booking => {
      const bookingJson = booking.toJSON();
      
      let customerRole = null;
      let responsibleParty = null;
      
      if (booking.from_customer_id === customerId) {
        customerRole = 'sender';
      } else if (booking.to_customer_id === customerId) {
        customerRole = 'receiver';
      }
      
      if (booking.payment_by === 'sender') {
        responsibleParty = {
          role: 'sender',
          customer_id: booking.from_customer_id,
          customer_name: booking.fromCustomer?.customer_name,
          customer_number: booking.fromCustomer?.customer_number
        };
      } else if (booking.payment_by === 'receiver') {
        responsibleParty = {
          role: 'receiver',
          customer_id: booking.to_customer_id,
          customer_name: booking.toCustomer?.customer_name,
          customer_number: booking.toCustomer?.customer_number
        };
      }
      
      const isResponsibleForPayment = 
        (booking.payment_by === 'sender' && booking.from_customer_id === customerId) ||
        (booking.payment_by === 'receiver' && booking.to_customer_id === customerId);
      
      return {
        ...bookingJson,
        customer_role: customerRole,
        is_responsible_for_payment: isResponsibleForPayment,
        responsible_party: responsibleParty,
        sender: {
          customer_id: booking.from_customer_id,
          customer_name: booking.fromCustomer?.customer_name,
          customer_number: booking.fromCustomer?.customer_number
        },
        receiver: {
          customer_id: booking.to_customer_id,
          customer_name: booking.toCustomer?.customer_name,
          customer_number: booking.toCustomer?.customer_number
        },
        payment_progress: {
          total: parseFloat(booking.total_amount || 0).toFixed(2),
          paid: parseFloat(booking.paid_amount || 0).toFixed(2),
          due: parseFloat(booking.due_amount || 0).toFixed(2),
          percentage_paid: booking.total_amount > 0 
            ? ((parseFloat(booking.paid_amount || 0) / parseFloat(booking.total_amount || 0)) * 100).toFixed(2)
            : 0
        }
      };
    });

    const totalPendingAmount = bookings.reduce(
      (sum, booking) => sum + parseFloat(booking.due_amount || 0), 
      0
    );

    const responsibleBookings = processedBookings.filter(b => b.is_responsible_for_payment);
    const involvedBookings = processedBookings.filter(b => !b.is_responsible_for_payment);

    return {
      customer_id: customerId,
      customer_info: customerInfo ? {
        customer_id: customerInfo.customer_id,
        customer_name: customerInfo.customer_name,
        customer_number: customerInfo.customer_number
      } : null,
      summary: {
        total_pending_bookings: bookings.length,
        total_pending_amount: totalPendingAmount.toFixed(2),
        total_responsible_amount: responsibleBookings.reduce(
          (sum, b) => sum + parseFloat(b.due_amount || 0), 0
        ).toFixed(2),
        bookings_where_customer_pays: responsibleBookings.length,
        bookings_where_others_pay: involvedBookings.length
      },
      pending_bookings: processedBookings,
      bookings_customer_must_pay: responsibleBookings,
      bookings_others_must_pay: involvedBookings
    };
    
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

module.exports = {
  getBooking,
  createBooking,
  updateBooking,
  updateDeliveryStatus,
  deleteBooking,
  getBookingById,
  getBookingsByCustomer,
  addBookingPayment ,
   // NEW EXPORTS
  getCustomerPaymentsByDate,
  getCustomerBookingsAndPayments,
  makeCustomerBulkPayment,
  getAllCustomerPaymentRecords,
  getCustomerPaymentSummary,
  getAllCustomersPaymentSummary,
  getCustomerPendingPayments
};