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
const end             = 2;    // maximum 100 = page 100 (inclusive)
const PARALLEL_LIMIT  = 10;
const squareFeetArray = ['SQFT','SQ FT','SOFT','SO FT','SAFT','SA FT','SQ FEET',
  'SQ.FT','SQ. FT','SO.FT','SO. FT','SA.FT','SA. FT','SQ.FEET','SQ. FEET',
  'SQ-FT','SQ- FT','SO-FT','SO- FT','SA-FT','SA- FT','SQ-FEET','SQ- FEET',
  'SQUARE FEET','SQUARE FT','FT2'];
let i                 = start - 1;
let saveCounter       = 0;

mongoose.connect(databaseUrl);

////////////////
Property.collection.drop();
////////////////

recursiveParseAndSave();

function recursiveParseAndSave() {
  const listings = [];
  const options = {
    uri: `http://api.zoopla.co.uk/api/v1/property_listings.js?area=London&order_by=age&page_size=100&page_number=${i}&listing_status=sale&api_key=gfya4wfdf8ypa8xemktvhx6h`,
    headers: {
      'User-Agent': 'Request-Promise',
      'Connection': 'keep-alive'
    },
    json: true
  };
  rp(options)
  .then(data => {
    data.listing.forEach((listing) => {
      if (listing.price != 0) {
        listings.push(listing);
        listing.date = Date.parse(listing.last_published_date);
      }
    });
    async.eachLimit(listings, PARALLEL_LIMIT, parseAndSave, (err) => {
      if (err) console.log(err);
      console.log(`${listings.length} listings saved. Finished page ${i+1}`);
      i++;
      if (i < end) recursiveParseAndSave();
    });
  })
  .catch(err => {
    console.log('rp error:', err);
  });
}


// first try to scrape square feet from listing url
// if not available, try to parse it from floor plan
// save listing to database
function parseAndSave(listing, callback) {
  console.log('reached');
  if (listing.floor_plan !== [] && listing.floor_plan) {
    scrapeSqFt(listing.details_url.split('&utm_medium=api')[0], (squareFeet) => {
      if (squareFeet) {
        listing.squareFeet = squareFeet;
        listing.pricePerSquareFoot = parseInt(listing.price / listing.squareFeet);
        console.log(`Scraped: SqFt ${squareFeet}, £/SqFt ${listing.pricePerSquareFoot}`);
        saveProperty(listing);
        callback();
      } else {
        download(listing.floor_plan[0], path.join(__dirname, `../images/${listing.listing_id}.png`), () => {
          vision.detectText(path.join(__dirname, `../images/${listing.listing_id}.png`), (err, text) => {
            if (err) {
              console.log('cloud vision error:', err);
              saveProperty(listing);
              callback();
            } else if (text[0] && text) {
              listing.floorPlanText = text[0];
              listing.parsedText = parseText(listing.floorPlanText);
              listing.squareFeet = findSquareFeet(listing.parsedText);
              if (listing.squareFeet) {
                listing.pricePerSquareFoot = parseInt(listing.price / listing.squareFeet);
              } else listing.pricePerSquareFoot = 'NA';
              console.log(`Parsed: SqFt ${listing.squareFeet}, £/SqFt ${listing.pricePerSquareFoot}`);
              saveProperty(listing);
              callback();
            }
          });
          fs.unlink(path.join(__dirname, `../images/${listing.listing_id}.png`), () => {});
        });
      }
    });
  } else {
    console.log('No floor plan');
    saveProperty(listing);
    callback();
  }
}

function scrapeSqFt(url, callback) {
  rp(url)
  .then(htmlString => {
    const $ = cheerio.load(htmlString);
    const squareFeet = $('.num-sqft').text();
    callback(parseInt(squareFeet));
  }).catch(err => {
    console.log(err);
  });
}

function download(uri, filename, callback) {
  request.head({ uri: uri }, function(err) {
    if (err) {
      console.log(err);
    } else {
      request(uri)
      .pipe(fs.createWriteStream(filename))
      .on('close', callback)
      .on('error', (err) => {
        return console.log(err);
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

function findSquareFeet(text) {
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

function saveProperty(listing) {
  Property.create(listing, (err) => {
    if (err) return console.log(err);
    saveCounter++;
    console.log(`listing ${saveCounter} saved`);
  });
}
