// server.js
// where your node app starts

// init project
var express = require('express');
var fetch = require('request-promise');
express.json();
var app = express();
var bodyParser = require('body-parser');
var GtfsRealtimeBindings = require('gtfs-realtime-bindings');
var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});

app.use(bodyParser.json());

app.get("/", (req, res) => {
  fetch("https://api.stm.info/pub/od/gtfs-rt/ic/v1/tripUpdates", {method: "POST", headers: {apikey: "l7xx37a10aa967e44c2690c564d094e6abc7"}})
  .then(body => {
    console.log(body)
    let feed = GtfsRealtimeBindings.transit_realtime.TripUpdate.decode(body);
    res.send(feed)
  })
})