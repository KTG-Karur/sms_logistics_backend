'use strict';

const Validator = require("fastest-validator");
const { verifyToken } = require("../middleware/auth");
const { ResponseEntry } = require("../helpers/construct-response");
const responseCode = require("../helpers/status-code");
const messages = require("../helpers/message");
const openingBalanceServices = require("../service/opening-balance-service");
const _ = require("lodash");

const schema = {
  date: {
    type: "string",
    pattern: "^\\d{4}-\\d{2}-\\d{2}$",
    optional: false,
    messages: {
      stringPattern: "Date must be in YYYY-MM-DD format",
      stringEmpty: "Date is required"
    }
  },
  officeCenterId: {
    type: "string",
    optional: false,
    messages: {
      stringEmpty: "Office center ID is required"
    }
  },
  openingBalance: {
    type: "number",
    positive: true,
    min: 0,
    optional: false,
    messages: {
      numberMin: "Opening balance cannot be negative",
      numberPositive: "Opening balance must be a positive number"
    }
  },
  notes: {
    type: "string",
    optional: true,
    max: 500
  }
};

const bulkSchema = {
  balances: {
    type: "array",
    items: {
      type: "object",
      props: {
        date: {
          type: "string",
          pattern: "^\\d{4}-\\d{2}-\\d{2}$",
          optional: false,
          messages: {
            stringPattern: "Date must be in YYYY-MM-DD format"
          }
        },
        officeCenterId: {
          type: "string",
          optional: false
        },
        openingBalance: {
          type: "number",
          positive: true,
          min: 0,
          optional: false
        },
        notes: {
          type: "string",
          optional: true,
          max: 500
        }
      }
    },
    min: 1,
    max: 1000,
    messages: {
      arrayMin: "At least one opening balance entry is required",
      arrayMax: "Cannot process more than 1000 entries at once"
    }
  }
};

async function getOpeningBalance(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    responseEntries.data = await openingBalanceServices.getOpeningBalance(req.query);
    
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

async function createOpeningBalance(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();
  
  try {
    const validationResponse = await v.validate(req.body, schema);
    
    if (validationResponse != true) {
      const errorMessage = validationResponse.map(err => err.message).join(', ');
      throw new Error(errorMessage);
    } else {
      responseEntries.data = await openingBalanceServices.createOpeningBalance(req.body);
      
      if (!responseEntries.data) {
        responseEntries.message = messages.DATA_NOT_FOUND;
      } else {
        responseEntries.message = "Opening balance created successfully";
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

async function bulkCreateOpeningBalances(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();
  
  try {
    if (!req.body.balances || !Array.isArray(req.body.balances)) {
      throw new Error("Request must contain a 'balances' array");
    }

    if (req.user && req.user.employee_id) {
      req.body.balances = req.body.balances.map(balance => ({
        ...balance,
        created_by: req.user.employee_id
      }));
    }

    const validationResponse = await v.validate(req.body, bulkSchema);
    
    if (validationResponse !== true) {
      const errorMessage = validationResponse.map(err => err.message).join(', ');
      throw new Error(errorMessage);
    }

    const result = await openingBalanceServices.bulkCreateOpeningBalances(req.body.balances);
    
    responseEntries.data = result;
    responseEntries.message = `${result.successful.length} opening balances created successfully. ${result.failed.length} failed.`;
    
    if (result.failed.length > 0) {
      responseEntries.warning = true;
      responseEntries.summary = {
        total_processed: req.body.balances.length,
        successful: result.successful.length,
        failed: result.failed.length,
        failure_reasons: [...new Set(result.failed.map(f => f.error))]
      };
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

async function updateOpeningBalance(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();
  
  try {
    if (!req.params.openingBalanceId) {
      throw new Error("Opening balance ID is required");
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
      responseEntries.data = await openingBalanceServices.updateOpeningBalance(
        req.params.openingBalanceId,
        req.body
      );
      
      if (!responseEntries.data) {
        responseEntries.message = messages.DATA_NOT_FOUND;
      } else {
        responseEntries.message = "Opening balance updated successfully";
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

async function deleteOpeningBalance(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    if (!req.params.openingBalanceId) {
      throw new Error("Opening balance ID is required");
    }
    
    responseEntries.data = await openingBalanceServices.deleteOpeningBalance(req.params.openingBalanceId);
    responseEntries.message = "Opening balance deleted successfully";
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
  // GET endpoint with query parameters for filtering
  fastify.route({
    method: "GET",
    url: "/opening-balances",
    // preHandler: verifyToken,
    handler: getOpeningBalance,
  });
  
  // Create single opening balance
  fastify.route({
    method: "POST",
    url: "/opening-balances",
    // preHandler: verifyToken,
    handler: createOpeningBalance,
  });
  
  // Bulk create opening balances
  fastify.route({
    method: "POST",
    url: "/opening-balances/bulk",
    // preHandler: verifyToken,
    handler: bulkCreateOpeningBalances,
  });
  
  // Update opening balance
  fastify.route({
    method: "PUT",
    url: "/opening-balances/:openingBalanceId",
    // preHandler: verifyToken,
    handler: updateOpeningBalance,
  });
  
  // Delete opening balance
  fastify.route({
    method: "DELETE",
    url: "/opening-balances/:openingBalanceId",
    // preHandler: verifyToken,
    handler: deleteOpeningBalance,
  });
};