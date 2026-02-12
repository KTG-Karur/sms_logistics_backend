"use strict";

const Validator = require("fastest-validator");
const { verifyToken } = require("../middleware/auth");
const { ResponseEntry } = require("../helpers/construct-response");
const responseCode = require("../helpers/status-code");
const messages = require("../helpers/message");
const locationServices = require("../service/location-service");
const _ = require("lodash");

const schema = {
  locationName: {
    type: "string",
    min: 2,
    max: 100,
    optional: false,
    messages: {
      stringEmpty: "Location name is required",
      stringMin: "Location name must be at least 2 characters",
      stringMax: "Location name cannot exceed 100 characters"
    }
  },
  officeCenterId: {
    type: "string",
    optional: false,
    messages: {
      stringEmpty: "Office center ID is required"
    }
  }
};

async function getLocation(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    responseEntries.data = await locationServices.getLocation(req.query);
    
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

async function getLocationById(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    if (!req.params.locationId) {
      throw new Error("Location ID is required");
    }
    
    responseEntries.data = await locationServices.getLocationById(req.params.locationId);
    
    if (!responseEntries.data) {
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

async function getLocationsByOfficeCenter(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    if (!req.params.officeCenterId) {
      throw new Error("Office center ID is required");
    }
    
    responseEntries.data = await locationServices.getLocationsByOfficeCenter(req.params.officeCenterId);
    
    if (!responseEntries.data || responseEntries.data.length === 0) {
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

async function createLocation(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();
  
  try {
    const validationResponse = await v.validate(req.body, schema);
    
    if (validationResponse != true) {
      const errorMessage = validationResponse.map(err => err.message).join(', ');
      throw new Error(errorMessage);
    } else {
      responseEntries.data = await locationServices.createLocation(req.body);
      
      if (!responseEntries.data) {
        responseEntries.message = messages.DATA_NOT_FOUND;
      } else {
        responseEntries.message = "Location created successfully";
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

async function updateLocation(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();
  
  try {
    if (!req.params.locationId) {
      throw new Error("Location ID is required");
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
      responseEntries.data = await locationServices.updateLocation(
        req.params.locationId,
        req.body
      );
      
      if (!responseEntries.data) {
        responseEntries.message = messages.DATA_NOT_FOUND;
      } else {
        responseEntries.message = "Location updated successfully";
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

async function deleteLocation(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    if (!req.params.locationId) {
      throw new Error("Location ID is required");
    }
    
    responseEntries.data = await locationServices.deleteLocation(req.params.locationId);
    responseEntries.message = "Location deleted successfully";
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
    url: "/locations",
    // preHandler: verifyToken,
    handler: getLocation,
  });
  
  fastify.route({
    method: "GET",
    url: "/locations/:locationId",
    // preHandler: verifyToken,
    handler: getLocationById,
  });
  
  fastify.route({
    method: "GET",
    url: "/office-centers/:officeCenterId/locations",
    // preHandler: verifyToken,
    handler: getLocationsByOfficeCenter,
  });
  
  fastify.route({
    method: "POST",
    url: "/locations",
    // preHandler: verifyToken,
    handler: createLocation,
  });
  
  fastify.route({
    method: "PUT",
    url: "/locations/:locationId",
    // preHandler: verifyToken,
    handler: updateLocation,
  });
  
  fastify.route({
    method: "DELETE",
    url: "/locations/:locationId",
    // preHandler: verifyToken,
    handler: deleteLocation,
  });
};