"use strict";

const sequelize = require("../models/index").sequelize;
const { verifyToken } = require("../middleware/auth");
const { ResponseEntry } = require("../helpers/construct-response");
const responseCode = require("../helpers/status-code");
const messages = require("../helpers/message");
const fs = require("fs");
const path = require("path");
const pump = require("pump");

async function UploadImages(req, res) {
  const responseEntries = new ResponseEntry();
  try {
    const uploadDir = "./uploads";
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const companyDir = path.join(uploadDir, "company");
    const productDir = path.join(uploadDir, "product");
    const visitingCardDir = path.join(uploadDir, "visitingCard");

    if (!fs.existsSync(companyDir)) fs.mkdirSync(companyDir);
    if (!fs.existsSync(productDir)) fs.mkdirSync(productDir);
    if (!fs.existsSync(visitingCardDir)) fs.mkdirSync(visitingCardDir);

    const parts = await req.files();
    const files = [];
    const visitingCardFiles = [];

    for await (const part of parts) {
      if (part.file) {
        const fileName = `${Date.now()}-${part.filename}`;

        /** COMPANY IMAGE */
        if (part.fieldname === "company") {
          const filePath = path.join(companyDir, fileName);
          await pump(part.file, fs.createWriteStream(filePath));

          await sequelize.models.company.update(
            { company_logo: `/uploads/company/${fileName}` },
            { where: { company_id: req.params.id } }
          );

          files.push({ fieldname: part.fieldname, fileName });
        }

        /** PRODUCT IMAGE */
        else if (part.fieldname === "product") {
          const filePath = path.join(productDir, fileName);
          await pump(part.file, fs.createWriteStream(filePath));

          await sequelize.models.product.update(
            { product_image: `/uploads/product/${fileName}` },
            { where: { product_id: req.params.id } }
          );

          files.push({ fieldname: part.fieldname, fileName });
        }

        /** MULTIPLE VISITING CARD UPLOAD */
        else if (part.fieldname === "visitingCard") {
          const filePath = path.join(visitingCardDir, fileName);
          await pump(part.file, fs.createWriteStream(filePath));

          visitingCardFiles.push(`/uploads/visitingCard/${fileName}`);

          files.push({ fieldname: part.fieldname, fileName });
        }

        /** DEFAULT FILE */
        else {
          const filePath = path.join(uploadDir, fileName);
          await pump(part.file, fs.createWriteStream(filePath));

          files.push({ fieldname: part.fieldname, fileName });
        }
      }
    }

    /** SAVE MULTIPLE VISITING CARDS */
    if (visitingCardFiles.length > 0) {
      const enquiry = await sequelize.models.ProductEnquiry.findOne({
        where: { enquiry_id: req.params.id },
      });

      let existingImages = [];
      if (enquiry && enquiry.visiting_card) {
        try {
          existingImages = JSON.parse(enquiry.visiting_card);
          if (!Array.isArray(existingImages)) existingImages = [];
        } catch {
          existingImages = [];
        }
      }

      const finalFiles = [...existingImages, ...visitingCardFiles];
      const limitedFiles = finalFiles.slice(0, 5); // LIMIT TO 5 IMAGES

      await sequelize.models.ProductEnquiry.update(
        { visiting_card: JSON.stringify(limitedFiles) },
        { where: { enquiry_id: req.params.id } }
      );
    }

    responseEntries.data = messages.UPLOADED_SUCCESSFULLY;
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
  // fastify.register(require("@fastify/multipart"), {
  //   limits: {
  //     fileSize: 1024 * 1024 * 5,
  //   },
  // });

  fastify.route({
    method: "POST",
    url: "/upload/:id",
    preHandler: verifyToken,
    handler: UploadImages,
  });
};
