const mongoose        = require('mongoose');
const vision          = require('@google-cloud/vision')({
  projectId: 'image-scraping',
  keyFilename: 'Image-scraping-5d9b95a7812f.json'
});
const fs              = require('fs');
const request         = require('request');
const rp              = require('request-promise');
const cheerio         = require('cheerio');
const async           = require('async');
const path            = require('path');
const config          = require('../config/config');
const databaseUrl     = config.db;
const Property        = require('../models/property');
const start           = 1;  // minimum 1 = page 1
const end             = 20;    // maximum 100 = page 100 (inclusive)
const PARALLEL_LIMIT  = 5;
const squareFeetArray = ['SQFT','SQ FT','SOFT','SO FT','SAFT','SA FT','SQ FEET',
  'SQ.FT','SQ. FT','SO.FT','SO. FT','SA.FT','SA. FT','SQ.FEET','SQ. FEET',
  'SQ-FT','SQ- FT','SO-FT','SO- FT','SA-FT','SA- FT','SQ-FEET','SQ- FEET',
  'SQUARE FEET','SQUARE FT','FT2'];
let i                 = start - 1;
let saveCounter       = 0;
let counter           = 0;
let listings = [];
mongoose.connect(databaseUrl);

const propertySource = require('./propertySource');
const listingsToBeSaved = 301;
let listingsSavedToDB = 0;

function test() {
  const listingNumber = listingsSavedToDB + 1;
  propertySource.getPropertyListing(listingNumber, (listing) => {
    console.log(listing);
    listingsSavedToDB++;
    console.log(`${listingsSavedToDB} listings saved`);
    test();
  });
}

test();




// check that duplcates are being deleted
////////////////
// Property.collection.drop();
////////////////






// while (listingsSavedToDB < listingsToBeSaved) {
//   let listingNumber = listingsSavedToDB + 1;
//   propertySource.getPropertyListing(listingNumber, (listing) => {
//     if (propertyDB.listingAlreadyExists(listing)) {
//        if (propertyDB.priceHasChanged(listing)) {
//          propertyDB.importPriceHistoryAndDeleteOldRecords(listing);
//        } else propertyDB.removeListing(listing);
//     }
//     propertyDB.getSquareFootData(listing,
//       propertyDB.saveListing(listing, () => {
//         listingsSavedToDB++;
//     }));
//   });
// }






// recursiveParseAndSave();
//
// // run parseAndSave function on all listings with a price
// // parallel limit avoids overloading the google cloud vision API
// function recursiveParseAndSave() {
//   console.log('<<<<recursiveParseAndSave started>>>>');
//   listings = [];
//   const options = {
//     uri: `http://api.zoopla.co.uk/api/v1/property_listings.js?area=London&order_by=age&page_size=100&page_number=${i}&listing_status=sale&api_key=gfya4wfdf8ypa8xemktvhx6h`,
//     headers: {
//       'User-Agent': 'Request-Promise',
//       'Connection': 'keep-alive'
//     },
//     json: true
//   };
//   rp(options)
//   .then(data => {
//     data.listing.forEach((listing) => {
//       if (listing.price != 0) {
//         listing.date = Date.parse(listing.last_published_date);
//         listings.push(listing);
//       }
//     });
//     async.eachLimit(listings, PARALLEL_LIMIT, parseAndSave, (err) => {
//       if (err) console.log(err);
//       console.log(`${listings.length} listings saved. Finished page ${i+1}`);
//       i++;
//       if (i < end) recursiveParseAndSave();
//       else dbSummary();
//     });
//   })
//   .catch(err => {
//     console.log('rp error:', err);
//   });
// }
//
// // if exact duplicate, ignore. if updated duplicate, save price history
// // try to scrape square feet from listing url
// // if not available, try to parse it from floor plan
// // if not outlier, save listing to database
// function parseAndSave(listing, callback) {
//   counter++;
//   dealWithDuplicates(listing, callback, () => {
//     if (listing.floor_plan !== [] && listing.floor_plan) {
//       scrapeSqFt(listing.details_url.split('&utm_medium=api')[0], (squareFeet) => {
//         if (squareFeet) {
//           listing.squareFeet = squareFeet;
//           listing.pricePerSquareFoot = parseInt(listing.price / listing.squareFeet);
//           console.log(`Scraped: SqFt ${squareFeet}, £/SqFt ${listing.pricePerSquareFoot}`);
//           saveProperty(listing, callback);
//         } else {
//           download(listing.floor_plan[0], path.join(__dirname, `../images/${listing.listing_id}.png`), () => {
//             vision.detectText(path.join(__dirname, `../images/${listing.listing_id}.png`), (err, text) => {
//               if (err) {
//                 console.log('cloud vision error:', err);
//                 saveProperty(listing, callback);
//               } else if (text[0] && text) {
//                 listing.floorPlanText = text[0];
//                 listing.parsedText = parseText(listing.floorPlanText);
//                 listing.squareFeet = findSquareFeet(listing.parsedText);
//                 if (listing.squareFeet) {
//                   listing.pricePerSquareFoot = parseInt(listing.price / listing.squareFeet);
//                 } else listing.pricePerSquareFoot = 'NA';
//                 console.log(`Parsed: SqFt ${listing.squareFeet}, £/SqFt ${listing.pricePerSquareFoot}`);
//                 saveProperty(listing, callback);
//               } else {
//                 console.log('No floor plan text');
//                 saveProperty(listing,callback);
//               }
//             });
//             fs.unlink(path.join(__dirname, `../images/${listing.listing_id}.png`), () => {});
//           });
//         }
//       });
//     } else {
//       console.log('No floor plan');
//       saveProperty(listing,callback);
//     }
//   });
// }
//
// function dealWithDuplicates(listing, callback, callback2) {
//   Property.find({listing_id: listing.listing_id}, (err, listings) => {
//     if (listings.length > 1) {
//       const duplicates = sortByKey(listings, 'date');
//       if (duplicates[1].date === duplicates[0].date) {
//         console.log('already in DB');
//         return callback();
//       } else {
//         duplicates[0].priceHistory = [];
//         if (duplicates[1].priceHistory) {
//           duplicates[0].priceHistory = (duplicates[1].priceHistory);
//           duplicates[0].priceHistory.push({
//             price: duplicates[1].price,
//             firstPubDate: duplicates[1].first_published_date,
//             lastPubDate: duplicates[1].last_published_date
//           });
//         } else {
//           for (let i = 1; i < duplicates.length; i++) {
//             duplicates[0].priceHistory.push({
//               price: duplicates[i].price,
//               firstPubDate: duplicates[i].first_published_date,
//               lastPubDate: duplicates[i].last_published_date
//             });
//           }
//         }
//       }
//     }
//     callback2();
//   });
// }
//
// function scrapeSqFt(url, callback) {
//   rp(url)
//   .then(htmlString => {
//     const $ = cheerio.load(htmlString);
//     const squareFeet = parseInt($('.num-sqft').text().split(',').join(''));
//     console.log($('.num-sqft').text(), squareFeet);
//     callback(squareFeet);
//   }).catch(err => {
//     console.log(err);
//     callback();
//   });
// }
//
// function download(uri, filename, callback) {
//   request.head({ uri: uri }, function(err) {
//     if (err) {
//       console.log(err);
//     } else {
//       request(uri)
//       .pipe(fs.createWriteStream(filename))
//       .on('close', callback)
//       .on('error', (err) => {
//         console.log(err);
//       });
//     }
//   });
// }
//
// function parseText(text) {
//   return text
//   .split(',').join('')    // thousand separator
//   .split('\n').join(' ')
//   .split('(').join(' ')
//   .split(')').join(' ')
//   .split('/').join(' ')
//   .split('-').join(' ');  // equals signs often register as dashes
// }
//
// function findSquareFeet(text) {
//   const splitBySqFt = [];
//   const sqFtValues = [];
//   squareFeetArray.forEach((value) => {
//     if (text.toUpperCase().includes(value)) {
//       splitBySqFt.push(text.toUpperCase().split(value));
//       const i = splitBySqFt.length - 1;
//       splitBySqFt[i].forEach((value, index) => {
//         splitBySqFt[i][index] = parseInt(value.split(' ')[value.split(' ').length -2]);
//         if (isNaN(splitBySqFt[i][index])) {
//           splitBySqFt[i][index] = 0;
//         }
//       });
//       splitBySqFt[i].splice(splitBySqFt[i].length-1, 1);
//     }
//   });
//   splitBySqFt.forEach((array, index) => {
//     const maxValue = Math.max(...splitBySqFt[index]);
//     if (splitBySqFt[index]) sqFtValues.push(maxValue);
//   });
//   const maxValue = Math.max(...sqFtValues);
//   if (isFinite(maxValue) && maxValue ) return maxValue;
// }
//
// function saveProperty (listing, callback) {
//   if (!outlier(listing)) {
//     Property.create(listing, (err) => {
//       if (err) return console.log(err);
//       saveCounter++;
//       console.log(`listing ${saveCounter} saved of ${counter - PARALLEL_LIMIT + 1} total`);
//       callback();
//     });
//   } else {
//     console.log('outlier - listing not saved');
//     callback();
//   }
// }
//
// // descending sort
// function sortByKey(array, key) {
//   return array.sort(function(a, b) {
//     var x = a[key]; var y = b[key];
//     return ((x < y) ? 1 : ((x > y) ? -1 : 0));
//   });
// }
//
// function outlier(listing) {
//   return (listing.squareFeet < 250 || listing.squareFeet > 5000 || listing.pricePerSquareFoot < 300 || listing.pricePerSquareFoot > 1700);
// }
//
// function dbSummary() {
//   let totalProperties;
//   let totalFloorPlans;
//   let totalSquareFeet;
//
//   Property.count({}, (err, count) => {
//     console.log(`Total unique properties in DB: ${count}`);
//     totalProperties = count;
//     Property.count({ floor_plan: {$exists: true, $ne: []} }, (err, count) => {
//       console.log(`Total floor plans in DB: ${count}`);
//       totalFloorPlans = count;
//       Property.count({ pricePerSquareFoot: {$ne: 'NA'} }, (err, count) => {
//         console.log(`Total properties with square foot data: ${count}`);
//         totalSquareFeet = count;
//         const floorPlansPercent = parseInt((totalFloorPlans / totalProperties) * 100);
//         const squareFeetPercent = parseInt((totalSquareFeet / totalProperties) * 100);
//         const squareFeetPercentOfFloorPlans = parseInt((totalSquareFeet / totalFloorPlans) * 100);
//         console.log(`Properties with floor plans: ${floorPlansPercent}%`);
//         console.log(`Properties with square feet data (% of total): ${squareFeetPercent}%`);
//         console.log(`Properties with square feet data (% of floor plans): ${squareFeetPercentOfFloorPlans}%`);
//       });
//     });
//   });
// }
