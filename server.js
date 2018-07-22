// server.js
// where your node app starts

// init project
var express = require('express');
express.json();
var app = express();
var fs = require("fs");
var request = require("request");
var cheerio = require("cheerio");
var snekfetch = require("snekfetch");
var moment = require("moment");
var bodyParser = require('body-parser');

require("moment-duration-format")(moment);

var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});

app.use(bodyParser.json());

app.get("/", (req, res) => {
  /*snekfetch.get("https://www.fanfiction.net/s/12954493").then(r => {
    var chapters = cheerio.load(r.body)("#chap_select option");
    res.send((chapters.length / 2).toString());
  });*/
})