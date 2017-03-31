const mongoose = require('mongoose');
const config = require('../config/config');
const databaseUrl = config.db;
const Property = require('../models/property');

mongoose.connect(databaseUrl);

// descending sort
function sortByKey(array, key) {
  return array.sort(function(a, b) {
    var x = a[key]; var y = b[key];
    return ((x < y) ? 1 : ((x > y) ? -1 : 0));
  });
}

// delete outliers & find properties that have been updated, import price history, delete older versions

Property.find({}, (err, data) => {
  let saveCount = 0;
  let removeCount = 0;
  let duplicateCount = 0;
  console.log(data.length);
  data.forEach((listing, index) => {
    console.log(listing.status);
    if (listing.scrapeSquareFeet === 'NA') {
      if (listing.squareFeet < 250 || listing.squareFeet > 5000) {
        Property.remove({ listing_id: listing.listing_id, date: listing.date }, err => {
          if (err) console.log(err);
          else {
            removeCount++;
            console.log(`Outlier removed, ${removeCount}`);
          }
        });
      }
      if (listing.pricePerSquareFoot < 300 || listing.pricePerSquareFoot > 1700) {
        Property.remove({ listing_id: listing.listing_id, date: listing.date }, err => {
          if (err) console.log(err);
          else {
            removeCount++;
            console.log(`Outlier removed, ${removeCount}`);
          }
        });
      }
    } else {
      Property.find({listing_id: listing.listing_id}, (err, listings) => {
        if (listings.length > 1) {
          const duplicatesArray = sortByKey(listings, 'date');
          duplicatesArray[0].priceHistory = [];
          if (duplicatesArray[1].priceHistory) {
            duplicatesArray[0].priceHistory = (duplicatesArray[1].priceHistory);
            duplicatesArray[0].priceHistory.push({
              price: duplicatesArray[1].price,
              firstPubDate: duplicatesArray[1].first_published_date,
              lastPubDate: duplicatesArray[1].last_published_date
            });
          } else {
            for (let i = 1; i < duplicatesArray.length; i++) {
              duplicatesArray[0].priceHistory.push({
                price: duplicatesArray[i].price,
                firstPubDate: duplicatesArray[i].first_published_date,
                lastPubDate: duplicatesArray[i].last_published_date
              });
            }
          }
          for (let i = 1; i < duplicatesArray.length; i++) {
            Property.remove({ listing_id: duplicatesArray[i].listing_id, date: duplicatesArray[i].date }, err => {
              if (err) console.log(err);
              else {
                duplicateCount++;
                console.log(`duplicate removed, ${duplicateCount}`);
              }
            });
          }
          duplicatesArray[0].save((err, listing) => {
            if (err) console.log(err);
            else {
              saveCount++;
              console.log(`${listing.listing_id} saved, ${saveCount}`);
            }
          });
        }
      });
    }
  });
  dbSummary();
});

// COUNT TOTALS, FLOOR PLANS & SQUARE FOOT DATA

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
