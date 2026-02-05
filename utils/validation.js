const AppError = require("./appError");
const { NO_PARAMS, OWNER_ONLY_ACTION } = require("./errorMessage");
const { STATUS_CODE } = require("./utility");

// common types
/**
 * 
 * @typedef {import("sequelize").Model} Model 
 * @typedef {import("sequelize").WhereOptions} WhereOptions 
 * @typedef {import("sequelize").FindOptions} FindOptions 
 * @typedef {import("./appError")} AppError 
 * @typedef {import("./utility")} STATUS_CODE 
 */

// function parameter types
/**
 * @typedef {Object} FindModelAndThrowConfig
 * @property {string} [messageOnFound]
 * @property {string} [messageOnDeleted]
 * @property {boolean} [throwOnDeleted]
*/

/**
 * @typedef {Object} FindModelOrThrowConfig
 * @property {string} [messageOnNotFound]
 * @property {string} [messageOnDeleted]
 * @property {boolean} [throwOnDeleted]
 */

// Create new type FindModelOrThrowOptions by joining findOptions and FindModelOrThrowConfig
/**
 * @typedef {import("sequelize").FindOptions & FindModelOrThrowConfig} FindModelOrThrowOptions
 */

// Create new type FindModelAndThrowOptions by joining findOptions and FindModelAndThrowConfig
/**
 * @typedef {import("sequelize").FindOptions & FindModelAndThrowConfig} FindModelAndThrowOptions
 */

module.exports.Validation = {
    timeParameters: (parameters = []) => {
        if (parameters.length == 0) {
            throw new AppError(NO_PARAMS, STATUS_CODE.BAD_REQUEST);
        }
        const notValids = parameters.filter((parameter) => {
            const time = new Date(parameter);
            return (parameter == null ||
                parameter == undefined ||
                (
                    typeof parameter == 'string' &&
                    (
                        parameter == "" ||
                        parameter == "undefined" ||
                        parameter == "null"
                    )
                ) ||
                isNaN(time)
            )
        })
        if (notValids.length != 0) {
            throw new AppError(NO_PARAMS, STATUS_CODE.BAD_REQUEST, { notValids });
        }

        return true;
    },
    nullParameters: (parameters = []) => {
        if (parameters.length == 0) {
            throw new AppError(NO_PARAMS, STATUS_CODE.BAD_REQUEST);
        }
        const notValids = parameters.filter((parameter) => {
            return (parameter == null ||
                parameter == undefined ||
                (
                    typeof parameter == 'string' &&
                    (
                        parameter == "" ||
                        parameter == "undefined" ||
                        parameter == "null"
                    )
                )
            )
        })
        if (notValids.length != 0) {
            throw new AppError(NO_PARAMS, STATUS_CODE.BAD_REQUEST, { notValids });
        }

        return true;
    },
    emptyStringParameters: (parameters = []) => {
        if (parameters.length == 0) {
            throw new AppError(NO_PARAMS, STATUS_CODE.BAD_REQUEST);
        }

        const notValids = parameters.filter((parameter) => ((parameter != null || parameter != undefined) &&
            (typeof parameter == 'string' && parameter == "" ||
                parameter == "undefined" ||
                parameter == "null")));
        if (notValids.length != 0) {
            throw new AppError(NO_PARAMS, STATUS_CODE.BAD_REQUEST);
        }

        return true;
    },
    emptyArrayParameters: (parameters = []) => {
        if (!Array.isArray(parameters) || parameters.length == 0) {
            throw new AppError(NO_PARAMS, STATUS_CODE.BAD_REQUEST);
        }

        const notValids = parameters.filter((parameter) => ((parameter == null || parameter == undefined)));
        if (notValids.length != 0) {
            throw new AppError(NO_PARAMS, STATUS_CODE.BAD_REQUEST);
        }

        return true;
    },
    /**
     * 
     * @param {any} parameter 
     * @param {{
     * message:string
     * data:any
     * }} options 
     * @returns 
     */
    isTrue: (parameter, options) => {
        if (!parameter) {
            throw new AppError(options?.message ?? NO_PARAMS, STATUS_CODE.BAD_REQUEST, options?.data);
        }

        return true;
    },
    authority: (auth, owner) => {
        if (owner != auth) {
            throw new AppError(OWNER_ONLY_ACTION, STATUS_CODE.FORBIDDEN);
        }

        return true;
    },
    password: (password, password_confirm) => {
        if (!password || password == '') {
            return;
        }

        if (password?.length < 8) {
            throw new AppError("Please choose a longer password", STATUS_CODE.BAD_REQUEST);
        }
        if (password != password_confirm) {
            throw new AppError("Passwords did't match", STATUS_CODE.BAD_REQUEST);
        }
    }
}

/**
 * @template T
 * @param {WhereOptions} finder
 * @param {new () => T} FindModel
 * @param {FindModelAndThrowOptions} options
 * @returns {Promise<T>}
 * @throws {AppError}
*/
module.exports.findModelAndThrow = async (finder, FindModel, options = {}) => {
    const { throwOnDeleted, messageOnFound, messageOnDeleted, ...findOptions } = options;

    const model = await FindModel.findOne({
        where: finder,
        paranoid: !throwOnDeleted,
        ...findOptions,
    })
    if (FindModel.options.paranoid && model?.isSoftDeleted() && throwOnDeleted) {
        throw new AppError(messageOnDeleted ?? `${FindModel.name} is deleted`, STATUS_CODE.BAD_REQUEST);
    }
    if (model) {
        throw new AppError(messageOnFound ?? `${FindModel.name} already exist`, STATUS_CODE.BAD_REQUEST);
    }
    return;
}

/**
 * @template T
 * @param {WhereOptions} finder
 * @param {new () => T} FindModel
 * @param {FindModelOrThrowOptions} options
 * @returns {Promise<T>}
 * @throws {AppError}
*/
module.exports.findModelOrThrow = async (finder, FindModel, options = {}) => {
    const { throwOnDeleted, messageOnNotFound, messageOnDeleted, ...findOptions } = options;

    /** @type {T | null} */
    const model = await FindModel.findOne({
        where: finder,
        paranoid: !throwOnDeleted,
        ...findOptions,
    })

    if (!model) {
        throw new AppError(messageOnNotFound ?? `${FindModel.name} not found`, STATUS_CODE.NOT_FOUND);
    }

    if (FindModel.options.paranoid && model?.isSoftDeleted() && throwOnDeleted) {
        throw new AppError(messageOnDeleted ?? `${FindModel.name} is deleted`, STATUS_CODE.NOT_FOUND);
    }

    return model;
}