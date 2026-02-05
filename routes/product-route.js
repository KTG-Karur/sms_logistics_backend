"use strict";
const Validator = require("fastest-validator");
const { verifyToken } = require("../middleware/auth");
const { ResponseEntry } = require("../helpers/construct-response");
const responseCode = require("../helpers/status-code");
const messages = require("../helpers/message");
const productServices = require("../service/product-service");
const _ = require("lodash");
const xlsx = require("xlsx");
const path = require("path");
const fs = require("fs");


const schema = {
  productNo: { type: "string", optional: false },
  productName: { type: "string", optional: false },
  productComposition: { type: "string", optional: false },
  size: { type: "string", optional: false },
  fabricName: { type: "string", optional: false },
  washingDetails: { type: "string", optional: false },
  lowQuantityPrice: { type: "number", optional: false, positive: true },
  mediumQuantityPrice: { type: "number", optional: false, positive: true },
  highQuantityPrice: { type: "number", optional: false, positive: true },
  fillingMaterial: { type: "string", optional: true },
  isActive: { type: "boolean", optional: true },
};

// Bulk upload validation schema
const bulkUploadSchema = {
  products: {
    type: "array",
    min: 1,
    items: {
      type: "object",
      strict: false,
      props: {
        productNo: {
          type: "string",
          optional: false,
          empty: false,
        },
        productName: {
          type: "string",
          optional: false,
          empty: false,
        },
        productComposition: {
          type: "string",
          optional: false,
          empty: false,
        },
        size: {
          type: "string",
          optional: false,
          empty: false,
        },
        fabricName: {
          type: "string",
          optional: false,
          empty: false,
        },
        washingDetails: {
          type: "string",
          optional: false,
          empty: false,
        },
        low_quantity_price: {
          type: "number",
          optional: false,
          positive: true,
          convert: true,
        },
        medium_quantity_price: {
          type: "number",
          optional: false,
          positive: true,
          convert: true,
        },
        high_quantity_price: {
          type: "number",
          optional: false,
          positive: true,
          convert: true,
        },
        moq: {
          type: "string",
          optional: false,
          empty: false,
        },
        packaging: {
          type: "string",
          optional: true,
          nullable: true,
        },
        fillingMaterial: {
          type: "string",
          optional: true,
          nullable: true,
        },
        productImage: {
          type: "string",
          optional: true,
          nullable: true,
        },
        isActive: {
          type: "boolean",
          optional: true,
          default: true,
          convert: true,
        },
      },
    },
  },
};

async function getProducts(req, res) {
  const responseEntries = new ResponseEntry();
  try {
    responseEntries.data = await productServices.getProducts(req.query);
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

async function createProduct(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();

  try {
    const validationResponse = await v.validate(req.body, schema);
    if (validationResponse != true) {
      throw new Error(messages.VALIDATION_FAILED);
    } else {
      const userId = req.user?.employeeId;
      responseEntries.data = await productServices.createProduct(
        req.body,
        userId
      );
      if (!responseEntries.data)
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

async function updateProduct(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();

  try {
    const filteredSchema = _.pick(schema, Object.keys(req.body));
    const validationResponse = v.validate(req.body, filteredSchema);

    if (validationResponse != true) {
      throw new Error(messages.VALIDATION_FAILED);
    } else {
      const userId = req.user?.employeeId;
      responseEntries.data = await productServices.updateProduct(
        req.params.productId,
        req.body,
        userId
      );
      if (!responseEntries.data)
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

async function deleteProduct(req, res) {
  const responseEntries = new ResponseEntry();

  try {
    const userId = req.user?.employeeId;
    responseEntries.data = await productServices.deleteProduct(
      req.params.productId,
      userId
    );
    responseEntries.message = "Product deleted successfully";
  } catch (error) {
    responseEntries.error = true;
    responseEntries.message = error.message ? error.message : error;
    responseEntries.code = responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    res.send(responseEntries);
  }
}

// Bulk upload via JSON
async function bulkUploadProducts(req, res) {
  const responseEntries = new ResponseEntry();
  const v = new Validator();

  try {
    console.log("Received data type:", typeof req.body);
    console.log("Is array?", Array.isArray(req.body));
    console.log("Has products field?", req.body.products !== undefined);

    let productsArray;

    // Check the structure of req.body
    if (Array.isArray(req.body)) {
      // Case 1: Direct array - [product1, product2, ...]
      productsArray = req.body;
    } else if (req.body && typeof req.body === "object") {
      // Case 2: Object with products field - { products: [...] }
      if (req.body.products && Array.isArray(req.body.products)) {
        productsArray = req.body.products;
      } else if (Array.isArray(req.body.data)) {
        // Case 3: Some APIs use { data: [...] }
        productsArray = req.body.data;
      } else {
        // Try to extract any array from the object
        const arrayKeys = Object.keys(req.body).filter((key) =>
          Array.isArray(req.body[key])
        );
        if (arrayKeys.length > 0) {
          // Use the first array found
          productsArray = req.body[arrayKeys[0]];
        } else {
          throw new Error(
            "Invalid data format. Send either an array or { products: [...] }"
          );
        }
      }
    } else {
      throw new Error(
        "Invalid data format. Request body must be an array or object."
      );
    }

    if (!productsArray || !Array.isArray(productsArray)) {
      throw new Error("No valid products array found in request.");
    }

    console.log(`Found ${productsArray.length} products to process`);

    // Product validation schema
    const productSchema = {
      productNo: {
        type: "string",
        optional: false,
        empty: false,
      },
      productName: {
        type: "string",
        optional: false,
        empty: false,
      },
      productComposition: {
        type: "string",
        optional: false,
        empty: false,
      },
      size: {
        type: "string",
        optional: false,
        empty: false,
      },
      fabricName: {
        type: "string",
        optional: false,
        empty: false,
      },
      washingDetails: {
        type: "string",
        optional: false,
        empty: false,
      },
      low_quantity_price: {
        type: "number",
        optional: false,
        positive: true,
        convert: true,
      },
      medium_quantity_price: {
        type: "number",
        optional: false,
        positive: true,
        convert: true,
      },
      high_quantity_price: {
        type: "number",
        optional: false,
        positive: true,
        convert: true,
      },
      moq: {
        type: "string",
        optional: false,
        empty: false,
      },
      packaging: {
        type: "string",
        optional: true,
        nullable: true,
      },
      fillingMaterial: {
        type: "string",
        optional: true,
        nullable: true,
      },
      productImage: {
        type: "string",
        optional: true,
        nullable: true,
      },
      isActive: {
        type: "boolean",
        optional: true,
        default: true,
        convert: true,
      },
    };

    // Validate each product
    const validationErrors = [];
    const validatedProducts = [];

    for (let i = 0; i < productsArray.length; i++) {
      const product = productsArray[i];

      const validation = v.validate(product, productSchema);

      if (validation === true) {
        validatedProducts.push(product);
      } else {
        validationErrors.push({
          index: i,
          productNo: product.productNo || "N/A",
          errors: validation.map((err) => `${err.field}: ${err.message}`),
        });
      }
    }

    // If no valid products at all
    if (validatedProducts.length === 0 && productsArray.length > 0) {
      throw new Error(
        `All ${
          productsArray.length
        } products failed validation. First error: ${JSON.stringify(
          validationErrors[0]
        )}`
      );
    }

    const userId = req.user?.employeeId;

    // Process only valid products
    if (validatedProducts.length > 0) {
      console.log(`Processing ${validatedProducts.length} valid products`);

      responseEntries.data = await productServices.bulkUploadProducts(
        validatedProducts,
        userId
      );

      // Add validation summary
      responseEntries.data.validationSummary = {
        totalReceived: productsArray.length,
        validCount: validatedProducts.length,
        invalidCount: validationErrors.length,
        validationErrors:
          validationErrors.length > 0 ? validationErrors : undefined,
      };

      responseEntries.message = `Successfully uploaded ${responseEntries.data.successCount} products. ${responseEntries.data.failedCount} failed during processing.`;

      if (validationErrors.length > 0) {
        responseEntries.message += ` ${validationErrors.length} failed validation.`;
      }

      if (responseEntries.data.failedProducts.length > 0) {
        responseEntries.warnings = responseEntries.data.failedProducts;
      }
    } else {
      responseEntries.message = "No valid products to upload";
    }
  } catch (error) {
    console.error("Bulk upload error:", error);
    console.error("Error stack:", error.stack);
    responseEntries.error = true;
    responseEntries.message = error.message ? error.message : error;
    responseEntries.code = responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    res.send(responseEntries);
  }
}



async function uploadExcel(req, res) {
  const responseEntries = new ResponseEntry();
  let tempFilePath = null;
  
  try {
    console.log("Excel upload started");
    
    // Get the uploaded file from fastify-multipart
    const data = await req.file();
    
    if (!data) {
      throw new Error("No file uploaded. Please select an Excel file.");
    }

    // Create temporary file
    const tempDir = "temp_uploads/";
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    tempFilePath = path.join(tempDir, `upload_${Date.now()}_${data.filename}`);
    
    // Write file to disk
    const writeStream = fs.createWriteStream(tempFilePath);
    await data.file.pipe(writeStream);
    
    // Wait for file to be written
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    console.log(`File saved to: ${tempFilePath}`);
    
    // Read the Excel file
    const workbook = xlsx.readFile(tempFilePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const excelData = xlsx.utils.sheet_to_json(worksheet);
    
    console.log(`Read ${excelData.length} rows from Excel file`);
    
    if (excelData.length === 0) {
      throw new Error("Excel file is empty or has no data.");
    }

    // Map Excel columns to product fields
    const products = excelData.map((row, index) => {
      // Try different possible column names
      const productNo = row["Product No"] || row["product_no"] || row["ProductNo"] || 
                        row["Product Code"] || row["Code"] || `EXCEL-${Date.now()}-${index + 1}`;
      
      const productName = row["Product Name"] || row["product_name"] || row["ProductName"] || 
                          row["Name"] || row["Description"] || "";
      
      const productComposition = row["Composition"] || row["product_composition"] || 
                                row["ProductComposition"] || row["Material"] || "";
      
      const size = row["Size"] || row["size"] || row["Dimensions"] || "";
      
      const fabricName = row["Fabric"] || row["fabric_name"] || row["FabricName"] || 
                         row["Fabric Type"] || "";
      
      const washingDetails = row["Washing"] || row["washing_details"] || 
                            row["WashingDetails"] || row["Wash Care"] || row["Care Instructions"] || "";
      
      // Price fields
      const lowPrice = row["Low Price"] || row["low_quantity_price"] || row["lowPrice"] || 
                      row["Low"] || row["Price Low"] || row["Minimum Price"] || 0;
      
      const mediumPrice = row["Medium Price"] || row["medium_quantity_price"] || row["mediumPrice"] || 
                         row["Medium"] || row["Price Medium"] || row["Standard Price"] || 0;
      
      const highPrice = row["High Price"] || row["high_quantity_price"] || row["highPrice"] || 
                       row["High"] || row["Price High"] || row["Maximum Price"] || 0;
      
      const fillingMaterial = row["Filling"] || row["filling_material"] || 
                             row["FillingMaterial"] || row["Filling Material"] || null;
      
      const moq = row["MOQ"] || row["moq"] || row["Minimum Order Quantity"] || 
                 row["Min Order"] || "";
      
      const packaging = row["Packaging"] || row["packaging"] || 
                       row["Package"] || row["Packing"] || null;
      
      const productImage = row["Image"] || row["product_image"] || 
                          row["ProductImage"] || row["Image URL"] || null;
      
      const isActive = row["Active"] !== false && row["Active"] !== "No" && 
                      row["Active"] !== "N" && row["Active"] !== 0;

      return {
        productNo: String(productNo).trim(),
        productName: String(productName).trim(),
        productComposition: String(productComposition).trim(),
        size: String(size).trim(),
        fabricName: String(fabricName).trim(),
        washingDetails: String(washingDetails).trim(),
        low_quantity_price: parseFloat(lowPrice) || 0,
        medium_quantity_price: parseFloat(mediumPrice) || 0,
        high_quantity_price: parseFloat(highPrice) || 0,
        fillingMaterial: fillingMaterial ? String(fillingMaterial).trim() : null,
        moq: String(moq).trim(),
        packaging: packaging ? String(packaging).trim() : null,
        productImage: productImage ? String(productImage).trim() : null,
        isActive: isActive
      };
    });

    // Filter out empty rows
    const validProducts = products.filter(product => 
      product.productNo && product.productName && product.productComposition
    );

    if (validProducts.length === 0) {
      throw new Error("No valid product data found in Excel file. Please check column headers.");
    }

    console.log(`Found ${validProducts.length} valid products in Excel file`);
    
    const userId = req.user?.employeeId;
    
    // Use the bulk upload function
    responseEntries.data = await productServices.bulkUploadProducts(validProducts, userId);
    
    responseEntries.message = `Excel file processed successfully. ${responseEntries.data.successCount} products uploaded, ${responseEntries.data.failedCount} failed.`;
    
    if (responseEntries.data.failedProducts.length > 0) {
      responseEntries.warnings = {
        message: `Some products failed to upload:`,
        failedProducts: responseEntries.data.failedProducts.slice(0, 10)
      };
      
      if (responseEntries.data.failedProducts.length > 10) {
        responseEntries.warnings.message += ` (showing first 10 of ${responseEntries.data.failedProducts.length})`;
      }
    }
    
  } catch (error) {
    console.error("Excel upload error:", error);
    responseEntries.error = true;
    responseEntries.message = error.message ? error.message : "Failed to process Excel file";
    responseEntries.code = responseCode.BAD_REQUEST;
    res.status(responseCode.BAD_REQUEST);
  } finally {
    // Clean up temporary file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
        console.log("Temporary file deleted:", tempFilePath);
      } catch (cleanupError) {
        console.warn("Could not delete temporary file:", cleanupError.message);
      }
    }
    res.send(responseEntries);
  }
}

module.exports = async function (fastify) {
  fastify.route({
    method: "GET",
    url: "/products",
    preHandler: verifyToken,
    handler: getProducts,
  });

  fastify.route({
    method: "POST",
    url: "/products",
    preHandler: verifyToken,
    handler: createProduct,
  });

  fastify.route({
    method: "PUT",
    url: "/products/:productId",
    preHandler: verifyToken,
    handler: updateProduct,
  });

  fastify.route({
    method: "DELETE",
    url: "/products/:productId",
    preHandler: verifyToken,
    handler: deleteProduct,
  });

  fastify.route({
    method: "POST",
    url: "/products/bulk-upload",
    preHandler: verifyToken,
    handler: bulkUploadProducts,
  });

  fastify.route({
    method: "POST",
    url: "/products/upload-excel",
    preHandler: verifyToken,
    handler: uploadExcel,
  });

 
};