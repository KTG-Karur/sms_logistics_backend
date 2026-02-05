"use strict";

const sequelize = require("../models/index").sequelize;
const messages = require("../helpers/message");
const _ = require("lodash");
const { QueryTypes } = require("sequelize");
const { decrptPassword } = require("../utils/utility");
const userServices = require("./user-service");

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
  try {
    const excuteMethod = _.mapKeys(putData, (value, key) => _.snakeCase(key));

    // 🔁 If company has a linked user, update user login info too
    if (putData?.userId) {
      const userPayload = {};
      if (putData.userName) userPayload.user_name = putData.userName;
      if (putData.password) userPayload.password = putData.password;

      if (Object.keys(userPayload).length > 0) {
        await userServices.updateUser(putData.userId, userPayload);
      }
    }

    // 🏢 Update the company record
    await sequelize.models.company.update(excuteMethod, {
      where: { company_id: companyId },
    });

    const req = { companyId };
    return await getCompany(req);
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

module.exports = {
  getCompany,
  updateCompany,
};
