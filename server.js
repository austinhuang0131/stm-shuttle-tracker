const express = require("express"),
      request = require("request"),
      GtfsRealtimeBindings = require("gtfs-realtime-bindings"),
      fs = require("fs");
var app = express();
var listener = app.listen(process.env.PORT, function() {
  console.log("Your app is listening on port " + listener.address().port);
});

app.get("/:route", (req, res) => {
  request(
    "https://api.stm.info/pub/od/gtfs-rt/ic/v1/vehiclePositions",
    {
      method: "POST",
      headers: { apikey: process.env.STM_API_KEY },
      encoding: null
    },
    (e, r, b) => {
      let feed = GtfsRealtimeBindings.FeedMessage.decode(b);
      res.send(
      );
    }
  );
});

app.get("/", (req, res) => {
  res.send("Work in progress... Contact im[at]austinhuang.me")
})