"use strict";
const sequelize = require("../models/index").sequelize;
const messages = require("../helpers/message");
const _ = require("lodash");
const { QueryTypes, Op } = require("sequelize");

async function getProductEnquiries(query) {
  try {
    let where = [];
    let params = {};

    if (query.enquiryId) {
      where.push(`pe.enquiry_id = :enquiryId`);
      params.enquiryId = query.enquiryId;
    }

    if (query.enquiryNo) {
      where.push(`pe.enquiry_no LIKE :enquiryNo`);
      params.enquiryNo = `%${query.enquiryNo}%`;
    }

    if (query.expoId) {
      where.push(`pe.expo_id = :expoId`);
      params.expoId = query.expoId;
    }

    if (query.status) {
      where.push(`pe.status = :status`);
      params.status = query.status;
    }

    if (query.productId) {
      where.push(`
        JSON_CONTAINS(
          pe.products,
          JSON_OBJECT('productId', :productId)
        )
      `);
      params.productId = query.productId;
    }

    if (query.fromDate && query.toDate) {
      where.push(`DATE(pe.enquiry_date) BETWEEN :fromDate AND :toDate`);
      params.fromDate = query.fromDate;
      params.toDate = query.toDate;
    } else if (query.fromDate) {
      where.push(`DATE(pe.enquiry_date) >= :fromDate`);
      params.fromDate = query.fromDate;
    } else if (query.toDate) {
      where.push(`DATE(pe.enquiry_date) <= :toDate`);
      params.toDate = query.toDate;
    }
    
    if (query.search) {
      where.push(`(
        pe.enquiry_no LIKE :search OR 
        pe.visitor_name LIKE :search OR 
        pe.company_name LIKE :search OR 
        pe.email LIKE :search OR 
        pe.contact_number LIKE :search OR
        ex.expo_name LIKE :search OR
        pe.country LIKE :search OR
        pe.city LIKE :search OR
        pe.nature_of_enquiry LIKE :search
      )`);
      params.search = `%${query.search}%`;
    }

    // Show ALL enquiries by default (both active and inactive)
    // Only filter by is_active if explicitly requested
    if (query.showActiveOnly) {
      where.push(`pe.is_active = 1`);
    }

    const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const result = await sequelize.query(
      `SELECT 
        pe.enquiry_id AS "enquiryId",
        pe.enquiry_no AS "enquiryNo",
        pe.expo_id AS "expoId",
        pe.visitor_name AS "visitorName",
        pe.visiting_card AS "visitingCard",
        pe.company_name AS "companyName",
        pe.city,
        pe.country,
        pe.email,
        pe.contact_number AS "contactNumber",
        pe.nature_of_enquiry AS "natureOfEnquiry",
        pe.remarks,
        pe.is_active AS "isActive",
        pe.enquiry_date AS "enquiryDate",
        pe.follow_up_date AS "followUpDate",
        pe.products,
        pe.created_at AS "createdAt",
        pe.updated_at AS "updatedAt",
        pe.created_by AS "createdBy",
        pe.updated_by AS "updatedBy",
        ex.expo_name AS "expoName",
        ex.country AS "expoCountry",
        ex.place AS "expoPlace",
        emp_created.employee_name AS "createdByName",
        emp_updated.employee_name AS "updatedByName"
      FROM product_enquiries pe
      LEFT JOIN expos ex ON ex.expo_id = pe.expo_id
      LEFT JOIN employees emp_created ON emp_created.employee_id = pe.created_by
      LEFT JOIN employees emp_updated ON emp_updated.employee_id = pe.updated_by
      ${whereSQL}
      ORDER BY pe.is_active DESC, pe.created_at DESC`,
      {
        type: QueryTypes.SELECT,
        replacements: params,
      }
    );

    // Parse products JSON and add expo details
    return result.map((enquiry) => ({
      ...enquiry,
      products:
        typeof enquiry.products === "string"
          ? JSON.parse(enquiry.products)
          : enquiry.products,
    }));
  } catch (error) {
    throw new Error(error.message || messages.OPERATION_ERROR);
  }
}

// Helper function to get product details by IDs
async function getProductDetailsByIds(productIds) {
  try {
    if (!productIds || productIds.length === 0) {
      return [];
    }

    // Convert to unique IDs to avoid duplicates
    const uniqueProductIds = [...new Set(productIds)];

    const products = await sequelize.query(
      `SELECT 
        product_id as "productId",
        product_no as "productNo",
        product_name as "productName",
        product_composition as "productComposition",
        size,
        fabric_name as "fabricName",
        washing_details as "washingDetails",
        filling_material as "fillingMaterial",
        low_quantity_price,
        medium_quantity_price,
        high_quantity_price,
        moq,
        packaging,
        product_image as "productImage"
      FROM products 
      WHERE product_id IN (?) AND is_active = 1`,
      {
        type: QueryTypes.SELECT,
        replacements: [uniqueProductIds],
      }
    );

    return products;
  } catch (error) {
    console.error('Error fetching product details:', error);
    throw new Error(`Failed to fetch product details: ${error.message}`);
  }
}

// Helper function to determine price based on quantity
function determinePrice(priceType, lowPrice, mediumPrice, highPrice) {
  switch(priceType) {
    case 'low_quantity_price':
      return lowPrice;
    case 'medium_quantity_price':
      return mediumPrice;
    case 'high_quantity_price':
      return highPrice;
    default:
      return mediumPrice; // Default to medium price
  }
}

// Helper function to format product data for enquiry
function formatProductsForEnquiry(selectedProducts, productDetails) {
  return selectedProducts.map((selectedProduct) => {
    const productDetail = productDetails.find(
      (p) => p.productId === selectedProduct.productId
    );

    if (!productDetail) {
      throw new Error(`Product with ID ${selectedProduct.productId} not found`);
    }

    // Determine the actual price based on price type
    const actualPrice = determinePrice(
      selectedProduct.price,
      productDetail.low_quantity_price,
      productDetail.medium_quantity_price,
      productDetail.high_quantity_price
    );

    return {
      productId: selectedProduct.productId,
      productNo: productDetail.productNo,
      productName: productDetail.productName,
      productImage:
        productDetail.productImage || "/assets/images/default-product.jpg",
      price: parseFloat(actualPrice).toFixed(2),
      priceType: selectedProduct.price, // Keep the price type for reference
      productComposition: productDetail.productComposition,
      size: productDetail.size,
      fabricName: productDetail.fabricName,
      washingDetails: productDetail.washingDetails,
      fillingMaterial: productDetail.fillingMaterial,
      moq: productDetail.moq,
      packaging: productDetail.packaging,
      sampleRequired: selectedProduct.sampleRequired || false,
      quantity: selectedProduct.quantity || 0,
      remarks: selectedProduct.remarks || "",
    };
  });
}

async function createProductEnquiry(postData, userId) {
  const transaction = await sequelize.transaction();
  try {
    // Generate enquiry number
    const lastEnquiry = await sequelize.models.ProductEnquiry.findOne({
      order: [["created_at", "DESC"]],
      transaction,
    });

    let enquiryNumber = "ENQ-001";
    if (lastEnquiry) {
      const lastNumber = parseInt(lastEnquiry.enquiry_no.split("-")[1]);
      enquiryNumber = `ENQ-${String(lastNumber + 1).padStart(3, "0")}`;
    }

    const productIds = postData.products.map((p) => p.productId);
    const productDetails = await getProductDetailsByIds(productIds);

    if (productDetails.length !== productIds.length) {
      const foundIds = productDetails.map(p => p.productId);
      const missingIds = productIds.filter(id => !foundIds.includes(id));
      throw new Error(`Products not found or inactive: ${missingIds.join(', ')}`);
    }

    // Format products with details
    const formattedProducts = formatProductsForEnquiry(
      postData.products,
      productDetails
    );

    const executeMethod = _.mapKeys(postData, (value, key) => _.snakeCase(key));
    executeMethod.enquiry_no = enquiryNumber;
    executeMethod.created_by = userId;
    executeMethod.products = formattedProducts;
    executeMethod.is_active = true; // Always set to active when creating

    // Set default dates if not provided
    if (!executeMethod.enquiry_date) {
      executeMethod.enquiry_date = new Date().toISOString().split("T")[0];
    }

    if (!executeMethod.follow_up_date) {
      const followUpDate = new Date();
      followUpDate.setDate(followUpDate.getDate() + 7);
      executeMethod.follow_up_date = followUpDate.toISOString().split("T")[0];
    }

    // Validate expo exists
    const expo = await sequelize.models.expo.findOne({
      where: { expo_id: executeMethod.expo_id },
      transaction,
    });

    if (!expo) {
      throw new Error("Expo not found");
    }

    const enquiryResult = await sequelize.models.ProductEnquiry.create(
      executeMethod,
      {
        transaction,
      }
    );

    await transaction.commit();

    // Return the created enquiry with full details
    const req = { enquiryId: enquiryResult.enquiry_id };
    return await getProductEnquiries(req);
  } catch (error) {
    await transaction.rollback();
    throw new Error(error?.message ? error.message : messages.OPERATION_ERROR);
  }
}

async function updateProductEnquiry(enquiryId, putData, userId) {
  const transaction = await sequelize.transaction();
  try {
    const executeMethod = _.mapKeys(putData, (value, key) => _.snakeCase(key));
    executeMethod.updated_by = userId;

    // Handle product updates if products are being modified
    if (executeMethod.products) {
      const productIds = executeMethod.products.map((p) => p.productId);
      const productDetails = await getProductDetailsByIds(productIds);

      if (productDetails.length !== productIds.length) {
        throw new Error("Some products were not found or are inactive");
      }

      // Format products with details
      executeMethod.products = formatProductsForEnquiry(
        executeMethod.products,
        productDetails
      );
    }

    // Validate expo exists if being updated
    if (executeMethod.expo_id) {
      const expo = await sequelize.models.expo.findOne({
        where: { expo_id: executeMethod.expo_id },
        transaction,
      });

      if (!expo) {
        throw new Error("Expo not found");
      }
    }

    const [affectedRows] = await sequelize.models.ProductEnquiry.update(
      executeMethod,
      {
        where: { enquiry_id: enquiryId },
        transaction,
      }
    );

    if (affectedRows === 0) {
      throw new Error("Product enquiry not found");
    }

    await transaction.commit();

    const req = { enquiryId };
    return await getProductEnquiries(req);
  } catch (error) {
    await transaction.rollback();
    throw new Error(error?.message ? error.message : messages.OPERATION_ERROR);
  }
}

async function deleteProductEnquiry(enquiryId, userId) {
  const transaction = await sequelize.transaction();
  try {
    const [affectedRows] = await sequelize.models.ProductEnquiry.update(
      {
        is_active: false,
        updated_by: userId,
      },
      {
        where: { enquiry_id: enquiryId },
        transaction,
      }
    );

    if (affectedRows === 0) {
      throw new Error("Product enquiry not found");
    }

    await transaction.commit();
    return { message: "Product enquiry deactivated successfully" };
  } catch (error) {
    await transaction.rollback();
    throw new Error(error?.message ? error.message : messages.OPERATION_ERROR);
  }
}

// Get statistics for dashboard - count both active and inactive
async function getEnquiryStatistics() {
  try {
    const result = await sequelize.query(
      `SELECT 
        COUNT(*) as totalEnquiries,
        COUNT(CASE WHEN is_active = true THEN 1 END) as activeEnquiries,
        COUNT(CASE WHEN is_active = false THEN 1 END) as inactiveEnquiries,
        COUNT(DISTINCT expo_id) as totalExpos,
        COUNT(DISTINCT country) as totalCountries
      FROM product_enquiries`
    );

    return result[0][0];
  } catch (error) {
    throw new Error(error.message || messages.OPERATION_ERROR);
  }
}

async function removeVisitingCardImage(enquiryId, imageName, userId) {
  const transaction = await sequelize.transaction();

  try {
    const enquiry = await sequelize.models.ProductEnquiry.findOne({
      where: { enquiry_id: enquiryId },
      transaction,
    });

    if (!enquiry) {
      throw new Error("Product enquiry not found");
    }

    let images = enquiry.visiting_card;

    try {
      images = JSON.parse(images || "[]");
    } catch {
      images = [];
    }

    if (!Array.isArray(images)) {
      images = [];
    }

    const filteredImages = images.filter((img) => img !== imageName);

    await sequelize.models.ProductEnquiry.update(
      {
        visiting_card: JSON.stringify(filteredImages),
        updated_by: userId,
      },
      {
        where: { enquiry_id: enquiryId },
        transaction,
      }
    );

    await transaction.commit();

    return {
      enquiryId,
      removed: imageName,
      remainingImages: filteredImages,
    };
  } catch (error) {
    await transaction.rollback();
    throw new Error(error.message || "Something went wrong");
  }
}

module.exports = {
  getProductEnquiries,
  createProductEnquiry,
  updateProductEnquiry,
  deleteProductEnquiry,
  getEnquiryStatistics,
  removeVisitingCardImage,
};
