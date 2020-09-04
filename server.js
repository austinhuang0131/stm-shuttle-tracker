/*
    STM Shuttle Tracker
    Copyright (C) 2020 Austin Huang <im@austinhuang.me> (https://austinhuang.me)

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

const express = require("express"),
  request = require("request"),
  DB = require("quick.db"),
  fs = require("fs"),
  time = "EDT", // Change to EST for non-daylight saving time!!!
  sample = fs.readFileSync("./sample.html", "utf8"),
  routes = new DB.table("routes"),
  routelist = require("./routes.json"),
  assets = require("./assets.json");
var app = express(),
  listener = app.listen(process.env.PORT, function() {
    console.log("Your app is listening on port " + listener.address().port);
  });

require("./update.js")(time);
setInterval(() => require("./update.js")(time), 30000);

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

app.get("/faq", (req, res) => {
  res.sendFile(__dirname + "/faq.html");
});

app.get("/:name.txt", (req, res) => {
  fs.access("./" + req.params.name + ".txt", fs.F_OK, err => {
    if (err) res.status(404).send("File not found");
    else res.sendFile(__dirname + "/" + req.params.name + ".txt");
  });
});

app.get("/assets/:name", (req, res) => {
  !assets[req.params.name]
    ? res.status(404).send("Not found in assets.json")
    : request(assets[req.params.name]).pipe(res);
});

app.get("/osm/:s/:z/:x/:y.png", (req, res) => {
  if (parseInt(req.params.z) < 10)
    return res.status(400).send("Zoom below 10 is rejected.");
  else if (
    parseInt(req.params.x) / 2 ** (parseInt(req.params.z) - 10) < 301 ||
    parseInt(req.params.x) / 2 ** (parseInt(req.params.z) - 10) > 303
  )
    return res
      .status(400)
      .send("Out of Montreal (x must be between 301 and 303 on zoom 10)");
  else if (
    parseInt(req.params.y) / 2 ** (parseInt(req.params.z) - 10) < 365 ||
    parseInt(req.params.y) / 2 ** (parseInt(req.params.z) - 10) > 367
  )
    return res
      .status(400)
      .send("Out of Montreal (y must be between 365 and 367 on zoom 10)");
  request(
    `https://${req.params.s}.tile.openstreetmap.org/${req.params.z}/${req.params.x}/${req.params.y}.png`,
    { headers: { "User-Agent": "I am caching for https://stm.austinhuang.me" } }
  ).pipe(res);
});

app.get("/:school", async (req, res) => {
  if (!routelist[req.params.school]) res.status(404).send("Invalid school.");
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
  else {
    let x = await routes.fetch(req.params.school),
      t = await DB.fetch("time." + req.params.school);
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
            [...x.loc.up, ...x.loc.down]
              .map(r => {
                let route = routelist[req.params.school].routes.find(
                  y => y.route === r.vehicle.trip.routeId
                );
                return (
                  "L.marker([" +
                  r.vehicle.position.latitude +
                  ", " +
                  r.vehicle.position.longitude +
                  '], {icon: bus}).addTo(mymap).bindPopup("<table style=\\"border-width:0px;\\"><tr><td align=\\"right\\">Bus #' +
                  r.id +
                  '</td><td align=\\"center\\">▼</td><td>🗒️ ' +
                  r.vehicle.trip.startTime +
                  '</td></tr><tr><td /><td align=\\"center\\">↓</td><td>' +
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
                    (x.tr.up.indexOf(r.vehicle.trip.tripId) > -1 ? "u" : "d") +
                      r.vehicle.currentStopSequence
                  ] +
                  " (" +
                  r.vehicle.currentStopSequence +
                  ')</td><td align=\\"center\\">' +
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
                      (x.tu.up.find(
                        n => n.tripUpdate.trip.tripId === r.vehicle.trip.tripId
                      ) && route.up === "u" + r.vehicle.currentStopSequence
                        ? "🔮 [" +
                          new Date(
                            x.tu.up.find(
                              n =>
                                n.tripUpdate.trip.tripId ===
                                r.vehicle.trip.tripId
                            ) &&
                              x.tu.up.find(
                                n =>
                                  n.tripUpdate.trip.tripId ===
                                  r.vehicle.trip.tripId
                              ).tripUpdate.stopTimeUpdate[
                                parseInt(r.vehicle.currentStopSequence) - 1
                              ].arrival.time
                          )
                            .toLocaleString("en-US", {
                              timeZone: "America/Montreal"
                            })
                            .split(",")[0] +
                          "]"
                        : x.loc.down.find(
                            n => n.vehicle.trip.tripId === r.vehicle.trip.tripId
                          ) &&
                          route.down === "d" + r.vehicle.currentStopSequence
                        ? "🔮 [" +
                          new Date(
                            x.tu.down
                              .find(
                                n =>
                                  n.tripUpdate.trip.tripId ===
                                  r.vehicle.trip.tripId
                              )
                              .tripUpdate.stopTimeUpdate.find(
                                s =>
                                  s.stopSequence ===
                                  r.vehicle.currentStopSequence
                              ).arrival.time * 1000
                          ).toLocaleString("en-US", {
                            hour12: false,
                            timeZone: "America/Montreal",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit"
                          }) +
                          "]"
                        : "")) +
                  "</td>" +
                  (x.tr.up.indexOf(r.vehicle.trip.tripId) > -1 &&
                  route.up !== "u" + r.vehicle.currentStopSequence // up, not last stop?
                    ? '</tr><tr><td /><td align=\\"center\\">↓</td><td /></tr><tr><td align=\\"right\\">' +
                      route.stops[route.up] +
                      '</td><td align=\\"center\\">◯</td><td>' +
                      (x.tu.up.find(
                        n => n.tripUpdate.trip.tripId === r.vehicle.trip.tripId
                      ) &&
                      x.tu.up
                        .find(
                          n =>
                            n.tripUpdate.trip.tripId === r.vehicle.trip.tripId
                        )
                        .tripUpdate.stopTimeUpdate.find(
                          s =>
                            s.stopSequence === parseInt(route.up.substring(1))
                        )
                        ? "🔮 [" +
                          new Date(
                            x.tu.up
                              .find(
                                n =>
                                  n.tripUpdate.trip.tripId ===
                                  r.vehicle.trip.tripId
                              )
                              .tripUpdate.stopTimeUpdate.find(
                                s =>
                                  s.stopSequence ===
                                  parseInt(route.up.substring(1))
                              ).arrival.time * 1000
                          )
                            .toLocaleString("en-US", {
                              hour12: false,
                              timeZone: "America/Montreal",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit"
                            })
                            .split(",")[0] +
                          "]"
                        : "") +
                      "</td></tr>"
                    : x.tr.down.indexOf(r.vehicle.trip.tripId) > -1 &&
                      route.down !== "d" + r.vehicle.currentStopSequence // down, not last stop?
                    ? '</tr><tr><td /><td align=\\"center\\">↓</td><td /></tr><tr><td align=\\"right\\">' +
                      route.stops[route.down] +
                      '</td><td align=\\"center\\">◯</td><td>' +
                      (x.tu.down.find(
                        n => n.tripUpdate.trip.tripId === r.vehicle.trip.tripId
                      ) &&
                      x.tu.down
                        .find(
                          n =>
                            n.tripUpdate.trip.tripId === r.vehicle.trip.tripId
                        )
                        .tripUpdate.stopTimeUpdate.find(s => {
                          return (
                            s.stopSequence === parseInt(route.down.substring(1))
                          );
                        })
                        ? "🔮 [" +
                          new Date(
                            x.tu.down
                              .find(
                                n =>
                                  n.tripUpdate.trip.tripId ===
                                  r.vehicle.trip.tripId
                              )
                              .tripUpdate.stopTimeUpdate.find(
                                s =>
                                  s.stopSequence ===
                                  parseInt(route.down.substring(1))
                              ).arrival.time * 1000
                          ).toLocaleString("en-US", {
                            hour12: false,
                            timeZone: "America/Montreal",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit"
                          }) +
                          "]"
                        : "")
                    : "</tr>") +
                  '</table>");'
                );
              })
              .join("\n")
          )
          .replace("[STOPS]", () => {
            let upFroms = routelist[req.params.school].routes
              .map(route => {
                if (route.upFromLoc)
                  return (
                    "L.marker([" +
                    route.upFromLoc +
                    ']).addTo(mymap).bindPopup("<table style=\\"border-width:0px;\\"><tr><td align=\\"right\\">' +
                    route.route +
                    ' 🚍</td><td align=\\"center\\">→</td><td>' +
                    route.stops[route.up] +
                    "</td></tr><tr>" +
                    (x.tu.up.length === 0 ||
                    x.tu.up.filter(
                      a =>
                        a.tripUpdate.stopTimeUpdate.length ===
                        parseInt(route.up.substring(1))
                    ).length === 0
                      ? '<td align=\\"right\\">Pas de bus</td><td /><td>No buses</td>'
                      : x.tu.up
                          .filter(
                            a =>
                              a.tripUpdate.stopTimeUpdate.length ===
                              parseInt(route.up.substring(1))
                          )
                          .sort(
                            (a, b) =>
                              a.tripUpdate.stopTimeUpdate[0].departure.time -
                              b.tripUpdate.stopTimeUpdate[0].departure.time
                          )
                          .map(
                            t =>
                              '<td align=\\"right\\">' +
                              new Date(
                                t.tripUpdate.stopTimeUpdate[0].departure.time *
                                  1000
                              ).toLocaleString("en-US", {
                                hour12: false,
                                timeZone: "America/Montreal",
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit"
                              }) +
                              " (🗒️ " +
                              t.tripUpdate.trip.startTime +
                              ")</td><td /><td>" +
                              (t.tripUpdate.stopTimeUpdate.find(
                                s =>
                                  s.stopSequence ===
                                  parseInt(route.down.substring(1))
                              ).departure
                                ? new Date(
                                    t.tripUpdate.stopTimeUpdate.find(
                                      s =>
                                        s.stopSequence ===
                                        parseInt(route.down.substring(1))
                                    ).arrival.time * 1000
                                  ).toLocaleString("en-US", {
                                    hour12: false,
                                    timeZone: "America/Montreal",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    second: "2-digit"
                                  })
                                : "???") +
                              "</td>"
                          )
                          .join("</tr><tr>")) +
                    '</tr></table>");'
                  );
              })
              .join("\n");
            if (routelist[req.params.school].downFromLoc)
              upFroms +=
                "\nL.marker([" +
                routelist[req.params.school].downFromLoc +
                ']).addTo(mymap).bindPopup("<table style=\\"border-width:0px;\\">' +
                routelist[req.params.school].routes
                  .map(
                    route =>
                      '<tr><td align=\\"right\\">' +
                      route.route +
                      ' 🚍</td><td align=\\"center\\">→</td><td>' +
                      route.stops[route.down] +
                      "</td></tr><tr>" +
                      (x.tu.down.length === 0 ||
                      x.tu.down.filter(
                        a =>
                          a.tripUpdate.stopTimeUpdate.length ===
                          parseInt(route.down.substring(1))
                      ).length === 0
                        ? '<td align=\\"right\\">Pas de bus</td><td /><td>No buses</td>'
                        : x.tu.down
                            .filter(
                              a =>
                                a.tripUpdate.stopTimeUpdate.length ===
                                parseInt(route.down.substring(1))
                            )
                            .sort(
                              (a, b) =>
                                a.tripUpdate.stopTimeUpdate[0].departure.time -
                                b.tripUpdate.stopTimeUpdate[0].departure.time
                            )
                            .map(
                              t =>
                                '<td align=\\"right\\">' +
                                new Date(
                                  t.tripUpdate.stopTimeUpdate[0].departure
                                    .time * 1000
                                ).toLocaleString("en-US", {
                                  hour12: false,
                                  timeZone: "America/Montreal",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit"
                                }) +
                                " (🗒️ " +
                                t.tripUpdate.trip.startTime +
                                ")</td><td /><td>" +
                                (t.tripUpdate.stopTimeUpdate.find(
                                  s =>
                                    s.stopSequence ===
                                    parseInt(route.down.substring(1))
                                )
                                  ? new Date(
                                      t.tripUpdate.stopTimeUpdate.find(
                                        s =>
                                          s.stopSequence ===
                                          parseInt(route.down.substring(1))
                                      ).departure.time * 1000
                                    ).toLocaleString("en-US", {
                                      hour12: false,
                                      timeZone: "America/Montreal",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      second: "2-digit"
                                    })
                                  : "???") +
                                "</td>"
                            )
                            .join("</tr><tr>")) +
                      "</tr>"
                  )
                  .join("") +
                '</table>");';
            return upFroms;
          })
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
          .replace("[REFRESH]", req.query.refresh === "true" ? "true" : "false")
          .replace(
            "[METAR]",
            req.query.refresh === "true"
              ? '<meta http-equiv="refresh" content="30" >'
              : ""
          )
          .replace("[CENTER]", routelist[req.params.school].center)
      );
  }
});
