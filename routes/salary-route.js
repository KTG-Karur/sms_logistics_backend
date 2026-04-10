"use strict";

const { verifyToken } = require("../middleware/auth");
const { ResponseEntry } = require("../helpers/construct-response");
const responseCode = require("../helpers/status-code");
const messages = require("../helpers/message");
const salaryServices = require("../service/salary-service");
const Validator = require("fastest-validator");
const _ = require("lodash");

const paymentSchema = {
  employeeId: {
    type: "string",
    optional: false,
    messages: {
      stringEmpty: "Employee ID is required"
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
  paymentDate: {
    type: "string",
    optional: false,
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    messages: {
      stringEmpty: "Payment date is required",
      stringPattern: "Payment date must be in YYYY-MM-DD format"
    }
  },
  officeCenterId: {
    type: "string",
    optional: false,
    messages: {
      stringEmpty: "Office center ID is required"
    }
  },
  paymentType: {
    type: "enum",
    values: ["cash", "gpay", "bank_transfer", "cheque", "other"],
    optional: true,
    default: "cash"
  },
  notes: {
    type: "string",
    optional: true,
    max: 255
  }
};

async function calculateSalary(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    responseEntries.data = await salaryServices.calculateSalary(req.query);
    
    if (!responseEntries.data) {
      responseEntries.message = messages.DATA_NOT_FOUND;
    }
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message = error.message || error;
    responseEntries.code = responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    res.send(responseEntries);
  }
}

async function getSalarySummary(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    responseEntries.data = await salaryServices.getSalarySummary(req.query);
    
    if (!responseEntries.data || responseEntries.data.length === 0) {
      responseEntries.message = messages.DATA_NOT_FOUND;
    }
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message = error.message || error;
    responseEntries.code = responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    res.send(responseEntries);
  }
}

async function getEmployeeSalaryDetail(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    const { employeeId, salaryMonth } = req.params;
    
    if (!employeeId || !salaryMonth) {
      throw new Error("Employee ID and salary month are required");
    }
    
    responseEntries.data = await salaryServices.getEmployeeSalaryDetail(employeeId, salaryMonth);
    
    if (!responseEntries.data) {
      responseEntries.message = messages.DATA_NOT_FOUND;
    }
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message = error.message || error;
    responseEntries.code = responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    res.send(responseEntries);
  }
}

async function processSalaryPayment(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();
  
  try {
    // Add created_by from token if available
    if (req.user && req.user.employee_id) {
      req.body.createdBy = req.user.employee_id;
    }
    
    const validationResponse = await v.validate(req.body, paymentSchema);
    
    if (validationResponse != true) {
      const errorMessage = validationResponse.map(err => err.message).join(', ');
      throw new Error(errorMessage);
    }
    
    responseEntries.data = await salaryServices.processSalaryPayment(req.body);
    responseEntries.message = "Salary payment processed successfully";
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message = error.message || error;
    responseEntries.code = responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    res.send(responseEntries);
  }
}

async function getSalaryPayments(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    responseEntries.data = await salaryServices.getSalaryPayments(req.query);
    
    if (!responseEntries.data || responseEntries.data.length === 0) {
      responseEntries.message = messages.DATA_NOT_FOUND;
    }
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message = error.message || error;
    responseEntries.code = responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    res.send(responseEntries);
  }
}

async function getSalaryPaymentById(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    const { paymentId } = req.params;
    
    if (!paymentId) {
      throw new Error("Payment ID is required");
    }
    
    responseEntries.data = await salaryServices.getSalaryPaymentById(paymentId);
    
    if (!responseEntries.data) {
      responseEntries.message = messages.DATA_NOT_FOUND;
    }
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
    url: "/salary/calculate",
    preHandler: verifyToken,
    handler: calculateSalary,
  });
  
  fastify.route({
    method: "GET",
    url: "/salary/summary",
    preHandler: verifyToken,
    handler: getSalarySummary,
  });
  
  fastify.route({
    method: "GET",
    url: "/salary/employee/:employeeId/:salaryMonth",
    preHandler: verifyToken,
    handler: getEmployeeSalaryDetail,
  });
  
  fastify.route({
    method: "POST",
    url: "/salary/payment",
    preHandler: verifyToken,
    handler: processSalaryPayment,
  });
  
  fastify.route({
    method: "GET",
    url: "/salary/payments",
    preHandler: verifyToken,
    handler: getSalaryPayments,
  });
  
  fastify.route({
    method: "GET",
    url: "/salary/payments/:paymentId",
    preHandler: verifyToken,
    handler: getSalaryPaymentById,
  });
};