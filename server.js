// server.js
// where your node app starts

// init project
var express = require('express');
var request = require('request');
express.json();
var app = express();
var bodyParser = require('body-parser');
var GtfsRealtimeBindings = require('gtfs-realtime-bindings');
var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});

app.use(bodyParser.json());

app.get("/", (req, res) => {
  request("https://api.stm.info/pub/od/gtfs-rt/ic/v1/vehiclePositions", {method: "POST", headers: {apikey: "l7xx37a10aa967e44c2690c564d094e6abc7"}, encoding: null}, (e,r,b) => {
    let feed = GtfsRealtimeBindings.FeedMessage.decode(b);
    res.send(feed/*.entity.filter(f => f.trip.route_id === "470")[0]*/)
  })
})