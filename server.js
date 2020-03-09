const express = require("express"),
      request = require("request"),
      GtfsRealtimeBindings = require("gtfs-realtime-bindings"),
      DB = require("quick.db"),
      routes = new DB.table("routes"),
      list = require("./list.json"),
      routelist = require("./routes.json");
var app = express();
var listener = app.listen(process.env.PORT, function() {
  console.log("Your app is listening on port " + listener.address().port);
});

setInterval(() => {
  request(
    "https://api.stm.info/pub/od/gtfs-rt/ic/v1/vehiclePositions",
    {
      method: "POST",
      headers: { apikey: process.env.STM_API_KEY },
      encoding: null
    },
    (e, r, b) => {
      let feed = GtfsRealtimeBindings.FeedMessage.decode(b);
      Object.keys(routelist).map(s => {
        routes.set(s, feed.entity.filter(f => f.vehicle.trip.route_id === routelist[s]));
      });
    }
  );
}, 90000);

app.get("/:school", (req, res) => {
  routes.fetch(req.params.school).then(r => {
    if (!r) res.send("No data available.");
    res.send(r.map(b => 
      "The bus, " + 
    ))
  })
});

app.get("/", (req, res) => {
  res.send("Work in progress... Contact im[at]austinhuang.me")
})