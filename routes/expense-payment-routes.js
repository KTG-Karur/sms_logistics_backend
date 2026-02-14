"use strict";
const Validator = require("fastest-validator");
const { ResponseEntry } = require("../helpers/construct-response");
const responseCode = require("../helpers/status-code");
const messages = require("../helpers/message");
const expensePaymentServices = require("../service/expense-payment-service");
const _ = require("lodash");

const schema = {
  expenseId: { 
    type: "string", 
    optional: false,
    messages: {
      required: "Expense ID is required"
    }
  },
  paymentDate: { 
    type: "string", 
    pattern: "^\\d{4}-\\d{2}-\\d{2}$",
    optional: false,
    messages: {
      stringPattern: "Payment date must be in YYYY-MM-DD format",
      required: "Payment date is required"
    }
  },
  amount: { 
    type: "number", 
    positive: true, 
    min: 0.01,
    optional: false,
    messages: {
      numberMin: "Amount must be greater than 0",
      numberPositive: "Amount must be a positive number",
      required: "Amount is required"
    }
  },
  paymentType: { 
    type: "enum", 
    values: ['cash', 'gpay', 'bank_transfer', 'cheque', 'other'],
    optional: false,
    default: 'cash',
    messages: {
      enumValue: "Invalid payment type",
      required: "Payment type is required"
    }
  },
  notes: { 
    type: "string", 
    optional: true,
    max: 500
  }
};

async function createExpensePayment(req, res) {
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
    
    responseEntries.data = await expensePaymentServices.createExpensePayment(req.body);
    responseEntries.message = "Payment added successfully";
    
    // Check if expense is now fully paid
    if (responseEntries.data.expense_status?.is_fully_paid) {
      responseEntries.message = "Payment added successfully. Expense is now fully paid!";
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

async function getExpensePaymentSummary(req, res) {
  const responseEntries = new ResponseEntry();
  try {
    if (!req.params.expenseId) {
      throw new Error("Expense ID is required");
    }
    
    responseEntries.data = await expensePaymentServices.getExpensePaymentSummary(req.params.expenseId);
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message = error.message ? error.message : error;
    responseEntries.code = responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    res.send(responseEntries);
  }
}

async function getPaymentsByExpenseId(req, res) {
  const responseEntries = new ResponseEntry();
  try {
    if (!req.params.expenseId) {
      throw new Error("Expense ID is required");
    }
    
    responseEntries.data = await expensePaymentServices.getPaymentsByExpenseId(req.params.expenseId);
    
    if (!responseEntries.data || responseEntries.data.length === 0) {
      responseEntries.message = "No payments found for this expense";
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

async function deleteExpensePayment(req, res) {
  const responseEntries = new ResponseEntry();
  try {
    if (!req.params.paymentId) {
      throw new Error("Payment ID is required");
    }
    
    responseEntries.data = await expensePaymentServices.deleteExpensePayment(req.params.paymentId);
    responseEntries.message = "Payment deleted successfully";
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message = error.message ? error.message : error;
    responseEntries.code = error.code ? error.code : responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    res.send(responseEntries);
  }
}

// Add this schema for bulk payments
const bulkPaymentSchema = {
  payments: {
    type: "array",
    items: {
      type: "object",
      props: {
        expenseId: { 
          type: "string", 
          optional: false,
          messages: {
            required: "Expense ID is required for each payment"
          }
        },
        paymentDate: { 
          type: "string", 
          pattern: "^\\d{4}-\\d{2}-\\d{2}$",
          optional: false,
          messages: {
            stringPattern: "Payment date must be in YYYY-MM-DD format",
            required: "Payment date is required"
          }
        },
        amount: { 
          type: "number", 
          positive: true, 
          min: 0.01,
          optional: false,
          messages: {
            numberMin: "Amount must be greater than 0",
            numberPositive: "Amount must be a positive number",
            required: "Amount is required"
          }
        },
        paymentType: { 
          type: "enum", 
          values: ['cash', 'gpay', 'bank_transfer', 'cheque', 'other'],
          optional: false,
          default: 'cash',
          messages: {
            enumValue: "Invalid payment type",
            required: "Payment type is required"
          }
        },
        notes: { 
          type: "string", 
          optional: true,
          max: 500
        }
      }
    },
    min: 1,
    max: 100,
    messages: {
      arrayMin: "At least one payment is required",
      arrayMax: "Cannot process more than 100 payments at once"
    }
  }
};

// Add this new controller method for bulk payment creation
async function bulkCreateExpensePayments(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();
  try {
    // Validate request body
    if (!req.body.payments || !Array.isArray(req.body.payments)) {
      throw new Error("Request must contain a 'payments' array");
    }

    // Add created_by from token if available to all payments
    if (req.user && req.user.employee_id) {
      req.body.payments = req.body.payments.map(payment => ({
        ...payment,
        created_by: req.user.employee_id
      }));
    }

    // Validate all payments
    const validationResponse = await v.validate(req.body, bulkPaymentSchema);
    if (validationResponse !== true) {
      const errorMessage = validationResponse.map(err => err.message).join(', ');
      throw new Error(errorMessage);
    }

    // Process bulk payments
    const result = await expensePaymentServices.bulkCreateExpensePayments(req.body.payments);
    
    responseEntries.data = result;
    responseEntries.message = `${result.successful.length} payments created successfully. ${result.failed.length} failed.`;
    
    // If there were failures, include them in the response
    if (result.failed.length > 0) {
      responseEntries.warning = true;
      responseEntries.failed_payments = result.failed;
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
  // Get payment summary for an expense
  fastify.route({
    method: "GET",
    url: "/expenses/:expenseId/payments/summary",
    // preHandler: verifyToken,
    handler: getExpensePaymentSummary,
  });

  // Get all payments for an expense
  fastify.route({
    method: "GET",
    url: "/expenses/:expenseId/payment",
    // preHandler: verifyToken,
    handler: getPaymentsByExpenseId,
  });

  // Create new payment
  fastify.route({
    method: "POST",
    url: "/expense-payments",
    // preHandler: verifyToken,
    handler: createExpensePayment,
  });

  // Delete payment
  fastify.route({
    method: "DELETE",
    url: "/expense-payments/:paymentId",
    // preHandler: verifyToken,
    handler: deleteExpensePayment,
  });

  // Add this new route for bulk payment creation
  fastify.route({
    method: "POST",
    url: "/expense-payments/bulk",
    // preHandler: verifyToken,
    handler: bulkCreateExpensePayments,
  });
};