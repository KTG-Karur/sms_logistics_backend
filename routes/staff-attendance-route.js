"use strict";

const { verifyToken } = require("../middleware/auth");
const { ResponseEntry } = require("../helpers/construct-response");
const responseCode = require("../helpers/status-code");
const messages = require("../helpers/message");
const staffAttendanceServices = require("../service/staff-attendance-service");

async function getStaffAttendance(req, res) {
  const responseEntries = new ResponseEntry();
  try {
    responseEntries.data = await staffAttendanceServices.getStaffAttendance(req.query);
    if (!responseEntries.data) responseEntries.message = messages.DATA_NOT_FOUND;
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message = error.message || error;
    responseEntries.code = responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    res.send(responseEntries);
  }
}

async function getStaffAttendanceList(req, res) {
  const responseEntries = new ResponseEntry();
  try {
    responseEntries.data = await staffAttendanceServices.getStaffAttendanceList(req.query);
    if (!responseEntries.data) responseEntries.message = messages.DATA_NOT_FOUND;
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message = error.message || error;
    responseEntries.code = responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    res.send(responseEntries);
  }
}

async function getStaffAttendanceReport(req, res) {
  const responseEntries = new ResponseEntry();
  try {
    responseEntries.data = await staffAttendanceServices.getStaffAttendanceReport(req.query);
    if (!responseEntries.data) responseEntries.message = messages.DATA_NOT_FOUND;
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message = error.message || error;
    responseEntries.code = responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    res.send(responseEntries);
  }
}

async function createStaffAttendance(req, res) {
  const responseEntries = new ResponseEntry();
  try {
    responseEntries.data = await staffAttendanceServices.createStaffAttendance(req.body);
    if (!responseEntries.data) responseEntries.message = messages.DATA_NOT_FOUND;
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message = error.message || error;
    responseEntries.code = responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    res.send(responseEntries);
  }
}

async function updateStaffAttendance(req, res) {
  const responseEntries = new ResponseEntry();
  try {
    responseEntries.data = await staffAttendanceServices.updateStaffAttendance(req.body);
    if (!responseEntries.data) responseEntries.message = messages.DATA_NOT_FOUND;
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message = error.message || error;
    responseEntries.code = responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    res.send(responseEntries);
  }
}

module.exports = async function (fastify) {
  fastify.route({
    method: 'GET',
    url: '/staff-attendance',
    // preHandler: verifyToken,
    handler: getStaffAttendance
  });

  fastify.route({
    method: 'GET',
    url: '/staff-attendance-list',
    // preHandler: verifyToken,
    handler: getStaffAttendanceList
  });

  fastify.route({
    method: 'GET',
    url: '/staff-attendance-report',
    // preHandler: verifyToken,
    handler: getStaffAttendanceReport
  });

  fastify.route({
    method: 'POST',
    url: '/staff-attendance',
    // preHandler: verifyToken,
    handler: createStaffAttendance
  });

  fastify.route({
    method: 'PUT',
    url: '/staff-attendance',
    // preHandler: verifyToken,
    handler: updateStaffAttendance
  });
};