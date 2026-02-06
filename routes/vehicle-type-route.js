"use strict";

const Validator = require("fastest-validator");
const { verifyToken } = require("../middleware/auth");
const { ResponseEntry } = require("../helpers/construct-response");
const responseCode = require("../helpers/status-code");
const messages = require("../helpers/message");
const vehicleTypeServices = require("../service/vehicle-type-service");
const _ = require("lodash");

const schema = {
  vehicleTypeName: {
    type: "string",
    min: 2,
    max: 100,
    optional: false,
    messages: {
      stringEmpty: "Vehicle type name is required",
      stringMin: "Vehicle type name must be at least 2 characters",
      stringMax: "Vehicle type name cannot exceed 100 characters"
    }
  },
};

async function getVehicleType(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    responseEntries.data = await vehicleTypeServices.getVehicleType(req.query);
    
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

async function createVehicleType(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();
  
  try {
    const validationResponse = await v.validate(req.body, schema);
    
    if (validationResponse != true) {
      const errorMessage = validationResponse.map(err => err.message).join(', ');
      throw new Error(errorMessage);
    } else {
      responseEntries.data = await vehicleTypeServices.createVehicleType(
        req.body
      );
      
      if (!responseEntries.data) {
        responseEntries.message = messages.DATA_NOT_FOUND;
      } else {
        responseEntries.message = "Vehicle type created successfully";
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

async function updateVehicleType(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();
  
  try {
    if (!req.params.vehicleTypeId) {
      throw new Error("Vehicle type ID is required");
    }
    
    const filteredSchema = _.pick(schema, Object.keys(req.body));
    
    if (Object.keys(filteredSchema).length === 0) {
      throw new Error("No valid fields to update");
    }
    
    const validationResponse = v.validate(req.body, filteredSchema);
    
    if (validationResponse != true) {
      const errorMessage = validationResponse.map(err => err.message).join(', ');
      throw new Error(errorMessage);
    } else {
      responseEntries.data = await vehicleTypeServices.updateVehicleType(
        req.params.vehicleTypeId,
        req.body
      );
      
      if (!responseEntries.data) {
        responseEntries.message = messages.DATA_NOT_FOUND;
      } else {
        responseEntries.message = "Vehicle type updated successfully";
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

async function deleteVehicleType(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    if (!req.params.vehicleTypeId) {
      throw new Error("Vehicle type ID is required");
    }
    
    responseEntries.data = await vehicleTypeServices.deleteVehicleType(
      req.params.vehicleTypeId
    );
    
    responseEntries.message = "Vehicle type deleted successfully";
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
    url: "/vehicle-types",
    // preHandler: verifyToken,
    handler: getVehicleType,
  });
  
  fastify.route({
    method: "POST",
    url: "/vehicle-types",
    // preHandler: verifyToken,
    handler: createVehicleType,
  });
  
  fastify.route({
    method: "PUT",
    url: "/vehicle-types/:vehicleTypeId",
    // preHandler: verifyToken,
    handler: updateVehicleType,
  });
  
  fastify.route({
    method: "DELETE",
    url: "/vehicle-types/:vehicleTypeId",
    // preHandler: verifyToken,
    handler: deleteVehicleType,
  });
};