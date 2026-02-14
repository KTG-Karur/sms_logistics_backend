"use strict";

const fs = require("fs");
const path = require("path");
const Sequelize = require("sequelize");
const process = require("process");
const basename = path.basename(__filename);
const env = "development"; // production || development
const config = require(__dirname + "/../config/config.json")[env];
const db = {};

let sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    config
  );
}

// First: Load all models automatically
fs.readdirSync(__dirname)
  .filter((file) => {
    return (
      file.indexOf(".") !== 0 &&
      file !== basename &&
      file.slice(-3) === ".js" &&
      file.indexOf(".test.js") === -1
    );
  })
  .forEach((file) => {
    const model = require(path.join(__dirname, file))(
      sequelize,
      Sequelize.DataTypes
    );
    db[model.name] = model;
  });

db.Employee = require("./employee")(sequelize, Sequelize.DataTypes);
db.Role = require("./role")(sequelize, Sequelize.DataTypes);
db.User = require("./user")(sequelize, Sequelize.DataTypes);
db.Company = require("./company")(sequelize, Sequelize.DataTypes);
db.Product = require("./product")(sequelize, Sequelize.DataTypes);
db.ProductEnquiry = require("./product-enquiry")(sequelize, Sequelize.DataTypes);
db.designation = require("./designation")(sequelize, Sequelize.DataTypes);
db.VehicleType = require("./vehicle-type")(sequelize, Sequelize.DataTypes);
db.Vehicle = require("./vehicle")(sequelize, Sequelize.DataTypes);
db.PackageType = require("./package-type")(sequelize, Sequelize.DataTypes);
db.Holiday = require("./holiday")(sequelize, Sequelize.DataTypes);
db.StaffAttendance = require("./staff_attendance")(sequelize, Sequelize.DataTypes);
db.ExpenceType = require("./expence-type")(sequelize, Sequelize.DataTypes);
db.OpeningBalance = require("./opening-balance")(sequelize, Sequelize.DataTypes);
db.Location = require("./location")(sequelize, Sequelize.DataTypes);
db.Booking = require("./booking")(sequelize, Sequelize.DataTypes);
db.BookingPackage = require("./booking-package")(sequelize, Sequelize.DataTypes);
db.Payment = require("./payment")(sequelize, Sequelize.DataTypes);

db.Customer = require("./customer")(sequelize, Sequelize.DataTypes); 
db.OfficeCenter = require("./office-center")(sequelize, Sequelize.DataTypes); 
Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
