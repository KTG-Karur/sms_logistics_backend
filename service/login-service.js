"use strict";
const sequelize = require("../models/index").sequelize;
const messages = require("../helpers/message");
const _ = require("lodash");
const fastify = require("../app");
const { QueryTypes } = require("sequelize");
const { decrptPassword, encryptObject } = require("../utils/utility");
// const { getRolePermission } = require('./role-permission-service');
const { getPage } = require("./page-service");
// import { v4 as uuidv4 } from 'uuid';
const { v4: uuidv4 } = require("uuid");
const { getRolePermission } = require("./role-permission-service");

async function getOrganizationLogin(query) {
  try {
    let filters = [];
    if (query && Object.keys(query).length) {
      if (query.userName) {
        filters.push(`u.user_name = '${query.userName}'`);
      }
    }
    filters.push(`s.is_active = 1`);
    const whereClause =
      filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
    const result = await sequelize.query(
      `
            SELECT 
            s.employee_id "staffId",  
            s.employee_name as "staffName",
            r.role_id "roleId",
            r.role_name "roleName",
            u.user_id "userId", 
            user_name "userName", 
            password
            FROM users u
            left join employees s on s.user_id = u.user_id 
            left join roles r on r.role_id = u.role_id  ${whereClause}`,
      {
        type: QueryTypes.SELECT,
        raw: true,
        nest: false,
      }
    );

    if (result.length > 0) {
      const roleId = result[0].roleId;
      const decrptPasswordData = await decrptPassword(result[0]?.password);
      if (decrptPasswordData === query.password) {
        const queryReq = {
          roleId: result[0].roleId,
        };
        const rolePermission = await getRolePermission(queryReq);
        const pagesList = await getPage();

        const rolePermissionData = JSON.parse(rolePermission[0].accessIds);
        const rolePermissionArr = rolePermissionData.access;
        const pagesData = [];
        let titleReq = {};
        const filterData = pagesList.forEach((page) => {
          if (page.isTitle === 1) {
            titleReq = {
              pageId: page.pageId,
              label: page.title,
              isTitle: true,
            };
          }

          const permissionPage = _.filter(rolePermissionArr, (o) => {
            const titlePushed = pagesData.find(
              (obj) => obj.pageId === titleReq?.pageId
            );

            if (o.pageId === page.pageId) {
              if (!titlePushed) {
                pagesData.push(titleReq);
              }

              if (page.parentId) {
                let parentChecker = pagesData.find(
                  (obj) => obj.pageId === page.parentId
                );

                if (parentChecker) {
                  parentChecker.children = parentChecker.children || [];
                  parentChecker.children.push({
                    label: page.pageName,
                    url: page.pageUrl,
                    parentKey: parentChecker.label,
                    access: o.accessPermission.join(", "),
                  });
                } else {
                  let parentObject = _.find(pagesList, {
                    pageId: page.parentId,
                  });

                  if (parentObject) {
                    let data = {
                      pageId: parentObject.pageId,
                      label: parentObject.pageName,
                      isTitle: false,
                      icon: parentObject.iconName,
                      children: [
                        {
                          label: page.pageName,
                          url: page.pageUrl,
                          parentKey: parentObject.pageName,
                          access: o.accessPermission.join(", "),
                        },
                      ],
                    };
                    pagesData.push(data);
                  }
                }
              } else if (page.pageUrl) {
                pagesData.push({
                  pageId: page.pageId,
                  label: page.pageName,
                  isTitle: false,
                  icon: page.iconName,
                  url: page.pageUrl,
                  access: o.accessPermission.join(", "),
                });
              }
            }
          });
        });

        const encryptObj = await encryptObject({
          staffId: result[0].staffId,
          staffName: result[0].staffName,
          roleId: result[0].roleId,
          roleName: result[0].roleName,
        });

        const token = fastify.jwt.sign(
          {
            data: encryptObj,
          },
          { expiresIn: "1d" }
        );
        const returnRes = [
          {
            userId: result[0].userId,
            staffId: result[0].staffId,
            staffCode: result[0].staffCode,
            staffName: result[0].staffName,
            roleId: result[0].roleId,
            roleName: result[0].roleName,
            pagePermission: pagesData,
            token: token,
          },
        ];
        return returnRes;
      } else {
        throw new Error(messages.INCORRECT_PASSWORD);
      }
    } else {
      throw new Error(messages.INVALID_USER);
    }
  } catch (error) {
    throw new Error(error);
  }
}

module.exports = {
  getOrganizationLogin,
};
