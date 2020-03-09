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
  routes.fetch(req.params.school).then(x => {
    if (!x) res.send("No data available.");
    res.send(x.map(r => 
      "This " + 
      (list[r.id].up ? "school-bound" : "home-bound") +
      " bus, scheduled at <b>" + list[r.id].time +
      "</b>, is currently at " + routes(req.params.school)
    ))
  })
});

//     res.send(feed.entity.filter(f => f.vehicle.trip.route_id === req.params.route).map(r => "Bus number " + r.id + " is currently "+(r.vehicle.current_status === 2 ? "going to" : "at")+" stop no. " + r.vehicle.current_stop_sequence + " ("+r.vehicle.position.latitude + ", " + r.vehicle.position.longitude + ") with trip #"+r.vehicle.trip.trip_id).join("<br><br>"));

app.get("/", (req, res) => {
  res.send("Work in progress... Contact im[at]austinhuang.me")
})