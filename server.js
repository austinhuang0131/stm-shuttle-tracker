// server.js
// where your node app starts

// init project
var express = require('express');
express.json();
var app = express();
var fs = require("fs");
var snekfetch = require("snekfetch");
var request = require("request");
var bodyParser = require('body-parser');

var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});

app.use(bodyParser.json());

app.get("/", (req, res) => {
  request.post("https://oauth.secure.pixiv.net/auth/token", {form: {
    "grant_type":"password",
    "username":"austinhuang0131@icloud.com",
    "password":"metagon123",
    "get_secure_url":"1",
    "client_id":"KzEZED7aC0vird8jWyHM38mXjNTY",
    "client_secret":"W9JZoJe00qPvJsiyCGT3CCtC6ZUtdpKpzMbNlUGP"
  }}, (e, r, b) => {console.log(b)})
})