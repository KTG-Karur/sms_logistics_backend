"use strict";

const Validator = require("fastest-validator");
const { verifyToken } = require("../middleware/auth");
const { ResponseEntry } = require("../helpers/construct-response");
const responseCode = require("../helpers/status-code");
const messages = require("../helpers/message");
const reportService = require("../service/report-service");
const _ = require("lodash");

// =============================================
// PROFIT & LOSS REPORTS
// =============================================

async function getDailyProfitLoss(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    const { date, centerId } = req.query;
    
    if (!date) {
      throw new Error("Date is required (YYYY-MM-DD)");
    }
    
    responseEntries.data = await reportService.getDailyProfitLoss(date, centerId);
    
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message = error.message ? error.message : error;
    responseEntries.code = error.code ? error.code : responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    res.send(responseEntries);
  }
}

async function getDateRangeProfitLoss(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    const { startDate, endDate, centerId } = req.query;
    
    if (!startDate || !endDate) {
      throw new Error("Start date and end date are required");
    }
    
    responseEntries.data = await reportService.getDateRangeProfitLoss(startDate, endDate, centerId);
    
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
// PACKAGE REPORTS
// =============================================

async function getPackageReport(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      centerId: req.query.centerId,
      packageTypeId: req.query.packageTypeId,
      customerId: req.query.customerId,
      status: req.query.status,
      page: req.query.page,
      limit: req.query.limit
    };
    
    responseEntries.data = await reportService.getPackageReport(filters);
    
    if (!responseEntries.data || responseEntries.data.packages.length === 0) {
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
// TRIP REPORTS
// =============================================

async function getTripReport(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      centerId: req.query.centerId,
      driverId: req.query.driverId,
      vehicleId: req.query.vehicleId,
      status: req.query.status,
      page: req.query.page,
      limit: req.query.limit
    };
    
    responseEntries.data = await reportService.getTripReport(filters);
    
    if (!responseEntries.data || responseEntries.data.trips.length === 0) {
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
// BALANCE REPORTS
// =============================================

async function getBalanceReport(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    const { startDate, endDate, centerId, page, limit } = req.query;
    
    if (!startDate || !endDate) {
      throw new Error("Start date and end date are required");
    }
    
    const filters = {
      startDate,
      endDate,
      centerId,
      page,
      limit
    };
    
    responseEntries.data = await reportService.getBalanceReport(filters);
    
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
// DASHBOARD STATISTICS
// =============================================

async function getDashboardStats(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    const { centerId } = req.query;
    
    responseEntries.data = await reportService.getDashboardStats(centerId);
    
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
  // Profit & Loss Reports
  fastify.route({
    method: "GET",
    url: "/reports/profit-loss/daily",
    // preHandler: verifyToken,
    handler: getDailyProfitLoss,
  });
  
  fastify.route({
    method: "GET",
    url: "/reports/profit-loss/range",
    // preHandler: verifyToken,
    handler: getDateRangeProfitLoss,
  });
  
  // Package Reports
  fastify.route({
    method: "GET",
    url: "/reports/packages",
    // preHandler: verifyToken,
    handler: getPackageReport,
  });
  
  // Trip Reports
  fastify.route({
    method: "GET",
    url: "/reports/trips",
    // preHandler: verifyToken,
    handler: getTripReport,
  });
  
  // Balance Reports
  fastify.route({
    method: "GET",
    url: "/reports/balance",
    // preHandler: verifyToken,
    handler: getBalanceReport,
  });
  
  // Dashboard Statistics
  fastify.route({
    method: "GET",
    url: "/dashboard/stats",
    // preHandler: verifyToken,
    handler: getDashboardStats,
  });
};