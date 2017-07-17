var fs = require('fs');
var path = require('path');
var config = JSON.parse(fs.readFileSync(path.join(__dirname,'config.json'), 'utf8'));

var serverName = config.topics.serverName;
var databaseName = config.topics.databaseName;

// all tables in mysql
var tableWhiteList = config.topics.tableWhiteList;

var topics = tableWhiteList.map(function (item, index) {
  return serverName + '.' + databaseName + '.' + item;
});

var config = {
  options: config.options,
  topics: topics,
};

module.exports = config;
