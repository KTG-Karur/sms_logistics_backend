'use strict';

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const message = require('./message');

// Create 'uploads' directory if it doesn't exist
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        // Specify the upload destination
        cb(null, uploadDir);
    },
    filename: function(req, file, cb) {
        // Generate a unique file name using current timestamp and original file extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileExtension = path.extname(file.originalname); // Get the file extension
        const fileName = uniqueSuffix + fileExtension; // Create unique file name
        
        cb(null, fileName);
    }
});

const fileFilter = (req, file, cb) => {
    
    // Accept only JPEG and PNG image files
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
        cb(null, true); // Accept the file
    } else {
        cb(new Error(message.UNSUPPORTED_FILE), false); // Reject the file with an error
    }
}

const upload = multer({
    storage: storage, // Set the storage configuration
    limits: {
        fileSize: 1024 * 1024 * 10 // Set file size limit to 5MB
    },
    fileFilter: fileFilter // Filter only images
});

module.exports = {
    upload
};
