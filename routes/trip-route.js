"use strict";

const Validator = require("fastest-validator");
const { verifyToken } = require("../middleware/auth");
const { ResponseEntry } = require("../helpers/construct-response");
const responseCode = require("../helpers/status-code");
const messages = require("../helpers/message");
const tripServices = require("../service/trip-service");
const _ = require("lodash");

const tripSchema = {
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
  vehicleId: {
    type: "string",
    optional: false,
    messages: {
      stringEmpty: "Vehicle is required"
    }
  },
  driverId: {
    type: "string",
    optional: false,
    messages: {
      stringEmpty: "Driver is required"
    }
  },
  bookingIds: {
    type: "array",
    optional: false,
    min: 1,
    items: "string",
    messages: {
      arrayMin: "At least one booking must be selected"
    }
  },
  loadmanIds: {
    type: "array",
    optional: false,
    min: 1,
    items: "string",
    messages: {
      arrayMin: "At least one loadman must be selected"
    }
  },
  tripDate: {
    type: "date",
    optional: false,
    convert: true,
    messages: {
      date: "Valid trip date is required"
    }
  },
  estimatedDeparture: {
    type: "string",
    optional: false,
    pattern: "^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$",
    messages: {
      stringPattern: "Departure time must be in HH:MM format"
    }
  },
  estimatedArrival: {
    type: "string",
    optional: false,
    pattern: "^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$",
    messages: {
      stringPattern: "Arrival time must be in HH:MM format"
    }
  },
  remarks: {
    type: "string",
    optional: true,
    max: 500
  }
};

const updateTripSchema = {
  fromCenterId: {
    type: "string",
    optional: true
  },
  toCenterId: {
    type: "string",
    optional: true
  },
  vehicleId: {
    type: "string",
    optional: true
  },
  driverId: {
    type: "string",
    optional: true
  },
  bookingIds: {
    type: "array",
    optional: true,
    min: 1,
    items: "string"
  },
  loadmanIds: {
    type: "array",
    optional: true,
    min: 1,
    items: "string"
  },
  tripDate: {
    type: "date",
    optional: true,
    convert: true
  },
  estimatedDeparture: {
    type: "string",
    optional: true,
    pattern: "^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$"
  },
  estimatedArrival: {
    type: "string",
    optional: true,
    pattern: "^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$"
  },
  remarks: {
    type: "string",
    optional: true,
    max: 500
  }
};

const statusUpdateSchema = {
  status: {
    type: "enum",
    values: ["scheduled", "in_progress", "completed", "cancelled"],
    optional: false,
    messages: {
      stringEmpty: "Status is required"
    }
  },
  actualDeparture: {
    type: "string",
    optional: true,
    pattern: "^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$"
  },
  actualArrival: {
    type: "string",
    optional: true,
    pattern: "^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$"
  }
};

async function getTrips(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    responseEntries.data = await tripServices.getTrips(req.query);
    
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

async function getTripById(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    if (!req.params.tripId) {
      throw new Error("Trip ID is required");
    }
    
    responseEntries.data = await tripServices.getTripById(req.params.tripId);
    
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

async function getAvailableBookings(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    responseEntries.data = await tripServices.getAvailableBookings();
    
    if (!responseEntries.data || responseEntries.data.length === 0) {
      responseEntries.message = "No available bookings found";
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

async function getAvailableVehicles(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    const tripDate = req.query.tripDate || new Date().toISOString().split('T')[0];
    responseEntries.data = await tripServices.getAvailableVehicles(tripDate);
    
    if (!responseEntries.data || responseEntries.data.length === 0) {
      responseEntries.message = "No available vehicles found";
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

async function getAvailableDrivers(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    const tripDate = req.query.tripDate || new Date().toISOString().split('T')[0];
    responseEntries.data = await tripServices.getAvailableDrivers(tripDate);
    
    if (!responseEntries.data || responseEntries.data.length === 0) {
      responseEntries.message = "No available drivers found";
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

async function getAvailableLoadmen(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    const tripDate = req.query.tripDate || new Date().toISOString().split('T')[0];
    responseEntries.data = await tripServices.getAvailableLoadmen(tripDate);
    
    if (!responseEntries.data || responseEntries.data.length === 0) {
      responseEntries.message = "No available loadmen found";
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

async function createTrip(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();
  
  try {
    const validationResponse = await v.validate(req.body, tripSchema);
    
    if (validationResponse != true) {
      const errorMessage = validationResponse.map(err => err.message).join(', ');
      throw new Error(errorMessage);
    }
    
    responseEntries.data = await tripServices.createTrip(req.body);
    responseEntries.message = "Trip created successfully";
    
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message = error.message ? error.message : error;
    responseEntries.code = responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    res.send(responseEntries);
  }
}

async function updateTrip(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();
  
  try {
    if (!req.params.tripId) {
      throw new Error("Trip ID is required");
    }
    
    const filteredSchema = _.pick(updateTripSchema, Object.keys(req.body));
    
    if (Object.keys(filteredSchema).length === 0) {
      throw new Error("No valid fields to update");
    }
    
    const validationResponse = v.validate(req.body, filteredSchema);
    
    if (validationResponse != true) {
      const errorMessage = validationResponse.map(err => err.message).join(', ');
      throw new Error(errorMessage);
    }
    
    responseEntries.data = await tripServices.updateTrip(req.params.tripId, req.body);
    responseEntries.message = "Trip updated successfully";
    
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message = error.message ? error.message : error;
    responseEntries.code = error.code ? error.code : responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    res.send(responseEntries);
  }
}

async function updateTripStatus(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();
  
  try {
    if (!req.params.tripId) {
      throw new Error("Trip ID is required");
    }
    
    const validationResponse = await v.validate(req.body, statusUpdateSchema);
    
    if (validationResponse != true) {
      const errorMessage = validationResponse.map(err => err.message).join(', ');
      throw new Error(errorMessage);
    }
    
    responseEntries.data = await tripServices.updateTripStatus(req.params.tripId, req.body);
    responseEntries.message = `Trip status updated to ${req.body.status}`;
    
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message = error.message ? error.message : error;
    responseEntries.code = error.code ? error.code : responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    res.send(responseEntries);
  }
}

async function deleteTrip(req, res) {
  const responseEntries = new ResponseEntry();
  
  try {
    if (!req.params.tripId) {
      throw new Error("Trip ID is required");
    }
    
    responseEntries.data = await tripServices.deleteTrip(req.params.tripId);
    responseEntries.message = "Trip deleted successfully";
    
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
  // Get endpoints
  fastify.route({
    method: "GET",
    url: "/trips",
    // preHandler: verifyToken,
    handler: getTrips,
  });
  
  fastify.route({
    method: "GET",
    url: "/trips/available/bookings",
    // preHandler: verifyToken,
    handler: getAvailableBookings,
  });
  
  fastify.route({
    method: "GET",
    url: "/trips/available/vehicles",
    // preHandler: verifyToken,
    handler: getAvailableVehicles,
  });
  
  fastify.route({
    method: "GET",
    url: "/trips/available/drivers",
    // preHandler: verifyToken,
    handler: getAvailableDrivers,
  });
  
  fastify.route({
    method: "GET",
    url: "/trips/available/loadmen",
    // preHandler: verifyToken,
    handler: getAvailableLoadmen,
  });
  
  fastify.route({
    method: "GET",
    url: "/trips/:tripId",
    // preHandler: verifyToken,
    handler: getTripById,
  });
  
  // Create endpoint
  fastify.route({
    method: "POST",
    url: "/trips",
    // preHandler: verifyToken,
    handler: createTrip,
  });
  
  // Update endpoints
  fastify.route({
    method: "PUT",
    url: "/trips/:tripId",
    // preHandler: verifyToken,
    handler: updateTrip,
  });
  
  fastify.route({
    method: "PATCH",
    url: "/trips/:tripId/status",
    // preHandler: verifyToken,
    handler: updateTripStatus,
  });
  
  // Delete endpoint
  fastify.route({
    method: "DELETE",
    url: "/trips/:tripId",
    // preHandler: verifyToken,
    handler: deleteTrip,
  });
};