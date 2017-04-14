var yt = require('googleapis').youtube('v3');
var ytdl = require("youtube-dl");
var fs = require("fs");
var https = require("https");

var args = process.argv;
var sLink = args[2];

var Gapi = "AIzaSyCb4WEODouAbNve1H0HhqrYfcnh7SGCsf8";

console.log("https://accounts.spotify.com/authorize/?client_id=f7fd010eb8204b7aabe4077d249ba905&response_type=code&redirect_uri=https://example.com/callback");
// https.get({
//   host: "accounts.spotify.com",
//   path: "/authorize/?client_id=f7fd010eb8204b7aabe4077d249ba905&response_type=code&redirect_uri=https%3A%2F%2Fexample.com%2Fcallback",
//
// })

function doAllTheShit(Stoken) {
  https.get({
    host: "api.spotify.com",
    path: "/v1/users/spotify/playlists/37i9dQZF1DX0wiundViT27/tracks",
    headers: {"Accept": "application/json", "Authorization": "Bearer "+Stoken}}, (res)=>{
      var pageData = "";
      res.setEncoding("utf-8");
      res.on('data', (chunk)=> {
        pageData += chunk;
      });
      res.on('end', ()=> {
        pageData = JSON.parse(pageData);

        for (var i = 0; i < pageData.items.length; i++) {
          var artistName = pageData.items[i].track.artists[0].name;
          var songName = pageData.items[i].track.name;
          var title = songName + " - " + artistName;
          search(artistName + " " + songName, title);
        }

      });
    });
}

function search(q, title) {
  var ytData;
  yt.search.list({
    auth: Gapi,
    part: "snippet",
    q: q,
    maxResults: 5
  }, function(error, info) {
    if (error) {
      console.error(error);
    }
    for (var i = 0; i < info.items.length; i++) {
      if (info.items[i].snippet.title.contains("Official") || info.items[i].snippet.title.contains("official")) {
        var best = i;
      } else {
        var best = 0;
      }
    }
    ytData = {"title":info.items[best].snippet.title, "channelTitle":info.items[best].snippet.channelTitle, "id": info.items[best].id.videoId, "thumbnail":info.items[best].snippet.thumbnails.high};
    console.log("https://www.youtube.com/watch?v="+ytData.id);
    download("https://www.youtube.com/watch?v="+ytData.id, title);
  });
}

function download(ytLink, title) {
  try {
    var dl = ytdl.exec(ytLink, ['-x', '--audio-format', 'mp3', "-o music/\""+title+".%(ext)s\""], {}, (err, output)=>{
      if (err) throw err;
      console.log(output.join('\n'));
    });
  } catch (e) {
    console.error(e);
  }
}

String.prototype.contains = function(p) {
  return (this.indexOf(p) > -1);
}
