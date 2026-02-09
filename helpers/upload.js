const fs = require("fs");
const path = require("path");
require("dotenv").config();

async function uploadImageToServer(image, prefix = "") {
  if (!image) return null;

  const uploadDir = process.env.IMAGE_UPLOAD_DIR || "uploads";
  const baseUrl = process.env.IMAGE_BASE_URL || "http://localhost:5098";

  const targetDir = path.join(uploadDir, prefix);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  let ext = "";
  if (image.originalname) {
    ext = path.extname(image.originalname);
  } else if (image.mimetype) {
    const mimeToExt = {
      "image/jpeg": ".jpg",
      "image/jpg": ".jpg",
      "image/png": ".png",
      "image/gif": ".gif",
      "image/webp": ".webp",
      "image/svg+xml": ".svg",
    };
    ext = mimeToExt[image.mimetype] || ".jpg";
  } else {
    ext = ".jpg";
  }

  const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  const filePath = path.join(targetDir, fileName);

  let buffer;

  if (image.buffer) {
    buffer = image.buffer;
  } else if (image.file) {
    const chunks = [];
    for await (const chunk of image.file) {
      chunks.push(chunk);
    }
    buffer = Buffer.concat(chunks);
  } else if (image.data) {
    buffer = Buffer.from(image.data);
  } else if (image.base64) {
    buffer = Buffer.from(image.base64, "base64");
  } else {
    buffer = image._buf || image._data || null;
    if (!buffer) {
      throw new Error("Invalid image data format");
    }
  }

  fs.writeFileSync(filePath, buffer);

  const publicPath = `${baseUrl}/${uploadDir}/${prefix}/${fileName}`
    .replace(/\\/g, "/")
    .replace(/([^:]\/)\/+/g, "$1");

  return {
    fileName,
    path: `${uploadDir}/${prefix}/${fileName}`,
    url: publicPath,
  };
}

module.exports = {
  uploadImageToServer,
};
