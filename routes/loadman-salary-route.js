"use strict";

const Validator = require("fastest-validator");
const { verifyToken } = require("../middleware/auth");
const { ResponseEntry } = require("../helpers/construct-response");
const responseCode = require("../helpers/status-code");
const messages = require("../helpers/message");
const loadmanSalaryService = require("../service/loadman-salary-service");
const _ = require("lodash");

const assignLoadmanSchema = {
  loadmanId: {
    type: "string",
    optional: false,
    messages: {
      stringEmpty: "Loadman ID is required"
    }
  },
  loadmanType: {
    type: "enum",
    values: ["pickup", "drop", "both"],
    optional: false,
    messages: {
      stringEmpty: "Loadman type is required"
    }
  }
};

const bulkAssignSchema = {
  assignments: {
    type: "array",
    optional: false,
    min: 1,
    items: {
      type: "object",
      props: {
        loadmanId: { type: "string", optional: false },
        loadmanType: { type: "enum", values: ["pickup", "drop", "both"], optional: false }
      }
    },
    messages: {
      arrayMin: "At least one loadman assignment is required"
    }
  }
};

const salaryStatusSchema = {
  status: {
    type: "enum",
    values: ["pending", "processed", "paid"],
    optional: false,
    messages: {
      stringEmpty: "Status is required"
    }
  },
  paymentDate: {
    type: "date",
    optional: true,
    convert: true
  },
  paymentReference: {
    type: "string",
    optional: true,
    max: 100
  },
  notes: {
    type: "string",
    optional: true,
    max: 500
  }
};

/**
 * Assign loadman to a package
 */
async function assignLoadmanToPackage(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();
  
  try {
    if (!req.params.tripBookingId || !req.params.bookingPackageId) {
      throw new Error("Trip booking ID and booking package ID are required");
    }
    
    // Support both single and bulk assignments
    let assignments = [];
    
    if (req.body.assignments) {
      // Bulk assignment
      const validationResponse = await v.validate(req.body, bulkAssignSchema);
      if (validationResponse != true) {
        const errorMessage = validationResponse.map(err => err.message).join(', ');
        throw new Error(errorMessage);
      }
      assignments = req.body.assignments;
    } else {
      // Single assignment
      const validationResponse = await v.validate(req.body, assignLoadmanSchema);
      if (validationResponse != true) {
        const errorMessage = validationResponse.map(err => err.message).join(', ');
        throw new Error(errorMessage);
      }
      assignments = [{
        loadmanId: req.body.loadmanId,
        loadmanType: req.body.loadmanType
      }];
    }
    
    responseEntries.data = await loadmanSalaryService.assignLoadmenToPackage(
      req.params.tripBookingId,
      req.params.bookingPackageId,
      assignments
    );
    
    responseEntries.message = "Loadman assigned successfully";
    
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message = error.message ? error.message : error;
    responseEntries.code = error.code ? error.code : responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    res.send(responseEntries);
  }
}

/**
 * Get loadmen assigned to a package
 */
async function getPackageLoadmen(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    const { tripBookingId, bookingPackageId } = req.params;
    
    responseEntries.data = await loadmanSalaryService.getPackageLoadmen(
      tripBookingId,
      bookingPackageId
    );
    
    if (!responseEntries.data || responseEntries.data.length === 0) {
      responseEntries.message = "No loadmen assigned to this package";
    }
    
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message = error.message ? error.message : error;
    responseEntries.code = error.code ? error.code : responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    res.send(responseEntries);
  }
}

/**
 * Calculate loadman salary for a trip
 */
async function calculateTripLoadmanSalary(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    if (!req.params.tripId) {
      throw new Error("Trip ID is required");
    }
    
    responseEntries.data = await loadmanSalaryService.calculateTripLoadmanSalary(
      req.params.tripId
    );
    
    responseEntries.message = "Loadman salary calculated successfully";
    
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message = error.message ? error.message : error;
    responseEntries.code = error.code ? error.code : responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    res.send(responseEntries);
  }
}

/**
 * Get loadman salaries with filters
 */
async function getLoadmanSalaries(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    const filters = {
      loadmanId: req.query.loadmanId,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      tripId: req.query.tripId,
      status: req.query.status,
      page: req.query.page,
      limit: req.query.limit
    };
    
    responseEntries.data = await loadmanSalaryService.getLoadmanSalaries(filters);
    
    if (!responseEntries.data || responseEntries.data.salaries.length === 0) {
      responseEntries.message = messages.DATA_NOT_FOUND;
    }
    
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message = error.message ? error.message : error;
    responseEntries.code = error.code ? error.code : responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    res.send(responseEntries);
  }
}

/**
 * Update loadman salary status
 */
async function updateLoadmanSalaryStatus(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();
  
  try {
    if (!req.params.salaryId) {
      throw new Error("Salary ID is required");
    }
    
    const validationResponse = await v.validate(req.body, salaryStatusSchema);
    
    if (validationResponse != true) {
      const errorMessage = validationResponse.map(err => err.message).join(', ');
      throw new Error(errorMessage);
    }
    
    responseEntries.data = await loadmanSalaryService.updateLoadmanSalaryStatus(
      req.params.salaryId,
      req.body
    );
    
    responseEntries.message = `Salary status updated to ${req.body.status}`;
    
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message = error.message ? error.message : error;
    responseEntries.code = error.code ? error.code : responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    res.send(responseEntries);
  }
}

/**
 * Get loadman earnings report
 */
async function getLoadmanEarningsReport(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    if (!req.params.loadmanId) {
      throw new Error("Loadman ID is required");
    }
    
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      throw new Error("Start date and end date are required");
    }
    
    responseEntries.data = await loadmanSalaryService.getLoadmanEarningsReport(
      req.params.loadmanId,
      startDate,
      endDate
    );
    
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message = error.message ? error.message : error;
    responseEntries.code = error.code ? error.code : responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    res.send(responseEntries);
  }
}

module.exports = async function (fastify) {
  // Assign loadmen to package
  fastify.route({
    method: "POST",
    url: "/trip-bookings/:tripBookingId/packages/:bookingPackageId/loadmen",
    // preHandler: verifyToken,
    handler: assignLoadmanToPackage,
  });
  
  // Get loadmen assigned to package
  fastify.route({
    method: "GET",
    url: "/trip-bookings/:tripBookingId/packages/:bookingPackageId/loadmen",
    // preHandler: verifyToken,
    handler: getPackageLoadmen,
  });
  
  // Calculate loadman salary for trip
  fastify.route({
    method: "POST",
    url: "/trips/:tripId/calculate-loadman-salary",
    // preHandler: verifyToken,
    handler: calculateTripLoadmanSalary,
  });
  
  // Get loadman salaries with filters
  fastify.route({
    method: "GET",
    url: "/loadman-salaries",
    // preHandler: verifyToken,
    handler: getLoadmanSalaries,
  });
  
  // Update loadman salary status
  fastify.route({
    method: "PATCH",
    url: "/loadman-salaries/:salaryId/status",
    // preHandler: verifyToken,
    handler: updateLoadmanSalaryStatus,
  });
  
  // Get loadman earnings report
  fastify.route({
    method: "GET",
    url: "/loadmen/:loadmanId/earnings-report",
    // preHandler: verifyToken,
    handler: getLoadmanEarningsReport,
  });
};