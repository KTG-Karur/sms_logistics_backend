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
  sequelize 
} = require("../models");
const { v4: uuidv4 } = require('uuid');

/**
 * Assign loadmen to a specific package within a trip
 */
async function assignLoadmenToPackage(tripBookingId, bookingPackageId, loadmanAssignments) {
  const transaction = await sequelize.transaction();
  
  try {
    // Verify trip booking exists
    const tripBooking = await TripBooking.findOne({
      where: { 
        trip_booking_id: tripBookingId, 
        is_active: 1 
      },
      include: [
        {
          model: Trip,
          as: 'trip',
          attributes: ['trip_id', 'trip_number']
        }
      ],
      transaction
    });
    
    if (!tripBooking) {
      throw new Error("Trip booking not found");
    }
    
    // Verify booking package exists
    const bookingPackage = await BookingPackage.findOne({
      where: { 
        booking_package_id: bookingPackageId, 
        is_active: 1 
      },
      include: [
        {
          model: Booking,
          as: 'booking',
          attributes: ['booking_id', 'booking_number']
        }
      ],
      transaction
    });
    
    if (!bookingPackage) {
      throw new Error("Booking package not found");
    }
    
    const results = [];
    
    for (const assignment of loadmanAssignments) {
      const { loadmanId, loadmanType } = assignment;
      
      // Verify loadman exists and is a loadman
      const loadman = await Employee.findOne({
        where: { 
          employee_id: loadmanId, 
          is_loadman: true,
          is_active: 1 
        },
        transaction
      });
      
      if (!loadman) {
        throw new Error(`Loadman with ID ${loadmanId} not found or is not a loadman`);
      }
      
      // Calculate amount earned based on loadman type
      let amountEarned = 0;
      
      if (loadmanType === 'pickup' || loadmanType === 'both') {
        amountEarned += parseFloat(bookingPackage.pickup_charge || 0);
      }
      if (loadmanType === 'drop' || loadmanType === 'both') {
        amountEarned += parseFloat(bookingPackage.drop_charge || 0);
      }
      
      // Check if assignment already exists
      const existingAssignment = await PackageLoadman.findOne({
        where: {
          trip_booking_id: tripBookingId,
          booking_package_id: bookingPackageId,
          loadman_id: loadmanId,
          is_active: 1
        },
        transaction
      });
      
      if (existingAssignment) {
        // Update existing assignment
        await existingAssignment.update({
          loadman_type: loadmanType,
          amount_earned: amountEarned,
          updated_at: new Date()
        }, { transaction });
        
        results.push({
          ...existingAssignment.toJSON(),
          updated: true
        });
      } else {
        // Create new assignment
        const newAssignment = await PackageLoadman.create({
          package_loadman_id: uuidv4(),
          trip_booking_id: tripBookingId,
          booking_package_id: bookingPackageId,
          loadman_id: loadmanId,
          loadman_type: loadmanType,
          amount_earned: amountEarned,
          created_at: new Date(),
          updated_at: new Date()
        }, { transaction });
        
        results.push(newAssignment.toJSON());
      }
    }
    
    await transaction.commit();
    
    return {
      success: true,
      message: `Assigned ${loadmanAssignments.length} loadmen to package`,
      trip_booking_id: tripBookingId,
      booking_package_id: bookingPackageId,
      assignments: results
    };
    
  } catch (error) {
    await transaction.rollback();
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

/**
 * Get loadmen assigned to a specific package
 */
async function getPackageLoadmen(tripBookingId, bookingPackageId) {
  try {
    const whereClause = { is_active: 1 };
    
    if (tripBookingId) {
      whereClause.trip_booking_id = tripBookingId;
    }
    
    if (bookingPackageId) {
      whereClause.booking_package_id = bookingPackageId;
    }
    
    const assignments = await PackageLoadman.findAll({
      where: whereClause,
      include: [
        {
          model: Employee,
          as: 'loadman',
          attributes: ['employee_id', 'employee_name', 'mobile_no']
        },
        {
          model: BookingPackage,
          as: 'bookingPackage',
          attributes: ['booking_package_id', 'quantity', 'pickup_charge', 'drop_charge', 'handling_charge']
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
    
    return assignments;
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

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
          attributes: ['booking_package_id', 'pickup_charge', 'drop_charge', 'handling_charge']
        }
      ],
      transaction
    });
    
    if (packageLoadmen.length === 0) {
      throw new Error("No loadman assignments found for this trip");
    }
    
    // Group by loadman
    const loadmanSummary = {};
    const trip = await Trip.findOne({ 
      where: { trip_id: tripId },
      attributes: ['trip_id', 'trip_number', 'trip_date'],
      transaction
    });
    
    packageLoadmen.forEach(assignment => {
      const loadmanId = assignment.loadman_id;
      
      if (!loadmanSummary[loadmanId]) {
        loadmanSummary[loadmanId] = {
          loadman_id: loadmanId,
          loadman_name: assignment.loadman?.employee_name || 'Unknown',
          total_pickup_charges: 0,
          total_drop_charges: 0,
          total_handling_charges: 0,
          total_amount: 0,
          package_count: 0,
          booking_ids: new Set(),
          assignments: []
        };
      }
      
      const summary = loadmanSummary[loadmanId];
      const pkg = assignment.bookingPackage;
      
      // Add amounts based on loadman type
      if (assignment.loadman_type === 'pickup' || assignment.loadman_type === 'both') {
        summary.total_pickup_charges += parseFloat(pkg?.pickup_charge || 0);
      }
      if (assignment.loadman_type === 'drop' || assignment.loadman_type === 'both') {
        summary.total_drop_charges += parseFloat(pkg?.drop_charge || 0);
      }
      
      // Add handling charges (usually split equally or based on assignment)
      if (pkg?.handling_charge) {
        // You may want to define how handling charges are split
        summary.total_handling_charges += parseFloat(pkg.handling_charge) / 2; // Example: split equally
      }
      
      summary.total_amount += parseFloat(assignment.amount_earned || 0);
      summary.package_count += 1;
      
      // Get booking ID from trip booking
      // This would require additional joins
      summary.assignments.push(assignment);
    });
    
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
      trip_id: tripId,
      trip_number: trip.trip_number,
      trip_date: trip.trip_date,
      loadmen: Object.values(loadmanSummary).map(l => ({
        loadman_id: l.loadman_id,
        loadman_name: l.loadman_name,
        total_pickup_charges: l.total_pickup_charges.toFixed(2),
        total_drop_charges: l.total_drop_charges.toFixed(2),
        total_handling_charges: l.total_handling_charges.toFixed(2),
        total_amount: l.total_amount.toFixed(2),
        package_count: l.package_count
      })),
      salary_records: salaryRecords
    };
    
  } catch (error) {
    await transaction.rollback();
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

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
        average_per_day: salaries.length > 0 ? (totalEarnings / salaries.length).toFixed(2) : 0
      },
      monthly_breakdown: Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month)),
      daily_breakdown: salaries
    };
    
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

module.exports = {
  assignLoadmenToPackage,
  getPackageLoadmen,
  calculateTripLoadmanSalary,
  getLoadmanSalaries,
  updateLoadmanSalaryStatus,
  getLoadmanEarningsReport
};