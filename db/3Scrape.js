module.exports = function(callback) {
  const rp         = require('request-promise');
  const cheerio    = require('cheerio');
  // const mongoose   = require('mongoose');
  const config = require('../config/config');
  // const databaseUrl = config.db;
  const Property = require('../models/property');
  let scrapeCounter = 0;
  let counter = 0;

  // mongoose.connect(databaseUrl);

  function cheerioUrlAsync(url, callback) {
    rp(url)
    .then(htmlString => {
      const $ = cheerio.load(htmlString);
      const squareFoot = $('.num-sqft').text();
      callback(squareFoot);
    }).catch(err => {
      console.log(err);
    });
  }

  // descending sort
  function sortByKey(array, key) {
    return array.sort(function(a, b) {
      var x = a[key]; var y = b[key];
      return ((x < y) ? 1 : ((x > y) ? -1 : 0));
    });
  }

  Property.find({}, (err, data) => {
    const sortedData = sortByKey(data, 'date');
    const listingCount = sortedData.length;
    sortedData.forEach((listing, index)=> {
      setTimeout(() => {
        if (!listing.scrapeSquareFeet && listing.scrapeSquareFeet !== 'NA') {
          cheerioUrlAsync(listing.details_url.split('&utm_medium=api')[0], (squareFoot) => {
            if (parseInt(squareFoot)) {
              listing.scrapeSquareFeet = parseInt(squareFoot.split(',').join(''));
              listing.pricePerSquareFoot = listing.price / listing.scrapeSquareFeet;
            } else listing.scrapeSquareFeet = 'NA';
            listing.save((err, listing) => {
              if (err) {
                counter++;
                return console.log(err);
              }
              scrapeCounter++;
              counter++;
              console.log(`${listing.listing_id} saved, scraped ${scrapeCounter} of ${counter}`);
              if (counter === listingCount) callback();
            });
          });
        } else {
          counter++;
          console.log(`already scraped, scraped ${scrapeCounter} of ${counter}`);
          if (counter === listingCount) callback();
        }
      }, index * 500);
    });
  });
};
