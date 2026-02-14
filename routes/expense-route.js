"use strict";
const Validator = require("fastest-validator");
const { verifyToken } = require("../middleware/auth");
const { ResponseEntry } = require("../helpers/construct-response");
const responseCode = require("../helpers/status-code");
const messages = require("../helpers/message");
const expenseServices = require("../service/expense-service");
const _ = require("lodash");

const schema = {
  expenseDate: { 
    type: "string", 
    pattern: "^\\d{4}-\\d{2}-\\d{2}$",
    optional: false,
    messages: {
      stringPattern: "Expense date must be in YYYY-MM-DD format"
    }
  },
  expenseTypeId: { 
    type: "string", 
    optional: false,
    min: 1,
    messages: {
      stringMin: "Expense type is required"
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
  description: { 
    type: "string", 
    optional: true,
    max: 500
  },
  // Optional payment fields
  payment: {
    type: "object",
    optional: true,
    props: {
      paymentDate: { 
        type: "string", 
        pattern: "^\\d{4}-\\d{2}-\\d{2}$",
        optional: false,
        messages: {
          stringPattern: "Payment date must be in YYYY-MM-DD format"
        }
      },
      amount: { 
        type: "number", 
        positive: true, 
        min: 0.01,
        optional: false,
        messages: {
          numberMin: "Payment amount must be greater than 0",
          numberPositive: "Payment amount must be a positive number"
        }
      },
      paymentType: { 
        type: "enum", 
        values: ['cash', 'gpay', 'bank_transfer', 'cheque', 'other'],
        optional: false,
        default: 'cash',
        messages: {
          enumValue: "Invalid payment type"
        }
      },
      notes: { 
        type: "string", 
        optional: true,
        max: 500
      }
    }
  }
};

async function getExpenses(req, res) {
  const responseEntries = new ResponseEntry();
  try {
    responseEntries.data = await expenseServices.getExpenses(req.query);
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

async function createExpense(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();
  try {
    // Add created_by from token if available
    if (req.user && req.user.employee_id) {
      req.body.created_by = req.user.employee_id;
      // If payment exists, add created_by to payment as well
      if (req.body.payment) {
        req.body.payment.created_by = req.user.employee_id;
      }
    }
    
    const validationResponse = await v.validate(req.body, schema);
    if (validationResponse !== true) {
      const errorMessage = validationResponse.map(err => err.message).join(', ');
      throw new Error(errorMessage);
    }
    
    // If payment is provided, validate payment amount doesn't exceed expense amount
    if (req.body.payment && req.body.payment.amount > req.body.amount) {
      throw new Error("Payment amount cannot exceed expense amount");
    }
    
    responseEntries.data = await expenseServices.createExpense(req.body);
    responseEntries.message = req.body.payment 
      ? "Expense created with payment successfully" 
      : "Expense created successfully";
    
    // Check if expense is now fully paid (if payment was provided)
    if (req.body.payment && responseEntries.data.payment_summary?.is_fully_paid) {
      responseEntries.message = "Expense created and fully paid!";
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

async function updateExpense(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();
  try {
    if (!req.params.expenseId) {
      throw new Error("Expense ID is required");
    }
    
    // Add updated_by from token if available
    if (req.user && req.user.employee_id) {
      req.body.updated_by = req.user.employee_id;
      // If payment exists, add created_by to payment as well
      if (req.body.payment) {
        req.body.payment.created_by = req.user.employee_id;
      }
    }
    
    // For update, we only validate the fields that are present
    const updateSchema = _.pick(schema, Object.keys(req.body));
    if (Object.keys(updateSchema).length === 0 && !req.body.payment) {
      throw new Error("No valid fields to update");
    }
    
    // If payment is provided, validate it separately
    if (req.body.payment) {
      const paymentValidation = v.validate(req.body.payment, schema.payment.props);
      if (paymentValidation !== true) {
        const errorMessage = paymentValidation.map(err => err.message).join(', ');
        throw new Error(`Payment validation failed: ${errorMessage}`);
      }
    }
    
    // Validate other fields if present
    if (Object.keys(updateSchema).length > 0) {
      const validationResponse = v.validate(req.body, updateSchema);
      if (validationResponse !== true) {
        const errorMessage = validationResponse.map(err => err.message).join(', ');
        throw new Error(errorMessage);
      }
    }
    
    responseEntries.data = await expenseServices.updateExpense(
      req.params.expenseId,
      req.body
    );
    responseEntries.message = req.body.payment 
      ? "Expense updated with payment successfully" 
      : "Expense updated successfully";
    
    // Check if expense is now fully paid (if payment was provided)
    if (req.body.payment && responseEntries.data.payment_summary?.is_fully_paid) {
      responseEntries.message = "Expense updated and fully paid!";
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

async function deleteExpense(req, res) {
  const responseEntries = new ResponseEntry();
  try {
    if (!req.params.expenseId) {
      throw new Error("Expense ID is required");
    }
    
    responseEntries.data = await expenseServices.deleteExpense(req.params.expenseId);
    responseEntries.message = "Expense deleted successfully";
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message = error.message ? error.message : error;
    responseEntries.code = error.code ? error.code : responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    res.send(responseEntries);
  }
}

// Keep this for viewing payments
async function getExpensePayments(req, res) {
  const responseEntries = new ResponseEntry();
  try {
    if (!req.params.expenseId) {
      throw new Error("Expense ID is required");
    }
    
    responseEntries.data = await expenseServices.getExpensePayments(req.params.expenseId);
    
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

// Keep this for viewing expense details
async function getExpenseWithDetails(req, res) {
  const responseEntries = new ResponseEntry();
  try {
    if (!req.params.expenseId) {
      throw new Error("Expense ID is required");
    }
    
    responseEntries.data = await expenseServices.getExpenseWithDetails(req.params.expenseId);
    
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

// Keep this for deleting payments
async function deleteExpensePayment(req, res) {
  const responseEntries = new ResponseEntry();
  try {
    if (!req.params.expenseId || !req.params.paymentId) {
      throw new Error("Expense ID and Payment ID are required");
    }
    
    responseEntries.data = await expenseServices.deleteExpensePayment(
      req.params.expenseId, 
      req.params.paymentId
    );
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

module.exports = async function (fastify) {
  // GET /expenses - Get all expenses with filters
  fastify.route({
    method: "GET",
    url: "/expenses",
    // preHandler: verifyToken,
    handler: getExpenses,
  });

  // GET /expenses/:expenseId - Get single expense with all details
  fastify.route({
    method: "GET",
    url: "/expenses/:expenseId",
    // preHandler: verifyToken,
    handler: getExpenseWithDetails,
  });

  // GET /expenses/:expenseId/payments - Get all payments for an expense
  fastify.route({
    method: "GET",
    url: "/expenses/:expenseId/payments",
    // preHandler: verifyToken,
    handler: getExpensePayments,
  });

  // POST /expenses - Create new expense (with optional payment)
  fastify.route({
    method: "POST",
    url: "/expenses",
    // preHandler: verifyToken,
    handler: createExpense,
  });

  // PUT /expenses/:expenseId - Update expense (with optional payment)
  fastify.route({
    method: "PUT",
    url: "/expenses/:expenseId",
    // preHandler: verifyToken,
    handler: updateExpense,
  });

  // DELETE /expenses/:expenseId - Delete expense
  fastify.route({
    method: "DELETE",
    url: "/expenses/:expenseId",
    // preHandler: verifyToken,
    handler: deleteExpense,
  });

  // DELETE /expenses/:expenseId/payments/:paymentId - Delete a payment
  fastify.route({
    method: "DELETE",
    url: "/expenses/:expenseId/payments/:paymentId",
    // preHandler: verifyToken,
    handler: deleteExpensePayment,
  });
};