"use strict";

const sequelize = require("../models/index").sequelize;
const messages = require("../helpers/message");
const _ = require("lodash");
const { Querys, QueryTypes } = require("sequelize");
const { encrptPassword } = require("../utils/utility");
const { User } = require("../models/index");

async function getUser(query) {
  try {
    let iql = "";
    let filter = [];
    if (query.userId) {
      filter.push(` u.user_id = '${query.userId}'`);
    }
    iql += filter.length > 0 ? `WHERE ${filter.join(" AND ")}` : "";
    const result = await sequelize.query(
      `
      SELECT  
      u.user_id "userId", 
      u.user_name "userName", 
      u.password "password"
      FROM users u
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

async function createUser(postData) {
  try {
    const existingUser = await sequelize.models.users.findOne({
      where: { user_name: postData.user_name },
    });

    if (existingUser) {
      throw new Error("username already exist" + messages.DUPLICATE_ENTRY);
    }

    if (postData?.password) {
      postData.password = await encrptPassword(postData?.password);
    }

    const excuteMethod = _.mapKeys(postData, (value, key) => _.snakeCase(key));

    // Manually generate UUID
    const { v4: uuidv4 } = require("uuid");
    excuteMethod.user_id = uuidv4();

    const userResult = await sequelize.models.users.create(excuteMethod);

    return [
      {
        userId: userResult.user_id,
        userName: userResult.user_name,
      },
    ];
  } catch (error) {
    console.error("Error in createUser:", error);
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}
async function updateUser(userId, putData) {
  try {
    if (putData?.password) {
      putData.password = await encrptPassword(putData?.password);
    }
    const excuteMethod = _.mapKeys(putData, (value, key) => _.snakeCase(key));
    const userResult = await sequelize.models.users.update(excuteMethod, {
      where: { user_id: userId },
    });
    const req = {
      userId: userId,
    };
    return await getUser(req);
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

module.exports = {
  getUser,
  updateUser,
  createUser,
};
