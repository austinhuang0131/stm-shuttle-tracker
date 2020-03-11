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

function update() {
  if (
    (time === "EDT" &&
      new Date().getUTCHours() >= 11 &&
      new Date().getUTCHours() <= 23 &&
      new Date().getDay() !== 0 &&
      new Date().getDay() !== 6) ||
    (time === "EST" && new Date().getUTCHours() >= 12 &&
      new Date().getDay() !== 0 &&
      new Date().getDay() !== 6)
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
            f => f.vehicle.trip.routeId === routelist[s].route
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

setInterval(update, 30000);

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

app.get("/changelog", (req, res) => {
  res.sendFile(__dirname + "/changelog.txt");
});

app.get("/:school", (req, res) => {
  if (!list[req.params.school]) res.status(404).send("Invalid school.");
  else if (
    (time === "EDT" &&
      !routelist[req.params.school].period.find(
        p =>
          p[0] + 4 <= new Date().getUTCHours() &&
          p[1] + 4 >= new Date().getUTCHours()
      )) ||
    (time === "EST" &&
      !routelist[req.params.school].period.find(
        p =>
          p[0] + 5 <= new Date().getUTCHours() &&
          (p[1] + 5 === 24 ? 0 : p[1] + 5) >= new Date().getUTCHours()
      )) ||
      new Date().getDay() === 0 ||
      new Date().getDay() === 6
  )
    res.status(503).sendFile(__dirname + "/unavailable.html");
  else
    routes.fetch(req.params.school).then(async x => {
      let t = await DB.fetch("time." + req.params.school),
        old = await DB.fetch("old." + req.params.school);
      if (!x)
        res
          .status(501)
          .send(
            "No bus data yet. This could be due to the school being relatively new to the system. Wait a couple of hours."
          );
      else
        res.send(
          sample
            .replace(
              "[BUSES]",
              x
                .map(r => {
                  if (list[req.params.school][r.vehicle.trip.tripId])
                    return (
                      "L.marker([" +
                      r.vehicle.position.latitude +
                      ", " +
                      r.vehicle.position.longitude +
                      '], {icon: greenIcon}).addTo(mymap).bindPopup("<p>Bus #' +
                      r.id +
                      ", bound for " +
                      (list[req.params.school][r.vehicle.trip.tripId].up
                        ? routelist[req.params.school].up
                        : routelist[req.params.school].down) +
                      ", which departs at <b>" +
                      r.vehicle.trip.startTime +
                      "</b> (Scheduled " +
                      list[req.params.school][r.vehicle.trip.tripId].time +
                      "), is " +
                      (r.vehicle.currentStatus === "STOPPED_AT"
                        ? "stopping at <b>"
                        : "going to <b>") +
                      routelist[req.params.school].stops[
                        (list[req.params.school][r.vehicle.trip.tripId].up
                          ? "u"
                          : "d") + r.vehicle.currentStopSequence
                      ] +
                      "</b> (" +
                      r.vehicle.currentStopSequence +
                      ") at " +
                      new Date(r.vehicle.timestamp * 1000)
                        .toLocaleString("en-US", {
                          timeZone: "America/Montreal",
                          hour12: false
                        })
                        .split(" ")[1] +
                      (routelist[req.params.school].uptime &&
                      routelist[req.params.school].downtime
                        ? ".</p><p>The bus is predicted to arrive at " +
                          (list[req.params.school][r.vehicle.trip.tripId].up
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
                                r.vehicle.trip.startTime +
                                " " +
                                time
                            ).getTime() -
                              Date.now() +
                              (list[req.params.school][r.vehicle.trip.tripId].up
                                ? routelist[req.params.school].uptime
                                : routelist[req.params.school].downtime),
                            { verbose: true, unitCount: 1 }
                          ) +
                          ", and come back to " +
                          (list[req.params.school][r.vehicle.trip.tripId].up
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
                                r.vehicle.trip.startTime +
                                " " +
                                time
                            ).getTime() -
                              Date.now() +
                              routelist[req.params.school].uptime +
                              routelist[req.params.school].downtime,
                            { verbose: true, unitCount: 1 }
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
                      ", which departed at " +
                      r.vehicle.trip.startTime +
                      " is currently " +
                      (r.vehicle.currentStatus === "STOPPED_AT"
                        ? "at"
                        : "going to") +
                      " stop no. " +
                      r.vehicle.currentStopSequence +
                      " with trip #" +
                      r.vehicle.trip.tripId +
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
            .replace(
              /\[SCHOOL\]/g,
              routelist[req.params.school].name +
                " (" +
                routelist[req.params.school].route +
                ")"
            )
            .replace("[school]", req.params.school)
            .replace("[CENTER]", routelist[req.params.school].center)
            .replace(
              "[OLD]",
              old === "yes"
                ? '<p>There are no buses running currently. This could mean that all the buses are being "En Transit", or a driver forgot to turn on iBUS... Below are the data acquired ' +
                    humanizeDuration(Date.now() - t, {
                      verbose: true,
                      unitCount: 1,
                      separateMilliseconds: true
                    }) +
                    " ago:</p>"
                : "<p>Below are the data acquired " +
                    humanizeDuration(Date.now() - t, {
                      verbose: true,
                      unitCount: 1,
                      separateMilliseconds: true
                    }) +
                    " ago:</p>"
            )
        );
    });
});
