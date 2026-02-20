"use strict";

const Validator = require("fastest-validator");
const { verifyToken } = require("../middleware/auth");
const { ResponseEntry } = require("../helpers/construct-response");
const responseCode = require("../helpers/status-code");
const messages = require("../helpers/message");
const loadmanSalaryService = require("../service/loadman-salary-service");
const _ = require("lodash");

// =============================================
// SCHEMAS
// =============================================

// Schema for bulk assignments with package type details
const bulkAssignPackagesSchema = {
  assignments: {
    type: "array",
    optional: false,
    min: 1,
    items: {
      type: "object",
      props: {
        packageTypeId: { 
          type: "string", 
          optional: false,
          messages: {
            stringEmpty: "Package type ID is required"
          }
        },
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
        },
        quantity: {
          type: "number",
          optional: true,
          positive: true,
          integer: true,
          min: 1,
          default: 1,
          messages: {
            numberMin: "Quantity must be at least 1"
          }
        }
      }
    },
    messages: {
      arrayMin: "At least one loadman assignment is required"
    }
  }
};

// Schema for salary status update
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

// Schema for loadman data filters
const loadmanDataFiltersSchema = {
  loadmanId: { type: "string", optional: true },
  startDate: { type: "date", optional: true, convert: true },
  endDate: { type: "date", optional: true, convert: true },
  tripId: { type: "string", optional: true },
  status: { type: "enum", values: ["pending", "processed", "paid", "all"], optional: true, default: "all" },
  search: { type: "string", optional: true },
  page: { type: "number", optional: true, positive: true, integer: true, default: 1, convert: true },
  limit: { type: "number", optional: true, positive: true, integer: true, default: 20, convert: true },
  sortBy: { type: "string", optional: true, default: "created_at" },
  sortOrder: { type: "enum", values: ["ASC", "DESC"], optional: true, default: "DESC" }
};

// =============================================
// ASSIGN LOADMEN TO PACKAGES BY TRIP ID
// =============================================

/**
 * Assign loadmen to packages by trip ID
 */
async function assignLoadmenToTripPackages(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();
  
  try {
    if (!req.params.tripId) {
      throw new Error("Trip ID is required");
    }
    
    const validationResponse = await v.validate(req.body, bulkAssignPackagesSchema);
    
    if (validationResponse != true) {
      const errorMessage = validationResponse.map(err => err.message).join(', ');
      throw new Error(errorMessage);
    }
    
    responseEntries.data = await loadmanSalaryService.assignLoadmenToTripPackages(
      req.params.tripId,
      req.body.assignments
    );
    
    responseEntries.message = "Loadmen assigned to trip packages successfully";
    
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message = error.message ? error.message : error;
    responseEntries.code = error.code ? error.code : responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    res.send(responseEntries);
  }
}

// =============================================
// GET PACKAGE LOADMEN BY TRIP ID
// =============================================

/**
 * Get loadmen assigned to packages for a trip
 */
/**
 * Get loadmen assigned to packages for a trip with date filter
 */
async function getTripPackageLoadmen(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    const { tripId } = req.params;
    const { packageTypeId, startDate, endDate } = req.query;
    
    if (!tripId) {
      throw new Error("Trip ID is required");
    }
    
    responseEntries.data = await loadmanSalaryService.getTripPackageLoadmen(
      tripId,
      packageTypeId,
      startDate,
      endDate
    );
    
    if (!responseEntries.data || 
        (responseEntries.data.bookings && responseEntries.data.bookings.length === 0)) {
      responseEntries.message = "No loadmen assigned";
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

// =============================================
// CALCULATE TRIP LOADMAN SALARY
// =============================================

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

// =============================================
// GET LOADMAN SALARIES
// =============================================

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
      page: req.query.page ? parseInt(req.query.page) : 1,
      limit: req.query.limit ? parseInt(req.query.limit) : 20
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

// =============================================
// UPDATE LOADMAN SALARY STATUS
// =============================================

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

// =============================================
// GET LOADMAN EARNINGS REPORT
// =============================================

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

// =============================================
// GET LOADMAN DATA WITH FILTERS
// =============================================

/**
 * Get loadman data with filters
 */
async function getLoadmanData(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();
  
  try {
    const validationResponse = await v.validate(req.query, loadmanDataFiltersSchema);
    
    if (validationResponse != true) {
      const errorMessage = validationResponse.map(err => err.message).join(', ');
      throw new Error(errorMessage);
    }
    
    const filters = {
      loadmanId: req.query.loadmanId,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      tripId: req.query.tripId,
      status: req.query.status === 'all' ? null : req.query.status,
      search: req.query.search,
      page: req.query.page ? parseInt(req.query.page) : 1,
      limit: req.query.limit ? parseInt(req.query.limit) : 20,
      sortBy: req.query.sortBy || 'created_at',
      sortOrder: req.query.sortOrder || 'DESC'
    };
    
    responseEntries.data = await loadmanSalaryService.getLoadmanData(filters);
    
    if (!responseEntries.data || responseEntries.data.loadmen.length === 0) {
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

// =============================================
// GET LOADMAN BY ID
// =============================================

/**
 * Get loadman details by ID with complete history
 */
async function getLoadmanById(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    if (!req.params.loadmanId) {
      throw new Error("Loadman ID is required");
    }
    
    const includeHistory = req.query.includeHistory !== 'false';
    const includeTrips = req.query.includeTrips !== 'false';
    const includePayments = req.query.includePayments !== 'false';
    
    responseEntries.data = await loadmanSalaryService.getLoadmanById(
      req.params.loadmanId,
      { includeHistory, includeTrips, includePayments }
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

// =============================================
// GET LOADMAN TRIP HISTORY
// =============================================

/**
 * Get loadman trip history
 */
async function getLoadmanTripHistory(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    if (!req.params.loadmanId) {
      throw new Error("Loadman ID is required");
    }
    
    const { startDate, endDate, page = 1, limit = 20 } = req.query;
    
    responseEntries.data = await loadmanSalaryService.getLoadmanTripHistory(
      req.params.loadmanId,
      { 
        startDate, 
        endDate, 
        page: page ? parseInt(page) : 1, 
        limit: limit ? parseInt(limit) : 20 
      }
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

// =============================================
// GET LOADMAN PERFORMANCE
// =============================================

/**
 * Get loadman performance metrics
 */
async function getLoadmanPerformance(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    if (!req.params.loadmanId) {
      throw new Error("Loadman ID is required");
    }
    
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      throw new Error("Start date and end date are required");
    }
    
    responseEntries.data = await loadmanSalaryService.getLoadmanPerformance(
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

// =============================================
// ROUTES
// =============================================
// =============================================
// GET LOADMAN PACKAGE ASSIGNMENTS BY LOADMAN ID
// =============================================

/**
 * Get package assignments for a specific loadman with date filters
 */
async function getLoadmanPackageAssignments(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    const { loadmanId } = req.params;
    const { startDate, endDate, page = 1, limit = 20 } = req.query;
    
    if (!loadmanId) {
      throw new Error("Loadman ID is required");
    }
    
    const filters = {
      startDate,
      endDate,
      page: parseInt(page),
      limit: parseInt(limit)
    };
    
    responseEntries.data = await loadmanSalaryService.getLoadmanPackageAssignments(
      loadmanId,
      filters
    );
    
    if (!responseEntries.data || responseEntries.data.assignments.length === 0) {
      responseEntries.message = "No assignments found for this loadman";
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
 * Get loadman earnings summary by date range
 */
async function getLoadmanEarningsSummary(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    const { loadmanId } = req.params;
    const { startDate, endDate } = req.query;
    
    if (!loadmanId) {
      throw new Error("Loadman ID is required");
    }
    
    if (!startDate || !endDate) {
      throw new Error("Start date and end date are required");
    }
    
    responseEntries.data = await loadmanSalaryService.getLoadmanEarningsSummary(
      loadmanId,
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
  // Assign loadmen to packages by trip ID
  fastify.route({
    method: "POST",
    url: "/trips/:tripId/assign-loadmen",
    // preHandler: verifyToken,
    handler: assignLoadmenToTripPackages,
  });
  
  // Get loadmen assigned to packages for a trip
  fastify.route({
    method: "GET",
    url: "/trips/:tripId/package-loadmen",
    // preHandler: verifyToken,
    handler: getTripPackageLoadmen,
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
  
  // Get loadman data with filters
  fastify.route({
    method: "GET",
    url: "/loadmen/data",
    // preHandler: verifyToken,
    handler: getLoadmanData,
  });
  
  // Get loadman by ID with details
  fastify.route({
    method: "GET",
    url: "/loadmen/:loadmanId",
    // preHandler: verifyToken,
    handler: getLoadmanById,
  });
  
  // Get loadman trip history
  fastify.route({
    method: "GET",
    url: "/loadmen/:loadmanId/trip-history",
    // preHandler: verifyToken,
    handler: getLoadmanTripHistory,
  });
  
  // Get loadman performance metrics
  fastify.route({
    method: "GET",
    url: "/loadmen/:loadmanId/performance",
    // preHandler: verifyToken,
    handler: getLoadmanPerformance,
  });

   // Get loadman package assignments by loadman ID
  fastify.route({
    method: "GET",
    url: "/loadmen/:loadmanId/package-assignments",
    // preHandler: verifyToken,
    handler: getLoadmanPackageAssignments,
  });
  
  // Get loadman earnings summary
  fastify.route({
    method: "GET",
    url: "/loadmen/:loadmanId/earnings-summary",
    // preHandler: verifyToken,
    handler: getLoadmanEarningsSummary,
  });
};