"use strict";

const sequelize = require("../models/index").sequelize;
const messages = require("../helpers/message");
const _ = require("lodash");
const { QueryTypes } = require("sequelize");

async function getExpenceType(query, needIsActive = true) {
  try {
    let iql = "";
    let filter = [];
    if (query.expenceTypeId) {
      filter.push(` de.expence_type_id = '${query.expenceTypeId}'`);
    }
    if (needIsActive) {
      filter.push(` de.is_active = 1`);
    }
    iql += filter.length > 0 ? `WHERE ${filter.join(" AND ")}` : "";
    const result = await sequelize.query(
      `SELECT de.expence_type_id "expenceTypeId",
        de.expence_type_name "expenceTypeName", de.is_active "isActive", de.created_at as createdAt, de.updated_at as updatedAt
        FROM expence_type de
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

async function createExpenceType(postData) {
  try {
    const excuteMethod = _.mapKeys(postData, (value, key) => _.snakeCase(key));
    
    if (excuteMethod?.expence_type_name) {
      const existingExpenceType = await sequelize.models.expence_type.findOne({
        where: {
          expence_type_name: excuteMethod.expence_type_name,
        },
      });
      if (existingExpenceType) {
        throw new Error(messages.DUPLICATE_ENTRY);
      }
    }
    
    const expenceTypeResult = await sequelize.models.expence_type.create(
      excuteMethod
    );
    
    const req = {
      expenceTypeId: expenceTypeResult.expence_type_id,
    };
    return await getExpenceType(req, false);
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

async function updateExpenceType(expenceTypeId, putData) {
  try {
    const excuteMethod = _.mapKeys(putData, (value, key) => _.snakeCase(key));
    
    if (excuteMethod?.expence_type_name) {
      const existingExpenceType = await sequelize.models.expence_type.findOne({
        where: {
          expence_type_name: excuteMethod.expence_type_name,
          expence_type_id: { [sequelize.Sequelize.Op.ne]: expenceTypeId } 
        },
      });
      if (existingExpenceType) {
        throw new Error(messages.DUPLICATE_ENTRY);
      }
    }
    
    await sequelize.models.expence_type.update(
      excuteMethod,
      { where: { expence_type_id: expenceTypeId } }
    );
    
    const req = {
      expenceTypeId: expenceTypeId,
    };
    return await getExpenceType(req, false);
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

module.exports = {
  getExpenceType,
  updateExpenceType,
  createExpenceType,
};