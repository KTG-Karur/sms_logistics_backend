"use strict";

const messages = require("../helpers/message");
const _ = require("lodash");
const { Op } = require("sequelize");
const { PackageType, sequelize, Package } = require("../models");

async function getPackageType(query, needIsActive = true) {
  try {
    let whereClause = {};
    if (query.packageTypeId) {
      whereClause.package_type_id = query.packageTypeId;
    }
    if (needIsActive) {
      whereClause.is_active = 1;
    }
    if (query.search) {
      whereClause.package_type_name = {
        [Op.like]: `%${query.search}%`,
      };
    }

    const packageTypes = await PackageType.findAll({
      where: whereClause,
      attributes: [
        "package_type_id",
        "package_type_name",
        "package_pickup_price",
        "package_drop_price",
        "is_active",
        "created_at",
        "updated_at",
        "created_by",
        "updated_by",
      ],
      order: [["created_at", "DESC"]],
    });
    return packageTypes;
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

async function createPackageType(postData) {
  const transaction = await sequelize.transaction();
  try {
    // No need to convert to snake_case since data already comes in snake_case
    // const excuteMethod = _.mapKeys(postData, (value, key) =>
    //   _.snakeCase(key)
    // );

    // Check for duplicate package type name
    if (postData.package_type_name) {
      const existingPackageType = await PackageType.findOne({
        where: {
          package_type_name: postData.package_type_name,
          is_active: 1,
        },
        transaction,
      });
      if (existingPackageType) {
        throw new Error(messages.DUPLICATE_ENTRY);
      }
    }

    // Create with the data as-is (already in snake_case)
    const packageTypeResult = await PackageType.create(postData, {
      transaction,
    });

    await transaction.commit();

    const result = await PackageType.findOne({
      where: { package_type_id: packageTypeResult.package_type_id },
      attributes: [
        "package_type_id",
        "package_type_name",
        "package_pickup_price",
        "package_drop_price",
        "is_active",
        "created_at",
        "updated_at",
      ],
    });
    return result;
  } catch (error) {
    await transaction.rollback();
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

async function updatePackageType(packageTypeId, putData) {
  const transaction = await sequelize.transaction();
  try {
    // No need to convert to snake_case since data already comes in snake_case
    // const excuteMethod = _.mapKeys(putData, (value, key) =>
    //   _.snakeCase(key)
    // );

    // Check for duplicate package type name (excluding current record)
    if (putData.package_type_name) {
      const existingPackageType = await PackageType.findOne({
        where: {
          package_type_name: putData.package_type_name,
          package_type_id: { [Op.ne]: packageTypeId },
          is_active: 1,
        },
        transaction,
      });
      if (existingPackageType) {
        throw new Error(messages.DUPLICATE_ENTRY);
      }
    }

    // Update with the data as-is (already in snake_case)
    const [affectedCount] = await PackageType.update(putData, {
      where: { package_type_id: packageTypeId },
      transaction,
    });

    if (affectedCount === 0) {
      throw new Error(messages.DATA_NOT_FOUND);
    }

    await transaction.commit();

    const result = await PackageType.findOne({
      where: { package_type_id: packageTypeId },
      attributes: [
        "package_type_id",
        "package_type_name",
        "package_pickup_price",
        "package_drop_price",
        "is_active",
        "created_at",
        "updated_at",
      ],
    });
    return result;
  } catch (error) {
    await transaction.rollback();
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

async function deletePackageType(packageTypeId) {
  const transaction = await sequelize.transaction();
  try {
    // Check if package type has associated packages
    // const packageCount = await Package.count({
    //   where: { package_type_id: packageTypeId },
    //   transaction,
    // });
    // if (packageCount > 0) {
    //   throw new Error("Cannot delete package type as it has associated packages");
    // }

    const [affectedCount] = await PackageType.update(
      { is_active: 0 },
      {
        where: { package_type_id: packageTypeId, is_active: 1 },
        transaction,
      }
    );

    if (affectedCount === 0) {
      throw new Error(messages.DATA_NOT_FOUND);
    }

    await transaction.commit();
    return { success: true, message: "Package type deleted successfully" };
  } catch (error) {
    await transaction.rollback();
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

module.exports = {
  getPackageType,
  updatePackageType,
  createPackageType,
  deletePackageType,
};