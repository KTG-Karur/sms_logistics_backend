"use strict";

const sequelize = require("../models/index").sequelize;
const messages = require("../helpers/message");
const _ = require("lodash");
const userServices = require("./user-service");
const { decrptPassword, encrptPassword } = require("../utils/utility");
const { QueryTypes } = require("sequelize");

async function getEmployee(query) {
  try {
    let iql = "";
    let count = 0;
    if (query && Object.keys(query).length) {
      iql += `WHERE `;
      if (query.employeeId) {
        iql += count >= 1 ? ` AND` : ``;
        count++;
        iql += ` em.employee_id = '${query.employeeId}'`;
      }
      if (query.departmentId) {
        iql += count >= 1 ? ` AND` : ``;
        count++;
        iql += ` em.department_id = '${query.departmentId}'`;
      }
      if (query.roleId) {
        iql += count >= 1 ? ` AND` : ``;
        count++;
        iql += ` em.role_id = '${query.roleId}'`;
      }
      if (query.isActive) {
        iql += count >= 1 ? ` AND` : ``;
        count++;
        iql += ` em.is_active = ${query.isActive}`;
      }
    }
    if (!query?.isActive && !iql.includes("em.is_active")) {
      iql += count >= 1 ? ` AND` : `WHERE`;
      iql += ` em.is_active = 1`;
    }

    const result = await sequelize.query(
      `SELECT em.id , em.employee_id "employeeId", em.employee_name "employeeName", em.address_i "addressI", em.address_ii "addressII", em.pincode "pincode", em.mobile_no "mobileNo",
        em.role_id "roleId",r.role_name "roleName",
        em.department_id "departmentId", de.department_name "departmentName" ,
        em.is_authenticated "isAuthenticated",
        em.is_active "isActive",
        em.user_id  "userId", us.user_name "userName",us.password "password", em.created_at createdAt, em.updated_at "updatedAt" , em.deleted_at "deletedAt"
        FROM employees em 
        left join roles r on r.role_id = em.role_id
        left join users us on us.user_id = em.user_id
        left join department de on de.department_id = em.department_id ${iql}`,
      {
        type: QueryTypes.SELECT,
        raw: true,
        nest: false,
      }
    );
    for (let employee of result) {
      if (employee.password) {
        employee.password = await decrptPassword(employee.password);
      }
    }
    return result;
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

async function createEmployee(postData) {
  try {
    const excuteMethod = _.mapKeys(postData, (value, key) => _.snakeCase(key));
    let user;
    if (excuteMethod?.employee_name || false) {
      const existingEmployee = await sequelize.models.employee.findOne({
        where: {
          mobile_no: excuteMethod.mobile_no,
        },
      });
      if (existingEmployee) {
        throw new Error(
          "mobile number already exist" + messages.DUPLICATE_ENTRY
        );
      }
    }
    if (postData?.isAuthenticated) {
      postData.user_name = postData?.username;
      user = await userServices.createUser(postData);
    }
    excuteMethod.user_id = user?.[0]?.userId ?? null;
    const employeeResult = await sequelize.models.employee.create(excuteMethod);
    const req = {
      employeeId: employeeResult.employee_id,
    };
    return await getEmployee(req);
  } catch (error) {
    throw new Error(error?.message ? error.message : messages.OPERATION_ERROR);
  }
}

async function updateEmployee(employeeId, putData) {
  try {
    const excuteMethod = _.mapKeys(putData, (value, key) => _.snakeCase(key));

    if (excuteMethod?.employee_name || false) {
      const existingEmployee = await sequelize.models.employee.findOne({
        where: {
          mobile_no: excuteMethod.mobile_no,
        },
      });
    }

    let userId = putData?.userId;

    if (userId) {
      const userPayload = {};
      if (putData.username) userPayload.user_name = putData.username;
      if (putData.password) userPayload.password = putData.password;
      if (putData.isAuthenticated === 0 || putData.isActive === 0) {
        userPayload.isActive = 0;
      }
      if (putData.isAuthenticated === 1 || putData.isActive === 1) {
        userPayload.isActive = 1;
      }
      if (putData.roleId) {
        userPayload.role_id = putData.roleId;
      }
      if (Object.keys(userPayload).length) {
        await userServices.updateUser(userId, userPayload);
      }
    }

    if (!userId && putData.isAuthenticated) {
      const newUser = await userServices.createUser({
        user_name: putData.username,
        password: putData.password,
        role_id: putData.roleId,
      });

      userId = newUser?.[0]?.userId;
      excuteMethod.user_id = userId;
    }

    await sequelize.models.employee.update(excuteMethod, {
      where: { employee_id: employeeId },
    });

    const req = { employeeId };
    return await getEmployee(req);
  } catch (error) {
    throw new Error(error?.message ? error.message : messages.OPERATION_ERROR);
  }
}

module.exports = {
  getEmployee,
  updateEmployee,
  createEmployee,
};
