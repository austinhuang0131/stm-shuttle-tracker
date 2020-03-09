const express = require("express"),
  request = require("request"),
  GtfsRealtimeBindings = require("gtfs-realtime-bindings"),
  DB = require("quick.db"),
  fs = require("fs"),
  humanizeDuration = require("humanize-duration"),
  sample = fs.readFileSync("./sample.txt", "utf8"),
  routes = new DB.table("routes"),
  list = require("./list.json"),
  routelist = require("./routes.json");
var app = express();
var listener = app.listen(process.env.PORT, function() {
  console.log("Your app is listening on port " + listener.address().port);
});

function update() {
  if (new Date().getHours() >= 7 && new Date().getHours() <= 19)
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
          let buses = feed.entity.filter(
            f => f.vehicle.trip.route_id === routelist[s].route
          );
          if (buses.length === 0) DB.set("old." + s, "yes");
          else {
            DB.set("time", Date.now());
            DB.set("old." + s, "no");
            routes.set(s, buses);
          }
        });
      }
    );
}

update();
setInterval(update, 45000);

app.get("/:school", (req, res) => {
  routes.fetch(req.params.school).then(async x => {
    let t = await DB.fetch("time"),
      old = await DB.fetch("old." + req.params.school);
    console.log(old);
    if (!x) res.send("You sure you're typing the school name right?");
    else if (x.length === 0)
      res.send(
        "No buses are online. Note that buses out of service are simply not trackable.<br><i>List updated at " +
          t +
          ".</i>"
      );
    else
      res.send(
        sample
          .replace(
            "[BUSES]",
            x
              .map(r => {
                if (list[r.vehicle.trip.trip_id])
                  return (
                    "L.marker([" +
                    r.vehicle.position.latitude +
                    ", " +
                    r.vehicle.position.longitude +
                    '], {icon: greenIcon}).addTo(mymap).bindPopup("Bus #' +
                    r.id +
                    ", bound for " +
                    (list[r.vehicle.trip.trip_id].up
                      ? routelist[req.params.school].up
                      : routelist[req.params.school].down) +
                    ", which departs at <b>" +
                    list[r.vehicle.trip.trip_id].time +
                    "</b>, is <b>" +
                    (r.vehicle.current_status === 2 ? "going to " : "at ") +
                    routelist[req.params.school].stops[
                      (list[r.vehicle.trip.trip_id].up ? "u" : "d") +
                        r.vehicle.current_stop_sequence
                    ] +
                    "</b> (" +
                    r.vehicle.current_stop_sequence +
                    ').");'
                  );
                else
                  return (
                    "L.marker([" +
                    r.vehicle.position.latitude +
                    ", " +
                    r.vehicle.position.longitude +
                    '], {icon: greenIcon}).addTo(mymap).bindPopup("Bus number ' +
                    r.id +
                    " is currently " +
                    (r.vehicle.current_status === 2 ? "going to" : "at") +
                    " stop no. " +
                    r.vehicle.current_stop_sequence +
                    " with trip #" +
                    r.vehicle.trip.trip_id +
                    '");'
                  );
              })
              .join("\n")
          )
          .replace(
            "[TIME]",
            "<br><i>List updated at " +
              new Date(t).toLocaleString("en-US", {
                timeZone: "America/Montreal"
              }) +
              ".</i>"
          )
          .replace("[SCHOOL]", req.params.school)
          .replace("[CENTER]", "[" + routelist[req.params.school].center + "]")
          .replace(
            "[OLD]",
            old === "yes"
              ? '<p>There are no buses running currently. This could mean that all the buses are being "En Transit", or a driver forgot to turn on his iBUS... Below are the data acquired ' +
                  humanizeDuration(Date.now() - t, { round: true }) +
                  " ago:</p>"
              : "<p>Below are the data acquired " +
                  humanizeDuration(Date.now() - t, { round: true }) +
                  " ago:</p>"
          )
      );
  });
});

app.get("/", (req, res) => {
  res.send("Work in progress... Contact im[at]austinhuang.me");
});
