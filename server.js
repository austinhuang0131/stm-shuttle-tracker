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
  routelist = require("./routes.json"),
  assets = require("./assets.json");
var app = express(),
  gtfsfile = fs.createWriteStream("./trips.txt", { flags: "a" }),
  gtfstrip = fs.readFileSync("./trips.txt", "utf8");
var listener = app.listen(process.env.PORT, function() {
  console.log("Your app is listening on port " + listener.address().port);
});

function update() {
  if (
    (time === "EDT" &&
      new Date().getUTCHours() >= 10 &&
      new Date().getUTCHours() <= 23 &&
      new Date().getDay() !== 0 &&
      new Date().getDay() !== 6) ||
    (time === "EST" &&
      new Date().getUTCHours() >= 11 &&
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
          let buses = feed.entity.filter(f =>
            routelist[s].routes.find(r => r.route === f.vehicle.trip.routeId)
          );
          if (buses.length === 0) DB.set("old." + s, "yes");
          else {
            DB.set("time." + s, Date.now());
            DB.set("old." + s, "no");
            routes.set(s, buses);
          }
        });
        feed.entity
          .filter(f => f.vehicle.trip.routeId.endsWith("E"))
          .map(r => {
            gtfstrip = fs.readFileSync("./trips.txt", "utf8");
            if (gtfstrip.indexOf(r.vehicle.trip.tripId) === -1) {
              gtfsfile.write(
                "\n" +
                  r.vehicle.trip.routeId +
                  ",," +
                  r.vehicle.trip.tripId +
                  "," +
                  r.vehicle.trip.routeId +
                  "-?,?,,0,," +
                  r.vehicle.trip.startTime.replace(/:00$/g, ""),
                "utf8",
                e => console.error
              );
            }
          });
      }
    );
  else gtfsfile.end();
}

setInterval(update, 30000);
update();

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

app.get("/faq", (req, res) => {
  res.sendFile(__dirname + "/faq.html");
});

app.get("/changelog", (req, res) => {
  res.sendFile(__dirname + "/changelog.txt");
});

app.get("/trips.txt", (req, res) => {
  res.sendFile(__dirname + "/trips.txt");
});

app.get("/assets/:name", (req, res) => {
  !assets[req.params.name]
  ? res.status(404).send("Not found in assets.json")
  : request(assets[req.params.name]).pipe(res);
});

app.get("/osm/:s/:z/:x/:y.png", (req, res) => {
  if (parseInt(req.params.z) < 10) return res.status(400).send("Zoom below 10 is rejected.");
  else if ((parseInt(req.params.x) / (2 ** (parseInt(req.params.z) - 10))) < 301 || (parseInt(req.params.x) / (2 ** (parseInt(req.params.z) - 10))) > 303) return res.status(400).send("Out of Montreal (x must be between 301 and 303 on zoom 10)");
  else if ((parseInt(req.params.y) / (2 ** (parseInt(req.params.z) - 10))) < 365 || (parseInt(req.params.y) / (2 ** (parseInt(req.params.z) - 10))) > 367) return res.status(400).send("Out of Montreal (y must be between 365 and 367 on zoom 10)");
  request(
    `https://${req.params.s}.tile.openstreetmap.org/${req.params.z}/${req.params.x}/${req.params.y}.png`,
    { headers: { "User-Agent": "I am caching for https://stm.austinhuang.me" } }
  ).pipe(res);
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
                  let route = routelist[req.params.school].routes.find(
                    x => x.route === r.vehicle.trip.routeId
                  );
                  if (
                    list[req.params.school].up.includes(
                      r.vehicle.trip.tripId
                    ) ||
                    list[req.params.school].down.includes(r.vehicle.trip.tripId)
                  )
                    return (
                      "L.marker([" +
                      r.vehicle.position.latitude +
                      ", " +
                      r.vehicle.position.longitude +
                      ']).addTo(mymap).bindPopup("<table style=\\"border-width:0px;\\"><tr><td align=\\"right\\">Bus #' +
                      r.id +
                      '</td><td align=\\"center\\">▼</td><td>🗒️ ' +
                      r.vehicle.trip.startTime.replace(/:00$/g, "") +
                      '</td></tr><tr><td></td><td align=\\"center\\">↓</td><td>' +
                      (r.vehicle.currentStatus === "STOPPED_AT"
                        ? ""
                        : "📡 " +
                          new Date(r.vehicle.timestamp * 1000).toLocaleString(
                            "en-US",
                            {
                              hour12: false,
                              timeZone: "America/Montreal",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit"
                            }
                          )) +
                      '</td></tr><tr><td align=\\"right\\">' +
                      route.stops[
                        (list[req.params.school].up.includes(
                          r.vehicle.trip.tripId
                        )
                          ? "u"
                          : "d") + r.vehicle.currentStopSequence
                      ] +
                      '</td><td align=\\"center\\">' +
                      (r.vehicle.currentStatus === "STOPPED_AT"
                        ? "⬤</td><td>📡 " +
                          new Date(r.vehicle.timestamp * 1000).toLocaleString(
                            "en-US",
                            {
                              hour12: false,
                              timeZone: "America/Montreal",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit"
                            }
                          ) +
                          "</td>"
                        : "◯</td><td>" +
                          (route.uptime &&
                          route.downtime &&
                          ((list[req.params.school].up.includes(
                            r.vehicle.trip.tripId
                          ) &&
                            route.up === "u" + r.vehicle.currentStopSequence) ||
                            (list[req.params.school].down.includes(
                              r.vehicle.trip.tripId
                            ) &&
                              route.down ===
                                "d" + r.vehicle.currentStopSequence))
                            ? "🔮 [" +
                              new Date(
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
                                ).getTime() + route.downtime
                              ).toLocaleString("en-US", {
                                hour12: false,
                                timeZone: "America/Montreal",
                                hour: "2-digit",
                                minute: "2-digit"
                              }) +
                              "]"
                            : "") +
                          "</td>") +
                      '</tr><tr><td></td><td align=\\"center\\">↓</td><td></td></tr>' +
                      (list[req.params.school].up.includes(
                        r.vehicle.trip.tripId
                      ) && route.up !== "u" + r.vehicle.currentStopSequence // up, not last stop?
                        ? '<tr><td align=\\"right\\">' +
                          route.stops[route.up] +
                          '</td><td align=\\"center\\">◯</td><td>' +
                          (route.uptime
                            ? "🔮 [" +
                              new Date(
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
                                ).getTime() + route.uptime
                              ).toLocaleString("en-US", {
                                hour12: false,
                                timeZone: "America/Montreal",
                                hour: "2-digit",
                                minute: "2-digit"
                              }) +
                              "]"
                            : "") +
                          '</td></tr><tr><td></td><td align=\\"center\\">↓</td><td></td></tr>'
                        : list[req.params.school].down.includes(
                            r.vehicle.trip.tripId
                          ) &&
                          route.down !== "d" + r.vehicle.currentStopSequence // down, not last stop?
                        ? '<tr><td align=\\"right\\">' +
                          route.stops[route.down] +
                          '</td><td align=\\"center\\">◯</td><td>' +
                          (route.downtime
                            ? "🔮 [" +
                              new Date(
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
                                ).getTime() + route.downtime
                              ).toLocaleString("en-US", {
                                hour12: false,
                                timeZone: "America/Montreal",
                                hour: "2-digit",
                                minute: "2-digit"
                              }) +
                              "]"
                            : "") +
                          '</td></tr><tr><td></td><td align=\\"center\\">↓</td><td></td></tr>'
                        : "") +
                      // return trip
                      '<tr><td align=\\"right\\">' +
                      (list[req.params.school].up.includes(
                        r.vehicle.trip.tripId
                      )
                        ? route.stops[route.down]
                        : route.stops[route.up]) +
                      '</td><td align=\\"center\\">○</td><td>' +
                      (route.uptime && route.downtime
                        ? "🔮 [" +
                          new Date(
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
                            ).getTime() +
                              route.uptime +
                              route.downtime
                          ).toLocaleString("en-US", {
                            hour12: false,
                            timeZone: "America/Montreal",
                            hour: "2-digit",
                            minute: "2-digit"
                          }) +
                          "]"
                        : "") +
                      '</td></tr></table>");'
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
              "<br><i>" +
                new Date(t).toLocaleString("en-US", {
                  timeZone: "America/Montreal"
                }) +
                ".</i>"
            )
            .replace(/\[SCHOOL\]/g, routelist[req.params.school].name)
            .replace(/\[school\]/g, req.params.school)
            .replace(
              "[REFRESH]",
              req.query.refresh === "true" ? "true" : "false"
            )
            .replace(
              "[METAR]",
              req.query.refresh === "true"
                ? '<meta http-equiv="refresh" content="30" >'
                : ""
            )
            .replace("[CENTER]", routelist[req.params.school].center)
        );
    });
});
