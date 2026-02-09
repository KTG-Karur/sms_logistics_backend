"use strict";

const Validator = require("fastest-validator");
const { verifyToken } = require("../middleware/auth");
const { ResponseEntry } = require("../helpers/construct-response");
const responseCode = require("../helpers/status-code");
const messages = require("../helpers/message");
const employeeServices = require("../service/employee-service");
const { uploadImageToServer } = require("../helpers/upload");
const _ = require("lodash");
const { Employee } = require("../models");

const schema = {
  employee_name: {
    type: "string",
    min: 2,
    max: 100,
    optional: false,
    messages: {
      stringEmpty: "Employee name is required",
      stringMin: "Employee name must be at least 2 characters",
      stringMax: "Employee name cannot exceed 100 characters",
    },
  },
  mobile_no: {
    type: "string",
    min: 10,
    max: 10,
    optional: false,
    messages: {
      stringEmpty: "Mobile number is required",
      stringMin: "Mobile number must be exactly 10 digits",
      stringMax: "Mobile number must be exactly 10 digits",
      string: "Mobile number must contain only numbers",
    },
  },
  address_i: {
    type: "string",
    optional: true,
  },
  pincode: {
    type: "string",
    min: 6,
    max: 6,
    optional: true,
    messages: {
      stringMin: "Pincode must be exactly 6 digits",
      stringMax: "Pincode must be exactly 6 digits",
      string: "Pincode must contain only numbers",
    },
  },
  role_id: {
    type: "string",
    optional: true,
  },
  department_id: {
    type: "string",
    optional: true,
  },
  is_authenticated: {
    type: "boolean",
    optional: true,
  },
  is_driver: {
    type: "boolean",
    optional: true,
  },
  has_salary: {
    type: "boolean",
    optional: true,
  },
  is_loadman: {
    type: "boolean",
    optional: true,
  },
  salary: {
    type: "number",
    min: 0,
    optional: true,
    messages: {
      numberMin: "Salary must be greater than or equal to 0",
    },
  },
  licence_number: {
    type: "string",
    optional: true,
  },
  licence_image: {
    type: "string",
    optional: true,
  },
  username: {
    type: "string",
    optional: true,
  },
  password: {
    type: "string",
    min: 6,
    optional: true,
    messages: {
      stringMin: "Password must be at least 6 characters",
    },
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

async function createEmployeeWithUpload(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();
  try {
    // Check if this is a multipart request
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('multipart/form-data')) {
      console.log("Processing multipart request...");
      
      // Extract form data from multipart objects
      const formData = extractMultipartData(req.body || {});
      console.log("Extracted form data:", formData);
      
      let licenceFileInfo = null;
      
      // Check if there's a licence file in the request body
      if (req.body.licenceFile && req.body.licenceFile.type === 'file') {
        const filePart = req.body.licenceFile;
        try {
          const fileBuffer = await filePart.toBuffer();
          licenceFileInfo = await uploadImageToServer({
            originalname: filePart.filename,
            mimetype: filePart.mimetype,
            buffer: fileBuffer
          }, 'employees/licence');
          
          if (licenceFileInfo && licenceFileInfo.url) {
            formData.licence_image = licenceFileInfo.url;
          }
        } catch (fileError) {
          console.error("Error processing file:", fileError);
          throw new Error("Failed to process uploaded file");
        }
      } else {
        // Also check req.files() for files that might not be in req.body
        const parts = await req.files();
        for await (const part of parts) {
          if (part.type === 'file' && (part.fieldname === 'licenceFile' || part.fieldname === 'licence_file')) {
            const fileBuffer = await part.toBuffer();
            licenceFileInfo = await uploadImageToServer({
              originalname: part.filename,
              mimetype: part.mimetype,
              buffer: fileBuffer
            }, 'employees/licence');
            
            if (licenceFileInfo && licenceFileInfo.url) {
              formData.licence_image = licenceFileInfo.url;
            }
          }
        }
      }
      
      console.log("Final form data for validation:", formData);
      
      // Validate required fields
      if (!formData.employee_name) {
        throw new Error("Employee name is required");
      }
      if (!formData.mobile_no) {
        throw new Error("Mobile number is required");
      }
      
      // Conditional validation
      if (formData.is_authenticated && !formData.role_id) {
        throw new Error("Role is required when authentication is enabled");
      }
      
      if (formData.is_driver && !formData.licence_number) {
        throw new Error("Licence number is required for driver");
      }
      
      if (formData.has_salary && (!formData.salary || formData.salary <= 0)) {
        throw new Error("Salary is required when Has Salary is enabled");
      }
      
      if (formData.is_authenticated && !formData.username) {
        throw new Error("Username is required when authentication is enabled");
      }
      
      if (formData.is_authenticated && !formData.password) {
        throw new Error("Password is required when authentication is enabled");
      }
      
      // Create employee with form data
      responseEntries.data = await employeeServices.createEmployee(formData);
      
      if (!responseEntries.data) {
        // Clean up file if employee creation fails
        if (licenceFileInfo && licenceFileInfo.path) {
          const fs = require("fs");
          const path = require("path");
          const filePath = path.join(process.cwd(), licenceFileInfo.path);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
        responseEntries.message = messages.DATA_NOT_FOUND;
      } else {
        responseEntries.message = "Employee created successfully" + (licenceFileInfo ? " with licence" : "");
      }
    } else {
      // Handle regular JSON request (no file upload)
      console.log("Processing JSON request:", req.body);
      
      // Validate required fields
      if (!req.body.employee_name) {
        throw new Error("Employee name is required");
      }
      if (!req.body.mobile_no) {
        throw new Error("Mobile number is required");
      }
      
      // Conditional validation for JSON request
      if (req.body.is_authenticated && !req.body.role_id) {
        throw new Error("Role is required when authentication is enabled");
      }
      
      if (req.body.is_driver && !req.body.licence_number) {
        throw new Error("Licence number is required for driver");
      }
      
      if (req.body.has_salary && (!req.body.salary || req.body.salary <= 0)) {
        throw new Error("Salary is required when Has Salary is enabled");
      }
      
      if (req.body.is_authenticated && !req.body.username) {
        throw new Error("Username is required when authentication is enabled");
      }
      
      if (req.body.is_authenticated && !req.body.password) {
        throw new Error("Password is required when authentication is enabled");
      }
      
      responseEntries.data = await employeeServices.createEmployee(req.body);
      
      if (!responseEntries.data) {
        responseEntries.message = messages.DATA_NOT_FOUND;
      } else {
        responseEntries.message = "Employee created successfully";
      }
    }
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message = error.message ? error.message : error;
    responseEntries.code = responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
    console.error("Create employee error:", error);
  } finally {
    res.send(responseEntries);
  }
}

async function updateEmployeeWithUpload(req, res) {
  const responseEntries = new ResponseEntry();
  try {
    if (!req.params.employeeId) {
      throw new Error("Employee ID is required");
    }
    
    const employeeId = req.params.employeeId;
    const contentType = req.headers['content-type'] || '';
    let formData = {};
    let licenceFileInfo = null;
    
    if (contentType.includes('multipart/form-data')) {
      // Extract form data from multipart objects
      formData = extractMultipartData(req.body || {});
      
      // Process file upload if present
      if (req.body.licenceFile && req.body.licenceFile.type === 'file') {
        const filePart = req.body.licenceFile;
        const fileBuffer = await filePart.toBuffer();
        licenceFileInfo = await uploadImageToServer({
          originalname: filePart.filename,
          mimetype: filePart.mimetype,
          buffer: fileBuffer
        }, 'employees/licence');
        
        if (licenceFileInfo && licenceFileInfo.url) {
          formData.licence_image = licenceFileInfo.url;
        }
      } else {
        // Check req.files() as well
        const parts = await req.files();
        for await (const part of parts) {
          if (part.type === 'file' && (part.fieldname === 'licenceFile' || part.fieldname === 'licence_file')) {
            const fileBuffer = await part.toBuffer();
            licenceFileInfo = await uploadImageToServer({
              originalname: part.filename,
              mimetype: part.mimetype,
              buffer: fileBuffer
            }, 'employees/licence');
            
            if (licenceFileInfo && licenceFileInfo.url) {
              formData.licence_image = licenceFileInfo.url;
            }
          }
        }
      }
    } else {
      // JSON request
      formData = req.body || {};
    }
    
    // Validate conditional requirements
    if (formData.is_authenticated && !formData.role_id) {
      throw new Error("Role is required when authentication is enabled");
    }
    
    if (formData.is_driver && !formData.licence_number) {
      throw new Error("Licence number is required for driver");
    }
    
    if (formData.has_salary && (!formData.salary || formData.salary <= 0)) {
      throw new Error("Salary is required when Has Salary is enabled");
    }
    
    if (formData.is_authenticated && !formData.username) {
      throw new Error("Username is required when authentication is enabled");
    }
    
    responseEntries.data = await employeeServices.updateEmployee(employeeId, formData);
    
    if (!responseEntries.data) {
      // Clean up file if update fails
      if (licenceFileInfo && licenceFileInfo.path) {
        const fs = require("fs");
        const path = require("path");
        const filePath = path.join(process.cwd(), licenceFileInfo.path);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      responseEntries.message = messages.DATA_NOT_FOUND;
    } else {
      responseEntries.message = "Employee updated successfully" + (licenceFileInfo ? " with licence" : "");
    }
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message = error.message ? error.message : error;
    responseEntries.code = error.code ? error.code : responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
    console.error("Update employee error:", error);
  } finally {
    res.send(responseEntries);
  }
}

async function getEmployee(req, res) {
  const responseEntries = new ResponseEntry();
  try {
    responseEntries.data = await employeeServices.getEmployee(req.query);
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

async function deleteEmployee(req, res) {
  const responseEntries = new ResponseEntry();
  try {
    if (!req.params.employeeId) {
      throw new Error("Employee ID is required");
    }
    
    // Get employee info before deleting to get licence file path
    const employee = await Employee.findOne({
      where: { employee_id: req.params.employeeId },
      attributes: ["licence_image"]
    });
    
    // Delete the employee
    responseEntries.data = await employeeServices.deleteEmployee(
      req.params.employeeId
    );
    
    // Delete associated licence file if exists
    if (employee && employee.licence_image) {
      const fs = require("fs");
      const path = require("path");
      try {
        // Extract file path from URL (remove protocol and domain)
        const fileUrl = employee.licence_image;
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
          console.log("Deleted licence file:", fullPath);
        }
      } catch (error) {
        console.error("Error deleting licence file:", error);
        // Don't fail the whole operation if file deletion fails
      }
    }
    
    responseEntries.message = "Employee deleted successfully";
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
    url: "/employees",
    // preHandler: verifyToken,
    handler: getEmployee,
  });
  
  fastify.route({
    method: "POST",
    url: "/employees",
    // preHandler: verifyToken,
    handler: createEmployeeWithUpload,
  });
  
  fastify.route({
    method: "PUT",
    url: "/employees/:employeeId",
    // preHandler: verifyToken,
    handler: updateEmployeeWithUpload,
  });
  
  fastify.route({
    method: "DELETE",
    url: "/employees/:employeeId",
    // preHandler: verifyToken,
    handler: deleteEmployee,
  });
};