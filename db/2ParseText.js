module.exports = function(callback) {
  const vision = require('@google-cloud/vision')({
    projectId: 'image-scraping',
    keyFilename: 'Image-scraping-5d9b95a7812f.json'
  });
  // const mongoose = require('mongoose');
  const config = require('../config/config');
  // const databaseUrl = config.db;
  const Property = require('../models/property');
  const fs = require('fs');
  const request = require('request');
  const async = require('async');
  const PARALLEL_LIMIT = 3;
  const path = require('path');
  let counter = 0;

  const squareFeetArray = ['SQFT','SQ FT','SOFT','SO FT','SAFT','SA FT','SQ FEET',
  'SQ.FT','SQ. FT','SO.FT','SO. FT','SA.FT','SA. FT','SQ.FEET','SQ. FEET',
  'SQ-FT','SQ- FT','SO-FT','SO- FT','SA-FT','SA- FT','SQ-FEET','SQ- FEET',
  'SQUARE FEET','SQUARE FT','FT2'];

  // mongoose.connect(databaseUrl);

  const download = (uri, filename, callback) => {
    request.head({ uri: uri }, function(err, res){
      if (err) {
        console.log(err);
      } else {
        console.log('content-type:', res.headers['content-type']);
        console.log('content-length:', res.headers['content-length']);

        request(uri)
        .pipe(fs.createWriteStream(filename))
        .on('close', callback)
        .on('error', (err) => {
          return console.log(err);
        });
      }
    });
  };

  // GET SQUARE FEET DATA FROM FLOOR PLANS AND SAVE TO DB
  function editProperty(listing, callback) {
    if (listing.price == 0) {
      Property.remove({ listing_id: listing.listing_id, date: listing.date }, err => {
        if (err) {
          console.log('property removal error',err);
          callback();
        } else {
          console.log('property removed');
          callback();
        }
      });
    } else if (listing.floor_plan[0] && listing.floor_plan[0] !== undefined && !listing.pricePerSquareFoot) {
      download(listing.floor_plan[0], path.join(__dirname, `../images/${listing.listing_id}.png`), () => {
        vision.detectText(path.join(__dirname, `../images/${listing.listing_id}.png`), (err, text) => {
          if (err) {
            console.log('cloud vision error:', err);
            fs.unlink(path.join(__dirname, `../images/${listing.listing_id}.png`), callback);
          } else if (text[0] && text) {
            listing.floorPlanText = text[0];
            listing.parsedText = parseText(listing.floorPlanText);
            listing.array = [];
            listing.finalArray = [];
            delete listing.squareFeet;
            listing.pricePerSquareFoot = 'NA';
            squareFeetArray.forEach((value, index) => {
              if (listing.parsedText.toUpperCase().includes(value)) {
                listing.array.push(listing.parsedText.toUpperCase().split(value));
                listing.array[listing.array.length - 1].forEach((value, index1) => {
                  listing.array[listing.array.length - 1][index1] = parseInt(value.split(' ')[value.split(' ').length -2]);
                  if (isNaN(listing.array[listing.array.length - 1][index1])) {
                    listing.array[listing.array.length - 1][index1] = 0;
                  }
                });
                listing.array[listing.array.length - 1].splice(listing.array[listing.array.length - 1].length-1, 1);
              }
            });
            listing.array.forEach((array, index) => {
              const maxValue = Math.max(...listing.array[index]);
              if (listing.array[index]) {
                listing.finalArray.push(maxValue);
              }
            });
            const maxValue = Math.max(...listing.finalArray);
            if (isFinite(maxValue) && maxValue ) {
              listing.squareFeet = maxValue;
              listing.pricePerSquareFoot = listing.price / listing.squareFeet;
            }
            console.log(listing.finalArray,listing.squareFeet);
            listing.save((err, listing) => {
              if (err) return console.log(err);
              counter++;
              console.log(`${listing.listing_id} saved, ${counter}`);
              fs.unlink(path.join(__dirname, `../images/${listing.listing_id}.png`), callback);
            });
          } else fs.unlink(path.join(__dirname, `../images/${listing.listing_id}.png`), callback);
        });
      });
    } else callback();
  }

  // descending sort
  function sortByKey(array, key) {
    return array.sort(function(a, b) {
      var x = a[key]; var y = b[key];
      return ((x < y) ? 1 : ((x > y) ? -1 : 0));
    });
  }


  function parseText(text) {
    return text
    .split(',').join('')    // thousand separator
    .split('\n').join(' ')
    .split('(').join(' ')
    .split(')').join(' ')
    .split('/').join(' ')
    .split('-').join(' ');  // equals signs often register as dashes
  }


  Property.find({}, (err, data) => {
    const shortArray = sortByKey(data,'date').slice(0,5000);
    // const shortArray = sortByKey(data,'date').slice(5000);
    async.eachLimit(shortArray, PARALLEL_LIMIT, editProperty, function(err) {
      console.log('reached');
      if (err) console.log(err);
      console.log('done');
      dbSummary();
    });
  });

  function dbSummary() {
    let totalProperties;
    let totalFloorPlans;
    let totalSquareFeet;

    Property.count({}, (err, count) => {
      console.log(`Total unique properties in DB: ${count}`);
      totalProperties = count;
      Property.count({ floor_plan: {$exists: true, $ne: []} }, (err, count) => {
        console.log(`Total floor plans in DB: ${count}`);
        totalFloorPlans = count;
        Property.count({ squareFeet: {$exists: true} }, (err, count) => {
          console.log(`Total properties with square foot data: ${count}`);
          totalSquareFeet = count;
          const floorPlansPercent = parseInt((totalFloorPlans / totalProperties) * 100);
          const squareFeetPercent = parseInt((totalSquareFeet / totalProperties) * 100);
          const squareFeetPercentOfFloorPlans = parseInt((totalSquareFeet / totalFloorPlans) * 100);
          console.log(`Properties with floor plans: ${floorPlansPercent}%`);
          console.log(`Properties with square feet data (% of total): ${squareFeetPercent}%`);
          console.log(`Properties with square feet data (% of floor plans): ${squareFeetPercentOfFloorPlans}%`);
          callback();
        });
      });
    });
  }
};
