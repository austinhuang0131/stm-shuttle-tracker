const express = require("express"),
  request = require("request"),
  GtfsRealtimeBindings = require("gtfs-realtime-bindings").transit_realtime,
  DB = require("quick.db"),
  fs = require("fs"),
  humanizeDuration = require("pretty-ms"),
  time = "EDT", // Change to EST for non-daylight saving time!!!
  sample = fs.readFileSync("./sample.html", "utf8"),
  routes = new DB.table("routes"),
  list = require("./list.json"),
  routelist = require("./routes.json");
var app = express();
var listener = app.listen(process.env.PORT, function() {
  console.log("Your app is listening on port " + listener.address().port);
});

console.log(GtfsRealtimeBindings)

function update() {
  if (
    (time === "EDT" &&
      new Date().getUTCHours() >= 11 &&
      new Date().getUTCHours() <= 23) ||
    (time === "EST" && new Date().getUTCHours() >= 12)
  )
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
            DB.set("time." + s, Date.now());
            DB.set("old." + s, "no");
            routes.set(s, buses);
          }
        });
      }
    );
}

update();
setInterval(update, 45000);

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

app.get("/changelog", (req, res) => {
  res.sendFile(__dirname + "/changelog.txt");
});

app.get("/:school", (req, res) => {
  routes.fetch(req.params.school).then(async x => {
    let t = await DB.fetch("time." + req.params.school),
      old = await DB.fetch("old." + req.params.school);
    if (!x) res.send("You sure you're typing the school name right?");
    else if (x.length === 0)
      res.send(
        '<p>Possible database damage detected. <a href="https://austinhuang.me/contact">Contact Austin immediately!</a></p>'
      );
    else
      res.send(
        sample
          .replace(
            "[BUSES]",
            x
              .map(r => {
                if (list[req.params.school][r.vehicle.trip.trip_id])
                  return (
                    "L.marker([" +
                    r.vehicle.position.latitude +
                    ", " +
                    r.vehicle.position.longitude +
                    '], {icon: greenIcon}).addTo(mymap).bindPopup("<p>Bus #' +
                    r.id +
                    ", bound for " +
                    (list[req.params.school][r.vehicle.trip.trip_id].up
                      ? routelist[req.params.school].up
                      : routelist[req.params.school].down) +
                    ", which departs at <b>" +
                    list[req.params.school][r.vehicle.trip.trip_id].time +
                    "</b>, is <b>" +
                    (r.vehicle.current_status === 2
                      ? "going to "
                      : "stopping at ") +
                    routelist[req.params.school].stops[
                      (list[req.params.school][r.vehicle.trip.trip_id].up
                        ? "u"
                        : "d") + r.vehicle.current_stop_sequence
                    ] +
                    "</b> (" +
                    r.vehicle.current_stop_sequence +
                    ") at " +
                    new Date(r.vehicle.timestamp.low * 1000)
                      .toLocaleString("en-US", {
                        timeZone: "America/Montreal",
                        hour12: false
                      })
                      .split(" ")[1] +
                    (routelist[req.params.school].uptime &&
                    routelist[req.params.school].downtime
                      ? ".</p><p>The bus is predicted to arrive at " +
                        (list[req.params.school][r.vehicle.trip.trip_id].up
                          ? routelist[req.params.school].up
                          : routelist[req.params.school].down) +
                        " in " +
                        humanizeDuration(
                          new Date(
                            new Date()
                              .toLocaleString("en-US", {
                                timeZone: "America/Montreal"
                              })
                              .split(",")[0] +
                              " " +
                              list[req.params.school][r.vehicle.trip.trip_id]
                                .time +
                              " " +
                              time
                          ).getTime() -
                            Date.now() +
                            (list[req.params.school][r.vehicle.trip.trip_id].up
                              ? routelist[req.params.school].uptime
                              : routelist[req.params.school].downtime),
                          {verbose: true, unitCount: 1}
                        ) +
                        ", and come back to " +
                        (list[req.params.school][r.vehicle.trip.trip_id].up
                          ? routelist[req.params.school].down
                          : routelist[req.params.school].up) +
                        " in " +
                        humanizeDuration(
                          new Date(
                            new Date()
                              .toLocaleString("en-US", {
                                timeZone: "America/Montreal"
                              })
                              .split(",")[0] +
                              " " +
                              list[req.params.school][r.vehicle.trip.trip_id]
                                .time +
                              " " +
                              time
                          ).getTime() -
                            Date.now() +
                            routelist[req.params.school].uptime +
                            routelist[req.params.school].downtime,
                          {verbose: true, unitCount: 1}
                        ) +
                        '.</p>");'
                      : '.</p>");')
                  );
                else
                  return (
                    "L.marker([" +
                    r.vehicle.position.latitude +
                    ", " +
                    r.vehicle.position.longitude +
                    '], {icon: greenIcon}).addTo(mymap).bindPopup("Bus ' +
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
          .replace("[SCHOOL]", routelist[req.params.school].name + ", route " + routelist[req.params.school].route)
          .replace("[CENTER]", routelist[req.params.school].center)
          .replace(
            "[OLD]",
            old === "yes"
              ? '<p id="open">There are no buses running currently. This could mean that all the buses are being "En Transit", or a driver forgot to turn on iBUS... Below are the data acquired ' +
                  humanizeDuration(Date.now() - t, {verbose: true, unitCount: 2, separateMilliseconds: true}) +
                  " ago:</p>"
              : '<p id="open">Below are the data acquired ' +
                  humanizeDuration(Date.now() - t, {verbose: true, unitCount: 2, separateMilliseconds: true}) +
                  " ago:</p>"
          )
      );
  });
});
