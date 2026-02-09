"use strict";

const fs = require("fs");
const path = require("path");
const pump = require("pump");
const { v4: uuidv4 } = require("uuid");

class UploadService {
  constructor() {
    this.baseUploadDir = "./uploads";
    this.tempDir = path.join(this.baseUploadDir, "temp");
    
    // Define allowed file types for different categories
    this.allowedFileTypes = {
      vehicles: ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "application/pdf"],
      company: ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"],
      product: ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"],
      visitingCard: ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "application/pdf"],
      profile: ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"],
      default: ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "application/pdf"]
    };
    
    this.ensureDirectories();
  }

  /**
   * Ensure all required directories exist
   */
  ensureDirectories() {
    const dirs = [
      this.baseUploadDir,
      this.tempDir,
      path.join(this.baseUploadDir, "vehicles"),
      path.join(this.baseUploadDir, "vehicles", "rc"),
      path.join(this.baseUploadDir, "vehicles", "insurance"),
      path.join(this.baseUploadDir, "vehicles", "fitness"),
      path.join(this.baseUploadDir, "vehicles", "other"),
      path.join(this.baseUploadDir, "company"),
      path.join(this.baseUploadDir, "product"),
      path.join(this.baseUploadDir, "visitingCard"),
    ];

    dirs.forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Generate unique filename
   * @param {string} originalName - Original filename
   * @param {string} prefix - Optional prefix for the filename
   * @returns {string} - Generated filename
   */
  generateFileName(originalName, prefix = "") {
    const extension = path.extname(originalName).toLowerCase();
    const baseName = path.basename(originalName, extension);
    const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9]/g, "_");
    const timestamp = Date.now();
    const uniqueId = uuidv4().substring(0, 8);

    let fileName = `${sanitizedBaseName}_${timestamp}_${uniqueId}${extension}`;
    
    if (prefix) {
      fileName = `${prefix}_${fileName}`;
    }

    return fileName;
  }

  /**
   * Process multipart form data
   * @param {Object} req - Fastify request object
   * @returns {Promise<Object>} - Processed form data and files
   */
  async processMultipartForm(req) {
    const parts = await req.files();
    const formData = {};
    const files = [];

    for await (const part of parts) {
      if (part.file) {
        // Handle file upload
        const fileInfo = await this.handleFileUpload(part);
        files.push(fileInfo);

        // Add file path to form data if it's a known field
        if (part.fieldname) {
          formData[part.fieldname] = fileInfo.filePath;
        }
      } else {
        // Handle regular form field
        formData[part.fieldname] = part.value;
      }
    }

    return { formData, files };
  }

  /**
   * Handle individual file upload with validation
   * @param {Object} part - Fastify multipart part
   * @param {string} category - File category (vehicles, company, product, etc.)
   * @param {string} subCategory - File sub-category (rc, insurance, etc.)
   * @returns {Promise<Object>} - File information
   */
  async handleFileUpload(part, category = "temp", subCategory = "") {
    const originalName = part.filename;
    const fieldname = part.fieldname || "file";
    const mimeType = part.mimetype.toLowerCase();
    
    // Validate file type
    const allowedTypes = this.allowedFileTypes[category] || this.allowedFileTypes.default;
    if (!this.validateFileType(mimeType, allowedTypes)) {
      throw new Error(
        `Invalid file type for ${category}. Allowed: ${allowedTypes.join(", ")}`
      );
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (part.fields?.fileSize && parseInt(part.fields.fileSize) > maxSize) {
      throw new Error(`File size exceeds maximum limit of ${maxSize / (1024 * 1024)}MB`);
    }

    // Determine file category from fieldname if not provided
    if (category === "temp") {
      category = this.determineCategory(fieldname);
    }

    // Generate filename with appropriate prefix
    const prefix = subCategory || fieldname;
    const fileName = this.generateFileName(originalName, prefix);
    
    // Determine save directory
    let saveDir = path.join(this.baseUploadDir, category);
    if (subCategory) {
      saveDir = path.join(saveDir, subCategory);
    }

    // Ensure directory exists
    if (!fs.existsSync(saveDir)) {
      fs.mkdirSync(saveDir, { recursive: true });
    }

    // Save file
    const filePath = path.join(saveDir, fileName);
    await pump(part.file, fs.createWriteStream(filePath));

    // Get file stats
    const stats = fs.statSync(filePath);

    return {
      fieldname,
      originalName,
      fileName,
      mimeType,
      filePath: `/${path.relative(".", filePath).replace(/\\/g, "/")}`, // Convert to URL path
      absolutePath: filePath,
      size: stats.size,
      category,
      subCategory: subCategory || fieldname,
      uploadedAt: new Date(),
    };
  }

  /**
   * Determine file category from fieldname
   * @param {string} fieldname - Field name
   * @returns {string} - Category name
   */
  determineCategory(fieldname) {
    const categoryMap = {
      rc: "vehicles",
      rc_upload: "vehicles",
      rcDocument: "vehicles",
      insurance: "vehicles",
      fitness: "vehicles",
      company: "company",
      product: "product",
      visitingCard: "visitingCard",
      profile: "profile",
      avatar: "profile",
    };

    return categoryMap[fieldname] || "temp";
  }

  /**
   * Move file from temp to permanent location
   * @param {string} tempFilePath - Temporary file path
   * @param {string} newCategory - New category
   * @param {string} entityId - Entity ID (vehicle_id, company_id, etc.)
   * @param {string} prefix - File prefix
   * @returns {Promise<Object>} - New file information
   */
  async moveToPermanentLocation(tempFilePath, newCategory, entityId, prefix = "") {
    if (!tempFilePath || !fs.existsSync(tempFilePath.replace(/^\//, ""))) {
      throw new Error("Temporary file not found");
    }

    const tempFullPath = path.join(process.cwd(), tempFilePath.replace(/^\//, ""));
    
    if (!fs.existsSync(tempFullPath)) {
      throw new Error("Temporary file not found");
    }

    // Create entity-specific directory
    const entityDir = path.join(this.baseUploadDir, newCategory, entityId);
    if (!fs.existsSync(entityDir)) {
      fs.mkdirSync(entityDir, { recursive: true });
    }

    // Generate new filename
    const originalName = path.basename(tempFilePath);
    const extension = path.extname(originalName);
    const newFileName = prefix 
      ? `${prefix}_${entityId}_${Date.now()}${extension}`
      : `${entityId}_${Date.now()}${extension}`;

    const newFullPath = path.join(entityDir, newFileName);
    
    // Move the file
    fs.renameSync(tempFullPath, newFullPath);

    return {
      originalPath: tempFilePath,
      newPath: `/${path.relative(".", newFullPath).replace(/\\/g, "/")}`,
      fileName: newFileName,
      entityId,
      category: newCategory,
    };
  }

  /**
   * Upload file directly without multipart form
   * @param {Buffer|Stream} fileBuffer - File buffer or stream
   * @param {string} originalName - Original filename
   * @param {string} category - File category
   * @param {string} subCategory - File sub-category
   * @returns {Promise<Object>} - File information
   */
  async uploadFileDirect(fileBuffer, originalName, category = "temp", subCategory = "") {
    const fileName = this.generateFileName(originalName, subCategory);
    
    // Determine save directory
    let saveDir = path.join(this.baseUploadDir, category);
    if (subCategory) {
      saveDir = path.join(saveDir, subCategory);
    }

    // Ensure directory exists
    if (!fs.existsSync(saveDir)) {
      fs.mkdirSync(saveDir, { recursive: true });
    }

    // Save file
    const filePath = path.join(saveDir, fileName);
    
    if (Buffer.isBuffer(fileBuffer)) {
      fs.writeFileSync(filePath, fileBuffer);
    } else {
      // Assuming it's a stream
      await pump(fileBuffer, fs.createWriteStream(filePath));
    }

    // Get file stats
    const stats = fs.statSync(filePath);

    return {
      originalName,
      fileName,
      filePath: `/${path.relative(".", filePath).replace(/\\/g, "/")}`,
      absolutePath: filePath,
      size: stats.size,
      category,
      subCategory,
      uploadedAt: new Date(),
    };
  }

  /**
   * Delete file
   * @param {string} filePath - File path (relative or absolute)
   * @returns {Promise<boolean>} - Success status
   */
  async deleteFile(filePath) {
    try {
      const fullPath = filePath.startsWith("/") 
        ? path.join(process.cwd(), filePath.substring(1))
        : filePath;

      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error deleting file:", error);
      return false;
    }
  }

  /**
   * Clean up temporary files older than specified hours
   * @param {number} hoursOld - Hours to consider as old (default: 24)
   * @returns {Promise<number>} - Number of files deleted
   */
  async cleanupTempFiles(hoursOld = 24) {
    try {
      let deletedCount = 0;
      const cutoffTime = Date.now() - (hoursOld * 60 * 60 * 1000);

      const cleanupDirectory = (dir) => {
        if (!fs.existsSync(dir)) return;

        const files = fs.readdirSync(dir);
        files.forEach((file) => {
          const filePath = path.join(dir, file);
          const stats = fs.statSync(filePath);

          if (stats.isFile() && stats.mtimeMs < cutoffTime) {
            fs.unlinkSync(filePath);
            deletedCount++;
          }
        });
      };

      // Clean temp directory
      cleanupDirectory(this.tempDir);

      return deletedCount;
    } catch (error) {
      console.error("Error cleaning up temp files:", error);
      return 0;
    }
  }

  /**
   * Get file information
   * @param {string} filePath - File path
   * @returns {Object|null} - File information or null if not found
   */
  getFileInfo(filePath) {
    try {
      const fullPath = filePath.startsWith("/") 
        ? path.join(process.cwd(), filePath.substring(1))
        : filePath;

      if (!fs.existsSync(fullPath)) {
        return null;
      }

      const stats = fs.statSync(fullPath);
      const fileName = path.basename(fullPath);
      const extension = path.extname(fileName);

      return {
        fileName,
        extension,
        filePath: `/${path.relative(".", fullPath).replace(/\\/g, "/")}`,
        absolutePath: fullPath,
        size: stats.size,
        mimeType: this.getMimeType(extension),
        created: stats.birthtime,
        modified: stats.mtime,
        accessed: stats.atime,
      };
    } catch (error) {
      console.error("Error getting file info:", error);
      return null;
    }
  }

  /**
   * Get MIME type from file extension
   * @param {string} extension - File extension
   * @returns {string} - MIME type
   */
  getMimeType(extension) {
    const mimeTypes = {
      ".pdf": "application/pdf",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".txt": "text/plain",
      ".doc": "application/msword",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".xls": "application/vnd.ms-excel",
      ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };

    return mimeTypes[extension.toLowerCase()] || "application/octet-stream";
  }

  /**
   * Validate file type
   * @param {string} mimeType - MIME type
   * @param {Array} allowedTypes - Allowed MIME types
   * @returns {boolean} - Whether file type is allowed
   */
  validateFileType(mimeType, allowedTypes = []) {
    if (allowedTypes.length === 0) {
      return true; // No restrictions
    }
    return allowedTypes.includes(mimeType);
  }

  /**
   * Validate file size
   * @param {number} size - File size in bytes
   * @param {number} maxSize - Maximum size in bytes
   * @returns {boolean} - Whether file size is valid
   */
  validateFileSize(size, maxSize) {
    return size <= maxSize;
  }
}

module.exports = new UploadService();