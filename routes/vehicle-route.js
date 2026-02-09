"use strict";

const Validator = require("fastest-validator");
const { verifyToken } = require("../middleware/auth");
const { ResponseEntry } = require("../helpers/construct-response");
const responseCode = require("../helpers/status-code");
const messages = require("../helpers/message");
const vehicleServices = require("../service/vehicle-service");
const { uploadImageToServer } = require("../helpers/upload");
const _ = require("lodash");
const { Vehicle } = require("../models");

const schema = {
  vehicleNumberPlate: {
    type: "string",
    min: 5,
    max: 20,
    optional: false,
    messages: {
      stringEmpty: "Vehicle number plate is required",
      stringMin: "Vehicle number plate must be at least 5 characters",
      stringMax: "Vehicle number plate cannot exceed 20 characters",
    },
  },
  vehicleTypeId: {
    type: "string",
    optional: false,
    messages: {
      stringEmpty: "Vehicle type is required",
    },
  },
  rcNumber: {
    type: "string",
    optional: false,
    messages: {
      stringEmpty: "RC number is required",
    },
  },
  rcExpiryDate: {
    type: "date",
    optional: false,
    convert: true,
    messages: {
      dateEmpty: "RC expiry date is required",
      date: "RC expiry date must be a valid date",
    },
  },
  insuranceNumber: {
    type: "string",
    optional: false,
    messages: {
      stringEmpty: "Insurance number is required",
    },
  },
  insuranceExpiryDate: {
    type: "date",
    optional: false,
    convert: true,
    messages: {
      dateEmpty: "Insurance expiry date is required",
      date: "Insurance expiry date must be a valid date",
    },
  },
  rcUpload: {
    type: "string",
    optional: true,
  },
};

// Helper function to extract values from Fastify multipart objects
function extractMultipartData(body) {
  const result = {};
  
  for (const key in body) {
    if (body[key] && typeof body[key] === 'object' && 'value' in body[key]) {
      // It's a field object from multipart
      result[key] = body[key].value;
    } else if (body[key] && typeof body[key] === 'object' && body[key].type === 'file') {
      // It's a file object - skip, will be processed separately
      continue;
    } else {
      // It's already a plain value
      result[key] = body[key];
    }
  }
  
  return result;
}

async function createVehicleWithUpload(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();

  try {
    // Check if this is a multipart request
    const contentType = req.headers['content-type'] || '';
    
    if (contentType.includes('multipart/form-data')) {
      console.log("Processing multipart request...");
      console.log("Raw request body:", req.body);
      
      // Extract form data from multipart objects
      const formData = extractMultipartData(req.body || {});
      console.log("Extracted form data:", formData);
      
      let rcFileInfo = null;
      
      // Check if there's a file in the request body
      if (req.body.rcDocument && req.body.rcDocument.type === 'file') {
        const filePart = req.body.rcDocument;
        try {
          const fileBuffer = await filePart.toBuffer();
          rcFileInfo = await uploadImageToServer({
            originalname: filePart.filename,
            mimetype: filePart.mimetype,
            buffer: fileBuffer
          }, 'vehicles/rc');
          
          if (rcFileInfo && rcFileInfo.url) {
            formData.rcUpload = rcFileInfo.url;
          }
        } catch (fileError) {
          console.error("Error processing file:", fileError);
          throw new Error("Failed to process uploaded file");
        }
      } else {
        // Also check req.files() for files that might not be in req.body
        const parts = await req.files();
        for await (const part of parts) {
          if (part.type === 'file' && (part.fieldname === 'rcDocument' || part.fieldname === 'rc_upload')) {
            const fileBuffer = await part.toBuffer();
            rcFileInfo = await uploadImageToServer({
              originalname: part.filename,
              mimetype: part.mimetype,
              buffer: fileBuffer
            }, 'vehicles/rc');
            
            if (rcFileInfo && rcFileInfo.url) {
              formData.rcUpload = rcFileInfo.url;
            }
          }
        }
      }

      console.log("Final form data for validation:", formData);

      // Validate form data
      const validationResponse = await v.validate(formData, schema);

      if (validationResponse !== true) {
        // Clean up uploaded file if validation fails
        if (rcFileInfo && rcFileInfo.path) {
          const fs = require("fs");
          const path = require("path");
          const filePath = path.join(process.cwd(), rcFileInfo.path);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
        
        const errorMessage = validationResponse
          .map((err) => err.message)
          .join(", ");
        throw new Error(errorMessage);
      }

      // Create vehicle with form data
      responseEntries.data = await vehicleServices.createVehicle(formData);

      if (!responseEntries.data) {
        // Clean up file if vehicle creation fails
        if (rcFileInfo && rcFileInfo.path) {
          const fs = require("fs");
          const path = require("path");
          const filePath = path.join(process.cwd(), rcFileInfo.path);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
        
        responseEntries.message = messages.DATA_NOT_FOUND;
      } else {
        responseEntries.message = "Vehicle created successfully" + (rcFileInfo ? " with documents" : "");
      }
    } else {
      // Handle regular JSON request (no file upload)
      console.log("Processing JSON request:", req.body);
      const validationResponse = await v.validate(req.body, schema);

      if (validationResponse !== true) {
        const errorMessage = validationResponse
          .map((err) => err.message)
          .join(", ");
        throw new Error(errorMessage);
      }

      responseEntries.data = await vehicleServices.createVehicle(req.body);

      if (!responseEntries.data) {
        responseEntries.message = messages.DATA_NOT_FOUND;
      } else {
        responseEntries.message = "Vehicle created successfully";
      }
    }
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message = error.message ? error.message : error;
    responseEntries.code = responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
    console.error("Create vehicle error:", error);
  } finally {
    res.send(responseEntries);
  }
}

async function updateVehicleWithUpload(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();

  try {
    if (!req.params.vehicleId) {
      throw new Error("Vehicle ID is required");
    }

    const vehicleId = req.params.vehicleId;
    const contentType = req.headers['content-type'] || '';
    
    let formData = {};
    let rcFileInfo = null;

    if (contentType.includes('multipart/form-data')) {
      // Extract form data from multipart objects
      formData = extractMultipartData(req.body || {});
      
      // Process file upload if present
      if (req.body.rcDocument && req.body.rcDocument.type === 'file') {
        const filePart = req.body.rcDocument;
        const fileBuffer = await filePart.toBuffer();
        rcFileInfo = await uploadImageToServer({
          originalname: filePart.filename,
          mimetype: filePart.mimetype,
          buffer: fileBuffer
        }, 'vehicles/rc');
        
        if (rcFileInfo && rcFileInfo.url) {
          formData.rcUpload = rcFileInfo.url;
        }
      } else {
        // Check req.files() as well
        const parts = await req.files();
        for await (const part of parts) {
          if (part.type === 'file' && (part.fieldname === 'rcDocument' || part.fieldname === 'rc_upload')) {
            const fileBuffer = await part.toBuffer();
            rcFileInfo = await uploadImageToServer({
              originalname: part.filename,
              mimetype: part.mimetype,
              buffer: fileBuffer
            }, 'vehicles/rc');
            
            if (rcFileInfo && rcFileInfo.url) {
              formData.rcUpload = rcFileInfo.url;
            }
          }
        }
      }
    } else {
      // JSON request
      formData = req.body || {};
    }

    const filteredSchema = _.pick(schema, Object.keys(formData));

    if (Object.keys(filteredSchema).length === 0) {
      // Clean up uploaded file if no valid fields
      if (rcFileInfo && rcFileInfo.path) {
        const fs = require("fs");
        const path = require("path");
        const filePath = path.join(process.cwd(), rcFileInfo.path);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      
      throw new Error("No valid fields to update");
    }

    const validationResponse = v.validate(formData, filteredSchema);

    if (validationResponse !== true) {
      // Clean up uploaded file if validation fails
      if (rcFileInfo && rcFileInfo.path) {
        const fs = require("fs");
        const path = require("path");
        const filePath = path.join(process.cwd(), rcFileInfo.path);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      
      const errorMessage = validationResponse
        .map((err) => err.message)
        .join(", ");
      throw new Error(errorMessage);
    }

    responseEntries.data = await vehicleServices.updateVehicle(vehicleId, formData);

    if (!responseEntries.data) {
      // Clean up file if update fails
      if (rcFileInfo && rcFileInfo.path) {
        const fs = require("fs");
        const path = require("path");
        const filePath = path.join(process.cwd(), rcFileInfo.path);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      
      responseEntries.message = messages.DATA_NOT_FOUND;
    } else {
      responseEntries.message = "Vehicle updated successfully" + (rcFileInfo ? " with documents" : "");
    }
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message = error.message ? error.message : error;
    responseEntries.code = error.code ? error.code : responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
    console.error("Update vehicle error:", error);
  } finally {
    res.send(responseEntries);
  }
}

// Keep other functions unchanged...
async function getVehicle(req, res) {
  const responseEntries = new ResponseEntry();

  try {
    responseEntries.data = await vehicleServices.getVehicle(req.query);

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

async function deleteVehicle(req, res) {
  const responseEntries = new ResponseEntry();

  try {
    if (!req.params.vehicleId) {
      throw new Error("Vehicle ID is required");
    }

    // Get vehicle info before deleting to get RC file path
    const vehicle = await Vehicle.findOne({
      where: { vehicle_id: req.params.vehicleId },
      attributes: ["rc_upload"]
    });

    // Delete the vehicle
    responseEntries.data = await vehicleServices.deleteVehicle(
      req.params.vehicleId
    );

    // Delete associated RC file if exists
    if (vehicle && vehicle.rc_upload) {
      const fs = require("fs");
      const path = require("path");
      
      try {
        // Extract file path from URL (remove protocol and domain)
        const fileUrl = vehicle.rc_upload;
        // If it's a full URL, extract the path
        let filePath = fileUrl;
        if (fileUrl.startsWith('http')) {
          const url = require("url");
          const parsedUrl = new URL(fileUrl);
          filePath = parsedUrl.pathname;
        }
        
        // Remove leading slash if present and prepend current directory
        if (filePath.startsWith('/')) {
          filePath = filePath.substring(1);
        }
        
        const fullPath = path.join(process.cwd(), filePath);
        
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          console.log("Deleted RC file:", fullPath);
        }
      } catch (error) {
        console.error("Error deleting RC file:", error);
        // Don't fail the whole operation if file deletion fails
      }
    }

    responseEntries.message = "Vehicle deleted successfully";
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
    url: "/vehicles",
    // preHandler: verifyToken,
    handler: getVehicle,
  });

  fastify.route({
    method: "POST",
    url: "/vehicles",
    // preHandler: verifyToken,
    handler: createVehicleWithUpload,
  });

  fastify.route({
    method: "PUT",
    url: "/vehicles/:vehicleId",
    // preHandler: verifyToken,
    handler: updateVehicleWithUpload,
  });

  fastify.route({
    method: "DELETE",
    url: "/vehicles/:vehicleId",
    // preHandler: verifyToken,
    handler: deleteVehicle,
  });
};