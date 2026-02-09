"use strict";

const messages = require("../helpers/message");
const _ = require("lodash");
const { Op } = require("sequelize");
const { Employee, Role, User, sequelize } = require("../models");

async function getEmployee(query, needIsActive = true) {
  try {
    let whereClause = {};
    
    if (query.employeeId) {
      whereClause.employee_id = query.employeeId;
    }
    
    if (query.roleId) {
      whereClause.role_id = query.roleId;
    }
    
    if (query.departmentId) {
      whereClause.department_id = query.departmentId;
    }
    
    if (query.mobileNo) {
      whereClause.mobile_no = { [Op.like]: `%${query.mobileNo}%` };
    }
    
    if (query.employeeName) {
      whereClause.employee_name = { [Op.like]: `%${query.employeeName}%` };
    }
    
    if (query.isDriver) {
      whereClause.is_driver = query.isDriver === '1' || query.isDriver === 'true' || query.isDriver === true;
    }
    
    if (query.isLoadman) {
      whereClause.is_loadman = query.isLoadman === '1' || query.isLoadman === 'true' || query.isLoadman === true;
    }
    
    if (query.isAuthenticated) {
      whereClause.is_authenticated = query.isAuthenticated === '1' || query.isAuthenticated === 'true' || query.isAuthenticated === true;
    }
    
    if (needIsActive) {
      whereClause.is_active = 1;
    }
    
    const employees = await Employee.findAll({
      where: whereClause,
      attributes: [
        "employee_id",
        "employee_name",
        "mobile_no",
        "address_i",
        "pincode",
        "role_id",
        "department_id",
        "is_authenticated",
        "is_driver",
        "has_salary",
        "is_loadman",
        "salary",
        "licence_number",
        "licence_image",
        "user_id",
        "is_active",
        "created_at",
        "updated_at",
        "created_by",
        "updated_by",
      ],
      order: [["created_at", "DESC"]],
    });
    
    const formattedEmployees = [];
    
    for (const employee of employees) {
      const employeeData = employee.toJSON();
      
      let roleName = null;
      let userName = null;
      
      // Fetch role name if role_id exists
      if (employeeData.role_id) {
        try {
          const role = await Role.findOne({
            where: { role_id: employeeData.role_id },
            attributes: ["role_name"]
          });
          roleName = role ? role.role_name : null;
        } catch (error) {
          console.error("Error fetching role:", error);
        }
      }
      
      // Fetch user name if user_id exists
      if (employeeData.user_id) {
        try {
          const user = await User.findOne({
            where: { user_id: employeeData.user_id },
            attributes: ["user_name"]
          });
          userName = user ? user.user_name : null;
        } catch (error) {
          console.error("Error fetching user:", error);
        }
      }
      
      formattedEmployees.push({
        employeeId: employeeData.employee_id,
        employeeName: employeeData.employee_name,
        mobileNo: employeeData.mobile_no,
        addressI: employeeData.address_i,
        pincode: employeeData.pincode,
        roleId: employeeData.role_id,
        roleName: roleName,
        departmentId: employeeData.department_id,
        isAuthenticated: employeeData.is_authenticated,
        isDriver: employeeData.is_driver,
        hasSalary: employeeData.has_salary,
        isLoadman: employeeData.is_loadman,
        salary: employeeData.salary,
        licenceNumber: employeeData.licence_number,
        licenceImage: employeeData.licence_image,
        userId: employeeData.user_id,
        userName: userName,
        isActive: employeeData.is_active,
        createdAt: employeeData.created_at,
        updatedAt: employeeData.updated_at,
        createdBy: employeeData.created_by,
        updatedBy: employeeData.updated_by,
      });
    }
    
    return formattedEmployees;
  } catch (error) {
    console.error("Error in getEmployee service:", error);
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

async function createEmployee(postData) {
  const transaction = await sequelize.transaction();
  try {
    // Check for duplicate mobile number
    if (postData.mobile_no) {
      const existingEmployee = await Employee.findOne({
        where: {
          mobile_no: postData.mobile_no,
          is_active: 1,
        },
        transaction,
      });
      if (existingEmployee) {
        throw new Error("Mobile number already exists");
      }
    }
    
    // Check if role exists (if provided)
    if (postData.role_id) {
      const role = await Role.findOne({
        where: {
          role_id: postData.role_id,
          is_active: 1,
        },
        transaction,
      });
      if (!role) {
        throw new Error("Invalid role");
      }
    }
    
    // Check for duplicate licence number for drivers
    if (postData.is_driver && postData.licence_number) {
      const existingDriver = await Employee.findOne({
        where: {
          licence_number: postData.licence_number,
          is_driver: true,
          is_active: 1,
        },
        transaction,
      });
      if (existingDriver) {
        throw new Error("Licence number already exists for another driver");
      }
    }
    
    let userId = null;
    // Create user if authentication is enabled
    if (postData.is_authenticated && postData.username && postData.password) {
      const existingUser = await User.findOne({
        where: {
          user_name: postData.username,
          is_active: 1,
        },
        transaction,
      });
      
      if (existingUser) {
        throw new Error("Username already exists");
      }
      
      // Import user service which uses your existing encryption
      const userServices = require("./user-service");
      
      // Use user service to create user (it will handle encryption)
      const userResult = await userServices.createUser({
        user_name: postData.username,
        password: postData.password, // Will be encrypted by user service
        role_id: postData.role_id,
      });
      
      if (userResult && userResult[0]) {
        userId = userResult[0].userId;
      }
    }
    
    // Prepare employee data
    const employeeData = {
      employee_name: postData.employee_name,
      mobile_no: postData.mobile_no,
      address_i: postData.address_i || null,
      pincode: postData.pincode || null,
      role_id: postData.role_id || null,
      department_id: postData.department_id || null,
      is_authenticated: postData.is_authenticated || false,
      is_driver: postData.is_driver || false,
      has_salary: postData.has_salary || false,
      is_loadman: postData.is_loadman || false,
      salary: postData.has_salary && postData.salary ? parseFloat(postData.salary) : null,
      licence_number: postData.is_driver && postData.licence_number ? postData.licence_number : null,
      licence_image: postData.licence_image || null,
      user_id: userId,
      is_active: 1,
    };
    
    const employeeResult = await Employee.create(employeeData, { transaction });
    
    await transaction.commit();
    
    // Get the created employee with details
    const result = await getEmployee({ employeeId: employeeResult.employee_id });
    return result[0] || null;
    
  } catch (error) {
    await transaction.rollback();
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

async function updateEmployee(employeeId, putData) {
  const transaction = await sequelize.transaction();
  try {
    // Check if employee exists
    const existingEmployee = await Employee.findOne({
      where: {
        employee_id: employeeId,
        is_active: 1,
      },
      transaction,
    });
    
    if (!existingEmployee) {
      throw new Error(messages.DATA_NOT_FOUND);
    }
    
    // Check for duplicate mobile number (excluding current record)
    if (putData.mobile_no) {
      const duplicateEmployee = await Employee.findOne({
        where: {
          mobile_no: putData.mobile_no,
          employee_id: { [Op.ne]: employeeId },
          is_active: 1,
        },
        transaction,
      });
      if (duplicateEmployee) {
        throw new Error("Mobile number already exists");
      }
    }
    
    // Check if role exists (if provided)
    if (putData.role_id) {
      const role = await Role.findOne({
        where: {
          role_id: putData.role_id,
          is_active: 1,
        },
        transaction,
      });
      if (!role) {
        throw new Error("Invalid role");
      }
    }
    
    // Check for duplicate licence number for drivers (excluding current record)
    if (putData.is_driver && putData.licence_number) {
      const duplicateDriver = await Employee.findOne({
        where: {
          licence_number: putData.licence_number,
          employee_id: { [Op.ne]: employeeId },
          is_driver: true,
          is_active: 1,
        },
        transaction,
      });
      if (duplicateDriver) {
        throw new Error("Licence number already exists for another driver");
      }
    }
    
    let userId = existingEmployee.user_id;
    
    // Handle user creation/update based on authentication status
    if (putData.is_authenticated) {
      if (!putData.username) {
        throw new Error("Username is required when authentication is enabled");
      }
      
      // Import user service
      const userServices = require("./user-service");
      
      if (userId) {
        // Update existing user using user service (it will handle encryption)
        const updateUserData = {
          user_name: putData.username,
          role_id: putData.role_id,
        };
        
        if (putData.password && putData.password.trim() !== '') {
          updateUserData.password = putData.password; // Will be encrypted by user service
        }
        
        await userServices.updateUser(userId, updateUserData);
      } else {
        // Create new user using user service (it will handle encryption)
        const existingUser = await User.findOne({
          where: {
            user_name: putData.username,
            is_active: 1,
          },
          transaction,
        });
        
        if (existingUser) {
          throw new Error("Username already exists");
        }
        
        // Use user service to create user
        const userResult = await userServices.createUser({
          user_name: putData.username,
          password: putData.password || 'default123',
          role_id: putData.role_id,
        });
        
        if (userResult && userResult[0]) {
          userId = userResult[0].userId;
        }
      }
    } else if (userId) {
      // Disable user if authentication is turned off
      await User.update({
        is_active: 0,
      }, {
        where: { user_id: userId },
        transaction,
      });
      userId = null; // Clear user_id from employee
    }
    
    // Prepare update data
    const updateData = {};
    
    // Personal Information
    if (putData.employee_name !== undefined) updateData.employee_name = putData.employee_name;
    if (putData.mobile_no !== undefined) updateData.mobile_no = putData.mobile_no;
    if (putData.address_i !== undefined) updateData.address_i = putData.address_i;
    if (putData.pincode !== undefined) updateData.pincode = putData.pincode;
    
    // Role and Department
    if (putData.role_id !== undefined) updateData.role_id = putData.role_id;
    if (putData.department_id !== undefined) updateData.department_id = putData.department_id;
    
    // Status Flags
    if (putData.is_authenticated !== undefined) updateData.is_authenticated = putData.is_authenticated;
    if (putData.is_driver !== undefined) updateData.is_driver = putData.is_driver;
    if (putData.has_salary !== undefined) updateData.has_salary = putData.has_salary;
    if (putData.is_loadman !== undefined) updateData.is_loadman = putData.is_loadman;
    
    // Salary and Driver Info
    if (putData.salary !== undefined) {
      updateData.salary = (putData.has_salary && putData.salary) ? parseFloat(putData.salary) : null;
    }
    
    if (putData.licence_number !== undefined) {
      updateData.licence_number = (putData.is_driver && putData.licence_number) ? putData.licence_number : null;
    }
    
    // File upload
    if (putData.licence_image !== undefined) updateData.licence_image = putData.licence_image;
    
    // Handle user_id based on authentication status
    if (putData.is_authenticated !== undefined) {
      updateData.user_id = putData.is_authenticated ? userId : null;
    } else if (userId !== undefined) {
      updateData.user_id = userId;
    }
    
    // Update employee
    const [affectedCount] = await Employee.update(updateData, {
      where: { employee_id: employeeId },
      transaction,
    });
    
    if (affectedCount === 0) {
      throw new Error(messages.DATA_NOT_FOUND);
    }
    
    await transaction.commit();
    
    // Get the updated employee with details
    const result = await getEmployee({ employeeId: employeeId });
    return result[0] || null;
    
  } catch (error) {
    await transaction.rollback();
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

async function deleteEmployee(employeeId) {
  const transaction = await sequelize.transaction();
  try {
    // Check if employee exists
    const existingEmployee = await Employee.findOne({
      where: { employee_id: employeeId },
      transaction,
    });
    
    if (!existingEmployee) {
      throw new Error(messages.DATA_NOT_FOUND);
    }
    
    // Soft delete employee
    const [affectedCount] = await Employee.update(
      { is_active: 0 },
      {
        where: { employee_id: employeeId, is_active: 1 },
        transaction,
      }
    );
    
    if (affectedCount === 0) {
      throw new Error(messages.DATA_NOT_FOUND);
    }
    
    // Also deactivate associated user if exists
    if (existingEmployee.user_id) {
      await User.update(
        { is_active: 0 },
        {
          where: { user_id: existingEmployee.user_id },
          transaction,
        }
      );
    }
    
    await transaction.commit();
    
    return { success: true, message: "Employee deleted successfully" };
    
  } catch (error) {
    await transaction.rollback();
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

module.exports = {
  getEmployee,
  updateEmployee,
  createEmployee,
  deleteEmployee,
};