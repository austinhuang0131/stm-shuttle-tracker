// server.js
// where your node app starts

// init project
var express = require('express');
express.json();
var app = express();
var fs = require("fs");
var Pixiv = require("pixiv-app-api");
var pixiv = new Pixiv("austinhuang0131@icloud.com", "metagon123");
var pixivImg = require("pixiv-img");
var bodyParser = require('body-parser');
var cloudinary = require('cloudinary');

var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});

app.use(bodyParser.json());

app.get("/", (req, res) => {
//  pixiv.searchIllust("succubus").then(r => pixivImg(r.illusts[Math.floor(Math.random() * r.illusts.length)].imageUrls.large).then(output => {cloudinary.v2.uploader.upload(output, (e, r) => {res.send(r)})}));
})