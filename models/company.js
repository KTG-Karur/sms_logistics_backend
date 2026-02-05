'use strict';
const {
  Model,
  UUIDV4
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class company extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  company.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    company_id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: UUIDV4
    },
    company_name: DataTypes.STRING,
    company_mobile: DataTypes.STRING,
    company_alt_mobile: DataTypes.STRING,
    company_mail: DataTypes.STRING,
    company_gst_no: DataTypes.STRING,
    company_address_one: DataTypes.STRING,
    company_address_two: DataTypes.STRING,
    company_logo: DataTypes.STRING,
    user_id: {
      type: DataTypes.STRING,
      references: {
        model: "users",
        key: "user_id",
      },
    },
  }, {
    sequelize,
    modelName: 'company',
  });
  return company;
};