"use strict";

const messages = require("../helpers/message");
const _ = require("lodash");
const { Op } = require("sequelize");
const { 
  PackageLoadman, 
  LoadmanSalary, 
  TripBooking, 
  BookingPackage, 
  Booking, 
  Trip, 
  Employee,
  PackageType,
  sequelize 
} = require("../models");
const { v4: uuidv4 } = require('uuid');

// =============================================
// ASSIGN LOADMEN TO PACKAGES BY TRIP ID
// =============================================

/**
 * Assign loadmen to packages within a trip using trip ID
 * Each assignment includes packageTypeId, loadmanId, loadmanType, and optional quantity
 */
async function assignLoadmenToTripPackages1(tripId, assignments) {
  const transaction = await sequelize.transaction();
  
  try {
    // Verify trip exists
    const trip = await Trip.findOne({
      where: { 
        trip_id: tripId, 
        is_active: 1 
      },
      attributes: ['trip_id', 'trip_number'],
      transaction
    });

    if (!trip) {
      throw new Error("Trip not found");
    }

    // Get all trip bookings for this trip
    const tripBookings = await TripBooking.findAll({
      where: { 
        trip_id: tripId,
        is_active: 1 
      },
      attributes: ['trip_booking_id', 'booking_id'],
      transaction
    });

    if (tripBookings.length === 0) {
      throw new Error("No bookings found for this trip");
    }

    const bookingIds = tripBookings.map(tb => tb.booking_id);
    const tripBookingIds = tripBookings.map(tb => tb.trip_booking_id);

    // Get all packages for these bookings
    const bookingPackages = await BookingPackage.findAll({
      where: { 
        booking_id: { [Op.in]: bookingIds },
        is_active: 1 
      },
      attributes: [
        'booking_package_id',
        'booking_id',
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
        },
        {
          model: Booking,
          as: 'booking',
          attributes: ['booking_id', 'booking_number']
        }
      ],
      transaction
    });

    if (bookingPackages.length === 0) {
      throw new Error("No packages found for this trip");
    }

    // Create a map of package type to package details
    const packageTypeMap = {};
    bookingPackages.forEach(bp => {
      if (!packageTypeMap[bp.package_type_id]) {
        packageTypeMap[bp.package_type_id] = [];
      }
      packageTypeMap[bp.package_type_id].push(bp);
    });

    // Create a map of booking_package_id to package for easy lookup
    const packageMap = {};
    bookingPackages.forEach(bp => {
      packageMap[bp.booking_package_id] = bp;
    });

    // Create a map of booking_id to trip_booking_id
    const bookingToTripBookingMap = {};
    tripBookings.forEach(tb => {
      bookingToTripBookingMap[tb.booking_id] = tb.trip_booking_id;
    });

    // Group loadman IDs for validation
    const loadmanIds = [...new Set(assignments.map(a => a.loadmanId))];
    
    // Verify all loadmen exist and are loadmen
    const loadmen = await Employee.findAll({
      where: { 
        employee_id: { [Op.in]: loadmanIds },
        is_loadman: true,
        is_active: 1 
      },
      transaction
    });

    if (loadmen.length !== loadmanIds.length) {
      const foundIds = loadmen.map(l => l.employee_id);
      const missingIds = loadmanIds.filter(id => !foundIds.includes(id));
      throw new Error(`Loadmen not found or are not loadmen: ${missingIds.join(', ')}`);
    }

    // Create a map for loadmen
    const loadmanMap = {};
    loadmen.forEach(l => {
      loadmanMap[l.employee_id] = l;
    });

    const results = [];
    const errors = [];

    // Process each assignment
    for (const assignment of assignments) {
      try {
        const { 
          packageTypeId, 
          loadmanId, 
          loadmanType,
          quantity = 1 // Default to 1 if not provided
        } = assignment;

        const availablePackages = packageTypeMap[packageTypeId];
        
        if (!availablePackages || availablePackages.length === 0) {
          throw new Error(`Package type ${packageTypeId} not found in this trip`);
        }

        // For simplicity, assign to the first package of this type
        // You might want to implement more sophisticated logic here
        const bookingPackage = availablePackages[0];
        const loadman = loadmanMap[loadmanId];
        const tripBookingId = bookingToTripBookingMap[bookingPackage.booking_id];

        if (!tripBookingId) {
          throw new Error(`No trip booking found for booking ${bookingPackage.booking_id}`);
        }

        // Validate quantity doesn't exceed package quantity
        if (quantity > (bookingPackage.quantity || 1)) {
          throw new Error(`Quantity ${quantity} exceeds package quantity ${bookingPackage.quantity || 1}`);
        }

        // Calculate amount earned based on loadman type and quantity
        let amountEarned = 0;

        if (loadmanType === 'pickup' || loadmanType === 'both') {
          amountEarned += parseFloat(bookingPackage.pickup_charge || 0) * quantity;
        }
        if (loadmanType === 'drop' || loadmanType === 'both') {
          amountEarned += parseFloat(bookingPackage.drop_charge || 0) * quantity;
        }

        // Check if assignment already exists
        const existingAssignment = await PackageLoadman.findOne({
          where: {
            trip_booking_id: tripBookingId,
            booking_package_id: bookingPackage.booking_package_id,
            loadman_id: loadmanId,
            is_active: 1
          },
          transaction
        });

        let assignmentResult;

        if (existingAssignment) {
          // Update existing assignment
          await existingAssignment.update({
            loadman_type: loadmanType,
            amount_earned: amountEarned,
            updated_at: new Date()
          }, { transaction });

          assignmentResult = {
            ...existingAssignment.toJSON(),
            updated: true,
            package_type_id: packageTypeId,
            package_type_name: bookingPackage.packageType?.package_type_name,
            booking_package_id: bookingPackage.booking_package_id,
            booking_number: bookingPackage.booking?.booking_number,
            trip_id: tripId,
            trip_number: trip.trip_number,
            quantity: quantity,
            amount_per_unit: amountEarned / quantity,
            loadman_name: loadman.employee_name
          };
        } else {
          // Create new assignment
          const newAssignment = await PackageLoadman.create({
            package_loadman_id: uuidv4(),
            trip_booking_id: tripBookingId,
            booking_package_id: bookingPackage.booking_package_id,
            loadman_id: loadmanId,
            loadman_type: loadmanType,
            amount_earned: amountEarned,
            created_at: new Date(),
            updated_at: new Date()
          }, { transaction });

          assignmentResult = {
            ...newAssignment.toJSON(),
            package_type_id: packageTypeId,
            package_type_name: bookingPackage.packageType?.package_type_name,
            booking_package_id: bookingPackage.booking_package_id,
            booking_number: bookingPackage.booking?.booking_number,
            trip_id: tripId,
            trip_number: trip.trip_number,
            quantity: quantity,
            amount_per_unit: amountEarned / quantity,
            loadman_name: loadman.employee_name
          };
        }

        results.push(assignmentResult);

      } catch (err) {
        errors.push({
          assignment,
          error: err.message
        });
      }
    }

    await transaction.commit();

    return {
      success: true,
      message: `Processed ${results.length} assignments successfully${errors.length > 0 ? ` with ${errors.length} errors` : ''}`,
      trip_id: tripId,
      trip_number: trip.trip_number,
      summary: {
        total_assignments: assignments.length,
        successful: results.length,
        failed: errors.length
      },
      results: results,
      errors: errors.length > 0 ? errors : undefined
    };
    
  } catch (error) {
    await transaction.rollback();
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}
/**
 * Assign loadmen to packages within a trip using trip ID
 * Each assignment includes packageTypeId, loadmanId, loadmanType, and optional quantity
 * Now properly handles multiple packages of the same type
 */
async function assignLoadmenToTripPackages(tripId, assignments) {
  const transaction = await sequelize.transaction();
  
  try {
    // Verify trip exists
    const trip = await Trip.findOne({
      where: { 
        trip_id: tripId, 
        is_active: 1 
      },
      attributes: ['trip_id', 'trip_number'],
      transaction
    });

    if (!trip) {
      throw new Error("Trip not found");
    }

    // Get all trip bookings for this trip
    const tripBookings = await TripBooking.findAll({
      where: { 
        trip_id: tripId,
        is_active: 1 
      },
      attributes: ['trip_booking_id', 'booking_id'],
      transaction
    });

    if (tripBookings.length === 0) {
      throw new Error("No bookings found for this trip");
    }

    const bookingIds = tripBookings.map(tb => tb.booking_id);
    const tripBookingIds = tripBookings.map(tb => tb.trip_booking_id);

    // Get all packages for these bookings
    const bookingPackages = await BookingPackage.findAll({
      where: { 
        booking_id: { [Op.in]: bookingIds },
        is_active: 1 
      },
      attributes: [
        'booking_package_id',
        'booking_id',
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
        },
        { 
          model: Booking, 
          as: 'booking', 
          attributes: ['booking_id', 'booking_number'] 
        }
      ],
      transaction
    });

    if (bookingPackages.length === 0) {
      throw new Error("No packages found for this trip");
    }

    // Create a map of package type to array of packages
    const packagesByType = {};
    bookingPackages.forEach(bp => {
      if (!packagesByType[bp.package_type_id]) {
        packagesByType[bp.package_type_id] = [];
      }
      packagesByType[bp.package_type_id].push(bp);
    });

    // Create a map of booking_package_id to package for easy lookup
    const packageMap = {};
    bookingPackages.forEach(bp => {
      packageMap[bp.booking_package_id] = bp;
    });

    // Create a map of booking_id to trip_booking_id
    const bookingToTripBookingMap = {};
    tripBookings.forEach(tb => {
      bookingToTripBookingMap[tb.booking_id] = tb.trip_booking_id;
    });

    // Group loadman IDs for validation
    const loadmanIds = [...new Set(assignments.map(a => a.loadmanId))];
    
    // Verify all loadmen exist and are loadmen
    const loadmen = await Employee.findAll({
      where: { 
        employee_id: { [Op.in]: loadmanIds },
        is_loadman: true,
        is_active: 1 
      },
      transaction
    });

    if (loadmen.length !== loadmanIds.length) {
      const foundIds = loadmen.map(l => l.employee_id);
      const missingIds = loadmanIds.filter(id => !foundIds.includes(id));
      throw new Error(`Loadmen not found or are not loadmen: ${missingIds.join(', ')}`);
    }

    // Create a map for loadmen
    const loadmanMap = {};
    loadmen.forEach(l => {
      loadmanMap[l.employee_id] = l;
    });

    const results = [];
    const errors = [];

    // Process each assignment
    for (const assignment of assignments) {
      try {
        const { 
          packageTypeId, 
          loadmanId, 
          loadmanType,
          quantity = 1 // Default to 1 if not provided
        } = assignment;

        // Get all packages of this type
        const availablePackages = packagesByType[packageTypeId];
        
        if (!availablePackages || availablePackages.length === 0) {
          throw new Error(`Package type ${packageTypeId} not found in this trip`);
        }

        const loadman = loadmanMap[loadmanId];

        // Calculate total available quantity for this package type
        const totalAvailableQuantity = availablePackages.reduce(
          (sum, pkg) => sum + (pkg.quantity || 1), 0
        );

        // Validate that requested quantity doesn't exceed total available
        if (quantity > totalAvailableQuantity) {
          throw new Error(
            `Quantity ${quantity} exceeds total available quantity ${totalAvailableQuantity} ` +
            `for package type ${packageTypeId}`
          );
        }

        // Distribute quantity across multiple packages of the same type
        let remainingQuantity = quantity;
        const packageAssignments = [];

        // Sort packages by ID or any criteria to ensure consistent assignment
        const sortedPackages = [...availablePackages].sort((a, b) => 
          a.booking_package_id.localeCompare(b.booking_package_id)
        );

        for (const bookingPackage of sortedPackages) {
          if (remainingQuantity <= 0) break;

          const packageQuantity = bookingPackage.quantity || 1;
          const assignQuantity = Math.min(remainingQuantity, packageQuantity);
          
          const tripBookingId = bookingToTripBookingMap[bookingPackage.booking_id];
          
          if (!tripBookingId) {
            throw new Error(`No trip booking found for booking ${bookingPackage.booking_id}`);
          }

          // Calculate amount earned for this package based on assigned quantity
          let amountEarned = 0;

          if (loadmanType === 'pickup' || loadmanType === 'both') {
            amountEarned += parseFloat(bookingPackage.pickup_charge || 0) * assignQuantity;
          }
          if (loadmanType === 'drop' || loadmanType === 'both') {
            amountEarned += parseFloat(bookingPackage.drop_charge || 0) * assignQuantity;
          }

          // Check if assignment already exists for this specific package
          const existingAssignment = await PackageLoadman.findOne({
            where: {
              trip_booking_id: tripBookingId,
              booking_package_id: bookingPackage.booking_package_id,
              loadman_id: loadmanId,
              is_active: 1
            },
            transaction
          });

          let assignmentResult;

          if (existingAssignment) {
            // Update existing assignment
            await existingAssignment.update({
              loadman_type: loadmanType,
              amount_earned: amountEarned,
              updated_at: new Date()
            }, { transaction });

            assignmentResult = {
              ...existingAssignment.toJSON(),
              updated: true,
              package_type_id: packageTypeId,
              package_type_name: bookingPackage.packageType?.package_type_name,
              booking_package_id: bookingPackage.booking_package_id,
              booking_number: bookingPackage.booking?.booking_number,
              trip_id: tripId,
              trip_number: trip.trip_number,
              assigned_quantity: assignQuantity,
              package_total_quantity: packageQuantity,
              amount_per_unit: amountEarned / assignQuantity,
              loadman_name: loadman.employee_name
            };
          } else {
            // Create new assignment
            const newAssignment = await PackageLoadman.create({
              package_loadman_id: uuidv4(),
              trip_booking_id: tripBookingId,
              booking_package_id: bookingPackage.booking_package_id,
              loadman_id: loadmanId,
              loadman_type: loadmanType,
              amount_earned: amountEarned,
              created_at: new Date(),
              updated_at: new Date()
            }, { transaction });

            assignmentResult = {
              ...newAssignment.toJSON(),
              package_type_id: packageTypeId,
              package_type_name: bookingPackage.packageType?.package_type_name,
              booking_package_id: bookingPackage.booking_package_id,
              booking_number: bookingPackage.booking?.booking_number,
              trip_id: tripId,
              trip_number: trip.trip_number,
              assigned_quantity: assignQuantity,
              package_total_quantity: packageQuantity,
              amount_per_unit: amountEarned / assignQuantity,
              loadman_name: loadman.employee_name
            };
          }

          packageAssignments.push(assignmentResult);
          remainingQuantity -= assignQuantity;
        }

        // Add all package assignments for this loadman/package type combination
        results.push(...packageAssignments);

      } catch (err) {
        errors.push({
          assignment,
          error: err.message
        });
      }
    }

    await transaction.commit();

    return {
      success: true,
      message: `Processed ${results.length} package assignments successfully${errors.length > 0 ? ` with ${errors.length} errors` : ''}`,
      trip_id: tripId,
      trip_number: trip.trip_number,
      summary: {
        total_assignments: assignments.length,
        total_package_assignments: results.length,
        successful: results.length,
        failed: errors.length
      },
      results: results,
      errors: errors.length > 0 ? errors : undefined
    };
    
  } catch (error) {
    await transaction.rollback();
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}
// =============================================
// GET PACKAGE LOADMEN BY TRIP ID
// =============================================

/**
 * Get loadmen assigned to packages for a trip
 */
/**
 * Get loadmen assigned to packages for a trip with date filter and total earnings
 */
async function getTripPackageLoadmen(tripId, packageTypeId = null, startDate = null, endDate = null) {
  try {
    // Verify trip exists
    const trip = await Trip.findOne({
      where: { 
        trip_id: tripId, 
        is_active: 1 
      },
      attributes: ['trip_id', 'trip_number', 'trip_date']
    });

    if (!trip) {
      throw new Error("Trip not found");
    }

    // Get all trip bookings for this trip
    const tripBookings = await TripBooking.findAll({
      where: { 
        trip_id: tripId,
        is_active: 1 
      },
      attributes: ['trip_booking_id', 'booking_id', 'created_at'],
      include: [
        {
          model: Booking,
          as: 'booking',
          attributes: ['booking_id', 'booking_number']
        }
      ]
    });

    if (tripBookings.length === 0) {
      return {
        trip_id: tripId,
        trip_number: trip.trip_number,
        trip_date: trip.trip_date,
        summary: {
          total_earnings: "0.00",
          total_pickup_charges: "0.00",
          total_drop_charges: "0.00",
          total_handling_charges: "0.00",
          total_packages: 0,
          total_assignments: 0,
          unique_loadmen: 0
        },
        bookings: []
      };
    }

    const bookingIds = tripBookings.map(tb => tb.booking_id);
    const tripBookingIds = tripBookings.map(tb => tb.trip_booking_id);

    // Get all packages for these bookings
    const bookingPackages = await BookingPackage.findAll({
      where: { 
        booking_id: { [Op.in]: bookingIds },
        is_active: 1 
      },
      attributes: [
        'booking_package_id',
        'booking_id',
        'package_type_id',
        'quantity',
        'pickup_charge',
        'drop_charge',
        'handling_charge'
      ],
      include: [
        {
          model: PackageType,
          as: 'packageType',
          attributes: ['package_type_id', 'package_type_name']
        }
      ]
    });

    // Create maps for easy lookup
    const packageMap = {};
    bookingPackages.forEach(bp => {
      packageMap[bp.booking_package_id] = bp;
    });

    const bookingMap = {};
    tripBookings.forEach(tb => {
      bookingMap[tb.booking_id] = tb;
    });

    // Build where clause for loadman assignments with date filter
    const whereClause = { 
      trip_booking_id: { [Op.in]: tripBookingIds },
      is_active: 1 
    };

    // Add date filter if provided
    if (startDate && endDate) {
      whereClause.created_at = {
        [Op.between]: [startDate, endDate]
      };
    } else if (startDate) {
      whereClause.created_at = {
        [Op.gte]: startDate
      };
    } else if (endDate) {
      whereClause.created_at = {
        [Op.lte]: endDate
      };
    }

    // Get all loadman assignments for these trip bookings with date filter
    const assignments = await PackageLoadman.findAll({
      where: whereClause,
      include: [
        {
          model: Employee,
          as: 'loadman',
          attributes: ['employee_id', 'employee_name', 'mobile_no']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    // Calculate overall summary
    const summary = {
      total_earnings: 0,
      total_pickup_charges: 0,
      total_drop_charges: 0,
      total_handling_charges: 0,
      total_packages: 0,
      total_assignments: assignments.length,
      unique_loadmen: new Set(assignments.map(a => a.loadman_id)).size,
      date_range: startDate && endDate ? { startDate, endDate } : null
    };

    // Group assignments by booking and package type
    const groupedByBooking = {};

    assignments.forEach(assignment => {
      const bookingPackage = packageMap[assignment.booking_package_id];
      if (!bookingPackage) return;
      
      const bookingId = bookingPackage.booking_id;
      const tripBooking = bookingMap[bookingId];
      const quantity = bookingPackage.quantity || 1;
      const amountEarned = parseFloat(assignment.amount_earned || 0);
      
      // Update summary totals
      summary.total_earnings += amountEarned;
      summary.total_pickup_charges += parseFloat(bookingPackage.pickup_charge || 0) * quantity;
      summary.total_drop_charges += parseFloat(bookingPackage.drop_charge || 0) * quantity;
      summary.total_handling_charges += parseFloat(bookingPackage.handling_charge || 0) * quantity;
      summary.total_packages += quantity;
      
      if (!groupedByBooking[bookingId]) {
        groupedByBooking[bookingId] = {
          booking_id: bookingId,
          booking_number: tripBooking?.booking?.booking_number,
          packages: {}
        };
      }

      const pkgTypeId = bookingPackage.package_type_id;
      const packageTypeName = bookingPackage.packageType?.package_type_name;
      
      if (!groupedByBooking[bookingId].packages[pkgTypeId]) {
        groupedByBooking[bookingId].packages[pkgTypeId] = {
          package_type_id: pkgTypeId,
          package_type_name: packageTypeName,
          total_quantity: 0,
          total_pickup_charge: 0,
          total_drop_charge: 0,
          total_handling_charge: 0,
          total_amount: 0,
          assignments: []
        };
      }
      
      const pkgGroup = groupedByBooking[bookingId].packages[pkgTypeId];
      
      pkgGroup.total_quantity += quantity;
      pkgGroup.total_pickup_charge += parseFloat(bookingPackage.pickup_charge || 0) * quantity;
      pkgGroup.total_drop_charge += parseFloat(bookingPackage.drop_charge || 0) * quantity;
      pkgGroup.total_handling_charge += parseFloat(bookingPackage.handling_charge || 0) * quantity;
      pkgGroup.total_amount += amountEarned;
      
      pkgGroup.assignments.push({
        ...assignment.toJSON(),
        package_quantity: quantity,
        amount_per_unit: (amountEarned / quantity).toFixed(2)
      });
    });

    // Convert packages object to array for each booking
    const formattedBookings = Object.values(groupedByBooking).map(booking => ({
      booking_id: booking.booking_id,
      booking_number: booking.booking_number,
      package_types: Object.values(booking.packages)
    }));

    // If specific package type requested, filter across all bookings
    if (packageTypeId) {
      const filteredBookings = formattedBookings.map(booking => ({
        ...booking,
        package_types: booking.package_types.filter(pt => pt.package_type_id === packageTypeId)
      })).filter(booking => booking.package_types.length > 0);

      // Calculate filtered summary
      const filteredSummary = {
        total_earnings: filteredBookings.reduce((sum, b) => 
          sum + b.package_types.reduce((s, pt) => s + pt.total_amount, 0), 0),
        total_pickup_charges: filteredBookings.reduce((sum, b) => 
          sum + b.package_types.reduce((s, pt) => s + pt.total_pickup_charge, 0), 0),
        total_drop_charges: filteredBookings.reduce((sum, b) => 
          sum + b.package_types.reduce((s, pt) => s + pt.total_drop_charge, 0), 0),
        total_handling_charges: filteredBookings.reduce((sum, b) => 
          sum + b.package_types.reduce((s, pt) => s + pt.total_handling_charge, 0), 0),
        total_packages: filteredBookings.reduce((sum, b) => 
          sum + b.package_types.reduce((s, pt) => s + pt.total_quantity, 0), 0),
        total_assignments: filteredBookings.reduce((sum, b) => 
          sum + b.package_types.reduce((s, pt) => s + pt.assignments.length, 0), 0),
        unique_loadmen: new Set(
          filteredBookings.flatMap(b => 
            b.package_types.flatMap(pt => 
              pt.assignments.map(a => a.loadman_id)
            )
          )
        ).size
      };

      return {
        trip_id: tripId,
        trip_number: trip.trip_number,
        trip_date: trip.trip_date,
        summary: {
          ...filteredSummary,
          total_earnings: filteredSummary.total_earnings.toFixed(2),
          total_pickup_charges: filteredSummary.total_pickup_charges.toFixed(2),
          total_drop_charges: filteredSummary.total_drop_charges.toFixed(2),
          total_handling_charges: filteredSummary.total_handling_charges.toFixed(2)
        },
        bookings: filteredBookings
      };
    }

    return {
      trip_id: tripId,
      trip_number: trip.trip_number,
      trip_date: trip.trip_date,
      summary: {
        ...summary,
        total_earnings: summary.total_earnings.toFixed(2),
        total_pickup_charges: summary.total_pickup_charges.toFixed(2),
        total_drop_charges: summary.total_drop_charges.toFixed(2),
        total_handling_charges: summary.total_handling_charges.toFixed(2)
      },
      bookings: formattedBookings
    };
    
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

// =============================================
// GET LOADMAN PACKAGE ASSIGNMENTS BY LOADMAN ID
// =============================================

/**
 * Get package assignments for a specific loadman with date filters
 */
async function getLoadmanPackageAssignments(loadmanId, filters = {}) {
  try {
    const { startDate, endDate, page = 1, limit = 20 } = filters;
    const offset = (page - 1) * limit;
    
    // Verify loadman exists
    const loadman = await Employee.findOne({
      where: { 
        employee_id: loadmanId, 
        is_loadman: true,
        is_active: 1 
      },
      attributes: ['employee_id', 'employee_name', 'mobile_no']
    });

    if (!loadman) {
      throw new Error("Loadman not found");
    }

    // Build where clause
    const whereClause = { 
      loadman_id: loadmanId,
      is_active: 1 
    };

    // Add date filter if provided
    if (startDate && endDate) {
      whereClause.created_at = {
        [Op.between]: [startDate, endDate]
      };
    } else if (startDate) {
      whereClause.created_at = {
        [Op.gte]: startDate
      };
    } else if (endDate) {
      whereClause.created_at = {
        [Op.lte]: endDate
      };
    }

    // Get all package assignments for this loadman with pagination
    const { count, rows: assignments } = await PackageLoadman.findAndCountAll({
      where: whereClause,
      attributes: [
        'package_loadman_id',
        'trip_booking_id',
        'booking_package_id',
        'loadman_type',
        'amount_earned',
        'created_at',
        'updated_at'
      ],
      include: [
        {
          model: BookingPackage,
          as: 'bookingPackage',
          attributes: [
            'booking_package_id',
            'booking_id',
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
            },
            {
              model: Booking,
              as: 'booking',
              attributes: ['booking_id', 'booking_number', 'booking_date']
            }
          ]
        },
        {
          model: TripBooking,
          as: 'tripBooking',
          attributes: ['trip_booking_id', 'delivery_status'],
          include: [
            {
              model: Trip,
              as: 'trip',
              attributes: ['trip_id', 'trip_number', 'trip_date', 'status']
            }
          ]
        }
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset,
      distinct: true
    });

    // Calculate summary statistics
    let totalEarnings = 0;
    let totalPackages = 0;
    let totalPickupEarnings = 0;
    let totalDropEarnings = 0;
    let totalHandlingEarnings = 0;

    const earningsByType = {
      pickup: 0,
      drop: 0,
      both: 0
    };

    const earningsByPackageType = {};

    assignments.forEach(assignment => {
      const amount = parseFloat(assignment.amount_earned || 0);
      const pkg = assignment.bookingPackage;
      const quantity = pkg?.quantity || 1;
      
      totalEarnings += amount;
      totalPackages += quantity;
      
      // Track by loadman type
      earningsByType[assignment.loadman_type] = (earningsByType[assignment.loadman_type] || 0) + amount;
      
      // Calculate pickup/drop/handling earnings
      if (assignment.loadman_type === 'pickup' || assignment.loadman_type === 'both') {
        totalPickupEarnings += parseFloat(pkg?.pickup_charge || 0) * quantity;
      }
      if (assignment.loadman_type === 'drop' || assignment.loadman_type === 'both') {
        totalDropEarnings += parseFloat(pkg?.drop_charge || 0) * quantity;
      }
      if (pkg?.handling_charge) {
        totalHandlingEarnings += parseFloat(pkg.handling_charge) * quantity;
      }

      // Track by package type
      const pkgTypeId = pkg?.package_type_id;
      const pkgTypeName = pkg?.packageType?.package_type_name || 'Unknown';
      
      if (!earningsByPackageType[pkgTypeId]) {
        earningsByPackageType[pkgTypeId] = {
          package_type_id: pkgTypeId,
          package_type_name: pkgTypeName,
          total_earnings: 0,
          total_quantity: 0,
          assignments_count: 0
        };
      }
      
      earningsByPackageType[pkgTypeId].total_earnings += amount;
      earningsByPackageType[pkgTypeId].total_quantity += quantity;
      earningsByPackageType[pkgTypeId].assignments_count += 1;
    });

    // Get unique trips
    const uniqueTrips = new Set();
    assignments.forEach(a => {
      if (a.tripBooking?.trip?.trip_id) {
        uniqueTrips.add(a.tripBooking.trip.trip_id);
      }
    });

    return {
      loadman: {
        employee_id: loadman.employee_id,
        employee_name: loadman.employee_name,
        mobile_no: loadman.mobile_no
      },
      date_range: startDate && endDate ? { startDate, endDate } : null,
      summary: {
        total_earnings: totalEarnings.toFixed(2),
        total_packages: totalPackages,
        total_assignments: assignments.length,
        total_trips: uniqueTrips.size,
        total_pickup_earnings: totalPickupEarnings.toFixed(2),
        total_drop_earnings: totalDropEarnings.toFixed(2),
        total_handling_earnings: totalHandlingEarnings.toFixed(2),
        earnings_by_type: earningsByType,
        earnings_by_package_type: Object.values(earningsByPackageType)
      },
      assignments: assignments.map(a => ({
        assignment_id: a.package_loadman_id,
        loadman_type: a.loadman_type,
        amount_earned: a.amount_earned,
        created_at: a.created_at,
        package: a.bookingPackage ? {
          package_id: a.bookingPackage.booking_package_id,
          package_type: a.bookingPackage.packageType?.package_type_name,
          quantity: a.bookingPackage.quantity,
          pickup_charge: a.bookingPackage.pickup_charge,
          drop_charge: a.bookingPackage.drop_charge,
          handling_charge: a.bookingPackage.handling_charge,
          total_charge: a.bookingPackage.total_package_charge
        } : null,
        booking: a.bookingPackage?.booking ? {
          booking_id: a.bookingPackage.booking.booking_id,
          booking_number: a.bookingPackage.booking.booking_number,
          booking_date: a.bookingPackage.booking.booking_date
        } : null,
        trip: a.tripBooking?.trip ? {
          trip_id: a.tripBooking.trip.trip_id,
          trip_number: a.tripBooking.trip.trip_number,
          trip_date: a.tripBooking.trip.trip_date,
          status: a.tripBooking.trip.status
        } : null
      })),
      pagination: {
        current_page: page,
        total_pages: Math.ceil(count / limit),
        total_records: count,
        limit
      }
    };
    
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

// =============================================
// GET LOADMAN EARNINGS SUMMARY
// =============================================

/**
 * Get loadman earnings summary by date range
 */
async function getLoadmanEarningsSummary(loadmanId, startDate, endDate) {
  try {
    // Verify loadman exists
    const loadman = await Employee.findOne({
      where: { 
        employee_id: loadmanId, 
        is_loadman: true,
        is_active: 1 
      },
      attributes: ['employee_id', 'employee_name', 'mobile_no']
    });

    if (!loadman) {
      throw new Error("Loadman not found");
    }

    // Get all salary records in date range
    const salaries = await LoadmanSalary.findAll({
      where: {
        loadman_id: loadmanId,
        salary_date: {
          [Op.between]: [startDate, endDate]
        },
        is_active: 1
      },
      attributes: [
        'loadman_salary_id',
        'trip_id',
        'salary_date',
        'total_pickup_charges',
        'total_drop_charges',
        'total_handling_charges',
        'total_amount',
        'package_count',
        'status',
        'payment_date'
      ],
      include: [
        {
          model: Trip,
          as: 'trip',
          attributes: ['trip_id', 'trip_number', 'trip_date']
        }
      ],
      order: [['salary_date', 'DESC']]
    });

    // Get all package assignments in date range for detailed breakdown
    const assignments = await PackageLoadman.findAll({
      where: {
        loadman_id: loadmanId,
        created_at: {
          [Op.between]: [startDate, endDate]
        },
        is_active: 1
      },
      attributes: [
        'package_loadman_id',
        'trip_booking_id',
        'booking_package_id',
        'loadman_type',
        'amount_earned',
        'created_at'
      ],
      include: [
        {
          model: BookingPackage,
          as: 'bookingPackage',
          attributes: [
            'booking_package_id',
            'package_type_id',
            'quantity'
          ],
          include: [
            {
              model: PackageType,
              as: 'packageType',
              attributes: ['package_type_name']
            }
          ]
        }
      ]
    });

    // Calculate summary totals
    const totalEarnings = salaries.reduce((sum, s) => sum + parseFloat(s.total_amount || 0), 0);
    const totalPackages = salaries.reduce((sum, s) => sum + s.package_count, 0);
    const totalPickup = salaries.reduce((sum, s) => sum + parseFloat(s.total_pickup_charges || 0), 0);
    const totalDrop = salaries.reduce((sum, s) => sum + parseFloat(s.total_drop_charges || 0), 0);
    const totalHandling = salaries.reduce((sum, s) => sum + parseFloat(s.total_handling_charges || 0), 0);
    
    const paidSalaries = salaries.filter(s => s.status === 'paid');
    const paidAmount = paidSalaries.reduce((sum, s) => sum + parseFloat(s.total_amount || 0), 0);
    const pendingAmount = totalEarnings - paidAmount;

    // Group by trip type
    const earningsByTrip = {};
    salaries.forEach(s => {
      if (!s.trip) return;
      const tripId = s.trip.trip_id;
      if (!earningsByTrip[tripId]) {
        earningsByTrip[tripId] = {
          trip_id: tripId,
          trip_number: s.trip.trip_number,
          trip_date: s.trip.trip_date,
          total_earnings: 0,
          packages: 0
        };
      }
      earningsByTrip[tripId].total_earnings += parseFloat(s.total_amount || 0);
      earningsByTrip[tripId].packages += s.package_count;
    });

    // Group by month
    const monthlyEarnings = {};
    salaries.forEach(s => {
      const month = s.salary_date.substring(0, 7);
      if (!monthlyEarnings[month]) {
        monthlyEarnings[month] = {
          month,
          total_earnings: 0,
          packages: 0,
          assignments: 0
        };
      }
      monthlyEarnings[month].total_earnings += parseFloat(s.total_amount || 0);
      monthlyEarnings[month].packages += s.package_count;
    });

    // Calculate daily average
    const daysInRange = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;
    const workingDays = new Set(assignments.map(a => 
      new Date(a.created_at).toISOString().split('T')[0]
    )).size;

    return {
      loadman: {
        employee_id: loadman.employee_id,
        employee_name: loadman.employee_name,
        mobile_no: loadman.mobile_no
      },
      date_range: { startDate, endDate },
      summary: {
        total_earnings: totalEarnings.toFixed(2),
        total_paid: paidAmount.toFixed(2),
        total_pending: pendingAmount.toFixed(2),
        total_packages: totalPackages,
        total_assignments: assignments.length,
        total_trips: Object.keys(earningsByTrip).length,
        total_pickup_charges: totalPickup.toFixed(2),
        total_drop_charges: totalDrop.toFixed(2),
        total_handling_charges: totalHandling.toFixed(2),
        average_per_day: workingDays > 0 ? (totalEarnings / workingDays).toFixed(2) : 0,
        average_per_package: totalPackages > 0 ? (totalEarnings / totalPackages).toFixed(2) : 0,
        working_days: workingDays,
        days_in_range: daysInRange,
        status_breakdown: {
          pending: salaries.filter(s => s.status === 'pending').length,
          processed: salaries.filter(s => s.status === 'processed').length,
          paid: salaries.filter(s => s.status === 'paid').length
        }
      },
      earnings_by_trip: Object.values(earningsByTrip),
      monthly_breakdown: Object.values(monthlyEarnings).sort((a, b) => a.month.localeCompare(b.month)),
      salary_records: salaries,
      recent_assignments: assignments.slice(0, 10)
    };
    
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

// =============================================
// CALCULATE TRIP LOADMAN SALARY
// =============================================

/**
 * Calculate loadman salary for a specific trip
 */
async function calculateTripLoadmanSalary(tripId) {
  const transaction = await sequelize.transaction();
  
  try {
    // Get all trip bookings for this trip
    const tripBookings = await TripBooking.findAll({
      where: { 
        trip_id: tripId, 
        is_active: 1 
      },
      attributes: ['trip_booking_id'],
      transaction
    });

    if (tripBookings.length === 0) {
      throw new Error("No bookings found for this trip");
    }

    const tripBookingIds = tripBookings.map(tb => tb.trip_booking_id);

    // Get all package loadmen assignments for these trip bookings
    const packageLoadmen = await PackageLoadman.findAll({
      where: {
        trip_booking_id: { [Op.in]: tripBookingIds },
        is_active: 1
      },
      include: [
        {
          model: Employee,
          as: 'loadman',
          attributes: ['employee_id', 'employee_name']
        },
        {
          model: BookingPackage,
          as: 'bookingPackage',
          attributes: [
            'booking_package_id',
            'quantity',
            'pickup_charge',
            'drop_charge',
            'handling_charge'
          ]
        }
      ],
      transaction
    });

    if (packageLoadmen.length === 0) {
      throw new Error("No loadman assignments found for this trip");
    }

    // Get trip details
    const trip = await Trip.findOne({
      where: { trip_id: tripId },
      attributes: ['trip_id', 'trip_number', 'trip_date'],
      transaction
    });

    // Group by loadman and calculate earnings with quantity
    const loadmanSummary = {};
    
    for (const assignment of packageLoadmen) {
      const loadmanId = assignment.loadman_id;
      const pkg = assignment.bookingPackage;
      const quantity = pkg?.quantity || 1;
      
      if (!loadmanSummary[loadmanId]) {
        loadmanSummary[loadmanId] = {
          loadman_id: loadmanId,
          loadman_name: assignment.loadman?.employee_name || 'Unknown',
          total_pickup_charges: 0,
          total_drop_charges: 0,
          total_handling_charges: 0,
          total_amount: 0,
          package_count: 0,
          package_details: [],
          booking_ids: new Set(),
          assignments: []
        };
      }

      const summary = loadmanSummary[loadmanId];
      
      // Calculate amounts based on loadman type and quantity
      let pickupEarned = 0;
      let dropEarned = 0;
      let handlingEarned = 0;
      
      if (assignment.loadman_type === 'pickup' || assignment.loadman_type === 'both') {
        pickupEarned = parseFloat(pkg?.pickup_charge || 0) * quantity;
        summary.total_pickup_charges += pickupEarned;
      }
      
      if (assignment.loadman_type === 'drop' || assignment.loadman_type === 'both') {
        dropEarned = parseFloat(pkg?.drop_charge || 0) * quantity;
        summary.total_drop_charges += dropEarned;
      }
      
      // Handle handling charges - split among assigned loadmen
      if (pkg?.handling_charge && parseFloat(pkg.handling_charge) > 0) {
        // Count how many loadmen are assigned to this package
        const loadmenForThisPackage = packageLoadmen.filter(
          pl => pl.booking_package_id === assignment.booking_package_id
        ).length;
        
        if (loadmenForThisPackage > 0) {
          handlingEarned = (parseFloat(pkg.handling_charge) * quantity) / loadmenForThisPackage;
          summary.total_handling_charges += handlingEarned;
        }
      }
      
      const totalForThisPackage = pickupEarned + dropEarned + handlingEarned;
      summary.total_amount += totalForThisPackage;
      summary.package_count += quantity; // Count each package unit
      
      // Track package details
      summary.package_details.push({
        booking_package_id: assignment.booking_package_id,
        quantity: quantity,
        pickup_charge_per_unit: pkg?.pickup_charge || 0,
        drop_charge_per_unit: pkg?.drop_charge || 0,
        handling_charge_per_unit: pkg?.handling_charge || 0,
        loadman_type: assignment.loadman_type,
        pickup_earned: pickupEarned,
        drop_earned: dropEarned,
        handling_earned: handlingEarned,
        total_earned: totalForThisPackage
      });
      
      summary.assignments.push(assignment);
    }

    // Create or update salary records
    const salaryRecords = [];
    
    for (const loadmanId in loadmanSummary) {
      const summary = loadmanSummary[loadmanId];
      
      // Check if salary record already exists for this loadman and date
      const existingSalary = await LoadmanSalary.findOne({
        where: {
          loadman_id: loadmanId,
          trip_id: tripId,
          salary_date: trip.trip_date,
          is_active: 1
        },
        transaction
      });

      const salaryData = {
        loadman_id: loadmanId,
        trip_id: tripId,
        salary_date: trip.trip_date,
        total_pickup_charges: summary.total_pickup_charges,
        total_drop_charges: summary.total_drop_charges,
        total_handling_charges: summary.total_handling_charges,
        total_amount: summary.total_amount,
        package_count: summary.package_count,
        booking_count: summary.booking_ids.size,
        status: 'pending'
      };

      let salaryRecord;

      if (existingSalary) {
        await existingSalary.update(salaryData, { transaction });
        salaryRecord = existingSalary;
      } else {
        salaryRecord = await LoadmanSalary.create({
          loadman_salary_id: uuidv4(),
          ...salaryData,
          created_at: new Date(),
          updated_at: new Date()
        }, { transaction });
      }

      salaryRecords.push(salaryRecord);
    }

    await transaction.commit();

    return {
      success: true,
      message: `Calculated salary for ${Object.keys(loadmanSummary).length} loadmen`,
      trip: {
        trip_id: tripId,
        trip_number: trip.trip_number,
        trip_date: trip.trip_date
      },
      loadmen: Object.values(loadmanSummary).map(l => ({
        loadman_id: l.loadman_id,
        loadman_name: l.loadman_name,
        total_pickup_charges: l.total_pickup_charges.toFixed(2),
        total_drop_charges: l.total_drop_charges.toFixed(2),
        total_handling_charges: l.total_handling_charges.toFixed(2),
        total_amount: l.total_amount.toFixed(2),
        package_count: l.package_count,
        package_details: l.package_details
      })),
      salary_records: salaryRecords
    };
    
  } catch (error) {
    await transaction.rollback();
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

// =============================================
// GET LOADMAN SALARIES
// =============================================

/**
 * Get loadman salary summary with filters
 */
async function getLoadmanSalaries(filters = {}) {
  try {
    const { 
      loadmanId, 
      startDate, 
      endDate, 
      tripId, 
      status, 
      page = 1, 
      limit = 20 
    } = filters;
    
    const offset = (page - 1) * limit;
    
    const whereClause = { is_active: 1 };
    
    if (loadmanId) {
      whereClause.loadman_id = loadmanId;
    }
    
    if (tripId) {
      whereClause.trip_id = tripId;
    }
    
    if (startDate && endDate) {
      whereClause.salary_date = {
        [Op.between]: [startDate, endDate]
      };
    } else if (startDate) {
      whereClause.salary_date = {
        [Op.gte]: startDate
      };
    } else if (endDate) {
      whereClause.salary_date = {
        [Op.lte]: endDate
      };
    }
    
    if (status) {
      whereClause.status = status;
    }
    
    const { count, rows: salaries } = await LoadmanSalary.findAndCountAll({
      where: whereClause,
      attributes: [
        'loadman_salary_id',
        'loadman_id',
        'trip_id',
        'salary_date',
        'total_pickup_charges',
        'total_drop_charges',
        'total_handling_charges',
        'total_amount',
        'package_count',
        'booking_count',
        'status',
        'payment_date',
        'payment_reference',
        'notes',
        'created_at'
      ],
      include: [
        { 
          model: Employee, 
          as: 'loadman', 
          attributes: ['employee_id', 'employee_name', 'mobile_no'] 
        },
        { 
          model: Trip, 
          as: 'trip', 
          attributes: ['trip_id', 'trip_number', 'trip_date'] 
        }
      ],
      order: [['salary_date', 'DESC'], ['created_at', 'DESC']],
      limit,
      offset,
      distinct: true
    });
    
    // Calculate summary statistics
    const totalAmount = salaries.reduce((sum, s) => sum + parseFloat(s.total_amount || 0), 0);
    const totalPickup = salaries.reduce((sum, s) => sum + parseFloat(s.total_pickup_charges || 0), 0);
    const totalDrop = salaries.reduce((sum, s) => sum + parseFloat(s.total_drop_charges || 0), 0);
    const totalHandling = salaries.reduce((sum, s) => sum + parseFloat(s.total_handling_charges || 0), 0);
    
    return {
      summary: {
        total_records: count,
        total_amount: totalAmount.toFixed(2),
        total_pickup_charges: totalPickup.toFixed(2),
        total_drop_charges: totalDrop.toFixed(2),
        total_handling_charges: totalHandling.toFixed(2),
        current_page: page,
        total_pages: Math.ceil(count / limit),
        limit
      },
      salaries,
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit)
      }
    };
    
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

// =============================================
// UPDATE LOADMAN SALARY STATUS
// =============================================

/**
 * Update loadman salary status (mark as paid)
 */
async function updateLoadmanSalaryStatus(salaryId, statusData) {
  const transaction = await sequelize.transaction();
  
  try {
    const salary = await LoadmanSalary.findOne({
      where: { 
        loadman_salary_id: salaryId, 
        is_active: 1 
      },
      transaction
    });
    
    if (!salary) {
      throw new Error("Salary record not found");
    }
    
    const updateData = {
      status: statusData.status
    };
    
    if (statusData.status === 'paid') {
      updateData.payment_date = statusData.payment_date || new Date().toISOString().split('T')[0];
      updateData.payment_reference = statusData.payment_reference || null;
    }
    
    if (statusData.notes) {
      updateData.notes = statusData.notes;
    }
    
    await salary.update(updateData, { transaction });
    
    await transaction.commit();
    
    return {
      success: true,
      message: `Salary status updated to ${statusData.status}`,
      salary: salary
    };
    
  } catch (error) {
    await transaction.rollback();
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

// =============================================
// GET LOADMAN EARNINGS REPORT
// =============================================

/**
 * Get loadman earnings report
 */
async function getLoadmanEarningsReport(loadmanId, startDate, endDate) {
  try {
    const whereClause = {
      loadman_id: loadmanId,
      is_active: 1
    };
    
    if (startDate && endDate) {
      whereClause.salary_date = {
        [Op.between]: [startDate, endDate]
      };
    }
    
    const salaries = await LoadmanSalary.findAll({
      where: whereClause,
      attributes: [
        'loadman_salary_id',
        'salary_date',
        'total_pickup_charges',
        'total_drop_charges',
        'total_handling_charges',
        'total_amount',
        'package_count',
        'booking_count',
        'status'
      ],
      include: [
        { 
          model: Trip, 
          as: 'trip', 
          attributes: ['trip_id', 'trip_number'] 
        }
      ],
      order: [['salary_date', 'ASC']]
    });
    
    // Get detailed package assignments for this loadman in the date range
    const packageAssignments = await PackageLoadman.findAll({
      where: {
        loadman_id: loadmanId,
        is_active: 1,
        created_at: {
          [Op.between]: [startDate, endDate]
        }
      },
      include: [
        {
          model: BookingPackage,
          as: 'bookingPackage',
          attributes: [
            'booking_package_id',
            'quantity',
            'pickup_charge',
            'drop_charge',
            'handling_charge'
          ],
          include: [
            {
              model: Booking,
              as: 'booking',
              attributes: ['booking_id', 'booking_number']
            }
          ]
        }
      ],
      order: [['created_at', 'DESC']]
    });
    
    // Calculate totals
    const totalEarnings = salaries.reduce((sum, s) => sum + parseFloat(s.total_amount || 0), 0);
    const totalPackages = salaries.reduce((sum, s) => sum + s.package_count, 0);
    const totalBookings = salaries.reduce((sum, s) => sum + s.booking_count, 0);
    
    // Group by month for chart data
    const monthlyData = {};
    salaries.forEach(s => {
      const month = s.salary_date.substring(0, 7); // YYYY-MM
      if (!monthlyData[month]) {
        monthlyData[month] = {
          month,
          total: 0,
          package_count: 0
        };
      }
      monthlyData[month].total += parseFloat(s.total_amount || 0);
      monthlyData[month].package_count += s.package_count;
    });
    
    // Group package assignments by type
    const pickupPackages = packageAssignments.filter(a => 
      a.loadman_type === 'pickup' || a.loadman_type === 'both'
    );
    const dropPackages = packageAssignments.filter(a => 
      a.loadman_type === 'drop' || a.loadman_type === 'both'
    );
    
    return {
      loadman_id: loadmanId,
      date_range: {
        start_date: startDate,
        end_date: endDate
      },
      summary: {
        total_earnings: totalEarnings.toFixed(2),
        total_packages: totalPackages,
        total_bookings: totalBookings,
        average_per_package: totalPackages > 0 ? (totalEarnings / totalPackages).toFixed(2) : 0,
        average_per_day: salaries.length > 0 ? (totalEarnings / salaries.length).toFixed(2) : 0,
        pickup_packages: pickupPackages.length,
        drop_packages: dropPackages.length
      },
      monthly_breakdown: Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month)),
      daily_breakdown: salaries,
      recent_assignments: packageAssignments.slice(0, 20).map(a => ({
        date: a.created_at,
        booking_number: a.bookingPackage?.booking?.booking_number,
        package_id: a.booking_package_id,
        quantity: a.bookingPackage?.quantity || 1,
        loadman_type: a.loadman_type,
        amount_earned: a.amount_earned,
        pickup_charge: a.bookingPackage?.pickup_charge,
        drop_charge: a.bookingPackage?.drop_charge
      }))
    };
    
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

// =============================================
// GET LOADMAN DATA WITH FILTERS
// =============================================

/**
 * Get loadman data with various filters
 */
async function getLoadmanData(filters = {}) {
  try {
    const { 
      loadmanId, 
      startDate, 
      endDate, 
      tripId, 
      status, 
      search, 
      page = 1, 
      limit = 20, 
      sortBy = 'created_at', 
      sortOrder = 'DESC' 
    } = filters;
    
    const offset = (page - 1) * limit;
    
    // Base query for loadmen (employees with is_loadman = true)
    const loadmanWhere = { 
      is_loadman: true, 
      is_active: 1 
    };
    
    if (search) {
      loadmanWhere[Op.or] = [
        { employee_name: { [Op.like]: `%${search}%` } },
        { employee_id: { [Op.like]: `%${search}%` } },
        { mobile_no: { [Op.like]: `%${search}%` } }
      ];
    }
    
    if (loadmanId) {
      loadmanWhere.employee_id = loadmanId;
    }
    
    // Get all loadmen with pagination
    const { count: totalLoadmen, rows: loadmen } = await Employee.findAndCountAll({
      where: loadmanWhere,
      attributes: [
        'employee_id',
        'employee_name',
        'mobile_no',
        'is_active',
        'created_at'
      ],
      order: [[sortBy, sortOrder]],
      limit,
      offset,
      distinct: true
    });
    
    const loadmanIds = loadmen.map(l => l.employee_id);
    
    if (loadmanIds.length === 0) {
      return {
        summary: {
          total_loadmen: 0,
          total_earnings: "0.00",
          total_trips: 0,
          total_packages: 0
        },
        loadmen: [],
        pagination: {
          current_page: page,
          total_pages: 0,
          total_records: 0,
          limit
        }
      };
    }
    
    // Build salary query with filters
    const salaryWhere = { 
      loadman_id: { [Op.in]: loadmanIds }, 
      is_active: 1 
    };
    
    if (startDate && endDate) {
      salaryWhere.salary_date = {
        [Op.between]: [startDate, endDate]
      };
    } else if (startDate) {
      salaryWhere.salary_date = {
        [Op.gte]: startDate
      };
    } else if (endDate) {
      salaryWhere.salary_date = {
        [Op.lte]: endDate
      };
    }
    
    if (tripId) {
      salaryWhere.trip_id = tripId;
    }
    
    if (status) {
      salaryWhere.status = status;
    }
    
    // Get all salaries for these loadmen
    const salaries = await LoadmanSalary.findAll({
      where: salaryWhere,
      attributes: [
        'loadman_salary_id',
        'loadman_id',
        'trip_id',
        'salary_date',
        'total_pickup_charges',
        'total_drop_charges',
        'total_handling_charges',
        'total_amount',
        'package_count',
        'status'
      ],
      include: [
        { 
          model: Trip, 
          as: 'trip', 
          attributes: ['trip_id', 'trip_number', 'trip_date', 'status'] 
        }
      ],
      order: [['salary_date', 'DESC']]
    });
    
    // Get all package assignments for these loadmen
    const packageWhere = { 
      loadman_id: { [Op.in]: loadmanIds }, 
      is_active: 1 
    };
    
    if (startDate && endDate) {
      packageWhere.created_at = {
        [Op.between]: [startDate, endDate]
      };
    }
    
    const packageAssignments = await PackageLoadman.findAll({
      where: packageWhere,
      attributes: [
        'package_loadman_id',
        'loadman_id',
        'trip_booking_id',
        'booking_package_id',
        'loadman_type',
        'amount_earned',
        'created_at'
      ],
      include: [
        { 
          model: BookingPackage, 
          as: 'bookingPackage', 
          attributes: ['booking_package_id', 'quantity', 'pickup_charge', 'drop_charge'],
          include: [
            { 
              model: Booking, 
              as: 'booking', 
              attributes: ['booking_id', 'booking_number'] 
            }
          ]
        }
      ],
      order: [['created_at', 'DESC']]
    });
    
    // Group data by loadman
    const loadmanData = {};
    
    // Initialize with loadman info
    loadmen.forEach(loadman => {
      loadmanData[loadman.employee_id] = {
        employee_id: loadman.employee_id,
        employee_name: loadman.employee_name,
        mobile_no: loadman.mobile_no,
        is_active: loadman.is_active,
        created_at: loadman.created_at,
        summary: {
          total_earnings: 0,
          total_pickup_charges: 0,
          total_drop_charges: 0,
          total_handling_charges: 0,
          total_trips: 0,
          total_packages: 0,
          total_bookings: 0,
          salary_count: 0,
          package_count: 0,
          pending_amount: 0,
          paid_amount: 0
        },
        recent_trips: [],
        recent_packages: [],
        salary_records: [],
        status_breakdown: {
          pending: 0,
          processed: 0,
          paid: 0
        }
      };
    });
    
    // Add salary data
    salaries.forEach(salary => {
      const data = loadmanData[salary.loadman_id];
      if (!data) return;
      
      data.summary.total_earnings += parseFloat(salary.total_amount || 0);
      data.summary.total_pickup_charges += parseFloat(salary.total_pickup_charges || 0);
      data.summary.total_drop_charges += parseFloat(salary.total_drop_charges || 0);
      data.summary.total_handling_charges += parseFloat(salary.total_handling_charges || 0);
      data.summary.total_packages += salary.package_count || 0;
      data.summary.salary_count += 1;
      
      data.status_breakdown[salary.status] += 1;
      
      if (salary.status === 'pending') {
        data.summary.pending_amount += parseFloat(salary.total_amount || 0);
      } else if (salary.status === 'paid') {
        data.summary.paid_amount += parseFloat(salary.total_amount || 0);
      }
      
      // Add to recent trips (max 5)
      if (data.recent_trips.length < 5 && salary.trip) {
        data.recent_trips.push({
          trip_id: salary.trip.trip_id,
          trip_number: salary.trip.trip_number,
          trip_date: salary.trip.trip_date,
          amount: salary.total_amount,
          package_count: salary.package_count,
          status: salary.trip.status
        });
      }
      
      data.salary_records.push(salary);
    });
    
    // Add package assignment data
    packageAssignments.forEach(assignment => {
      const data = loadmanData[assignment.loadman_id];
      if (!data) return;
      
      data.summary.package_count += 1;
      
      // Add to recent packages (max 5)
      if (data.recent_packages.length < 5) {
        data.recent_packages.push({
          package_loadman_id: assignment.package_loadman_id,
          booking_number: assignment.bookingPackage?.booking?.booking_number,
          loadman_type: assignment.loadman_type,
          amount_earned: assignment.amount_earned,
          quantity: assignment.bookingPackage?.quantity || 1,
          created_at: assignment.created_at
        });
      }
    });
    
    // Calculate totals across all loadmen
    const totalEarnings = Object.values(loadmanData).reduce((sum, l) => sum + l.summary.total_earnings, 0);
    const totalTrips = Object.values(loadmanData).reduce((sum, l) => sum + l.summary.total_trips, 0);
    const totalPackages = Object.values(loadmanData).reduce((sum, l) => sum + l.summary.total_packages, 0);
    const totalPending = Object.values(loadmanData).reduce((sum, l) => sum + l.summary.pending_amount, 0);
    const totalPaid = Object.values(loadmanData).reduce((sum, l) => sum + l.summary.paid_amount, 0);
    
    // Format the response
    const formattedLoadmen = Object.values(loadmanData).map(l => ({
      ...l,
      summary: {
        ...l.summary,
        total_earnings: l.summary.total_earnings.toFixed(2),
        total_pickup_charges: l.summary.total_pickup_charges.toFixed(2),
        total_drop_charges: l.summary.total_drop_charges.toFixed(2),
        total_handling_charges: l.summary.total_handling_charges.toFixed(2),
        pending_amount: l.summary.pending_amount.toFixed(2),
        paid_amount: l.summary.paid_amount.toFixed(2)
      },
      salary_records: l.salary_records.map(s => ({
        salary_id: s.loadman_salary_id,
        date: s.salary_date,
        amount: s.total_amount,
        trip_number: s.trip?.trip_number,
        package_count: s.package_count,
        status: s.status
      }))
    }));
    
    return {
      summary: {
        total_loadmen: totalLoadmen,
        filtered_loadmen: formattedLoadmen.length,
        total_earnings: totalEarnings.toFixed(2),
        total_trips: totalTrips,
        total_packages: totalPackages,
        total_pending: totalPending.toFixed(2),
        total_paid: totalPaid.toFixed(2)
      },
      loadmen: formattedLoadmen,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(totalLoadmen / limit),
        total_records: totalLoadmen,
        limit
      }
    };
    
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

// =============================================
// GET LOADMAN BY ID
// =============================================

/**
 * Get loadman details by ID with complete history
 */
async function getLoadmanById(loadmanId, options = {}) {
  try {
    const { 
      includeHistory = true, 
      includeTrips = true, 
      includePayments = true 
    } = options;
    
    // Get loadman basic info
    const loadman = await Employee.findOne({
      where: { 
        employee_id: loadmanId, 
        is_loadman: true, 
        is_active: 1 
      },
      attributes: [
        'employee_id',
        'employee_name',
        'mobile_no',
        'address_i',
        'pincode',
        'is_active',
        'created_at',
        'updated_at'
      ]
    });
    
    if (!loadman) {
      throw new Error("Loadman not found");
    }
    
    // Get all salary records
    const salaries = await LoadmanSalary.findAll({
      where: { 
        loadman_id: loadmanId, 
        is_active: 1 
      },
      attributes: [
        'loadman_salary_id',
        'trip_id',
        'salary_date',
        'total_pickup_charges',
        'total_drop_charges',
        'total_handling_charges',
        'total_amount',
        'package_count',
        'booking_count',
        'status',
        'payment_date',
        'payment_reference',
        'notes',
        'created_at'
      ],
      include: [
        { 
          model: Trip, 
          as: 'trip', 
          attributes: ['trip_id', 'trip_number', 'trip_date', 'status'] 
        }
      ],
      order: [['salary_date', 'DESC']]
    });
    
    // Get all package assignments
    const packageAssignments = await PackageLoadman.findAll({
      where: { 
        loadman_id: loadmanId, 
        is_active: 1 
      },
      attributes: [
        'package_loadman_id',
        'trip_booking_id',
        'booking_package_id',
        'loadman_type',
        'amount_earned',
        'created_at'
      ],
      include: [
        { 
          model: BookingPackage, 
          as: 'bookingPackage', 
          attributes: [
            'booking_package_id',
            'quantity',
            'pickup_charge',
            'drop_charge',
            'handling_charge',
            'total_package_charge'
          ],
          include: [
            { 
              model: Booking, 
              as: 'booking', 
              attributes: ['booking_id', 'booking_number'] 
            },
            { 
              model: PackageType, 
              as: 'packageType', 
              attributes: ['package_type_id', 'package_type_name'] 
            }
          ]
        },
        { 
          model: TripBooking, 
          as: 'tripBooking', 
          attributes: ['trip_booking_id', 'delivery_status'],
          include: [
            { 
              model: Trip, 
              as: 'trip', 
              attributes: ['trip_id', 'trip_number', 'trip_date'] 
            }
          ]
        }
      ],
      order: [['created_at', 'DESC']]
    });
    
    // Calculate summary statistics
    const totalEarnings = salaries.reduce((sum, s) => sum + parseFloat(s.total_amount || 0), 0);
    const totalPickup = salaries.reduce((sum, s) => sum + parseFloat(s.total_pickup_charges || 0), 0);
    const totalDrop = salaries.reduce((sum, s) => sum + parseFloat(s.total_drop_charges || 0), 0);
    const totalHandling = salaries.reduce((sum, s) => sum + parseFloat(s.total_handling_charges || 0), 0);
    const totalPackages = salaries.reduce((sum, s) => sum + s.package_count, 0);
    const totalTrips = new Set(salaries.map(s => s.trip_id).filter(id => id)).size;
    
    const statusBreakdown = {
      pending: salaries.filter(s => s.status === 'pending').length,
      processed: salaries.filter(s => s.status === 'processed').length,
      paid: salaries.filter(s => s.status === 'paid').length
    };
    
    // Group assignments by package type
    const byPackageType = {};
    packageAssignments.forEach(pa => {
      const typeId = pa.bookingPackage?.packageType?.package_type_id;
      const typeName = pa.bookingPackage?.packageType?.package_type_name || 'Unknown';
      
      if (!byPackageType[typeId]) {
        byPackageType[typeId] = {
          package_type_id: typeId,
          package_type_name: typeName,
          total_assignments: 0,
          total_earned: 0,
          pickup_count: 0,
          drop_count: 0,
          both_count: 0
        };
      }
      
      byPackageType[typeId].total_assignments += 1;
      byPackageType[typeId].total_earned += parseFloat(pa.amount_earned || 0);
      
      if (pa.loadman_type === 'pickup') byPackageType[typeId].pickup_count += 1;
      else if (pa.loadman_type === 'drop') byPackageType[typeId].drop_count += 1;
      else if (pa.loadman_type === 'both') byPackageType[typeId].both_count += 1;
    });
    
    return {
      loadman: loadman.toJSON(),
      summary: {
        total_earnings: totalEarnings.toFixed(2),
        total_pickup_charges: totalPickup.toFixed(2),
        total_drop_charges: totalDrop.toFixed(2),
        total_handling_charges: totalHandling.toFixed(2),
        total_trips: totalTrips,
        total_packages: totalPackages,
        total_assignments: packageAssignments.length,
        status_breakdown: statusBreakdown,
        by_package_type: Object.values(byPackageType)
      },
      salary_history: salaries,
      package_assignments: packageAssignments
    };
    
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

// =============================================
// GET LOADMAN TRIP HISTORY
// =============================================

/**
 * Get loadman trip history
 */
async function getLoadmanTripHistory(loadmanId, options = {}) {
  try {
    const { startDate, endDate, page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;
    
    // Get all trips this loadman was assigned to
    const whereClause = { 
      loadman_id: loadmanId, 
      is_active: 1 
    };
    
    if (startDate && endDate) {
      whereClause.created_at = {
        [Op.between]: [startDate, endDate]
      };
    }
    
    const { count, rows: assignments } = await PackageLoadman.findAndCountAll({
      where: whereClause,
      attributes: [
        'package_loadman_id',
        'trip_booking_id',
        'loadman_type',
        'amount_earned',
        'created_at'
      ],
      include: [
        { 
          model: TripBooking, 
          as: 'tripBooking', 
          attributes: ['trip_booking_id', 'delivery_status'],
          include: [
            { 
              model: Trip, 
              as: 'trip', 
              attributes: ['trip_id', 'trip_number', 'trip_date', 'status'] 
            },
            { 
              model: Booking, 
              as: 'booking', 
              attributes: ['booking_id', 'booking_number'] 
            }
          ]
        },
        { 
          model: BookingPackage, 
          as: 'bookingPackage', 
          attributes: ['booking_package_id', 'quantity', 'package_type_id'],
          include: [
            { 
              model: PackageType, 
              as: 'packageType', 
              attributes: ['package_type_name'] 
            }
          ]
        }
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset,
      distinct: true
    });
    
    // Group by trip
    const trips = {};
    assignments.forEach(ass => {
      const trip = ass.tripBooking?.trip;
      if (!trip) return;
      
      const tripId = trip.trip_id;
      if (!trips[tripId]) {
        trips[tripId] = {
          trip_id: trip.trip_id,
          trip_number: trip.trip_number,
          trip_date: trip.trip_date,
          status: trip.status,
          total_earned: 0,
          package_count: 0,
          assignments: []
        };
      }
      
      trips[tripId].total_earned += parseFloat(ass.amount_earned || 0);
      trips[tripId].package_count += ass.bookingPackage?.quantity || 1;
      trips[tripId].assignments.push({
        booking_number: ass.tripBooking?.booking?.booking_number,
        package_type: ass.bookingPackage?.packageType?.package_type_name,
        loadman_type: ass.loadman_type,
        amount: ass.amount_earned,
        quantity: ass.bookingPackage?.quantity || 1
      });
    });
    
    return {
      loadman_id: loadmanId,
      summary: {
        total_trips: Object.keys(trips).length,
        total_assignments: count,
        total_earned: Object.values(trips).reduce((sum, t) => sum + t.total_earned, 0).toFixed(2),
        total_packages: Object.values(trips).reduce((sum, t) => sum + t.package_count, 0)
      },
      trips: Object.values(trips),
      pagination: {
        current_page: page,
        total_pages: Math.ceil(count / limit),
        total_records: count,
        limit
      }
    };
    
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

// =============================================
// GET LOADMAN PERFORMANCE
// =============================================

/**
 * Get loadman performance metrics
 */
async function getLoadmanPerformance(loadmanId, startDate, endDate) {
  try {
    // Get all salary records in date range
    const salaries = await LoadmanSalary.findAll({
      where: { 
        loadman_id: loadmanId, 
        salary_date: { 
          [Op.between]: [startDate, endDate] 
        }, 
        is_active: 1 
      },
      attributes: [
        'salary_date',
        'total_pickup_charges',
        'total_drop_charges',
        'total_handling_charges',
        'total_amount',
        'package_count'
      ],
      order: [['salary_date', 'ASC']]
    });
    
    // Get all package assignments in date range
    const assignments = await PackageLoadman.findAll({
      where: { 
        loadman_id: loadmanId, 
        created_at: { 
          [Op.between]: [startDate, endDate] 
        }, 
        is_active: 1 
      },
      attributes: [
        'package_loadman_id',
        'loadman_type',
        'amount_earned',
        'created_at'
      ],
      include: [
        { 
          model: BookingPackage, 
          as: 'bookingPackage', 
          attributes: ['quantity'] 
        }
      ]
    });
    
    // Calculate daily metrics
    const dailyMetrics = {};
    const dates = [];
    let currentDate = new Date(startDate);
    const endDateTime = new Date(endDate);
    
    while (currentDate <= endDateTime) {
      const dateStr = currentDate.toISOString().split('T')[0];
      dates.push(dateStr);
      
      const daySalary = salaries.find(s => s.salary_date === dateStr);
      const dayAssignments = assignments.filter(a => {
        const aDate = new Date(a.created_at).toISOString().split('T')[0];
        return aDate === dateStr;
      });
      
      dailyMetrics[dateStr] = {
        date: dateStr,
        earnings: parseFloat(daySalary?.total_amount || 0),
        packages: daySalary?.package_count || 0,
        assignments: dayAssignments.length,
        pickup_count: dayAssignments.filter(a => a.loadman_type === 'pickup' || a.loadman_type === 'both').length,
        drop_count: dayAssignments.filter(a => a.loadman_type === 'drop' || a.loadman_type === 'both').length
      };
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Calculate overall metrics
    const totalEarnings = salaries.reduce((sum, s) => sum + parseFloat(s.total_amount || 0), 0);
    const totalPackages = salaries.reduce((sum, s) => sum + s.package_count, 0);
    const totalAssignments = assignments.length;
    const workingDays = Object.values(dailyMetrics).filter(d => d.assignments > 0).length;
    
    // Group by month
    const monthlyTotals = {};
    dates.forEach(date => {
      const month = date.substring(0, 7);
      if (!monthlyTotals[month]) {
        monthlyTotals[month] = {
          month,
          earnings: 0,
          packages: 0,
          assignments: 0
        };
      }
      monthlyTotals[month].earnings += dailyMetrics[date].earnings;
      monthlyTotals[month].packages += dailyMetrics[date].packages;
      monthlyTotals[month].assignments += dailyMetrics[date].assignments;
    });
    
    return {
      loadman_id: loadmanId,
      date_range: { startDate, endDate },
      summary: {
        total_earnings: totalEarnings.toFixed(2),
        total_packages: totalPackages,
        total_assignments: totalAssignments,
        working_days: workingDays,
        average_per_day: workingDays > 0 ? (totalEarnings / workingDays).toFixed(2) : 0,
        average_per_package: totalPackages > 0 ? (totalEarnings / totalPackages).toFixed(2) : 0,
        pickup_drop_ratio: assignments.length > 0 
          ? (assignments.filter(a => a.loadman_type === 'pickup' || a.loadman_type === 'both').length / assignments.length).toFixed(2) 
          : 0
      },
      daily_breakdown: Object.values(dailyMetrics),
      monthly_totals: Object.values(monthlyTotals)
    };
    
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

// =============================================
// EXPORTS
// =============================================

module.exports = {
  assignLoadmenToTripPackages,
  getTripPackageLoadmen,
  calculateTripLoadmanSalary,
  getLoadmanSalaries,
  updateLoadmanSalaryStatus,
  getLoadmanEarningsReport,
  getLoadmanData,
  getLoadmanById,
  getLoadmanTripHistory,
  getLoadmanPerformance,
   getLoadmanPackageAssignments,
  getLoadmanEarningsSummary
};