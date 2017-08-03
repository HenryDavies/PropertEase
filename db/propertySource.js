const httpRequestPromise = require('request-promise');
const numberOfDaysToDownload = 2;
const listingsPerHttpRequest = 100;
const apiKey = 'gfya4wfdf8ypa8xemktvhx6h';
const listingsArray = [];
const async = require('async');

let options;

module.exports = {
  getAllPropertyListings: getAllPropertyListings
};

function getAllPropertyListings(callback) {
  let pageNumber = 1;
  const xDaysAgo = Date.parse(new Date()) - 1000 * 60 * 60 * 24 * numberOfDaysToDownload;
  let withinSpecifiedXDays = true;
  async.whilst(
    () => withinSpecifiedXDays && pageNumber < 6,
    (innerCallback) => {
      setHttpOptions(pageNumber);
      httpRequestPromise(options)
        .then(data => {
          if (Date.parse(data.listing[0] < xDaysAgo)) {
            withinSpecifiedXDays = false;
            console.log(`${listingsArray.length} listings got from Zoopla`);
            callback(null, listingsArray);
          }
          addListingsToArray(data.listing, callback);
          console.log(`page ${pageNumber} downloaded`);
          pageNumber++;
          innerCallback(null, pageNumber);
        })
        .catch(err => {
          console.log('HTTP request error:', err);
        });
    },
    () => callback(null, listingsArray)
  );
}

function setHttpOptions(pageNumber) {
  options = {
    uri: `http://api.zoopla.co.uk/api/v1/property_listings.js?area=London&order_by=age&page_size=${listingsPerHttpRequest}&page_number=${pageNumber}&listing_status=sale&api_key=${apiKey}`,
    headers: {
      'User-Agent': 'Request-Promise',
      'Connection': 'keep-alive'
    },
    json: true
  };
}

function addListingsToArray(listings) {
  listings.forEach(listing => {
    listing.date = Date.parse(listing.last_published_date);
    listingsArray.push(listing);
  });
}
