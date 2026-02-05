"use strict";

const sequelize = require("../models/index").sequelize;
const messages = require("../helpers/message");
const _ = require("lodash");
const { QueryTypes } = require("sequelize");

async function getDepartment(query, needIsActive = true) {
  try {
    let iql = "";
    let filter = [];
    if (query.departmentId) {
      filter.push(` de.department_id = '${query.departmentId}'`);
    }
    if (needIsActive) {
      filter.push(` de.is_active = 1`);
    }
    iql += filter.length > 0 ? `WHERE ${filter.join(" AND ")}` : "";
    const result = await sequelize.query(
      `SELECT de.department_id "departmentId",
        de.department_name "departmentName", de.is_active "isActive", de.created_at as createdAt, de.updated_at as updatedAt
        FROM department de
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

async function createDepartment(postData) {
  try {
    const excuteMethod = _.mapKeys(postData, (value, key) => _.snakeCase(key));
    if (excuteMethod?.name || false) {
      const existingDepartment = await sequelize.models.department.findOne({
        where: {
          name: excuteMethod.name,
        },
      });
      if (existingDepartment) {
        throw new Error(messages.DUPLICATE_ENTRY);
      }
    }
    const departmentResult = await sequelize.models.department.create(
      excuteMethod
    );
    const req = {
      departmentId: departmentResult.department_id,
    };
    return await getDepartment(req, false);
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

async function updateDepartment(departmentId, putData) {
  try {
    const excuteMethod = _.mapKeys(putData, (value, key) => _.snakeCase(key));
    if (excuteMethod?.name || false) {
      const existingDepartment = await sequelize.models.department.findOne({
        where: {
          name: excuteMethod.name,
        },
      });
      if (existingDepartment) {
        throw new Error(
          error.message ? error.message : messages.DUPLICATE_ENTRY
        );
      }
    }
    const departmentResult = await sequelize.models.department.update(
      excuteMethod,
      { where: { department_id: departmentId } }
    );
    const req = {
      departmentId: departmentId,
    };
    return await getDepartment(req, false);
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

module.exports = {
  getDepartment,
  updateDepartment,
  createDepartment,
};
