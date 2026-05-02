"use strict";

const Validator = require('fastest-validator');
const { verifyToken } = require("../middleware/auth");
const { ResponseEntry } = require("../helpers/construct-response");
const responseCode = require("../helpers/status-code");
const messages = require("../helpers/message");
const companyServices = require("../service/company-service");
const _ = require('lodash');
const { uploadImageToServer } = require("../helpers/upload");

const schema = {
    companyName: { type: "string", optional: false },
    companyAddressOne: { type: "string", optional: false },
    companyMobile: { type: "string", optional: true },
    companyAltMobile: { type: "string", optional: true },
    companyMail: { type: "string", optional: true },
    companyGstNo: { type: "string", optional: true },
    companyAddressTwo: { type: "string", optional: true },
    companyLogo: { type: "string", optional: true },
    userId: { type: "string", optional: true },
    userName: { type: "string", optional: true },
    password: { type: "string", optional: true },
}

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

async function getCompany(req, res) {
    const responseEntries = new ResponseEntry();
    try {
        responseEntries.data = await companyServices.getCompany(req.query);
        if (!responseEntries.data) responseEntries.message = messages.DATA_NOT_FOUND;
    } catch (error) {
        responseEntries.error = true;
        responseEntries.message = error.message ? error.message : error;
        responseEntries.code = responseCode.BAD_REQUEST;
        res.status(responseCode.BAD_REQUEST);
    } finally {
        res.send(responseEntries);
    }
}

async function updateCompanyWithUpload(req, res) {
    const responseEntries = new ResponseEntry();
    const v = new Validator();
    
    try {
        if (!req.params.companyId) {
            throw new Error("Company ID is required");
        }

        const companyId = req.params.companyId;
        const contentType = req.headers['content-type'] || '';
        
        let formData = {};
        let logoFileInfo = null;

        if (contentType.includes('multipart/form-data')) {
            console.log("Processing multipart request for company update...");
            
            // Extract form data from multipart objects
            formData = extractMultipartData(req.body || {});
            console.log("Extracted form data:", formData);
            
            // Process file upload if present (for company logo)
            if (req.body.companyLogo && req.body.companyLogo.type === 'file') {
                const filePart = req.body.companyLogo;
                try {
                    const fileBuffer = await filePart.toBuffer();
                    logoFileInfo = await uploadImageToServer({
                        originalname: filePart.filename,
                        mimetype: filePart.mimetype,
                        buffer: fileBuffer
                    }, 'companies/logos');
                    
                    if (logoFileInfo && logoFileInfo.url) {
                        formData.companyLogo = logoFileInfo.url;
                    }
                } catch (fileError) {
                    console.error("Error processing logo file:", fileError);
                    throw new Error("Failed to process uploaded logo file");
                }
            } else {
                // Check req.files() for files that might not be in req.body
                const parts = await req.files();
                for await (const part of parts) {
                    if (part.type === 'file' && (part.fieldname === 'companyLogo' || part.fieldname === 'company_logo')) {
                        const fileBuffer = await part.toBuffer();
                        logoFileInfo = await uploadImageToServer({
                            originalname: part.filename,
                            mimetype: part.mimetype,
                            buffer: fileBuffer
                        }, 'companies/logos');
                        
                        if (logoFileInfo && logoFileInfo.url) {
                            formData.companyLogo = logoFileInfo.url;
                        }
                    }
                }
            }
        } else {
            // JSON request
            formData = req.body || {};
        }

        // Filter schema based on provided fields
        const filteredSchema = _.pick(schema, Object.keys(formData));

        if (Object.keys(filteredSchema).length === 0) {
            // Clean up uploaded file if no valid fields
            if (logoFileInfo && logoFileInfo.path) {
                const fs = require("fs");
                const path = require("path");
                const filePath = path.join(process.cwd(), logoFileInfo.path);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
            throw new Error("No valid fields to update");
        }

        const validationResponse = v.validate(formData, filteredSchema);
        
        if (validationResponse !== true) {
            // Clean up uploaded file if validation fails
            if (logoFileInfo && logoFileInfo.path) {
                const fs = require("fs");
                const path = require("path");
                const filePath = path.join(process.cwd(), logoFileInfo.path);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
            
            const errorMessage = validationResponse
                .map((err) => err.message)
                .join(", ");
            throw new Error(errorMessage);
        }

        responseEntries.data = await companyServices.updateCompany(companyId, formData);
        
        if (!responseEntries.data) {
            // Clean up file if update fails
            if (logoFileInfo && logoFileInfo.path) {
                const fs = require("fs");
                const path = require("path");
                const filePath = path.join(process.cwd(), logoFileInfo.path);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
            responseEntries.message = messages.DATA_NOT_FOUND;
        } else {
            responseEntries.message = "Company updated successfully" + (logoFileInfo ? " with logo" : "");
        }
    } catch (error) {
        responseEntries.error = true;
        responseEntries.message = error.message ? error.message : error;
        responseEntries.code = error.code ? error.code : responseCode.BAD_REQUEST;
        res.status(responseCode.BAD_REQUEST);
        console.error("Update company error:", error);
    } finally {
        res.send(responseEntries);
    }
}

module.exports = async function (fastify) {
    fastify.route({
        method: 'GET',
        url: '/company',
        preHandler: verifyToken,
        handler: getCompany
    });
    
    fastify.route({
        method: 'PUT',
        url: '/company/:companyId',
        preHandler: verifyToken,
        handler: updateCompanyWithUpload
    });
};