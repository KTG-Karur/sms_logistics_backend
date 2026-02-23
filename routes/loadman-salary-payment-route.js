"use strict";

const { verifyToken } = require("../middleware/auth");
const { ResponseEntry } = require("../helpers/construct-response");
const responseCode = require("../helpers/status-code");
const messages = require("../helpers/message");
const loadmanSalaryPaymentService = require("../service/loadman-salary-payment-service");
const Validator = require("fastest-validator");
const _ = require("lodash");
const { Op } = require("sequelize");

const paymentSchema = {
  loadmanId: {
    type: "string",
    optional: false,
    messages: {
      stringEmpty: "Loadman ID is required"
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
  officeCenterId: {
    type: "string",
    optional: false,
    messages: {
      stringEmpty: "Office center ID is required"
    }
  },
  payUntilDate: {
    type: "string",
    optional: false,
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    messages: {
      stringEmpty: "Pay until date is required",
      stringPattern: "Pay until date must be in YYYY-MM-DD format"
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

const dateRangeSchema = {
  loadmanId: { type: "string", optional: true },
  startDate: { 
    type: "string", 
    optional: true,
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    messages: {
      stringPattern: "Start date must be in YYYY-MM-DD format"
    }
  },
  endDate: { 
    type: "string", 
    optional: true,
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    messages: {
      stringPattern: "End date must be in YYYY-MM-DD format"
    }
  },
  upToDate: {
    type: "string", 
    optional: true,
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    messages: {
      stringPattern: "Up to date must be in YYYY-MM-DD format"
    }
  },
  status: { 
    type: "enum", 
    values: ["paid", "pending", "partial", null], 
    optional: true 
  },
  search: {
    type: "string",
    optional: true
  },
  page: { 
    type: "number", 
    optional: true, 
    positive: true, 
    integer: true, 
    default: 1, 
    convert: true 
  },
  limit: { 
    type: "number", 
    optional: true, 
    positive: true, 
    integer: true, 
    default: 20, 
    convert: true 
  }
};

// Calculate daily salary for loadman
async function calculateDailySalary(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    const { loadmanId, date } = req.params;
    
    if (!loadmanId || !date) {
      throw new Error("Loadman ID and date are required");
    }
    
    const includeDetails = req.query.includeDetails !== 'false';
    
    responseEntries.data = await loadmanSalaryPaymentService.calculateLoadmanDailySalary(
      loadmanId, 
      date, 
      includeDetails
    );
    
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

// Process loadman salary payment (pay all outstanding up to a date)
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
    
    responseEntries.data = await loadmanSalaryPaymentService.processLoadmanSalaryPayment(req.body);
    responseEntries.message = "Loadman salary payment processed successfully";
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message = error.message || error;
    responseEntries.code = responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    res.send(responseEntries);
  }
}

// Get loadman salary summary (detailed view with daily breakdown)
async function getSalarySummary(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();
  
  try {
    const validationResponse = await v.validate(req.query, dateRangeSchema);
    
    if (validationResponse != true) {
      const errorMessage = validationResponse.map(err => err.message).join(', ');
      throw new Error(errorMessage);
    }
    
    const { loadmanId, startDate, endDate, status, page, limit } = req.query;
    
    if (loadmanId) {
      // Get detailed view for specific loadman
      if (!startDate || !endDate) {
        throw new Error("Start date and end date are required for loadman details");
      }
      responseEntries.data = await loadmanSalaryPaymentService.getLoadmanSalaryDetail(
        loadmanId, 
        startDate, 
        endDate
      );
    } else {
      // Get summary for all loadmen
      responseEntries.data = await loadmanSalaryPaymentService.getLoadmanSalarySummary({
        startDate,
        endDate,
        status,
        page,
        limit
      });
    }
    
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

// Get all loadmen salary summary (simplified view)
async function getAllLoadmenSalarySummary(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();
  
  try {
    const validationResponse = await v.validate(req.query, dateRangeSchema);
    
    if (validationResponse != true) {
      const errorMessage = validationResponse.map(err => err.message).join(', ');
      throw new Error(errorMessage);
    }
    
    const { startDate, endDate, status, search } = req.query;
    
    responseEntries.data = await loadmanSalaryPaymentService.getAllLoadmenSalarySummary({
      startDate,
      endDate,
      status,
      search
    });
    
    if (!responseEntries.data || responseEntries.data.loadmen.length === 0) {
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

// Get loadman expense summary
async function getExpenseSummary(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    const { loadmanId, startDate, endDate, officeCenterId } = req.query;
    
    const loadmanExpenseTypeId = await loadmanSalaryPaymentService.getLoadmanExpenseTypeId();
    
    const whereClause = {
      expense_type_id: loadmanExpenseTypeId,
      is_active: 1
    };
    
    if (loadmanId) {
      whereClause.employee_id = loadmanId;
    }
    
    if (officeCenterId) {
      whereClause.office_center_id = officeCenterId;
    }
    
    if (startDate && endDate) {
      whereClause.expense_date = {
        [Op.between]: [startDate, endDate]
      };
    }
    
    const Expense = require("../models").Expense;
    const Employee = require("../models").Employee;
    const OfficeCenter = require("../models").OfficeCenter;
    const ExpensePayment = require("../models").ExpensePayment;
    
    const expenses = await Expense.findAll({
      where: whereClause,
      attributes: [
        'expense_id',
        'expense_date',
        'amount',
        'paid_amount',
        'is_paid',
        'description'
      ],
      include: [
        {
          model: Employee,
          as: 'employee',
          attributes: ['employee_id', 'employee_name']
        },
        {
          model: OfficeCenter,
          as: 'officeCenter',
          attributes: ['office_center_id', 'office_center_name']
        },
        {
          model: ExpensePayment,
          as: 'payments',
          where: { is_active: 1 },
          required: false,
          attributes: [
            'expense_payment_id',
            'payment_date',
            'amount',
            'payment_type',
            'notes'
          ]
        }
      ],
      order: [['expense_date', 'DESC']]
    });
    
    const totalAmount = expenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
    const totalPaid = expenses.reduce((sum, e) => sum + parseFloat(e.paid_amount || 0), 0);
    
    responseEntries.data = {
      summary: {
        totalExpenses: expenses.length,
        totalAmount: totalAmount.toFixed(2),
        totalPaid: totalPaid.toFixed(2),
        totalPending: (totalAmount - totalPaid).toFixed(2)
      },
      expenses
    };
    
    if (!responseEntries.data || responseEntries.data.expenses.length === 0) {
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

// Get loadman payment history
async function getPaymentHistory(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    responseEntries.data = await loadmanSalaryPaymentService.getLoadmanPayments(req.query);
    
    if (!responseEntries.data || responseEntries.data.data.length === 0) {
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

// Get single payment by ID
async function getPaymentById(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    const { paymentId } = req.params;
    
    if (!paymentId) {
      throw new Error("Payment ID is required");
    }
    
    const loadmanExpenseTypeId = await loadmanSalaryPaymentService.getLoadmanExpenseTypeId();
    
    const Expense = require("../models").Expense;
    const ExpensePayment = require("../models").ExpensePayment;
    const Employee = require("../models").Employee;
    const OfficeCenter = require("../models").OfficeCenter;
    
    const payment = await ExpensePayment.findOne({
      where: {
        expense_payment_id: paymentId,
        is_active: 1
      },
      include: [
        {
          model: Expense,
          as: 'expense',
          required: true,
          where: {
            expense_type_id: loadmanExpenseTypeId
          },
          attributes: [
            'expense_id',
            'expense_date',
            'amount',
            'paid_amount',
            'is_paid',
            'description',
            'employee_id',
            'office_center_id'
          ],
          include: [
            {
              model: Employee,
              as: 'employee',
              attributes: ['employee_id', 'employee_name']
            },
            {
              model: OfficeCenter,
              as: 'officeCenter',
              attributes: ['office_center_id', 'office_center_name']
            }
          ]
        }
      ],
      attributes: [
        'expense_payment_id',
        'payment_date',
        'amount',
        'payment_type',
        'notes',
        'created_at',
        'created_by'
      ]
    });
    
    if (!payment) {
      throw new Error(messages.DATA_NOT_FOUND);
    }
    
    responseEntries.data = payment;
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
  // Calculate daily salary for loadman
  fastify.route({
    method: "GET",
    url: "/loadman-salary/calculate/daily/:loadmanId/:date",
    // preHandler: verifyToken,
    handler: calculateDailySalary,
  });
  
  // Process loadman salary payment (pay all outstanding up to a date)
  fastify.route({
    method: "POST",
    url: "/loadman-salary/payment",
    // preHandler: verifyToken,
    handler: processSalaryPayment,
  });
  
  // Get loadman salary summary (detailed with daily breakdown)
  fastify.route({
    method: "GET",
    url: "/loadman-salary/summary",
    // preHandler: verifyToken,
    handler: getSalarySummary,
  });
  
  // Get all loadmen salary summary (simplified view)
  fastify.route({
    method: "GET",
    url: "/loadman-salary/all-summary",
    // preHandler: verifyToken,
    handler: getAllLoadmenSalarySummary,
  });
  
  // Get loadman expense summary
  fastify.route({
    method: "GET",
    url: "/loadman-salary/expenses",
    // preHandler: verifyToken,
    handler: getExpenseSummary,
  });
  
  // Get loadman payment history
  fastify.route({
    method: "GET",
    url: "/loadman-salary/payments",
    // preHandler: verifyToken,
    handler: getPaymentHistory,
  });
  
  // Get single payment by ID
  fastify.route({
    method: "GET",
    url: "/loadman-salary/payments/:paymentId",
    // preHandler: verifyToken,
    handler: getPaymentById,
  });
};