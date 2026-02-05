"use strict";
const { verifyToken } = require("../middleware/auth");
const { ResponseEntry } = require("../helpers/construct-response");
const responseCode = require("../helpers/status-code");
const dashboardServices = require("../service/dashboard-service");

async function getDashboardData(req, res) {
  const responseEntries = new ResponseEntry();

  try {
    const dashboardData = await dashboardServices.getDashboardData();

    responseEntries.data = dashboardData;
    responseEntries.message = "Dashboard data fetched successfully";
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message = error.message || "Failed to fetch dashboard data";
    responseEntries.code = responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    res.send(responseEntries);
  }
}

async function getDashboardStatistics(req, res) {
  const responseEntries = new ResponseEntry();

  try {
    const statistics = await dashboardServices.getDashboardStatistics();

    responseEntries.data = statistics;
    responseEntries.message = "Dashboard statistics fetched successfully";
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message =
      error.message || "Failed to fetch dashboard statistics";
    responseEntries.code = responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    res.send(responseEntries);
  }
}

async function getRecentEnquiries(req, res) {
  const responseEntries = new ResponseEntry();

  try {
    const limit = parseInt(req.query.limit) || 5;
    const enquiries = await dashboardServices.getRecentEnquiries(limit);

    responseEntries.data = enquiries;
    responseEntries.message = "Recent enquiries fetched successfully";
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message =
      error.message || "Failed to fetch recent enquiries";
    responseEntries.code = responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    res.send(responseEntries);
  }
}

async function getTopProducts(req, res) {
  const responseEntries = new ResponseEntry();

  try {
    const limit = parseInt(req.query.limit) || 5;
    const topProducts = await dashboardServices.getTopProducts(limit);

    responseEntries.data = topProducts;
    responseEntries.message = "Top products fetched successfully";
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message = error.message || "Failed to fetch top products";
    responseEntries.code = responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    res.send(responseEntries);
  }
}

async function getCountrySummary(req, res) {
  const responseEntries = new ResponseEntry();

  try {
    const limit = parseInt(req.query.limit) || 10;
    const countrySummary = await dashboardServices.getCountryWiseSummary(limit);

    responseEntries.data = countrySummary;
    responseEntries.message = "Country summary fetched successfully";
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message =
      error.message || "Failed to fetch country summary";
    responseEntries.code = responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    res.send(responseEntries);
  }
}

async function getExpoPerformance(req, res) {
  const responseEntries = new ResponseEntry();

  try {
    const expoPerformance = await dashboardServices.getExpoPerformance();

    responseEntries.data = expoPerformance;
    responseEntries.message = "Expo performance data fetched successfully";
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message =
      error.message || "Failed to fetch expo performance";
    responseEntries.code = responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    res.send(responseEntries);
  }
}

async function getQuickStats(req, res) {
  const responseEntries = new ResponseEntry();

  try {
    const quickStats = await dashboardServices.getQuickStats();

    responseEntries.data = quickStats;
    responseEntries.message = "Quick stats fetched successfully";
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message = error.message || "Failed to fetch quick stats";
    responseEntries.code = responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    res.send(responseEntries);
  }
}

module.exports = async function (fastify) {
  // Main dashboard endpoint with all data
  fastify.route({
    method: "GET",
    url: "/dashboard",
    preHandler: verifyToken,
    handler: getDashboardData,
  });

  // Individual endpoints for specific data
  fastify.route({
    method: "GET",
    url: "/dashboard/statistics",
    preHandler: verifyToken,
    handler: getDashboardStatistics,
  });

  fastify.route({
    method: "GET",
    url: "/dashboard/recent-enquiries",
    preHandler: verifyToken,
    handler: getRecentEnquiries,
  });

  fastify.route({
    method: "GET",
    url: "/dashboard/top-products",
    preHandler: verifyToken,
    handler: getTopProducts,
  });

  fastify.route({
    method: "GET",
    url: "/dashboard/country-summary",
    preHandler: verifyToken,
    handler: getCountrySummary,
  });

  fastify.route({
    method: "GET",
    url: "/dashboard/expo-performance",
    preHandler: verifyToken,
    handler: getExpoPerformance,
  });

  fastify.route({
    method: "GET",
    url: "/dashboard/quick-stats",
    preHandler: verifyToken,
    handler: getQuickStats,
  });
};
