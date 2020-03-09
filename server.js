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
  DB.set("time", Date.now());
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
  routes.fetch(req.params.school).then(async x => {
    let t = await DB.fetch("time");
    if (!x) res.send("You sure you're typing the school name right?");
    else if (x.length === 0) res.send("No buses are online.<br><i>List updated at " + new Date(t).toString().split(" ")[4] + ".</i>")
    else res.send(x.map(r => {
      if (list[r.id])
        return "This " + 
        (list[r.id].up ? "school-bound" : "home-bound") +
        " bus, scheduled at <b>" + list[r.id].time +
        "</b>, is " + 
        (r.vehicle.current_status === 2 ? "going to " : "at ") +
        routes[req.params.school].stops[(list[r.id].up ? "u" : "d") + r.vehicle.current_stop_sequence] + ".";
      else return "Bus number " + r.id + " is currently "+(r.vehicle.current_status === 2 ? "going to" : "at")+" stop no. " + r.vehicle.current_stop_sequence + " ("+r.vehicle.position.latitude + ", " + r.vehicle.position.longitude + ") with trip #"+r.vehicle.trip.trip_id
    }).join("<br><br>") + 
        "<br><br><i>List updated at " + new Date(t).toString().split(" ")[4] + ".</i>")
  })
});

app.get("/", (req, res) => {
  res.send("Work in progress... Contact im[at]austinhuang.me")
})