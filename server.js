const express = require("express"),
      request = require("request"),
      GtfsRealtimeBindings = require("gtfs-realtime-bindings"),
      DB = require("quick.db"),
      fs = require("fs"),
      sample = fs.readFileSync("./sample.txt", "utf8"),
      routes = new DB.table("routes"),
      list = require("./list.json"),
      routelist = require("./routes.json");
var app = express();
var listener = app.listen(process.env.PORT, function() {
  console.log("Your app is listening on port " + listener.address().port);
});

function update() {
  DB.set("time", new Date().toLocaleString("en-US", {timeZone: "America/Montreal"}));
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
        console.log(s, feed.entity.filter(f => f.vehicle.trip.route_id === routelist[s].route));

        routes.set(s, feed.entity.filter(f => f.vehicle.trip.route_id === routelist[s].route));
      });
    }
  );
};

update();
setInterval(update, 90000);

app.get("/:school", (req, res) => {
  routes.fetch(req.params.school).then(async x => {
    let t = await DB.fetch("time");
    if (!x) res.send("You sure you're typing the school name right?");
    else if (x.length === 0) res.send("No buses are online.<br><i>List updated at " + t + ".</i>")
    else res.send(sample
      .replace("[BUSES]", x.map(r => {
        if (list[r.vehicle.trip.trip_id])
          return "L.marker(["+r.vehicle.position.latitude + ", " + r.vehicle.position.longitude + "], {icon: greenIcon}).addTo(mymap).bindPopup(\"This " + 
          (list[r.vehicle.trip.trip_id].up ? "school-bound" : "home-bound") +
          " bus, which departs at <b>" + list[r.vehicle.trip.trip_id].time + "</b>, is " + 
          (r.vehicle.current_status === 2 ? "going to " : "at ") +
          routelist[req.params.school].stops[(list[r.vehicle.trip.trip_id].up ? "u" : "d") + r.vehicle.current_stop_sequence] + ".\");";
        else return "L.marker(["+r.vehicle.position.latitude + ", " + r.vehicle.position.longitude + "], {icon: greenIcon}).addTo(mymap).bindPopup(\"Bus number " + r.id + " is currently "+(r.vehicle.current_status === 2 ? "going to" : "at")+" stop no. " + r.vehicle.current_stop_sequence + " with trip #"+r.vehicle.trip.trip_id+"\");";
      }).join("\n"))
      .replace("[TIME]", "<br><i>List updated at " + t + ".</i>")
      .replace("[SCHOOL]", req.params.school)
      .replace("[CENTER]", "["+routelist[req.params.school].center+"]")
    );
  })
});

app.get("/", (req, res) => {
  res.send("Work in progress... Contact im[at]austinhuang.me");
});