const Property        = require('../models/property');
const httpRequest         = require('request');
const httpRequestPromise = require('request-promise');
const cheerio         = require('cheerio');
const fs              = require('fs');
const path            = require('path');
const vision          = require('@google-cloud/vision')({
  projectId: 'image-scraping',
  keyFilename: 'Image-scraping-5d9b95a7812f.json'
});
const async = require('async');
const squareFeetArray = ['SQFT','SQ FT','SOFT','SO FT','SAFT','SA FT','SQ FEET',
  'SQ.FT','SQ. FT','SO.FT','SO. FT','SA.FT','SA. FT','SQ.FEET','SQ. FEET',
  'SQ-FT','SQ- FT','SO-FT','SO- FT','SA-FT','SA- FT','SQ-FEET','SQ- FEET',
  'SQUARE FEET','SQUARE FT','FT2'];
const parallelLimitForVision = 3;

module.exports = {
  dealWithListingsAlreadyInDB: dealWithListingsAlreadyInDB,
  getSquareFootDataForAllListings: getSquareFootDataForAllListings,
  removeOutliers: removeOutliers,
  saveListingsToDB: saveListingsToDB,
  DBsummary: DBsummary
};

function dealWithListingsAlreadyInDB(listings, callback) {
  const filteredListings = [];
  const numberOfListings = listings.length;
  let listingsChecked = 0;
  let duplicateCount = 0;
  let updatedRecordCount = 0;
  listings.forEach(listing => {
    Property.find({listing_id: listing.listing_id}, (err, listingsAlreadyInDB) => {
      listingsChecked++;
      if (err) console.log(err);
      if (listingsAlreadyInDB.length === 0) filteredListings.push(listing);
      else {
        const duplicates = sortByKey(listingsAlreadyInDB, 'date');
        if (duplicates[0].date !== listing.date ) {
          importPriceHistory(listing, duplicates, (listing) => {
            filteredListings.push(listing);
            updatedRecordCount++;
          });
        } else {
          duplicateCount++;
        }
      }
      if (listingsChecked === numberOfListings) {
        console.log(`${duplicateCount + updatedRecordCount} listings already in DB: ${duplicateCount} duplicates (removed from array), ${updatedRecordCount} updated listings (imported price history)`);
        callback(null, filteredListings);
      }
    });
  });

  // descending sort
  function sortByKey(array, key) {
    return array.sort(function(a, b) {
      var x = a[key]; var y = b[key];
      return ((x < y) ? 1 : ((x > y) ? -1 : 0));
    });
  }

  function importPriceHistory(listing, duplicates, callback) {
    if (duplicates[0].priceHistory) {
      listing.priceHistory = duplicates[0].priceHistory;
      listing.priceHistory.push({
        price: duplicates[0].price,
        firstPubDate: duplicates[0].first_published_date,
        lastPubDate: duplicates[0].last_published_date
      });
    } else {
      listing.priceHistory = [];
      for (let i = 0; i < duplicates.length; i++) {
        listing.priceHistory.push({
          price: duplicates[i].price,
          firstPubDate: duplicates[i].first_published_date,
          lastPubDate: duplicates[i].last_published_date
        });
      }
    }
    callback(listing);
  }
}

function getSquareFootDataForAllListings(listings, callback) {
  let listingsChecked = 0;
  async.eachLimit(listings, parallelLimitForVision, getSquareFootData, (err) => {
    if (err) console.log(err);
    console.log(`Finished square foot scraping/parsing for ${listings.length} listings`);
    callback(null, listings);
  });

  function getSquareFootData(listing, callback) {
    listingsChecked++;
    console.log(`Finding square foot data for listing ${listingsChecked}`);
    if (floorPlanExists(listing)) {
      scrapeSqFtFromListingURL(listing.details_url.split('&utm_medium=api')[0], (scrapedSquareFeet) => {
        if (scrapedSquareFeet) {
          listing.scraped = true;
          listing.squareFeet = scrapedSquareFeet;
          listing.pricePerSquareFoot = parseInt(listing.price / listing.squareFeet);
          console.log(`Scraped: SqFt ${scrapedSquareFeet}, £/SqFt ${listing.pricePerSquareFoot}`);
          callback();
        } else {
          parseSqFtFromListingFloorPlan(listing, (listingWithParsedSqFt) => {
            if (listingWithParsedSqFt) listing = listingWithParsedSqFt;
            callback();
          });
        }
      });
    } else {
      console.log('No floor plan');
      callback();
    }

    function floorPlanExists(listing) {
      return (listing.floor_plan !== [] && listing.floor_plan);
    }

    function scrapeSqFtFromListingURL(url, callback) {
      httpRequestPromise(url)
      .then(htmlString => {
        const $ = cheerio.load(htmlString);
        const squareFeet = parseInt($('.num-sqft').text().split(',').join(''));
        callback(squareFeet);
      }).catch(err => {
        console.log(err);
        callback();
      });
    }

    function parseSqFtFromListingFloorPlan(listing, callback) {
      downloadFile(listing.floor_plan[0], imagePath(listing), () => {
        vision.detectText(imagePath(listing), (err, text) => {
          if (err) {
            console.log('cloud vision error:', err);
            callback();
          } else if (text[0] && text) {
            listing.floorPlanText = text[0];
            listing.parsedText = parseText(listing.floorPlanText);
            listing.squareFeet = findMaxSquareFeet(listing.parsedText);
            if (listing.squareFeet) {
              listing.pricePerSquareFoot = parseInt(listing.price / listing.squareFeet);
            } else listing.pricePerSquareFoot = 'NA';
            console.log(`Parsed: SqFt ${listing.squareFeet}, £/SqFt ${listing.pricePerSquareFoot}`);
            callback(listing);
          } else {
            console.log('No floor plan text');
            callback();
          }
        });
        fs.unlink(imagePath(listing), () => {});
      });

      function imagePath(listing) {
        return path.join(__dirname, `../images/${listing.listing_id}.png`);
      }

      function downloadFile(uri, filename, callback) {
        httpRequest.head({ uri: uri }, function(err) {
          if (err) {
            console.log(err);
          } else {
            httpRequest(uri)
            .pipe(fs.createWriteStream(filename))
            .on('close', callback)
            .on('error', (err) => {
              console.log(err);
            });
          }
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


      function findMaxSquareFeet(text) {
        const splitBySqFt = [];
        const sqFtValues = [];
        squareFeetArray.forEach((value) => {
          if (text.toUpperCase().includes(value)) {
            splitBySqFt.push(text.toUpperCase().split(value));
            const i = splitBySqFt.length - 1;
            splitBySqFt[i].forEach((value, index) => {
              splitBySqFt[i][index] = parseInt(value.split(' ')[value.split(' ').length -2]);
              if (isNaN(splitBySqFt[i][index])) {
                splitBySqFt[i][index] = 0;
              }
            });
            splitBySqFt[i].splice(splitBySqFt[i].length-1, 1);
          }
        });
        splitBySqFt.forEach((array, index) => {
          const maxValue = Math.max(...splitBySqFt[index]);
          if (splitBySqFt[index]) sqFtValues.push(maxValue);
        });
        const maxValue = Math.max(...sqFtValues);
        if (isFinite(maxValue) && maxValue ) return maxValue;
      }
    }
  }
}

function removeOutliers(listings, callback) {
  const filteredListings = [];
  let outlierCount = 0;
  listings.forEach(listing => {
    if (notOutlier(listing)) filteredListings.push(listing);
    else {
      outlierCount++;
    }
  });
  console.log(`${outlierCount} outliers removed. ${filteredListings.length} listings to be saved in DB.`);
  callback(null, filteredListings);

  function notOutlier(listing) {
    return (listing.scraped || !(listing.squareFeet < 250 || listing.squareFeet > 5000 || listing.pricePerSquareFoot < 300 || listing.pricePerSquareFoot > 1700));
  }
}

function saveListingsToDB(listings, callback) {
  const numberOfListings = listings.length;
  let listingsSaved = 0;
  listings.forEach(listing => {
    Property.create(listing, (err) => {
      listingsSaved++;
      if (err) return console.log(err);
      if (listingsSaved === numberOfListings) {
        console.log(`${listingsSaved} listings saved to DB`);
        callback(null);
      }
    });
  });
}

function DBsummary() {
  let totalProperties;
  let totalFloorPlans;
  let totalSquareFeet;

  Property.count({}, (err, count) => {
    console.log(`Total unique properties in DB: ${count}`);
    totalProperties = count;
    Property.count({ floor_plan: {$exists: true, $ne: []} }, (err, count) => {
      console.log(`Total floor plans in DB: ${count}`);
      totalFloorPlans = count;
      Property.count({ pricePerSquareFoot: {$ne: 'NA'} }, (err, count) => {
        console.log(`Total properties with square foot data: ${count}`);
        totalSquareFeet = count;
        const floorPlansPercent = parseInt((totalFloorPlans / totalProperties) * 100);
        const squareFeetPercent = parseInt((totalSquareFeet / totalProperties) * 100);
        const squareFeetPercentOfFloorPlans = parseInt((totalSquareFeet / totalFloorPlans) * 100);
        console.log(`Properties with floor plans: ${floorPlansPercent}%`);
        console.log(`Properties with square feet data (% of total): ${squareFeetPercent}%`);
        console.log(`Properties with square feet data (% of floor plans): ${squareFeetPercentOfFloorPlans}%`);
      });
    });
  });
}
