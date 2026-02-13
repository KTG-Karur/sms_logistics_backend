"use strict";

const Validator = require("fastest-validator");
const { verifyToken } = require("../middleware/auth");
const { ResponseEntry } = require("../helpers/construct-response");
const responseCode = require("../helpers/status-code");
const messages = require("../helpers/message");
const officeCenterServices = require("../service/office-center-service");
const _ = require("lodash");

const schema = {
  officeCenterName: {
    type: "string",
    min: 2,
    max: 100,
    optional: false,
    messages: {
      stringEmpty: "Office center name is required",
      stringMin: "Office center name must be at least 2 characters",
      stringMax: "Office center name cannot exceed 100 characters"
    }
  }
};

async function getOfficeCenter(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    responseEntries.data = await officeCenterServices.getOfficeCenter(req.query);
    
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

async function getOfficeCenterById(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    if (!req.params.officeCenterId) {
      throw new Error("Office center ID is required");
    }
    
    responseEntries.data = await officeCenterServices.getOfficeCenterById(req.params.officeCenterId);
    
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

async function createOfficeCenter(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();
  
  try {
    const validationResponse = await v.validate(req.body, schema);
    
    if (validationResponse != true) {
      const errorMessage = validationResponse.map(err => err.message).join(', ');
      throw new Error(errorMessage);
    } else {
      responseEntries.data = await officeCenterServices.createOfficeCenter(req.body);
      
      if (!responseEntries.data) {
        responseEntries.message = messages.DATA_NOT_FOUND;
      } else {
        responseEntries.message = "Office center created successfully";
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

async function updateOfficeCenter(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();
  
  try {
    if (!req.params.officeCenterId) {
      throw new Error("Office center ID is required");
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
      responseEntries.data = await officeCenterServices.updateOfficeCenter(
        req.params.officeCenterId,
        req.body
      );
      
      if (!responseEntries.data) {
        responseEntries.message = messages.DATA_NOT_FOUND;
      } else {
        responseEntries.message = "Office center updated successfully";
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

async function deleteOfficeCenter(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    if (!req.params.officeCenterId) {
      throw new Error("Office center ID is required");
    }
    
    responseEntries.data = await officeCenterServices.deleteOfficeCenter(req.params.officeCenterId);
    responseEntries.message = "Office center deleted successfully";
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message = error.message ? error.message : error;
    responseEntries.code = error.code ? error.code : responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    res.send(responseEntries);
  }
}

/**
 * Get all office centers with their locations
 * Supports filtering by office center ID and search
 */
async function getAllOfficeCentersWithLocations(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    responseEntries.data = await officeCenterServices.getAllOfficeCentersWithLocations(req.query);
    
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

/**
 * Get office center by ID with locations
 */
async function getOfficeCenterWithLocationsById(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    if (!req.params.officeCenterId) {
      throw new Error("Office center ID is required");
    }
    
    responseEntries.data = await officeCenterServices.getOfficeCenterWithLocationsById(req.params.officeCenterId);
    
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


module.exports = async function (fastify) {
  fastify.route({
    method: "GET",
    url: "/office-centers",
    // preHandler: verifyToken,
    handler: getOfficeCenter,
  });
  
  fastify.route({
    method: "GET",
    url: "/office-centers/:officeCenterId",
    // preHandler: verifyToken,
    handler: getOfficeCenterById,
  });
  
  fastify.route({
    method: "POST",
    url: "/office-centers",
    // preHandler: verifyToken,
    handler: createOfficeCenter,
  });
  
  fastify.route({
    method: "PUT",
    url: "/office-centers/:officeCenterId",
    // preHandler: verifyToken,
    handler: updateOfficeCenter,
  });
  
  fastify.route({
    method: "DELETE",
    url: "/office-centers/:officeCenterId",
    // preHandler: verifyToken,
    handler: deleteOfficeCenter,
  });

   fastify.route({
    method: "GET",
    url: "/office-centers/with-locations/all",
    // preHandler: verifyToken,
    handler: getAllOfficeCentersWithLocations,
  });
  
  fastify.route({
    method: "GET",
    url: "/office-centers/:officeCenterId/with-locations",
    // preHandler: verifyToken,
    handler: getOfficeCenterWithLocationsById,
  });
};