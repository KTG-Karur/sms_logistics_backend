const { DataTypes, Sequelize, Model } = require("sequelize");
require('dotenv').config();

const defaultKeys = (name) => {
    return {
        id: {
            allowNull: false,
            autoIncrement: true,
            type: DataTypes.INTEGER.UNSIGNED,
            unique: true,
        },
        [name]: {
            type: DataTypes.STRING(36),
            allowNull: false,
            primaryKey: true,
            defaultValue: DataTypes.UUIDV4,
        }
    };
};


const migrationDefaults = (options = { withUser: false, isUser: false, paranoid: false }) => {
    const withUser = options.withUser ?? false;
    const isUser = options.isUser ?? false;
    const paranoid = options.paranoid ?? false;

    const defaultColumns = {
        is_active: {
            allowNull: false,
            type: Sequelize.BOOLEAN,
            defaultValue: 1
        },
        created_at: {
            type: 'TIMESTAMP',
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        created_by: {
            type: Sequelize.STRING,
            allowNull: true,
            defaultValue: null,
        },
        updated_at: {
            type: Sequelize.DATE,
            allowNull: true,
            defaultValue: null,
        },
        updated_by: {
            type: Sequelize.STRING,
            allowNull: true,
            defaultValue: null,
        },
        deleted_at: {
            type: Sequelize.DATE,
            allowNull: true,
            defaultValue: null,
        },
    };

    if (paranoid) {
        defaultColumns['deleted_by'] = {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null
        };
    }

    return defaultColumns;
};

/** @param {typeof Model} model * @param {*} models * @param {boolean} isUser */
const actionUsers = (model, models, isUser = false) => {
    model.belongsTo(models.User, {
        targetKey: 'user_id',
        foreignKey: {
            name: 'created_by',
            allowNull: isUser,
        },
        as: 'userCreated',
    });
    model.belongsTo(models.User, {
        targetKey: 'user_id',
        foreignKey: {
            name: 'updated_by',
            allowNull: true,
        },
        as: 'userUpdated',
    });
    if (model.options.paranoid) {
        model.belongsTo(models.User, {
            targetKey: 'user_id',
            foreignKey: {
                name: 'deleted_by',
                allowNull: true,
            },
            as: 'userDeleted',
        });
    }
}

/** 
 * @param {Sequelize} sequelize 
 * @param {string} tableName
 * @param {import("sequelize").InitOptions} options
 * @returns
 */
const modelDefaults = (sequelize, tableName, options = {}) => {
    const defaultConfig = {
        paranoid: false,
        collate: process.env.COLLATE,
    };

    const initConfig = {
        sequelize,
        tableName,
        created_at: "createdAt",
        timestamps: true,
        updated_at: "updatedAt",
        deleted_at: "deleted_at",
        created_by: "created_by",
        updated_by: "updated_by",
        ...defaultConfig,
        ...options,
    };

    return initConfig;
};


// const relationShip = ({ modelName, key, allowNull = false, unique = false, onDelete = "CASCADE", onUpdate = "CASCADE" }) => {
//     return {
//         type: DataTypes.STRING(36),
//         allowNull: allowNull,
//         onDelete: onDelete,
//         onUpdate: onUpdate,
//         references: {
//             key: key,
//             model: modelName,
//         },
//         // unique: unique,
//     };
// };

const relationShip = ({ modelName, key, allowNull = false }) => {
    return {
        type: DataTypes.STRING(36),
        allowNull,
        references: {
            model: modelName,
            key: key,
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    };
};


module.exports = {
    defaultKeys,
    migrationDefaults,
    modelDefaults,
    relationShip,
    actionUsers,
};