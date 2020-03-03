var express = require("express");
var request = require("request");
var app = express();
var GtfsRealtimeBindings = require("gtfs-realtime-bindings");
var listener = app.listen(process.env.PORT, function() {
  console.log("Your app is listening on port " + listener.address().port);
});

app.get("/:route", (req, res) => {
  request(
    "https://api.stm.info/pub/od/gtfs-rt/ic/v1/vehiclePositions",
    {
      method: "POST",
      headers: { apikey: process.env.STM_API_KEY },
      encoding: null
    },
    (e, r, b) => {
      let feed = GtfsRealtimeBindings.FeedMessage.decode(b);
      res.send(
        feed.entity
          .filter(f => f.vehicle.trip.route_id === req.params.route)
          .length === 0
        ? "There are no buses on this route :("
        : feed.entity
          .filter(f => f.vehicle.trip.route_id === req.params.route)
          .map(
            r =>
              "Bus number " +
              r.id +
              " is currently " +
              (r.vehicle.current_status === 2 ? "going to" : "at") +
              " stop no. " +
              r.vehicle.current_stop_sequence +
              " (" +
              r.vehicle.position.latitude +
              ", " +
              r.vehicle.position.longitude +
              ") with trip #" +
              r.vehicle.trip.trip_id
          )
          .join("<br><br>")
      );
    }
  );
});

app.get("/", (req, res) => {
  res.send("<p>The rule is very simple: All you need to do is visit https://maribus-test.glitch.me followed by the route number.</p><p>For example, if you want to track that shuttle bus, you would do https://maribus-test.glitch.me/124E. (Don't forget the E! Otherwise you'd be tracking the regular 124.)</p>Of course, currently, everything is still in the bare minimum stage and I haven't implemented most of the features yet, so bear with me...")
})