// server.js
// where your node app starts

// init project
var express = require('express');
var app = express();
var fs = require("fs")
var db = JSON.parse(fs.readFileSync("./database.json", "utf8"));

app.use(express.static('public'));

app.post("/database", function (request, response) {
  db.push(request.query);
  if (db.find(a => {return a.user === request.query.user})) db.slice(db.indexOf(db.find(a => {return a.user === request.query.user})), 0);
  fs.writeFile("./database.json", JSON.stringify(db), "utf8");
  response.sendStatus(200);
});
app.get("/database", function (request, response) {
  if (db.find(a => {return a.user === request.query.user}) === undefined) {
    var o = {user: request.query.user, goal: 60};
    db.push(o);
    response.send(o);
  }
  else response.send(db.find(a => {return a.user === request.query.user}));
});

var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});
