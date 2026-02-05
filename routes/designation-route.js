"use strict";

const Validator = require("fastest-validator");
const { verifyToken } = require("../middleware/auth");
const { ResponseEntry } = require("../helpers/construct-response");
const responseCode = require("../helpers/status-code");
const messages = require("../helpers/message");
const designationServices = require("../service/designation-service");
const _ = require("lodash");

const schema = {
  designationName: { type: "string", optional: false },
};

async function getDesignation(req, res) {
  const responseEntries = new ResponseEntry();
  try {
    responseEntries.data = await designationServices.getDesignation(req.query);
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

async function createDesignation(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();
  try {
    const validationResponse = await v.validate(req.body, schema);
    if (validationResponse != true) {
      throw new Error(messages.VALIDATION_FAILED);
    } else {
      responseEntries.data = await designationServices.createDesignation(
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

async function updateDesignation(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();
  try {
    const filteredSchema = _.pick(schema, Object.keys(req.body));
    const validationResponse = v.validate(req.body, filteredSchema);
    if (validationResponse != true) {
      throw new Error(messages.VALIDATION_FAILED);
    } else {
      responseEntries.data = await designationServices.updateDesignation(
        req.params.designationId,
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
    url: "/designation",
    preHandler: verifyToken,
    handler: getDesignation,
  });
  fastify.route({
    method: "POST",
    url: "/designation",
    preHandler: verifyToken,
    handler: createDesignation,
  });

  fastify.route({
    method: "PUT",
    url: "/designation/:designationId",
    preHandler: verifyToken,
    handler: updateDesignation,
  });
};
