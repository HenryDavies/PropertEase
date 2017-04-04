const saveProps     = require('./1SaveProps');
const parseText     = require('./2ParseText');
const scrape        = require('./3Scrape');
const dupesOutliers = require('./4DupesOutliers');

saveProps(() => {
  console.log('first function finished');
  parseText(() => {
    console.log('second function finished');
    scrape(() => {
      console.log('third function finished');
      dupesOutliers();
    });
  });
});
