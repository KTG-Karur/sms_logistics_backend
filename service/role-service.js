"use strict";

const sequelize = require("../models/index").sequelize;
const messages = require("../helpers/message");
const _ = require("lodash");
const { QueryTypes } = require("sequelize");
const {
  createRolePermission,
  updateRolePermission,
} = require("./role-permission-service");

async function getRole(query) {
  try {
    let iql = "";
    let filter = [];
    if (query.roleId) {
      filter.push(` ro.role_id = '${query.roleId}'`);
    }
    filter.push(` ro.is_active = 1`);
    iql += filter.length > 0 ? `WHERE ${filter.join(" AND ")}` : "";

    const result = await sequelize.query(
      `SELECT 
      ro.role_id "roleId",
        ro.role_name "roleName", 
        ro.is_active "isActive", 
        ro.created_at as createdAt, ro.updated_at as updatedAt
        FROM roles ro
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

async function createRole(postData) {
  try {
    const excuteMethod = _.mapKeys(postData, (value, key) => _.snakeCase(key));
    if (excuteMethod?.name || false) {
      const existingRole = await sequelize.models.roles.findOne({
        where: {
          name: excuteMethod.name,
        },
      });
      if (existingRole) {
        throw new Error(messages.DUPLICATE_ENTRY);
      }
    }
    const roleResult = await sequelize.models.roles.create(excuteMethod);
    const req = {
      roleId: roleResult.role_id,
      accessIds: postData.accessIds,
    };
    const rolePermission = createRolePermission(req);
    return await getRole(req);
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

async function updateRole(roleId, putData) {
  try {
    const excuteMethod = _.mapKeys(putData, (value, key) => _.snakeCase(key));
    if (excuteMethod?.name || false) {
      const existingRole = await sequelize.models.roles.findOne({
        where: {
          name: excuteMethod.name,
        },
      });
      if (existingRole) {
        throw new Error(
          error.message ? error.message : messages.DUPLICATE_ENTRY
        );
      }
    }
    if (putData.isActive === 0) {
      const roleResult = await sequelize.models.roles.update(excuteMethod, {
        where: { role_id: roleId },
      });
      const req = {
        roleId: roleId,
      };
      return await getRole(req);
    } else {
      const roleResult = await sequelize.models.roles.update(excuteMethod, {
        where: { role_id: roleId },
      });
      const req = {
        roleId: roleId,
        accessIds: putData.accessIds,
        rolePermissionId: putData.rolePermissionId,
      };
      const rolePermission = updateRolePermission(req.rolePermissionId, req);
      return await getRole(req);
    }
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

async function deleteRole(roleId) {
  try {
    const roleResult = await sequelize.models.role.destroy({
      where: { role_id: roleId },
    });
    if (roleResult == 1) {
      return "Deleted Successfully...!";
    } else {
      return "Data Not Founded...!";
    }
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

module.exports = {
  getRole,
  updateRole,
  createRole,
  deleteRole,
};
