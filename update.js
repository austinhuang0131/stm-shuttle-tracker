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

const request = require("request"),
  GtfsRealtimeBindings = require("gtfs-realtime-bindings").transit_realtime,
  DB = require("quick.db"),
  fs = require("fs"),
  routes = new DB.table("routes"),
  routelist = require("./routes.json"),
  realstops = require("./stops.json"),
  stopfile = fs.createWriteStream("./stops.txt", { flags: "a" }),
  gtfsstops = fs.createReadStream("./stops.txt");

function streamToString(stream) {
  const chunks = [];
  return new Promise((resolve, reject) => {
    stream.on("data", chunk => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

module.exports = time => {
  if (
    (time === "EDT" &&
      new Date().getUTCHours() >= 10 &&
      new Date().getUTCHours() <= 23) ||
    (time === "EST" &&
      new Date().getUTCHours() >= 11 &&
      new Date().getDay() !== 0 &&
      new Date().getDay() !== 6)
  )
    request(
      "https://api.stm.info/pub/od/gtfs-rt/ic/v1/tripUpdates",
      {
        method: "POST",
        headers: { apikey: process.env.STM_API_KEY },
        encoding: null
      },
      (e, r, b) => {
        if (e || r.statusCode !== 200) return;
        let updt = GtfsRealtimeBindings.FeedMessage.decode(b);
        request(
          "https://api.stm.info/pub/od/gtfs-rt/ic/v1/vehiclePositions",
          {
            method: "POST",
            headers: { apikey: process.env.STM_API_KEY },
            encoding: null
          },
          (e, r, b2) => {
            if (e || r.statusCode !== 200) return console.error;
            let feed = GtfsRealtimeBindings.FeedMessage.decode(b2);
            Object.keys(routelist).map(async s => {
              let d = await routes.fetch(s),
                ups = updt.entity.filter(
                  u =>
                    (routelist[s].routes.find(l => {
                      return (
                        l.upFromId === u.tripUpdate.stopTimeUpdate[0].stopId &&
                        l.upToId ===
                          u.tripUpdate.stopTimeUpdate[
                            u.tripUpdate.stopTimeUpdate.length - 1
                          ].stopId &&
                        l.route === u.tripUpdate.trip.routeId
                      );
                    }) ||
                      d.tr.up.indexOf(u.tripUpdate.trip.tripId) > -1) &&
                    u.tripUpdate.stopTimeUpdate[0].departure &&
                    u.tripUpdate.stopTimeUpdate[0].departure.time * 1000 +
                      60000 >
                      Date.now()
                ),
                downs = updt.entity.filter(
                  u =>
                    (routelist[s].routes.find(l => {
                      return (
                        l.downFromId ===
                          u.tripUpdate.stopTimeUpdate[0].stopId &&
                        l.downToId ===
                          u.tripUpdate.stopTimeUpdate[
                            u.tripUpdate.stopTimeUpdate.length - 1
                          ].stopId &&
                        l.route === u.tripUpdate.trip.routeId
                      );
                    }) ||
                      d.tr.down.indexOf(u.tripUpdate.trip.tripId) > -1) &&
                    u.tripUpdate.stopTimeUpdate[0].departure &&
                    u.tripUpdate.stopTimeUpdate[0].departure.time * 1000 +
                      60000 >
                      Date.now()
                );
              if (!d) d = { tu: {}, loc: {}, tr: {} };
              d.tu.up = ups;
              d.tu.down = downs;
              d.tr = !d.tr ? {} : d.tr;
              d.tr.up =
                d.tr.up.length === 0
                  ? ups.map(b => b.tripUpdate.trip.tripId)
                  : [
                      ...new Set([
                        ...d.tr.up,
                        ...ups.map(b => b.tripUpdate.trip.tripId)
                      ])
                    ];
              d.tr.down =
                d.tr.down.length === 0
                  ? downs.map(b => b.tripUpdate.trip.tripId)
                  : [
                      ...new Set([
                        ...d.tr.down,
                        ...downs.map(b => b.tripUpdate.trip.tripId)
                      ])
                    ];
              let upBuses = feed.entity.filter(
                  f => d.tr.up.indexOf(f.vehicle.trip.tripId) > -1
                ),
                downBuses = feed.entity.filter(f => {
                  return d.tr.down.indexOf(f.vehicle.trip.tripId) > -1;
                });
              DB.set("time." + s, Date.now());
              d.loc.up = upBuses;
              d.loc.down = downBuses;
              routes.set(s, d);
            });

            /*updt.entity
              .filter(
                u =>
                  u.tripUpdate.trip.routeId.endsWith("E") ||
                  u.tripUpdate.trip.routeId.endsWith("I")
              )
              .map(t => {
                t.tripUpdate.stopTimeUpdate.map(s => {
                  if (realstops.indexOf(s.stopId) === -1)
                    streamToString(gtfsstops)
                      .then(gtfsstop => {
                        if (
                          gtfsstop.indexOf(s.stopId + "," + s.stopId + ",") ===
                          -1
                        )
                          stopfile.write(
                            s.stopId +
                              "," +
                              s.stopId +
                              "," +
                              t.tripUpdate.trip.routeId +
                              " trip " +
                              t.tripUpdate.trip.tripId +
                              " route " +
                              t.tripUpdate.stopTimeUpdate[0].stopId +
                              " => " +
                              t.tripUpdate.stopTimeUpdate[
                                t.tripUpdate.stopTimeUpdate.length - 1
                              ].stopId +
                              " depart " +
                              t.tripUpdate.trip.startDate +
                              " " +
                              t.tripUpdate.trip.startTime.replace(/:00$/g, "") +
                              ",,,https://github.com/austinhuang0131/stm-shuttle-tracker/wiki/Fake-STM-Stops,0,,0\n",
                            "utf8",
                            console.error
                          );
                      })
                      .catch(console.error);
                });
              });*/
          }
        );
      }
    );
};
