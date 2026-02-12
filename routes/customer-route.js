"use strict";

const Validator = require("fastest-validator");
const { verifyToken } = require("../middleware/auth");
const { ResponseEntry } = require("../helpers/construct-response");
const responseCode = require("../helpers/status-code");
const messages = require("../helpers/message");
const customerServices = require("../service/customer-service");
const _ = require("lodash");

const schema = {
  customerName: {
    type: "string",
    min: 2,
    max: 100,
    optional: false,
    messages: {
      stringEmpty: "Customer name is required",
      stringMin: "Customer name must be at least 2 characters",
      stringMax: "Customer name cannot exceed 100 characters"
    }
  },
  customerNumber: {
    type: "string",
    min: 1,
    max: 50,
    optional: false,
    messages: {
      stringEmpty: "Customer number is required",
      stringMin: "Customer number must be at least 1 character",
      stringMax: "Customer number cannot exceed 50 characters"
    }
  }
};

async function getCustomer(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    responseEntries.data = await customerServices.getCustomer(req.query);
    
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

async function getCustomerById(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    if (!req.params.customerId) {
      throw new Error("Customer ID is required");
    }
    
    responseEntries.data = await customerServices.getCustomerById(req.params.customerId);
    
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

async function createCustomer(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();
  
  try {
    const validationResponse = await v.validate(req.body, schema);
    
    if (validationResponse != true) {
      const errorMessage = validationResponse.map(err => err.message).join(', ');
      throw new Error(errorMessage);
    } else {
      responseEntries.data = await customerServices.createCustomer(req.body);
      
      if (!responseEntries.data) {
        responseEntries.message = messages.DATA_NOT_FOUND;
      } else {
        responseEntries.message = "Customer created successfully";
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

async function updateCustomer(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();
  
  try {
    if (!req.params.customerId) {
      throw new Error("Customer ID is required");
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
      responseEntries.data = await customerServices.updateCustomer(
        req.params.customerId,
        req.body
      );
      
      if (!responseEntries.data) {
        responseEntries.message = messages.DATA_NOT_FOUND;
      } else {
        responseEntries.message = "Customer updated successfully";
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

async function deleteCustomer(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    if (!req.params.customerId) {
      throw new Error("Customer ID is required");
    }
    
    responseEntries.data = await customerServices.deleteCustomer(req.params.customerId);
    responseEntries.message = "Customer deleted successfully";
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
    url: "/customers",
    // preHandler: verifyToken,
    handler: getCustomer,
  });
  
  fastify.route({
    method: "GET",
    url: "/customers/:customerId",
    // preHandler: verifyToken,
    handler: getCustomerById,
  });
  
  fastify.route({
    method: "POST",
    url: "/customers",
    // preHandler: verifyToken,
    handler: createCustomer,
  });
  
  fastify.route({
    method: "PUT",
    url: "/customers/:customerId",
    // preHandler: verifyToken,
    handler: updateCustomer,
  });
  
  fastify.route({
    method: "DELETE",
    url: "/customers/:customerId",
    // preHandler: verifyToken,
    handler: deleteCustomer,
  });
};