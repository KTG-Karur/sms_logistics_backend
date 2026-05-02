"use strict";

const sequelize = require("../models/index").sequelize;
const messages = require("../helpers/message");
const _ = require("lodash");
const { QueryTypes } = require("sequelize");
const { decrptPassword } = require("../utils/utility");
const userServices = require("./user-service");
const path = require("path");
const fs = require("fs");

async function getCompany(query) {
  try {
    let iql = "";
    let filter = [];
    if (query.companyId) {
      filter.push(`co.company_id = '${query.companyId}'`);
    }
    iql += filter.length > 0 ? `WHERE ${filter.join(" AND ")}` : "";

    const result = await sequelize.query(
      `
      SELECT 
        co.company_id "companyId",
        co.company_name "companyName",
        co.company_mobile "companyMobile",
        co.company_alt_mobile "companyAltMobile",
        co.company_mail "companyMail",
        co.company_gst_no "companyGstNo",
        co.company_address_one "companyAddressOne",
        co.company_address_two "companyAddressTwo",
        co.company_logo "companyLogo",
        co.user_id "userId",
        us.user_name "userName",
        us.password "password",
        co.updatedAt
      FROM companies co
      LEFT JOIN users us ON us.user_id = co.user_id
      ${iql}
    `,
      {
        type: QueryTypes.SELECT,
        raw: true,
        nest: false,
      }
    );

    // 🔐 Decrypt password if available
    for (let company of result) {
      if (company.password) {
        company.password = await decrptPassword(company.password);
      }
    }

    return result;
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

async function updateCompany(companyId, putData) {
  const transaction = await sequelize.transaction();

  try {
    // Get existing company to handle old logo deletion
    const existingCompany = await sequelize.models.company.findOne({
      where: { company_id: companyId },
      transaction,
      raw: true,
    });

    if (!existingCompany) {
      throw new Error(messages.DATA_NOT_FOUND);
    }

    const excuteMethod = _.mapKeys(putData, (value, key) => _.snakeCase(key));

    // 🔁 If company has a linked user, update user login info too
    if (putData?.userId) {
      const userPayload = {};
      if (putData.userName) userPayload.user_name = putData.userName;
      if (putData.password) userPayload.password = putData.password;

      if (Object.keys(userPayload).length > 0) {
        await userServices.updateUser(putData.userId, userPayload, transaction);
      }
    }

    // 🏢 Update the company record
    await sequelize.models.company.update(excuteMethod, {
      where: { company_id: companyId },
      transaction,
    });

    // 🗑️ Delete old logo file if new logo was uploaded
    if (excuteMethod.company_logo && existingCompany.company_logo) {
      try {
        // Extract file path from URL
        let filePath = existingCompany.company_logo;
        if (filePath.startsWith('http')) {
          const url = require("url");
          const parsedUrl = new URL(filePath);
          filePath = parsedUrl.pathname;
        }
        
        if (filePath.startsWith('/')) {
          filePath = filePath.substring(1);
        }
        
        const fullPath = path.join(process.cwd(), filePath);
        
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          console.log("Deleted old company logo:", fullPath);
        }
      } catch (error) {
        console.error("Error deleting old logo file:", error);
        // Don't fail the transaction if file deletion fails
      }
    }

    await transaction.commit();

    const req = { companyId };
    return await getCompany(req);
  } catch (error) {
    await transaction.rollback();
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

module.exports = {
  getCompany,
  updateCompany,
};