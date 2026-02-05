"use strict";

const sequelize = require("../models/index").sequelize;
const messages = require("../helpers/message");
const _ = require("lodash");
const { QueryTypes } = require("sequelize");

async function getDesignation(query, needIsActive = true) {
  try {
    let iql = "";
    let filter = [];
    if (query.designationId) {
      filter.push(` de.designation_id = '${query.designationId}'`);
    }
    if (needIsActive) {
      filter.push(` de.is_active = 1`);
    }
    iql += filter.length > 0 ? `WHERE ${filter.join(" AND ")}` : "";
    const result = await sequelize.query(
      `SELECT de.designation_id "designationId",
        de.designation_name "designationName", de.is_active "isActive", de.created_at as createdAt, de.updated_at as updatedAt
        FROM designation de
        ${iql}`,
      {
        type: QueryTypes.SELECT,
        raw: true,
        nest: false,
      }
    );
    return result;
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

async function createDesignation(postData) {
  try {
    const excuteMethod = _.mapKeys(postData, (value, key) => _.snakeCase(key));
    if (excuteMethod?.name || false) {
      const existingDesignation = await sequelize.models.designation.findOne({
        where: {
          name: excuteMethod.name,
        },
      });
      if (existingDesignation) {
        throw new Error(messages.DUPLICATE_ENTRY);
      }
    }
    const designationResult = await sequelize.models.designation.create(
      excuteMethod
    );
    const req = {
      designationId: designationResult.designation_id,
    };
    return await getDesignation(req, false);
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

async function updateDesignation(designationId, putData) {
  try {
    const excuteMethod = _.mapKeys(putData, (value, key) => _.snakeCase(key));
    if (excuteMethod?.name || false) {
      const existingDesignation = await sequelize.models.designation.findOne({
        where: {
          name: excuteMethod.name,
        },
      });
      if (existingDesignation) {
        throw new Error(
          error.message ? error.message : messages.DUPLICATE_ENTRY
        );
      }
    }
    const designationResult = await sequelize.models.designation.update(
      excuteMethod,
      { where: { designation_id: designationId } }
    );
    const req = {
      designationId: designationId,
    };
    return await getDesignation(req, false);
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

module.exports = {
  getDesignation,
  updateDesignation,
  createDesignation,
};
