"use strict";
const Validator = require("fastest-validator");
const { verifyToken } = require("../middleware/auth");
const { ResponseEntry } = require("../helpers/construct-response");
const responseCode = require("../helpers/status-code");
const messages = require("../helpers/message");
const productEnquiryServices = require("../service/product-enquiry-service");
const _ = require("lodash");

const schema = {
  expo_id: {
    type: "string",
    empty: false,
  },
  visitor_name: {
    type: "string",
    optional: true,
  },
  company_name: {
    type: "string",
    optional: true,
  },
  contact_number: {
    type: "string",
    optional: true,
  },
  // Optional fields
  visiting_card: {
    type: "string",
    optional: true,
  },
  city: {
    type: "string",
    optional: true,
  },
  country: {
    type: "string",
    optional: true,
  },
  email: {
    type: "email",
    optional: true,
  },
  nature_of_enquiry: {
    type: "string",
    optional: true,
  },
  remarks: {
    type: "string",
    optional: true,
  },
  status: {
    type: "enum",
    values: ["active", "inactive"],
    optional: true,
  },
  enquiry_date: {
    type: "string",
    optional: true,
  },
  follow_up_date: {
    type: "string",
    optional: true,
  },
  products: {
    type: "array",
    items: {
      type: "object",
      props: {
        productId: {
          type: "string",
          empty: false,
        },
        sampleRequired: {
          type: "boolean",
          optional: true,
        },
        quantity: {
          type: "number",
          integer: true,
          optional: true,
        },
        remarks: {
          type: "string",
          optional: true,
        },
      },
    },
  },
};
async function getProductEnquiries(req, res) {
  const responseEntries = new ResponseEntry();
  try {
    responseEntries.data = await productEnquiryServices.getProductEnquiries(
      req.query
    );
    if (!responseEntries.data)
      responseEntries.message = messages.DATA_NOT_FOUND;
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message = error.message ? error.message : error;
    responseEntries.code = responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    res.send(responseEntries);
  }
}

async function createProductEnquiry(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();
  try {
    const validationResponse = await v.validate(req.body, schema);
    if (validationResponse !== true) {
      throw new Error(messages.VALIDATION_FAILED);
    }

    const userId = req.user?.employeeId;
    responseEntries.data = await productEnquiryServices.createProductEnquiry(
      req.body,
      userId
    );

    if (!responseEntries.data) {
      responseEntries.message = messages.DATA_NOT_FOUND;
    } else {
      responseEntries.message = "Product enquiry created successfully";
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

async function updateProductEnquiry(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();
  try {
    const filteredSchema = _.pick(schema, Object.keys(req.body));
    const validationResponse = v.validate(req.body, filteredSchema);
    if (validationResponse !== true) {
      throw new Error(messages.VALIDATION_FAILED);
    }

    const userId = req.user?.employeeId;
    responseEntries.data = await productEnquiryServices.updateProductEnquiry(
      req.params.enquiryId,
      req.body,
      userId
    );

    if (!responseEntries.data) {
      responseEntries.message = messages.DATA_NOT_FOUND;
    } else {
      responseEntries.message = "Product enquiry updated successfully";
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

async function deleteProductEnquiry(req, res) {
  const responseEntries = new ResponseEntry();
  try {
    const userId = req.user?.employeeId;
    responseEntries.data = await productEnquiryServices.deleteProductEnquiry(
      req.params.enquiryId,
      userId
    );
    responseEntries.message = "Product enquiry deleted successfully";
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message = error.message ? error.message : error;
    responseEntries.code = responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    res.send(responseEntries);
  }
}

async function getEnquiryStatistics(req, res) {
  const responseEntries = new ResponseEntry();
  try {
    responseEntries.data = await productEnquiryServices.getEnquiryStatistics();
    if (!responseEntries.data)
      responseEntries.message = messages.DATA_NOT_FOUND;
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message = error.message ? error.message : error;
    responseEntries.code = responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    res.send(responseEntries);
  }
}

async function removeVisitingCardImage(req, res) {
  const responseEntries = new ResponseEntry();

  try {
    const { enquiryId } = req.params;
    const { imageName } = req.body;

    if (!imageName) {
      throw new Error("Image name is required");
    }

    const userId = req.user?.employeeId;

    responseEntries.data = await productEnquiryServices.removeVisitingCardImage(
      enquiryId,
      imageName,
      userId
    );

    responseEntries.message = "Image removed successfully";
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
  fastify.route({
    method: "GET",
    url: "/product-enquiries",
    preHandler: verifyToken,
    handler: getProductEnquiries,
  });

  fastify.route({
    method: "POST",
    url: "/product-enquiries",
    preHandler: verifyToken,
    handler: createProductEnquiry,
  });

  fastify.route({
    method: "PUT",
    url: "/product-enquiries/:enquiryId",
    preHandler: verifyToken,
    handler: updateProductEnquiry,
  });

  fastify.route({
    method: "DELETE",
    url: "/product-enquiries/:enquiryId",
    preHandler: verifyToken,
    handler: deleteProductEnquiry,
  });

  fastify.route({
    method: "GET",
    url: "/product-enquiries/statistics",
    preHandler: verifyToken,
    handler: getEnquiryStatistics,
  });
  fastify.route({
    method: "PUT",
    url: "/product-enquiries/:enquiryId/remove-visiting-card",
    preHandler: verifyToken,
    handler: removeVisitingCardImage,
  });
};
