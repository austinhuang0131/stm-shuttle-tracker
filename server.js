// server.js
// where your node app starts

// init project
var express = require('express');
var app = express();
var fs = require("fs");
var request = require("request");
var cheerio = require("cheerio");
var snekfetch = require("snekfetch");
var moment = require("moment");

require("moment-duration-format")(moment);

var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});

app.get("/", (req, res) => {
/*  snekfetch.get("https://www.fanfiction.net/s/12954493").then(r => {
    var $ = cheerio.load(r.body);
    var chapters = $("#chap_select option");
    res.send((chapters.length / 2).toString());
  });

  var now = moment();
  res.send(moment.duration(Date.now()).format("d [days] hh [hours] mm [minutes]"));
  */
  snekfetch.get("https://discoin.sidetrip.xyz/transactions", {headers: {Authorization: "80ab72d40aef21028dbf4e68326b6e1cecceeca37347a9e84eda1a8386fbe463"}}).then(r =>
    res.send(r.body)
  ).catch(e => res.send(e));
  /*request("https://discoin.sidetrip.xyz/transactions", {headers: {"Authorization": "80ab72d40aef21028dbf4e68326b6e1cecceeca37347a9e84eda1a8386fbe463"}}, (err, resn, body) => res.send(body))*/
})