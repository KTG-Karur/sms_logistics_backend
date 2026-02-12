"use strict";

const sequelize = require('../models/index').sequelize;
const messages = require("../helpers/message");
const _ = require('lodash');
const { QueryTypes } = require('sequelize');

async function getHoliday(query) {
  try {
    let iql = "";
    let count = 0;
    if (query && Object.keys(query).length) {
      iql += `WHERE`;
      if (query.holidayId) {
        iql += count >= 1 ? ` AND` : ``;
        count++;
        iql += ` holiday_id = '${query.holidayId}'`;
      }
    }
    const result = await sequelize.query(`SELECT holiday_id "holidayId", is_active "isActive", holiday_date "holidayDate", reason, createdAt FROM holidays ${iql}`, {
      type: QueryTypes.SELECT,
      raw: true,
      nest: false
    });
    return result;
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

async function createHoliday(postData) {
  try {
    const excuteMethod = _.mapKeys(postData, (value, key) => _.snakeCase(key))
    const holidayResult = await sequelize.models.holiday.create(excuteMethod);
    const req = {
      holidayId: holidayResult.holiday_id
    }
    console.log("req")
    console.log(req)
    return await getHoliday(req);
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

async function updateHoliday(holidayId, putData) {
  try {
    const excuteMethod = _.mapKeys(putData, (value, key) => _.snakeCase(key))
    const holidayResult = await sequelize.models.holiday.update(excuteMethod, { where: { holiday_id: holidayId } });
    const req = {
      holidayId: holidayId
    }
    return await getHoliday(req);
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

module.exports = {
  getHoliday,
  updateHoliday,
  createHoliday
};