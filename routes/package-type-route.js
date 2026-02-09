"use strict";

const Validator = require("fastest-validator");
const { verifyToken } = require("../middleware/auth");
const { ResponseEntry } = require("../helpers/construct-response");
const responseCode = require("../helpers/status-code");
const messages = require("../helpers/message");
const packageTypeServices = require("../service/package-type-service");
const _ = require("lodash");

const schema = {
  package_type_name: { // Changed to snake_case
    type: "string",
    min: 2,
    max: 100,
    optional: false,
    messages: {
      stringEmpty: "Package type name is required",
      stringMin: "Package type name must be at least 2 characters",
      stringMax: "Package type name cannot exceed 100 characters",
    },
  },
  package_pickup_price: { // Changed to snake_case
    type: "number",
    min: 0,
    optional: false,
    messages: {
      numberMin: "Pickup price must be greater than or equal to 0",
      numberEmpty: "Pickup price is required",
    },
  },
  package_drop_price: { // Changed to snake_case
    type: "number",
    min: 0,
    optional: false,
    messages: {
      numberMin: "Drop price must be greater than or equal to 0",
      numberEmpty: "Drop price is required",
    },
  },
};

async function getPackageType(req, res) {
  const responseEntries = new ResponseEntry();
  try {
    responseEntries.data = await packageTypeServices.getPackageType(req.query);
    if (!responseEntries.data || responseEntries.data.length === 0) {
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

async function createPackageType(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();
  try {
    const validationResponse = await v.validate(req.body, schema);
    if (validationResponse !== true) {
      const errorMessage = validationResponse
        .map((err) => err.message)
        .join(", ");
      throw new Error(errorMessage);
    } else {
      responseEntries.data = await packageTypeServices.createPackageType(
        req.body
      );
      if (!responseEntries.data) {
        responseEntries.message = messages.DATA_NOT_FOUND;
      } else {
        responseEntries.message = "Package type created successfully";
      }
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

async function updatePackageType(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();
  try {
    if (!req.params.packageTypeId) {
      throw new Error("Package type ID is required");
    }

    const filteredSchema = _.pick(schema, Object.keys(req.body));
    if (Object.keys(filteredSchema).length === 0) {
      throw new Error("No valid fields to update");
    }

    const validationResponse = v.validate(req.body, filteredSchema);
    if (validationResponse !== true) {
      const errorMessage = validationResponse
        .map((err) => err.message)
        .join(", ");
      throw new Error(errorMessage);
    } else {
      responseEntries.data = await packageTypeServices.updatePackageType(
        req.params.packageTypeId,
        req.body
      );
      if (!responseEntries.data) {
        responseEntries.message = messages.DATA_NOT_FOUND;
      } else {
        responseEntries.message = "Package type updated successfully";
      }
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

async function deletePackageType(req, res) {
  const responseEntries = new ResponseEntry();
  try {
    if (!req.params.packageTypeId) {
      throw new Error("Package type ID is required");
    }
    responseEntries.data = await packageTypeServices.deletePackageType(
      req.params.packageTypeId
    );
    responseEntries.message = "Package type deleted successfully";
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
    url: "/package-types",
    // preHandler: verifyToken,
    handler: getPackageType,
  });

  fastify.route({
    method: "POST",
    url: "/package-types",
    // preHandler: verifyToken,
    handler: createPackageType,
  });

  fastify.route({
    method: "PUT",
    url: "/package-types/:packageTypeId",
    // preHandler: verifyToken,
    handler: updatePackageType,
  });

  fastify.route({
    method: "DELETE",
    url: "/package-types/:packageTypeId",
    // preHandler: verifyToken,
    handler: deletePackageType,
  });
};