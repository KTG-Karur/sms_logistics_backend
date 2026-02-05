"use strict";

const sequelize = require("../models/index").sequelize;
const messages = require("../helpers/message");
const _ = require("lodash");
const { QueryTypes } = require("sequelize");

async function getExpo(query) {
  try {
    let where = [];

    if (query.expoId) {
      where.push(` ex.expo_id = '${query.expoId}'`);
    }

    if (!query.showAll) {
      where.push(` ex.is_active = 1`);
    }

    const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const result = await sequelize.query(
      `
      SELECT
        ex.expo_id     AS "expoId",
        ex.expo_name   AS "expoName",
        ex.country,
        ex.place,
        ex.from_date   AS "fromDate",
        ex.to_date     AS "toDate",
        ex.year,
        ex.is_completed AS "isCompleted",
        ex.is_active AS "isActive",
        ex.staff,
        ex.created_at AS "createdAt",
        ex.updated_at AS "updatedAt"
      FROM expos ex
      ${whereSQL}
      `,
      { type: QueryTypes.SELECT, raw: true }
    );

    return result.map((r) => ({
      ...r,
      staff: r.staff ? JSON.parse(r.staff) : [],
    }));
  } catch (error) {
    throw new Error(error.message || messages.OPERATION_ERROR);
  }
}

async function createExpo(postData) {
  try {
    const data = _.mapKeys(postData, (v, k) => _.snakeCase(k));

    if (data.expo_name) {
      const exists = await sequelize.models.expo.findOne({
        where: { expo_name: data.expo_name },
      });
      if (exists) throw new Error(messages.DUPLICATE_ENTRY);
    }

    const result = await sequelize.models.expo.create(data);

    return await getExpo({ expoId: result.expo_id }, false);
  } catch (error) {
    throw new Error(error.message || messages.OPERATION_ERROR);
  }
}

async function updateExpo(expoId, putData) {
  try {
    const { Op } = require("sequelize");

    const data = _.mapKeys(putData, (v, k) => _.snakeCase(k));

    if (data.expo_name) {
      const exists = await sequelize.models.expo.findOne({
        where: {
          expo_name: data.expo_name,
          expo_id: { [Op.ne]: expoId },
        },
      });

      if (exists) throw new Error(messages.DUPLICATE_ENTRY);
    }

    await sequelize.models.expo.update(data, {
      where: { expo_id: expoId },
    });

    return await getExpo({ expoId }, false);
  } catch (error) {
    throw new Error(error.message || messages.OPERATION_ERROR);
  }
}

module.exports = {
  getExpo,
  createExpo,
  updateExpo,
};
