"use strict";

const Validator = require("fastest-validator");
const { verifyToken } = require("../middleware/auth");
const { ResponseEntry } = require("../helpers/construct-response");
const responseCode = require("../helpers/status-code");
const messages = require("../helpers/message");
const bookingServices = require("../service/booking-service");
const _ = require("lodash");

const packageSchema = {
  packageTypeId: {
    type: "string",
    optional: false,
    messages: {
      stringEmpty: "Package type is required"
    }
  },
  quantity: {
    type: "number",
    optional: false,
    positive: true,
    integer: true,
    min: 1,
    messages: {
      numberMin: "Quantity must be at least 1"
    }
  },
  pickupCharge: {
    type: "number",
    optional: true,
    number: true,
    default: 0
  },
  dropCharge: {
    type: "number",
    optional: true,
    number: true,
    default: 0
  },
  handlingCharge: {
    type: "number",
    optional: true,
    number: true,
    default: 0
  }
};

const bookingSchema = {
  bookingNumber: {
    type: "string",
    optional: true,
    min: 5,
    max: 50
  },
  llrNumber: {
    type: "string",
    optional: true,
    min: 5,
    max: 50
  },
  bookingDate: {
    type: "date",
    optional: true,
    convert: true
  },
  fromCenterId: {
    type: "string",
    optional: false,
    messages: {
      stringEmpty: "From center is required"
    }
  },
  toCenterId: {
    type: "string",
    optional: false,
    messages: {
      stringEmpty: "To center is required"
    }
  },
  fromLocationId: {
    type: "string",
    optional: false,
    messages: {
      stringEmpty: "From location is required"
    }
  },
  toLocationId: {
    type: "string",
    optional: false,
    messages: {
      stringEmpty: "To location is required"
    }
  },
  fromCustomerId: {
    type: "string",
    optional: false,
    messages: {
      stringEmpty: "Sender customer is required"
    }
  },
  toCustomerId: {
    type: "string",
    optional: false,
    messages: {
      stringEmpty: "Receiver customer is required"
    }
  },
  paidAmount: {
    type: "number",
    optional: true,
    number: true,
    min: 0,
    default: 0
  },
  paymentMode: {
    type: "enum",
    values: ["cash", "card", "upi", "bank_transfer", "cheque", "wallet"],
    optional: true,
    default: "cash"
  },
  paymentBy: {
    type: "enum",
    values: ["sender", "receiver"],
    optional: true,
    default: "sender"
  },
  specialInstructions: {
    type: "string",
    optional: true,
    max: 500
  },
  referenceNumber: {
    type: "string",
    optional: true,
    max: 100
  },
  packages: {
    type: "array",
    optional: false,
    min: 1,
    items: {
      type: "object",
      props: packageSchema
    },
    messages: {
      arrayMin: "At least one package is required"
    }
  }
};

const deliveryStatusSchema = {
  deliveryStatus: {
    type: "enum",
    values: ["not_started", "pickup_assigned", "picked_up", "in_transit", "out_for_delivery", "delivered", "cancelled"],
    optional: false,
    messages: {
      stringEmpty: "Delivery status is required"
    }
  },
  actualDeliveryDate: {
    type: "date",
    optional: true,
    convert: true
  }
};
const paymentSchema = {
  amount: {
    type: "number",
    optional: false,
    positive: true,
    min: 0.01,
    messages: {
      numberMin: "Amount must be greater than 0",
      numberPositive: "Amount must be positive"
    }
  },
  paymentMode: {
    type: "enum",
    values: ["cash", "card", "upi", "bank_transfer", "cheque", "wallet"],
    optional: false,
    messages: {
      stringEmpty: "Payment mode is required"
    }
  },
  paymentDate: {
    type: "date",
    optional: true,
    convert: true
  },
  customerId: {
    type: "string",
    optional: true
  },
  description: {
    type: "string",
    optional: true,
    max: 500
  },
  collectedBy: {
    type: "string",
    optional: true
  },
  collectedAtCenter: {
    type: "string",
    optional: true
  }
};

async function addBookingPayment(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();
  
  try {
    if (!req.params.bookingId) {
      throw new Error("Booking ID is required");
    }
    
    const validationResponse = await v.validate(req.body, paymentSchema);
    
    if (validationResponse != true) {
      const errorMessage = validationResponse.map(err => err.message).join(', ');
      throw new Error(errorMessage);
    }
    
    responseEntries.data = await bookingServices.addBookingPayment(
      req.params.bookingId,
      req.body
    );
    
    responseEntries.message = "Payment added successfully";
    
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message = error.message ? error.message : error;
    responseEntries.code = error.code ? error.code : responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    res.send(responseEntries);
  }
}

async function getBooking(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    responseEntries.data = await bookingServices.getBooking(req.query);
    
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

async function getBookingById(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    if (!req.params.bookingId) {
      throw new Error("Booking ID is required");
    }
    
    responseEntries.data = await bookingServices.getBookingById(req.params.bookingId);
    
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

async function getBookingsByCustomer(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    if (!req.params.customerId) {
      throw new Error("Customer ID is required");
    }
    
    const type = req.query.type || 'sender';
    
    responseEntries.data = await bookingServices.getBookingsByCustomer(req.params.customerId, type);
    
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

async function createBooking(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();
  console.log("it hiting///////////////////////////////////////");
  
  try {
    const validationResponse = await v.validate(req.body, bookingSchema);
    
    if (validationResponse != true) {
      const errorMessage = validationResponse.map(err => err.message).join(', ');
      throw new Error(errorMessage);
    } else {
      responseEntries.data = await bookingServices.createBooking(req.body);
      
      if (!responseEntries.data) {
        responseEntries.message = messages.DATA_NOT_FOUND;
      } else {
        responseEntries.message = "Booking created successfully";
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

async function updateBooking(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();
  
  try {
    if (!req.params.bookingId) {
      throw new Error("Booking ID is required");
    }
    
    // Create a simplified schema for updates (only fields that can be updated)
    const updateSchema = {
      bookingDate: { type: "date", optional: true, convert: true },
      specialInstructions: { type: "string", optional: true, max: 500 },
      referenceNumber: { type: "string", optional: true, max: 100 }
    };
    
    const filteredSchema = _.pick(updateSchema, Object.keys(req.body));
    
    if (Object.keys(filteredSchema).length === 0) {
      throw new Error("No valid fields to update");
    }
    
    const validationResponse = v.validate(req.body, filteredSchema);
    
    if (validationResponse != true) {
      const errorMessage = validationResponse.map(err => err.message).join(', ');
      throw new Error(errorMessage);
    } else {
      responseEntries.data = await bookingServices.updateBooking(
        req.params.bookingId,
        req.body
      );
      
      if (!responseEntries.data) {
        responseEntries.message = messages.DATA_NOT_FOUND;
      } else {
        responseEntries.message = "Booking updated successfully";
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

async function updateDeliveryStatus(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();
  
  try {
    if (!req.params.bookingId) {
      throw new Error("Booking ID is required");
    }
    
    const validationResponse = v.validate(req.body, deliveryStatusSchema);
    
    if (validationResponse != true) {
      const errorMessage = validationResponse.map(err => err.message).join(', ');
      throw new Error(errorMessage);
    } else {
      responseEntries.data = await bookingServices.updateDeliveryStatus(
        req.params.bookingId,
        req.body.deliveryStatus,
        req.body.actualDeliveryDate
      );
      
      responseEntries.message = "Delivery status updated successfully";
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

async function deleteBooking(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    if (!req.params.bookingId) {
      throw new Error("Booking ID is required");
    }
    
    responseEntries.data = await bookingServices.deleteBooking(req.params.bookingId);
    responseEntries.message = "Booking deleted successfully";
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
    method: "POST",
    url: "/bookings/:bookingId/payments",
    // preHandler: verifyToken,
    handler: addBookingPayment,
  });

  
  fastify.route({
    method: "GET",
    url: "/bookings",
    // preHandler: verifyToken,
    handler: getBooking,
  });
  
  fastify.route({
    method: "GET",
    url: "/bookings/:bookingId",
    // preHandler: verifyToken,
    handler: getBookingById,
  });
  
  fastify.route({
    method: "GET",
    url: "/customers/:customerId/bookings",
    // preHandler: verifyToken,
    handler: getBookingsByCustomer,
  });
  
  fastify.route({
    method: "POST",
    url: "/bookings",
    // preHandler: verifyToken,
    handler: createBooking,
  });
  
  fastify.route({
    method: "PUT",
    url: "/bookings/:bookingId",
    // preHandler: verifyToken,
    handler: updateBooking,
  });
  
  fastify.route({
    method: "PATCH",
    url: "/bookings/:bookingId/delivery-status",
    // preHandler: verifyToken,
    handler: updateDeliveryStatus,
  });
  
  fastify.route({
    method: "DELETE",
    url: "/bookings/:bookingId",
    // preHandler: verifyToken,
    handler: deleteBooking,
  });
};