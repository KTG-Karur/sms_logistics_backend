"use strict";
const Validator = require("fastest-validator");
const { verifyToken } = require("../middleware/auth");
const { ResponseEntry } = require("../helpers/construct-response");
const responseCode = require("../helpers/status-code");
const messages = require("../helpers/message");
const extraIncomeServices = require("../service/extra-income-service");
const _ = require("lodash");

const schema = {
  income_date: { 
    type: "string", 
    pattern: "^\\d{4}-\\d{2}-\\d{2}$",
    optional: false,
    messages: {
      stringPattern: "Income date must be in YYYY-MM-DD format"
    }
  },
  officeCenterId: { 
    type: "string", 
    optional: false,
    min: 1,
    messages: {
      stringMin: "Office center is required"
    }
  },
  amount: { 
    type: "number", 
    positive: true, 
    min: 0,
    optional: false,
    messages: {
      numberMin: "Amount must be greater than or equal to 0",
      numberPositive: "Amount must be a positive number"
    }
  },
  incomeType: { 
    type: "enum", 
    values: ['cash', 'upi', 'bank_transfer', 'cheque', 'other'],
    optional: false,
    default: 'cash',
    messages: {
      enumValue: "Invalid income type. Must be one of: cash, upi, bank_transfer, cheque, other"
    }
  },
  description: { 
    type: "string", 
    optional: true,
    max: 500
  }
};

async function getExtraIncomes(req, res) {
  const responseEntries = new ResponseEntry();
  try {
    responseEntries.data = await extraIncomeServices.getExtraIncomes(req.query);
    if (!responseEntries.data || responseEntries.data.total === 0) {
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

async function getExtraIncomeById(req, res) {
  const responseEntries = new ResponseEntry();
  try {
    if (!req.params.extraIncomeId) {
      throw new Error("Extra income ID is required");
    }
    
    responseEntries.data = await extraIncomeServices.getExtraIncomeById(req.params.extraIncomeId);
    if (!responseEntries.data) {
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

async function createExtraIncome(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();
  try {
    if (req.user && req.user.employee_id) {
      req.body.created_by = req.user.employee_id;
    }
    
    const validationResponse = await v.validate(req.body, schema);
    if (validationResponse !== true) {
      const errorMessage = validationResponse.map(err => err.message).join(', ');
      throw new Error(errorMessage);
    }
    
    responseEntries.data = await extraIncomeServices.createExtraIncome(req.body);
    responseEntries.message = "Extra income created successfully";
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message = error.message ? error.message : error;
    responseEntries.code = responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    res.send(responseEntries);
  }
}

async function updateExtraIncome(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();
  try {
    if (!req.params.extraIncomeId) {
      throw new Error("Extra income ID is required");
    }
    
    if (req.user && req.user.employee_id) {
      req.body.updated_by = req.user.employee_id;
    }
    
    const updateSchema = _.pick(schema, Object.keys(req.body));
    if (Object.keys(updateSchema).length === 0) {
      throw new Error("No valid fields to update");
    }
    
    const validationResponse = v.validate(req.body, updateSchema);
    if (validationResponse !== true) {
      const errorMessage = validationResponse.map(err => err.message).join(', ');
      throw new Error(errorMessage);
    }
    
    responseEntries.data = await extraIncomeServices.updateExtraIncome(
      req.params.extraIncomeId,
      req.body
    );
    responseEntries.message = "Extra income updated successfully";
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message = error.message ? error.message : error;
    responseEntries.code = responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    res.send(responseEntries);
  }
}

async function deleteExtraIncome(req, res) {
  const responseEntries = new ResponseEntry();
  try {
    if (!req.params.extraIncomeId) {
      throw new Error("Extra income ID is required");
    }
    
    responseEntries.data = await extraIncomeServices.deleteExtraIncome(req.params.extraIncomeId);
    responseEntries.message = "Extra income deleted successfully";
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
    url: "/extra-incomes",
    preHandler: verifyToken,
    handler: getExtraIncomes,
  });

  fastify.route({
    method: "GET",
    url: "/extra-incomes/:extraIncomeId",
    preHandler: verifyToken,
    handler: getExtraIncomeById,
  });

  fastify.route({
    method: "POST",
    url: "/extra-incomes",
    preHandler: verifyToken,
    handler: createExtraIncome,
  });

  fastify.route({
    method: "PUT",
    url: "/extra-incomes/:extraIncomeId",
    preHandler: verifyToken,
    handler: updateExtraIncome,
  });

  fastify.route({
    method: "DELETE",
    url: "/extra-incomes/:extraIncomeId",
    preHandler: verifyToken,
    handler: deleteExtraIncome,
  });
};