"use strict";

const messages = require("../helpers/message");
const _ = require("lodash");
const { Op } = require("sequelize");
const { VehicleType, Vehicle } = require("../models");
const sequelize = require("../models").sequelize;

async function getVehicle(query, needIsActive = true) {
  try {
    let whereClause = {};
    let includeClause = [];

    if (query.vehicleId) {
      whereClause.vehicle_id = query.vehicleId;
    }

    if (query.vehicleTypeId) {
      whereClause.vehicle_type_id = query.vehicleTypeId;
    }

    if (query.vehicleNumberPlate) {
      whereClause.vehicle_number_plate = {
        [Op.like]: `%${query.vehicleNumberPlate}%`,
      };
    }

    if (query.rcNumber) {
      whereClause.rc_number = {
        [Op.like]: `%${query.rcNumber}%`,
      };
    }

    if (needIsActive) {
      whereClause.is_active = 1;
    }

    // Add vehicle type join
    includeClause.push({
      model: VehicleType,
      as: "vehicleType",
      attributes: ["vehicle_type_id", "vehicle_type_name"],
      where: { is_active: 1 },
      required: false,
    });

    const vehicles = await Vehicle.findAll({
      where: whereClause,
      include: includeClause,
      attributes: [
        "vehicle_id",
        "vehicle_number_plate",
        "vehicle_type_id",
        "rc_number",
        "rc_expiry_date",
        "insurance_number",
        "insurance_expiry_date",
        "rc_upload",
        "is_active",
        "created_at",
        "updated_at",
        "created_by",
        "updated_by",
      ],
      order: [["created_at", "DESC"]],
    });

    // Format the response
    const formattedVehicles = vehicles.map((vehicle) => {
      const vehicleData = vehicle.toJSON();
      return {
        ...vehicleData,
        vehicleType: vehicleData.vehicleType || null,
      };
    });

    return formattedVehicles;
  } catch (error) {
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

async function createVehicle(postData) {
  const transaction = await sequelize.transaction();

  try {
    const excuteMethod = _.mapKeys(postData, (value, key) => _.snakeCase(key));

    // Check for duplicate vehicle number plate
    if (excuteMethod.vehicle_number_plate) {
      const existingVehicle = await Vehicle.findOne({
        where: {
          vehicle_number_plate: excuteMethod.vehicle_number_plate,
          is_active: 1,
        },
        transaction,
      });

      if (existingVehicle) {
        throw new Error("Vehicle number plate already exists");
      }
    }

    // Check for duplicate RC number
    if (excuteMethod.rc_number) {
      const existingVehicle = await Vehicle.findOne({
        where: {
          rc_number: excuteMethod.rc_number,
          is_active: 1,
        },
        transaction,
      });

      if (existingVehicle) {
        throw new Error("RC number already exists");
      }
    }

    // Check if vehicle type exists
    if (excuteMethod.vehicle_type_id) {
      const vehicleType = await VehicleType.findOne({
        where: {
          vehicle_type_id: excuteMethod.vehicle_type_id,
          is_active: 1,
        },
        transaction,
      });

      if (!vehicleType) {
        throw new Error("Invalid vehicle type");
      }
    }

    // Validate dates
    const currentDate = new Date();
    const rcExpiryDate = new Date(excuteMethod.rc_expiry_date);
    const insuranceExpiryDate = new Date(excuteMethod.insurance_expiry_date);

    if (rcExpiryDate < currentDate) {
      throw new Error("RC expiry date cannot be in the past");
    }

    if (insuranceExpiryDate < currentDate) {
      throw new Error("Insurance expiry date cannot be in the past");
    }

    const vehicleResult = await Vehicle.create(excuteMethod, {
      transaction,
    });

    await transaction.commit();

    // Get the created vehicle with vehicle type details
    const result = await Vehicle.findOne({
      where: {
        vehicle_id: vehicleResult.vehicle_id,
      },
      include: [
        {
          model: VehicleType,
          as: "vehicleType",
          attributes: ["vehicle_type_id", "vehicle_type_name"],
        },
      ],
      attributes: [
        "vehicle_id",
        "vehicle_number_plate",
        "vehicle_type_id",
        "rc_number",
        "rc_expiry_date",
        "insurance_number",
        "insurance_expiry_date",
        "rc_upload",
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

async function updateVehicle(vehicleId, putData) {
  const transaction = await sequelize.transaction();

  try {
    const excuteMethod = _.mapKeys(putData, (value, key) => _.snakeCase(key));

    // Check if vehicle exists
    const existingVehicle = await Vehicle.findOne({
      where: { vehicle_id: vehicleId, is_active: 1 },
      transaction,
    });

    if (!existingVehicle) {
      throw new Error(messages.DATA_NOT_FOUND);
    }

    // Check for duplicate vehicle number plate (excluding current record)
    if (excuteMethod.vehicle_number_plate) {
      const duplicateVehicle = await Vehicle.findOne({
        where: {
          vehicle_number_plate: excuteMethod.vehicle_number_plate,
          vehicle_id: { [Op.ne]: vehicleId },
          is_active: 1,
        },
        transaction,
      });

      if (duplicateVehicle) {
        throw new Error("Vehicle number plate already exists");
      }
    }

    // Check for duplicate RC number (excluding current record)
    if (excuteMethod.rc_number) {
      const duplicateVehicle = await Vehicle.findOne({
        where: {
          rc_number: excuteMethod.rc_number,
          vehicle_id: { [Op.ne]: vehicleId },
          is_active: 1,
        },
        transaction,
      });

      if (duplicateVehicle) {
        throw new Error("RC number already exists");
      }
    }

    // Check if vehicle type exists
    if (excuteMethod.vehicle_type_id) {
      const vehicleType = await VehicleType.findOne({
        where: {
          vehicle_type_id: excuteMethod.vehicle_type_id,
          is_active: 1,
        },
        transaction,
      });

      if (!vehicleType) {
        throw new Error("Invalid vehicle type");
      }
    }

    // Validate dates
    if (excuteMethod.rc_expiry_date) {
      const rcExpiryDate = new Date(excuteMethod.rc_expiry_date);
      const currentDate = new Date();

      if (rcExpiryDate < currentDate) {
        throw new Error("RC expiry date cannot be in the past");
      }
    }

    if (excuteMethod.insurance_expiry_date) {
      const insuranceExpiryDate = new Date(excuteMethod.insurance_expiry_date);
      const currentDate = new Date();

      if (insuranceExpiryDate < currentDate) {
        throw new Error("Insurance expiry date cannot be in the past");
      }
    }

    const [affectedCount] = await Vehicle.update(
      excuteMethod,
      {
        where: { vehicle_id: vehicleId },
        transaction,
      }
    );

    if (affectedCount === 0) {
      throw new Error(messages.DATA_NOT_FOUND);
    }

    await transaction.commit();

    // Get the updated vehicle with vehicle type details
    const result = await Vehicle.findOne({
      where: {
        vehicle_id: vehicleId,
      },
      include: [
        {
          model: VehicleType,
          as: "vehicleType",
          attributes: ["vehicle_type_id", "vehicle_type_name"],
        },
      ],
      attributes: [
        "vehicle_id",
        "vehicle_number_plate",
        "vehicle_type_id",
        "rc_number",
        "rc_expiry_date",
        "insurance_number",
        "insurance_expiry_date",
        "rc_upload",
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

async function deleteVehicle(vehicleId) {
  const transaction = await sequelize.transaction();

  try {
    const [affectedCount] = await Vehicle.update(
      { is_active: 0 },
      {
        where: {
          vehicle_id: vehicleId,
          is_active: 1,
        },
        transaction,
      }
    );

    if (affectedCount === 0) {
      throw new Error(messages.DATA_NOT_FOUND);
    }

    await transaction.commit();

    return { success: true, message: "Vehicle deleted successfully" };
  } catch (error) {
    await transaction.rollback();
    throw new Error(error.message ? error.message : messages.OPERATION_ERROR);
  }
}

module.exports = {
  getVehicle,
  updateVehicle,
  createVehicle,
  deleteVehicle,
};