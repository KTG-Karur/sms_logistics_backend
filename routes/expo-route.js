"use strict";

const Validator = require("fastest-validator");
const { verifyToken } = require("../middleware/auth");
const { ResponseEntry } = require("../helpers/construct-response");
const responseCode = require("../helpers/status-code");
const messages = require("../helpers/message");
const expoServices = require("../service/expo-service");
const _ = require("lodash");

const schema = {
  expo_name: { type: "string", empty: false },
  country: { type: "string", empty: false },
  place: { type: "string", empty: false },
  from_date: { type: "string", optional: true },
  to_date: { type: "string", optional: true },
  year: { type: "string", optional: true },
  is_completed: { type: "boolean", optional: true },
  staff: {
    type: "array",
    optional: true,
    items: { type: "string" },
  },
};

async function getExpo(req, res) {
  const responseEntries = new ResponseEntry();
  try {
    responseEntries.data = await expoServices.getExpo(req.query);
    if (!responseEntries.data)
      responseEntries.message = messages.DATA_NOT_FOUND;
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message = error.message || error;
    responseEntries.code = responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    res.send(responseEntries);
  }
}

async function createExpo(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();

  try {
    const validationResponse = v.validate(req.body, schema);
    if (validationResponse !== true) {
      throw new Error(messages.VALIDATION_FAILED);
    }

    responseEntries.data = await expoServices.createExpo(req.body);
    if (!responseEntries.data)
      responseEntries.message = messages.DATA_NOT_FOUND;
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message = error.message || error;
    responseEntries.code = responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    res.send(responseEntries);
  }
}

async function updateExpo(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();

  try {
    const filteredSchema = _.pick(schema, Object.keys(req.body));
    const validationResponse = v.validate(req.body, filteredSchema);
    if (validationResponse !== true) {
      throw new Error(messages.VALIDATION_FAILED);
    }

    responseEntries.data = await expoServices.updateExpo(
      req.params.expoId,
      req.body
    );

    if (!responseEntries.data)
      responseEntries.message = messages.DATA_NOT_FOUND;
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
    method: "GET",
    url: "/expo",
    preHandler: verifyToken,
    handler: getExpo,
  });

  fastify.route({
    method: "POST",
    url: "/expo",
    preHandler: verifyToken,
    handler: createExpo,
  });

  fastify.route({
    method: "PUT",
    url: "/expo/:expoId",
    preHandler: verifyToken,
    handler: updateExpo,
  });
};
