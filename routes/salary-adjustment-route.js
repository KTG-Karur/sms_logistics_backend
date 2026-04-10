"use strict";

const Validator = require("fastest-validator");
const { verifyToken } = require("../middleware/auth");
const { ResponseEntry } = require("../helpers/construct-response");
const responseCode = require("../helpers/status-code");
const messages = require("../helpers/message");
const salaryAdjustmentServices = require("../service/salary-adjustment-service");
const _ = require("lodash");

const schema = {
  employeeId: {
    type: "string",
    optional: false,
    messages: {
      stringEmpty: "Employee ID is required"
    }
  },
  adjustmentDate: {
    type: "string",
    optional: false,
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    messages: {
      stringEmpty: "Adjustment date is required",
      stringPattern: "Adjustment date must be in YYYY-MM-DD format"
    }
  },
  type: {
    type: "enum",
    values: ["deduction", "extra"],
    optional: false,
    messages: {
      enumValue: "Type must be either 'deduction' or 'extra'"
    }
  },
  amount: {
    type: "number",
    positive: true,
    min: 0.01,
    optional: false,
    messages: {
      numberPositive: "Amount must be positive",
      numberMin: "Amount must be greater than 0"
    }
  },
  reason: {
    type: "string",
    optional: true,
    max: 255,
    messages: {
      stringMax: "Reason cannot exceed 255 characters"
    }
  },
  salaryMonth: {
    type: "string",
    optional: false,
    pattern: /^\d{4}-\d{2}$/,
    messages: {
      stringEmpty: "Salary month is required",
      stringPattern: "Salary month must be in YYYY-MM format"
    }
  }
};

async function getSalaryAdjustment(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    responseEntries.data = await salaryAdjustmentServices.getSalaryAdjustment(req.query);
    
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

async function createSalaryAdjustment(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();
  
  try {
    const validationResponse = await v.validate(req.body, schema);
    
    if (validationResponse != true) {
      const errorMessage = validationResponse.map(err => err.message).join(', ');
      throw new Error(errorMessage);
    } else {
      responseEntries.data = await salaryAdjustmentServices.createSalaryAdjustment(req.body);
      
      if (!responseEntries.data) {
        responseEntries.message = messages.DATA_NOT_FOUND;
      } else {
        responseEntries.message = "Salary adjustment created successfully";
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

async function updateSalaryAdjustment(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();
  
  try {
    if (!req.params.adjustmentId) {
      throw new Error("Adjustment ID is required");
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
      responseEntries.data = await salaryAdjustmentServices.updateSalaryAdjustment(
        req.params.adjustmentId,
        req.body
      );
      
      if (!responseEntries.data) {
        responseEntries.message = messages.DATA_NOT_FOUND;
      } else {
        responseEntries.message = "Salary adjustment updated successfully";
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

async function deleteSalaryAdjustment(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    if (!req.params.adjustmentId) {
      throw new Error("Adjustment ID is required");
    }
    
    responseEntries.data = await salaryAdjustmentServices.deleteSalaryAdjustment(req.params.adjustmentId);
    responseEntries.message = "Salary adjustment deleted successfully";
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
    url: "/salary-adjustments",
    preHandler: verifyToken,
    handler: getSalaryAdjustment,
  });
  
  fastify.route({
    method: "POST",
    url: "/salary-adjustments",
    preHandler: verifyToken,
    handler: createSalaryAdjustment,
  });
  
  fastify.route({
    method: "PUT",
    url: "/salary-adjustments/:adjustmentId",
    preHandler: verifyToken,
    handler: updateSalaryAdjustment,
  });
  
  fastify.route({
    method: "DELETE",
    url: "/salary-adjustments/:adjustmentId",
    preHandler: verifyToken,
    handler: deleteSalaryAdjustment,
  });
};