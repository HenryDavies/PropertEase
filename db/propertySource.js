const request         = require('request');
const rp = require('request-promise');

const propertySource = {};
propertySource.listingsPerHttpRequest = 100;
propertySource.apiKey = 'gfya4wfdf8ypa8xemktvhx6h';

propertySource.getPropertyListing = (listingNumber, callback) => {
  // console.log(propertySource.listingArray);
  if (propertySource.listingNotInArray(listingNumber)) {
    propertySource.setPageNumberAndHttpOptions(listingNumber);
    rp(propertySource.options)
    .then(data => {
      console.log('reached');
      propertySource.addListingsToArray(data.listing, () => {
        const listingIndex = (listingNumber - 1) % 100;
        callback(propertySource.listingArray[listingIndex]);
      });
    })
    .catch(err => {
      console.log('HTTP request error:', err);
    });
  } else {
    const listingIndex = (listingNumber - 1) % 100;
    callback(propertySource.listingArray[listingIndex]);
  }
};

propertySource.listingNotInArray = (listingNumber) => {
  return !(propertySource.pageNumber === Math.floor((listingNumber + 1) / 100) + 1);
};

propertySource.setPageNumberAndHttpOptions = (listingNumber) => {
  propertySource.pageNumber = Math.floor((listingNumber - 1) / propertySource.listingsPerHttpRequest) + 1;
  propertySource.options = {
    uri: `http://api.zoopla.co.uk/api/v1/property_listings.js?area=London&order_by=age&page_size=${propertySource.listingsPerHttpRequest}&page_number=${propertySource.pageNumber}&listing_status=sale&api_key=${propertySource.apiKey}`,
    headers: {
      'User-Agent': 'Request-Promise',
      'Connection': 'keep-alive'
    },
    json: true
  };
};

propertySource.addListingsToArray = (listings, callback) => {
  console.log('addlistings function reached');
  propertySource.listingArray = [];
  listings.forEach(listing => {
    propertySource.listingArray.push(listing);
  });
  callback();
};

module.exports = propertySource;
