"use strict";

const sequelize = require("../models/index").sequelize;
const messages = require("../helpers/message");
const _ = require("lodash");
const { QueryTypes } = require("sequelize");

async function getPage(query) {
  try {
    let iql = "";
    let count = 0;
    if (query && Object.keys(query).length) {
      iql += `WHERE`;
      if (query.pageId) {
        iql += count >= 1 ? ` AND` : ``;
        count++;
        iql += ` pa.page_id = ${query.pageId}`;
      }
      if (query.isActive) {
        iql += count >= 1 ? ` AND` : ``;
        count++;
        iql += ` pa.is_active = ${query.isActive}`;
      }
    }
    const result = await sequelize.query(
      `
    SELECT 
    pa.page_id AS "pageId",pa.page_id AS "id",
    pa.title AS "title",
    pa.parent_id AS "parentId",
    p.page_name AS "parentName",
    pa.icon_name AS "iconName",
    pa.page_name AS "pageName", pa.page_name AS "text",
    pa.page_url AS "pageUrl",
    pa.is_title AS "isTitle",
    CONCAT('[', GROUP_CONCAT(JSON_OBJECT('accessId', a.access_id,'id', CONCAT(UPPER(SUBSTRING(a.access_name, 1, 1)), '_', a.access_id), 'accessName', a.access_name,'text',a.access_name,
    'extraKey',a.access_id, 'parentId',pa.page_id)), ']') AS access
    FROM pages pa
    LEFT JOIN pages p ON p.page_id = pa.parent_id
    LEFT JOIN access a ON FIND_IN_SET(a.access_id, pa.access_ids) > 0
    ${iql}
    GROUP BY pa.page_id
    ORDER BY pa.id ASC `,
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

async function createPage(postData) {
  try {
    const excuteMethod = _.mapKeys(postData, (value, key) => _.snakeCase(key));
    const pageResult = await sequelize.models.pages.create(excuteMethod);
    const req = {
      pageId: pageResult.page_id,
    };
    return await getPage(req);
  } catch (error) {
    throw new Error(error?.message ? error.message : messages.OPERATION_ERROR);
  }
}

async function updatePage(pageId, putData) {
  try {
    const excuteMethod = _.mapKeys(putData, (value, key) => _.snakeCase(key));
    const pageResult = await sequelize.models.pages.update(excuteMethod, {
      where: { page_id: pageId },
    });
    const req = {
      pageId: pageId,
    };
    return await getPage(req);
  } catch (error) {
    throw new Error(error?.message ? error.message : messages.OPERATION_ERROR);
  }
}

module.exports = {
  getPage,
  updatePage,
  createPage,
};
