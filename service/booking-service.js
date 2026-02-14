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
    // Check if booking has payments
    const paymentCount = await Payment.count({
      where: { booking_id: bookingId, is_active: 1 },
      transaction
    });
    
    if (paymentCount > 0) {
      throw new Error("Cannot delete booking as it has associated payments");
    }
    
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

module.exports = {
  getBooking,
  createBooking,
  updateBooking,
  updateDeliveryStatus,
  deleteBooking,
  getBookingById,
  getBookingsByCustomer,
  addBookingPayment 
};