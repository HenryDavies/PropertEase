const httpRequestPromise = require('request-promise');
const listingsToBeSaved = 1000;
const listingsPerHttpRequest = 100;
const apiKey = 'gfya4wfdf8ypa8xemktvhx6h';
const listingsArray = [];

let options;

module.exports = {
  getAllPropertyListings: getAllPropertyListings
};

function getAllPropertyListings(callback) {
  const pagesToGet = (Math.ceil(listingsToBeSaved / 100) * 100) / listingsPerHttpRequest;
  for (let pageNumber = 1; pageNumber <= pagesToGet; pageNumber++) {
    setHttpOptions(pageNumber);
    httpRequestPromise(options)
    .then(data => {
      addListingsToArray(data.listing, callback);
      if (listingsArray.length >= listingsToBeSaved) {
        console.log('passing to next function');
        callback(null, listingsArray.slice(0, listingsToBeSaved));
      }
    })
    .catch(err => {
      console.log('HTTP request error:', err);
    });
  }
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
