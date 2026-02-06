"use strict";

const Validator = require("fastest-validator");
const { verifyToken } = require("../middleware/auth");
const { ResponseEntry } = require("../helpers/construct-response");
const responseCode = require("../helpers/status-code");
const messages = require("../helpers/message");
const vehicleServices = require("../service/vehicle-service");
const _ = require("lodash");

const schema = {
  vehicleNumberPlate: {
    type: "string",
    min: 5,
    max: 20,
    optional: false,
    messages: {
      stringEmpty: "Vehicle number plate is required",
      stringMin: "Vehicle number plate must be at least 5 characters",
      stringMax: "Vehicle number plate cannot exceed 20 characters",
    },
  },
  vehicleTypeId: {
    type: "string",
    optional: false,
    messages: {
      stringEmpty: "Vehicle type is required",
    },
  },
  rcNumber: {
    type: "string",
    optional: false,
    messages: {
      stringEmpty: "RC number is required",
    },
  },
  rcExpiryDate: {
    type: "date",
    optional: false,
    convert: true,
    messages: {
      dateEmpty: "RC expiry date is required",
      date: "RC expiry date must be a valid date",
    },
  },
  insuranceNumber: {
    type: "string",
    optional: false,
    messages: {
      stringEmpty: "Insurance number is required",
    },
  },
  insuranceExpiryDate: {
    type: "date",
    optional: false,
    convert: true,
    messages: {
      dateEmpty: "Insurance expiry date is required",
      date: "Insurance expiry date must be a valid date",
    },
  },
  rcUpload: {
    type: "string",
    optional: true,
    messages: {
      string: "RC upload must be a valid URL",
    },
  },
};

async function getVehicle(req, res) {
  const responseEntries = new ResponseEntry();

  try {
    responseEntries.data = await vehicleServices.getVehicle(req.query);

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

async function createVehicle(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();

  try {
    const validationResponse = await v.validate(req.body, schema);

    if (validationResponse != true) {
      const errorMessage = validationResponse
        .map((err) => err.message)
        .join(", ");
      throw new Error(errorMessage);
    } else {
      responseEntries.data = await vehicleServices.createVehicle(req.body);

      if (!responseEntries.data) {
        responseEntries.message = messages.DATA_NOT_FOUND;
      } else {
        responseEntries.message = "Vehicle created successfully";
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

async function updateVehicle(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();

  try {
    if (!req.params.vehicleId) {
      throw new Error("Vehicle ID is required");
    }

    const filteredSchema = _.pick(schema, Object.keys(req.body));

    if (Object.keys(filteredSchema).length === 0) {
      throw new Error("No valid fields to update");
    }

    const validationResponse = v.validate(req.body, filteredSchema);

    if (validationResponse != true) {
      const errorMessage = validationResponse
        .map((err) => err.message)
        .join(", ");
      throw new Error(errorMessage);
    } else {
      responseEntries.data = await vehicleServices.updateVehicle(
        req.params.vehicleId,
        req.body
      );

      if (!responseEntries.data) {
        responseEntries.message = messages.DATA_NOT_FOUND;
      } else {
        responseEntries.message = "Vehicle updated successfully";
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

async function deleteVehicle(req, res) {
  const responseEntries = new ResponseEntry();

  try {
    if (!req.params.vehicleId) {
      throw new Error("Vehicle ID is required");
    }

    responseEntries.data = await vehicleServices.deleteVehicle(
      req.params.vehicleId
    );

    responseEntries.message = "Vehicle deleted successfully";
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message = error.message ? error.message : error;
    responseEntries.code = error.code ? error.code : responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    res.send(responseEntries);
  }
}

async function getExpiringVehicles(req, res) {
  const responseEntries = new ResponseEntry();

  try {
    const daysThreshold = req.query.days || 30;
    responseEntries.data = await vehicleServices.getVehiclesWithExpiringDocuments(
      parseInt(daysThreshold)
    );

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

module.exports = async function (fastify) {
  fastify.route({
    method: "GET",
    url: "/vehicles",
    // preHandler: verifyToken,
    handler: getVehicle,
  });

  fastify.route({
    method: "POST",
    url: "/vehicles",
    // preHandler: verifyToken,
    handler: createVehicle,
  });

  fastify.route({
    method: "PUT",
    url: "/vehicles/:vehicleId",
    // preHandler: verifyToken,
    handler: updateVehicle,
  });

  fastify.route({
    method: "DELETE",
    url: "/vehicles/:vehicleId",
    // preHandler: verifyToken,
    handler: deleteVehicle,
  });

  fastify.route({
    method: "GET",
    url: "/vehicles/expiring-documents",
    // preHandler: verifyToken,
    handler: getExpiringVehicles,
  });
};