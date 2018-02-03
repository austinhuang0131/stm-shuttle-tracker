// server.js
// where your node app starts

// init project
var express = require('express');
var app = express();
var fs = require("fs")
var db = JSON.parse(fs.readFileSync("./database.json", "utf8"));

// we've started you off with Express, 
// but feel free to use whatever libs or frameworks you'd like through `package.json`.

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));

// could also use the POST body instead of query string: http://expressjs.com/en/api.html#req.body
app.post("/database", function (request, response) {
  db.push(request.query);
  fs.writeFile("./database.json", JSON.stringify(db), "utf8");
  response.sendStatus(200);
});

// listen for requests :)
var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});
