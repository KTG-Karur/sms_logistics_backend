"use strict";

const { verifyToken } = require("../middleware/auth");
const { ResponseEntry } = require("../helpers/construct-response");
const responseCode = require("../helpers/status-code");
const messages = require("../helpers/message");
const uploadService = require("../service/upload-service");

async function uploadFile(req, res) {
  const responseEntries = new ResponseEntry();

  try {
    const { entityType, entityId, documentType } = req.params;
    
    // Validate entity type
    const allowedEntityTypes = ["vehicle", "company", "product", "profile"];
    if (!allowedEntityTypes.includes(entityType)) {
      throw new Error(`Invalid entity type. Allowed: ${allowedEntityTypes.join(", ")}`);
    }

    const parts = await req.files();
    const uploadedFiles = [];

    for await (const part of parts) {
      if (part.file) {
        // Upload file using common service
        const fileInfo = await uploadService.handleFileUpload(
          part,
          entityType + "s", // Pluralize (vehicles, companies, products, profiles)
          documentType || part.fieldname
        );

        uploadedFiles.push(fileInfo);
      }
    }

    responseEntries.data = {
      message: "Files uploaded successfully",
      entityType,
      entityId: entityId || "pending",
      uploadedFiles,
    };

    responseEntries.message = messages.UPLOADED_SUCCESSFULLY;
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message = error.message || error;
    responseEntries.code = responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    res.send(responseEntries);
  }
}

async function getFileInfo(req, res) {
  const responseEntries = new ResponseEntry();

  try {
    const { filePath } = req.query;

    if (!filePath) {
      throw new Error("File path is required");
    }

    const fileInfo = uploadService.getFileInfo(filePath);

    if (!fileInfo) {
      throw new Error("File not found");
    }

    responseEntries.data = fileInfo;
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message = error.message || error;
    responseEntries.code = responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    res.send(responseEntries);
  }
}

async function cleanupTempFiles(req, res) {
  const responseEntries = new ResponseEntry();

  try {
    const hoursOld = req.query.hours || 24;
    const deletedCount = await uploadService.cleanupTempFiles(parseInt(hoursOld));

    responseEntries.data = {
      deletedCount,
      message: `Cleaned up ${deletedCount} temporary files older than ${hoursOld} hours`,
    };
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
//   fastify.register(require('@fastify/multipart'), {
//     limits: {
//       fileSize: 1024 * 1024 * 10, // 10MB limit
//       files: 10 // Maximum 10 files
//     }
//   });

  // Upload file to specific entity
  fastify.route({
    method: "POST",
    url: "/upload/:entityType/:entityId/:documentType?",
    preHandler: verifyToken,
    handler: uploadFile,
  });

  // Get file information
  fastify.route({
    method: "GET",
    url: "/upload/file-info",
    preHandler: verifyToken,
    handler: getFileInfo,
  });

  // Cleanup temporary files (admin only)
  fastify.route({
    method: "POST",
    url: "/upload/cleanup",
    preHandler: verifyToken,
    handler: cleanupTempFiles,
  });
};