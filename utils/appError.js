const { SERVER_ERROR, OWNER_ONLY_ACTION } = require("./errorMessage");
const { STATUS_CODE } = require("./utility");

class AppError extends Error {
  constructor(message, statusCode, data) {
    super(message);
    this.statusCode = statusCode ?? 500;
    this.status = false;
    this.isAppError = true;
    this.data = data;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;

module.exports.sendAppError = (extras, message, statusCode, data) => {
  if (extras.transaction) {
    return extras.transaction?.rollback().finally(() => extras.next(new AppError(message, statusCode, data)));
  }
  else {
    return extras.next(new AppError(message, statusCode, data));
  }
}

module.exports.sendOwnerOnlyActionError = (extras) => {
  if (extras.transaction) {
    return extras.transaction?.rollback().finally(() => extras.next(new AppError(OWNER_ONLY_ACTION, STATUS_CODE.BAD_REQUEST)));
  }
  else {
    return extras.next(new AppError(OWNER_ONLY_ACTION, STATUS_CODE.BAD_REQUEST));
  }
}

module.exports.sendInternalServerError = (extras) => {
  if (extras.transaction) {
    return extras.transaction?.rollback().finally(() => extras.next(new AppError(SERVER_ERROR, STATUS_CODE.INTERNAL_SERVER_ERROR)));
  }
  else {
    return extras.next(new AppError(SERVER_ERROR, STATUS_CODE.INTERNAL_SERVER_ERROR));
  }
}