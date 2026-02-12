"use strict";

const sequelize = require("../models/index").sequelize;
const messages = require("../helpers/message");
const _ = require("lodash");
const { QueryTypes } = require("sequelize");
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

// Get attendance for a specific date
async function getStaffAttendance(query) {
  try {
    if (!query.attendanceDate) {
      throw new Error("attendanceDate is required to fetch attendance.");
    }

    const filters = [];

    if (query.departmentId && query.departmentId !== '') {
      filters.push(`e.department_id = ${query.departmentId}`);
    }

    if (query.employeeId) {
      filters.push(`e.employee_id = '${query.employeeId}'`);
    }
    
    filters.push(`e.is_active = 1`);

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const attendanceDate = query.attendanceDate;
    const dayOfWeek = moment(attendanceDate).day(); // 0 = Sunday

    // If the requested date is Sunday, return empty array
    if (dayOfWeek === 0) {
      return [];
    }

    const result = await sequelize.query(
      `SELECT 
        e.employee_id AS "staffId",
        e.employee_name AS "staffName",
        '' AS "staffCode",
        NULL AS "staffProfile",
        COALESCE(ts.staff_attendance_id, '') AS "staffAttendanceId",
        COALESCE(ts.attendance_status, 'absent') AS "attendanceStatus",
        '${attendanceDate}' AS "attendanceDate"
      FROM employees e
      LEFT JOIN staff_attendances ts 
        ON ts.staff_id = e.employee_id 
        AND ts.attendance_date = '${attendanceDate}'
      ${whereClause}
      ORDER BY e.employee_id`,
      {
        type: QueryTypes.SELECT,
        raw: true,
        nest: false,
      }
    );

    return result;
  } catch (error) {
    throw new Error(error.message || messages.OPERATION_ERROR);
  }
}

// Get monthly attendance list with holidays and Sundays
async function getStaffAttendanceList(query) {
  try {
    if (!query.attendanceDate) {
      throw new Error("attendanceDate is required");
    }

    const filters = [];

    if (query.departmentId && query.departmentId !== '') {
      filters.push(`e.department_id = ${query.departmentId}`);
    }

    if (query.employeeId) {
      filters.push(`e.employee_id = '${query.employeeId}'`);
    }

    filters.push(`e.is_active = 1`);

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const startDate = moment(query.attendanceDate).startOf("month").format("YYYY-MM-DD");
    const endDate = moment(query.attendanceDate).endOf("month").format("YYYY-MM-DD");

    // Get all active employees based on filters
    const employeeQuery = `
      SELECT 
        e.employee_id AS staffId,
        NULL AS staffProfile,
        '' AS staffCode,
        e.employee_name AS staffName
      FROM employees e
      ${whereClause}
    `;
    const allEmployees = await sequelize.query(employeeQuery, {
      type: QueryTypes.SELECT,
      raw: true,
    });

    // Get all dates in the month
    const allDates = [];
    let currentDate = moment(startDate);
    while (currentDate.isSameOrBefore(endDate, "day")) {
      allDates.push(currentDate.format("YYYY-MM-DD"));
      currentDate.add(1, "day");
    }

    // Fetch attendance records for the month
    const attendanceRecords = await sequelize.query(
      `SELECT 
        sa.staff_attendance_id AS attendanceId, 
        sa.staff_id AS staffId, 
        sa.attendance_status AS attendanceStatus, 
        sa.attendance_date AS attendanceDate
       FROM staff_attendances sa
       WHERE sa.attendance_date BETWEEN '${startDate}' AND '${endDate}'
       ORDER BY sa.attendance_date ASC`,
      { type: QueryTypes.SELECT, raw: true }
    );

    // Fetch holidays for the month
    const holidays = await sequelize.query(
      `SELECT holiday_date FROM holidays 
       WHERE holiday_date BETWEEN '${startDate}' AND '${endDate}'`,
      { type: QueryTypes.SELECT, raw: true }
    );
    const holidayDatesSet = new Set(holidays.map(h => moment(h.holiday_date).format('YYYY-MM-DD')));

    let attendanceDetail = [];

    allEmployees.forEach((employee) => {
      const filteredAttendanceRecords = attendanceRecords.filter(
        (att) => att.staffId === employee.staffId
      );

      let employeeAttendance = {
        staffId: employee.staffId,
        staffCode: employee.staffCode,
        staffProfile: employee.staffProfile,
        staffName: employee.staffName,
        totalWorkingDays: 0,
        presentCount: 0,
        absentCount: 0,
        halfdayCount: 0,
        dailyStatus: {},
      };

      allDates.forEach((date) => {
        const dayOfWeek = moment(date).day(); // 0 = Sunday

        if (dayOfWeek === 0) {
          employeeAttendance.dailyStatus[date] = "sunday";
          return;
        }

        if (holidayDatesSet.has(date)) {
          employeeAttendance.dailyStatus[date] = "holiday";
          return;
        }

        const record = filteredAttendanceRecords.find(
          (att) => moment(att.attendanceDate).format("YYYY-MM-DD") === date
        );

        if (record) {
          employeeAttendance.dailyStatus[date] = record.attendanceStatus;
          if (record.attendanceStatus === 'present') {
            employeeAttendance.presentCount++;
          } else if (record.attendanceStatus === 'absent') {
            employeeAttendance.absentCount++;
          } else if (record.attendanceStatus === 'halfday') {
            employeeAttendance.halfdayCount++;
          }
          employeeAttendance.totalWorkingDays++;
        } else {
          employeeAttendance.dailyStatus[date] = "-"; // No record found
        }
      });

      attendanceDetail.push(employeeAttendance);
    });

    return { attendanceDetail };
  } catch (error) {
    throw new Error(error.message || messages.OPERATION_ERROR);
  }
}

// Get attendance report
async function getStaffAttendanceReport(query) {
  try {
    let filters = [];

    if (query && Object.keys(query).length) {
      if (query.staffAttendanceId) {
        filters.push(`ts.staff_attendance_id = '${query.staffAttendanceId}'`);
      }

      if (query.employeeId) {
        filters.push(`e.employee_id = '${query.employeeId}'`);
      }

      if (query.attendanceDate && query.durationId == 0) {
        filters.push(`ts.attendance_date = '${query.attendanceDate}'`);
      }

      if (query.durationId) {
        const startDate = moment(query.attendanceDate)
          .startOf(query.durationId == 2 ? 'year' : 'month')
          .format('YYYY-MM-DD');
        const endDate = moment(query.attendanceDate)
          .endOf(query.durationId == 2 ? 'year' : 'month')
          .format('YYYY-MM-DD');
        filters.push(`ts.attendance_date BETWEEN '${startDate}' AND '${endDate}'`);
      }

      if (query.departmentId && query.departmentId !== '') {
        filters.push(`e.department_id = ${query.departmentId}`);
      }
    }

    filters.push(`e.is_active = 1`);
    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    const result = await sequelize.query(
      `SELECT 
        e.employee_id "staffId",
        e.employee_name as staffName,
        '' "staffCode",
        COUNT(CASE WHEN ts.attendance_status = 'present' THEN 1 END) AS "presentDays",
        COUNT(CASE WHEN ts.attendance_status = 'absent' THEN 1 END) AS "absentDays",
        COUNT(CASE WHEN ts.attendance_status = 'halfday' THEN 1 END) AS "halfdayDays",
        DAY(LAST_DAY('${moment(query.attendanceDate).format('YYYY-MM-DD')}')) "totalDays"
      FROM employees e
      LEFT JOIN staff_attendances ts ON ts.staff_id = e.employee_id 
        AND ts.attendance_date BETWEEN 
          '${moment(query.attendanceDate).startOf('month').format('YYYY-MM-DD')}' 
          AND '${moment(query.attendanceDate).endOf('month').format('YYYY-MM-DD')}'
      ${whereClause}
      GROUP BY 
        e.employee_id, e.employee_name
      ORDER BY 
        e.employee_id`,
      {
        type: QueryTypes.SELECT,
        raw: true,
        nest: false,
      }
    );
    return result;
  } catch (error) {
    throw new Error(error.message || messages.OPERATION_ERROR);
  }
}

// Create attendance
async function createStaffAttendance(postData) {
  try {
    const attendanceData = postData.staffAttendance.map(item => ({
      staff_attendance_id: uuidv4(),
      staff_id: item.staffId,
      attendance_date: item.attendanceDate,
      attendance_status: item.attendanceStatus || 'absent',
      created_by: item.createdBy || null
    }));

    await sequelize.models.staff_attendance.bulkCreate(attendanceData, {
      ignoreDuplicates: true
    });

    const req = {
      attendanceDate: postData.staffAttendance[0].attendanceDate,
    };
    return await getStaffAttendance(req);
  } catch (error) {
    throw new Error(error.message || messages.OPERATION_ERROR);
  }
}

// Update attendance
async function updateStaffAttendance(putData) {
  try {
    const attendanceList = putData.staffAttendance;

    for (const attendanceData of attendanceList) {
      const { staffId, attendanceDate, attendanceStatus, updatedBy } = attendanceData;

      const [existing] = await sequelize.query(
        `SELECT staff_attendance_id
         FROM staff_attendances
         WHERE staff_id = '${staffId}'
           AND DATE(attendance_date) = '${attendanceDate}'
         LIMIT 1`,
        {
          type: QueryTypes.SELECT,
          raw: true,
          nest: false,
        }
      );

      if (existing) {
        await sequelize.models.staff_attendance.update(
          {
            attendance_status: attendanceStatus,
            updated_by: updatedBy
          },
          {
            where: {
              staff_attendance_id: existing.staff_attendance_id,
            },
          }
        );
      } else {
        await sequelize.models.staff_attendance.create({
          staff_attendance_id: uuidv4(),
          staff_id: staffId,
          attendance_date: attendanceDate,
          attendance_status: attendanceStatus,
          created_by: updatedBy
        });
      }
    }

    const req = {
      attendanceDate: putData.staffAttendance[0].attendanceDate,
    };

    return await getStaffAttendance(req);
  } catch (error) {
    throw new Error(error.message || messages.OPERATION_ERROR);
  }
}

module.exports = {
  getStaffAttendance,
  updateStaffAttendance,
  getStaffAttendanceList,
  createStaffAttendance,
  getStaffAttendanceReport,
};