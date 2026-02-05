'use strict';
const {
  Model,
  UUIDV4
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class pages extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  pages.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    page_id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: UUIDV4
    },
    is_title: {
      type: DataTypes.BOOLEAN,
      defaultValue: null,
    },
    title: {
      type: DataTypes.STRING,
      defaultValue: null,
    },
    parent_id: {
      type: DataTypes.STRING,
      defaultValue: null,
    },
    page_name: {
      type: DataTypes.STRING,
      defaultValue: null,
    },
    page_url: {
      type: DataTypes.STRING,
      defaultValue: null,
    },
    icon_name: {
      type: DataTypes.STRING,
      defaultValue: null,
    },
    access_ids: {
      type: DataTypes.STRING,
      defaultValue: null,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: 1,
    },
  }, {
    sequelize,
    modelName: 'pages',
  });
  return pages;
};