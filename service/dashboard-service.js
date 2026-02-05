"use strict";
const sequelize = require("../models/index").sequelize;
const { QueryTypes, Op } = require("sequelize");

async function getDashboardStatistics() {
  try {
    // Get total visitors (all enquiries)
    const totalVisitorsQuery = `
      SELECT COUNT(*) as totalVisitors 
      FROM product_enquiries 
      WHERE is_active = true
    `;

    // Get active enquiries
    const activeEnquiriesQuery = `
      SELECT COUNT(*) as activeEnquiries 
      FROM product_enquiries 
      WHERE status = 'active' AND is_active = true
    `;

    // Get total products
    const totalProductsQuery = `
      SELECT COUNT(*) as totalProducts 
      FROM products 
      WHERE is_active = true
    `;

    // Get sample requests count - compatible with older MySQL/MariaDB
    const sampleRequestsQuery = `
      SELECT COUNT(DISTINCT pe.enquiry_id) as sampleRequests
      FROM product_enquiries pe
      WHERE pe.is_active = true 
      AND (
        pe.products LIKE '%"sampleRequired":true%' 
        OR pe.products LIKE '%"sampleRequired": true%'
      )
    `;

    // Execute all queries
    const [totalVisitors, activeEnquiries, totalProducts, sampleRequests] =
      await Promise.all([
        sequelize.query(totalVisitorsQuery, { type: QueryTypes.SELECT }),
        sequelize.query(activeEnquiriesQuery, { type: QueryTypes.SELECT }),
        sequelize.query(totalProductsQuery, { type: QueryTypes.SELECT }),
        sequelize.query(sampleRequestsQuery, { type: QueryTypes.SELECT }),
      ]);

    return {
      totalVisitors: parseInt(totalVisitors[0]?.totalVisitors || 0),
      activeEnquiries: parseInt(activeEnquiries[0]?.activeEnquiries || 0),
      totalProducts: parseInt(totalProducts[0]?.totalProducts || 0),
      sampleRequests: parseInt(sampleRequests[0]?.sampleRequests || 0),
    };
  } catch (error) {
    throw new Error(`Failed to fetch dashboard statistics: ${error.message}`);
  }
}

async function getRecentEnquiries(limit = 5) {
  try {
    const query = `
      SELECT 
        pe.enquiry_id as "enquiryId",
        pe.enquiry_no as "enquiryNo",
        pe.expo_id as "expoId",
        pe.visitor_name as "visitorName",
        pe.visiting_card as "visitingCard",
        pe.company_name as "companyName",
        pe.city,
        pe.country,
        pe.email,
        pe.contact_number as "contactNumber",
        pe.nature_of_enquiry as "natureOfEnquiry",
        pe.remarks,
        pe.status,
        pe.enquiry_date as "enquiryDate",
        pe.follow_up_date as "followUpDate",
        pe.products,
        pe.created_at as "createdAt",
        ex.expo_name as "expoName"
      FROM product_enquiries pe
      LEFT JOIN expos ex ON ex.expo_id = pe.expo_id
      WHERE pe.is_active = true
      ORDER BY pe.created_at DESC
      LIMIT ?
    `;

    const enquiries = await sequelize.query(query, {
      type: QueryTypes.SELECT,
      replacements: [limit],
    });

    // Parse products JSON and format for frontend
    return enquiries.map((enquiry) => {
      let products = [];
      try {
        products =
          typeof enquiry.products === "string"
            ? JSON.parse(enquiry.products)
            : enquiry.products || [];
      } catch (e) {
        console.error("Error parsing products JSON:", e);
        products = [];
      }

      return {
        id: enquiry.enquiryId,
        enquiryNo: enquiry.enquiryNo,
        expoName: enquiry.expoName,
        visitorName: enquiry.visitorName,
        visitingCard: enquiry.visitingCard,
        companyName: enquiry.companyName,
        city: enquiry.city,
        country: enquiry.country,
        email: enquiry.email,
        contactNumber: enquiry.contactNumber,
        natureOfEnquiry: enquiry.natureOfEnquiry,
        products: products.map((p) => ({
          productNo: p.productNo,
          productName: p.productName,
          quantity: p.quantity || 0,
          sampleRequired: p.sampleRequired || false,
        })),
        status: enquiry.status,
        enquiryDate: enquiry.enquiryDate,
      };
    });
  } catch (error) {
    throw new Error(`Failed to fetch recent enquiries: ${error.message}`);
  }
}

async function getTopProducts(limit = 5) {
  try {
    // First, get all enquiries with their products
    const enquiriesQuery = `
      SELECT products 
      FROM product_enquiries 
      WHERE is_active = true
    `;

    const enquiries = await sequelize.query(enquiriesQuery, {
      type: QueryTypes.SELECT,
    });

    // Count product enquiries manually
    const productCounts = {};

    enquiries.forEach((enquiry) => {
      let products = [];
      try {
        products =
          typeof enquiry.products === "string"
            ? JSON.parse(enquiry.products)
            : enquiry.products || [];
      } catch (e) {
        console.error("Error parsing products:", e);
        return;
      }

      products.forEach((product) => {
        if (product.productId) {
          productCounts[product.productId] =
            (productCounts[product.productId] || 0) + 1;
        }
      });
    });

    // Get product details for the top products
    const topProductIds = Object.entries(productCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([productId]) => productId);

    if (topProductIds.length === 0) {
      return [];
    }

    const placeholders = topProductIds.map(() => "?").join(",");
    const productsQuery = `
      SELECT 
        product_id as "productId",
        product_no as "productNo",
        product_name as "productName"
      FROM products 
      WHERE product_id IN (${placeholders}) 
      AND is_active = true
    `;

    const products = await sequelize.query(productsQuery, {
      type: QueryTypes.SELECT,
      replacements: topProductIds,
    });

    // Combine product details with counts
    return products
      .map((product) => ({
        productId: product.productId,
        productNo: product.productNo,
        productName: product.productName,
        enquiryCount: productCounts[product.productId] || 0,
      }))
      .sort((a, b) => b.enquiryCount - a.enquiryCount);
  } catch (error) {
    throw new Error(`Failed to fetch top products: ${error.message}`);
  }
}

async function getCountryWiseSummary(limit = 10) {
  try {
    const query = `
      SELECT 
        country,
        COUNT(*) as count
      FROM product_enquiries 
      WHERE is_active = true
      GROUP BY country 
      ORDER BY count DESC
      LIMIT ?
    `;

    const countrySummary = await sequelize.query(query, {
      type: QueryTypes.SELECT,
      replacements: [limit],
    });

    return countrySummary;
  } catch (error) {
    throw new Error(`Failed to fetch country summary: ${error.message}`);
  }
}

async function getExpoPerformance() {
  try {
    const query = `
      SELECT 
        ex.expo_id as "expoId",
        ex.expo_name as "expoName",
        COUNT(pe.enquiry_id) as enquiryCount
      FROM expos ex
      LEFT JOIN product_enquiries pe ON ex.expo_id = pe.expo_id AND pe.is_active = true
      WHERE ex.is_active = true
      GROUP BY ex.expo_id, ex.expo_name
      ORDER BY enquiryCount DESC
    `;

    const expoPerformance = await sequelize.query(query, {
      type: QueryTypes.SELECT,
    });

    // Calculate percentages
    const totalEnquiries = expoPerformance.reduce(
      (sum, expo) => sum + parseInt(expo.enquiryCount || 0),
      0
    );

    return expoPerformance.map((expo) => ({
      expo: expo.expoName,
      count: parseInt(expo.enquiryCount || 0),
      percentage:
        totalEnquiries > 0
          ? ((parseInt(expo.enquiryCount || 0) / totalEnquiries) * 100).toFixed(
              1
            )
          : "0.0",
    }));
  } catch (error) {
    throw new Error(`Failed to fetch expo performance: ${error.message}`);
  }
}

async function getQuickStats() {
  try {
    // Get all enquiries to calculate average products
    const enquiriesQuery = `
      SELECT products 
      FROM product_enquiries 
      WHERE is_active = true
    `;

    const enquiries = await sequelize.query(enquiriesQuery, {
      type: QueryTypes.SELECT,
    });

    let totalProducts = 0;
    let totalEnquiries = 0;
    let activeEnquiries = 0;

    enquiries.forEach((enquiry) => {
      let products = [];
      try {
        products =
          typeof enquiry.products === "string"
            ? JSON.parse(enquiry.products)
            : enquiry.products || [];
      } catch (e) {
        console.error("Error parsing products:", e);
        return;
      }

      totalProducts += products.length;
      totalEnquiries++;

      // Check if enquiry is active (you might need to adjust this based on your status logic)
      if (enquiry.status === "active") {
        activeEnquiries++;
      }
    });

    // Top country
    const topCountryQuery = `
      SELECT country
      FROM product_enquiries 
      WHERE is_active = true
      GROUP BY country 
      ORDER BY COUNT(*) DESC 
      LIMIT 1
    `;

    const topCountryResult = await sequelize.query(topCountryQuery, {
      type: QueryTypes.SELECT,
    });

    return {
      avgProducts:
        totalEnquiries > 0
          ? (totalProducts / totalEnquiries).toFixed(1)
          : "0.0",
      conversionRate:
        totalEnquiries > 0
          ? ((activeEnquiries / totalEnquiries) * 100).toFixed(1)
          : "0.0",
      topCountry: topCountryResult[0]?.country || "N/A",
    };
  } catch (error) {
    throw new Error(`Failed to fetch quick stats: ${error.message}`);
  }
}

async function getDashboardData() {
  try {
    const [
      statistics,
      recentEnquiries,
      topProducts,
      countrySummary,
      expoPerformance,
      quickStats,
    ] = await Promise.all([
      getDashboardStatistics(),
      getRecentEnquiries(),
      getTopProducts(),
      getCountryWiseSummary(),
      getExpoPerformance(),
      getQuickStats(),
    ]);

    return {
      statistics,
      recentEnquiries,
      topProducts,
      countrySummary,
      expoPerformance,
      quickStats,
    };
  } catch (error) {
    throw new Error(`Failed to fetch dashboard data: ${error.message}`);
  }
}

module.exports = {
  getDashboardStatistics,
  getRecentEnquiries,
  getTopProducts,
  getCountryWiseSummary,
  getExpoPerformance,
  getQuickStats,
  getDashboardData,
};
