const propertySource = require('./propertySource');
const propertyDB = require('./propertyDB');
const async = require('async');
const mongoose = require('mongoose');
const config = require('../config/config');
const databaseUrl = config.db;

mongoose.connect(databaseUrl);

async.waterfall([
  propertySource.getAllPropertyListings,
  propertyDB.dealWithListingsAlreadyInDB,
  propertyDB.getSquareFootDataForAllListings,
  propertyDB.removeOutliers,
  propertyDB.saveListingsToDB,
  propertyDB.DBsummary
], function (err, result) {
  if (err) return console.log(err);
  console.log(result);
});
