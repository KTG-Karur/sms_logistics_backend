"use strict";

const Validator = require("fastest-validator");
const { verifyToken } = require("../middleware/auth");
const { ResponseEntry } = require("../helpers/construct-response");
const responseCode = require("../helpers/status-code");
const messages = require("../helpers/message");
const departmentServices = require("../service/department-service");
const _ = require("lodash");

const schema = {
  departmentName: { type: "string", optional: false },
};

async function getDepartment(req, res) {
  const responseEntries = new ResponseEntry();
  try {
    responseEntries.data = await departmentServices.getDepartment(req.query);
    if (!responseEntries.data)
      responseEntries.message = messages.DATA_NOT_FOUND;
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message = error.message ? error.message : error;
    responseEntries.code = responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    res.send(responseEntries);
  }
}

async function createDepartment(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();
  try {
    const validationResponse = await v.validate(req.body, schema);
    if (validationResponse != true) {
      throw new Error(messages.VALIDATION_FAILED);
    } else {
      responseEntries.data = await departmentServices.createDepartment(
        req.body
      );
      if (!responseEntries.data)
        responseEntries.message = messages.DATA_NOT_FOUND;
    }
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message = error.message ? error.message : error;
    responseEntries.code = responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    res.send(responseEntries);
  }
}

async function updateDepartment(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();
  try {
    const filteredSchema = _.pick(schema, Object.keys(req.body));
    const validationResponse = v.validate(req.body, filteredSchema);
    if (validationResponse != true) {
      throw new Error(messages.VALIDATION_FAILED);
    } else {
      responseEntries.data = await departmentServices.updateDepartment(
        req.params.departmentId,
        req.body
      );
      if (!responseEntries.data)
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

module.exports = async function (fastify) {
  fastify.route({
    method: "GET",
    url: "/department",
    preHandler: verifyToken,
    handler: getDepartment,
  });
  fastify.route({
    method: "POST",
    url: "/department",
    preHandler: verifyToken,
    handler: createDepartment,
  });

  fastify.route({
    method: "PUT",
    url: "/department/:departmentId",
    preHandler: verifyToken,
    handler: updateDepartment,
  });
};
