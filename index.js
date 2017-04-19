// all the dependencies
var yt = require('googleapis').youtube('v3');
var ytdl = require("youtube-dl");
var fs = require("fs");
var https = require("https");
var request = require("request");
var termList = require("./termList.json");
var colors = require('colors/safe');
var ffmetadata = require("ffmetadata");

// global data
var amountOfSongs;
var amountOfSongsDone = 0;
var percentage;


// colors theme
colors.setTheme({
  silly: 'rainbow',
  input: 'grey',
  verbose: 'cyan',
  prompt: 'grey',
  info: 'green',
  data: 'grey',
  help: 'cyan',
  warn: 'yellow',
  debug: 'blue',
  error: 'red',
  link: ["underline", "green"]
});


// get the spotify token from the user
var app = require('http').createServer(handler);
var io = require('socket.io')(app);

app.listen(8000);

function handler(req, res) {
  fs.readFile(__dirname + "/index.html", function(err, data) {
    if (err) {
      res.writeHead(500);
      return res.end(colors.error("error loading index.html"));
    }

    res.writeHead(200);
    res.end(data);

  });
}

io.on("connection", function (socket) {
  socket.on("token", function(data) {
    getToken(data.code);
  });
});


function getToken(code) {
  var data = {
    'grant_type': "authorization_code",
    'code': code,
    'redirect_uri': "http://localhost:8000"
  }
  var options = {
    url: "https://accounts.spotify.com/api/token",
    method: "POST",
    json: true,
    form: data,
    headers: {
      'Authorization': "Basic "+encodeB64("f7fd010eb8204b7aabe4077d249ba905:dfcc36a349bb4219baade50a51381b9c")
    }
  };
  request.post(options, (error, response, body) => {
    if (!error && response.statusCode === 200) {
      getTracks(body.access_token);
    }
  });
}

function encodeB64(s) {
  return Buffer.from(s).toString("base64");
}

// getting the spotify link
var args = process.argv;
var sLink = args[2];
var linkData = {};
linkData["username"] = sLink.substring(sLink.indexOf("user")+5, sLink.length);
linkData["username"] = linkData["username"].substring(0, linkData["username"].indexOf("/"));
linkData["playlist"] = sLink.substring(sLink.indexOf("playlist")+9, sLink.length);

var Gapi = "AIzaSyCb4WEODouAbNve1H0HhqrYfcnh7SGCsf8";
console.log(colors.help("click link to login to spotify"));
console.log(colors.link("https://accounts.spotify.com/authorize/?client_id=f7fd010eb8204b7aabe4077d249ba905&response_type=code&redirect_uri=http://localhost:8000"));

function getTracks(Stoken) {
  var spotifyData = [];
  https.get({
    host: "api.spotify.com",
    path: "/v1/users/"+linkData.username+"/playlists/"+linkData.playlist+"/tracks",
    headers: {"Accept": "application/json", "Authorization": "Bearer "+Stoken}}, (res)=>{
      var pageData = "";
      res.setEncoding("utf-8");
      res.on('data', (chunk)=> {
        pageData += chunk;
      });
      res.on('end', ()=> {
        pageData = JSON.parse(pageData);

        amountOfSongs = pageData.total;
        for (var i = 0; i < pageData.items.length; i++) {
          spotifyData.push({
            "cover": pageData.items[i].track.album.images[0].url,
            "songName": pageData.items[i].track.name,
            "artistName": pageData.items[i].track.artists[0].name
          });
          if (pageData.items[i].track.album.album_type === "album") {
            spotifyData[i]["album"] = pageData.items[i].track.album.name;
          } else {
            spotifyData[i]["album"] = spotifyData[i].songName;
          }
          getArtistGenre(pageData.items[i].track.artists[0].href, Stoken, i, function(data, i) {
            if (data.genres[0]) {
              spotifyData[i]["genre"] = data.genres[0];
            } else {
              spotifyData[i]["genre"] = "";
            }
            search(spotifyData[i]);
          });
        }
      });
    });
}

function getArtistGenre(href, Stoken, i, callback) {
  var options = {
    url: href,
    method: "GET",
    headers: {
      "Accept": "application/json",
      "Authorization": "Bearer "+Stoken
    }
  };
  request.get(options, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      var data = JSON.parse(body);
      callback(data, i);
    }
  });
}

function search(spotifyData) {
  var ytData;
  yt.search.list({
    auth: Gapi,
    part: "snippet",
    q: spotifyData.artistName +" "+ spotifyData.songName,
    maxResults: 5
  }, function(error, info) {
    if (error) {
      console.error(colors.error(error));
    }
    loop1:
    for (var i = 0; i < info.items.length; i++) {
      if (info.items[i].id.kind === 'youtube#video') {
        loop2:
        for (var j = 0; j < termList.length; j++) {
          if (info.items[i].snippet.title.toLowerCase().contains(termList[j])) {
            var best = i;
            break loop1;
          }
        }
      }
    }
    if (!best) {
      for (var i = 0; i < info.items.length; i++) {
        if (info.items[i].id.kind === "youtube#video") {
          var best = i;
          break;
        }
      }
    }
    ytData = {"title":info.items[best].snippet.title, "channelTitle":info.items[best].snippet.channelTitle, "id": info.items[best].id.videoId, "thumbnail":info.items[best].snippet.thumbnails.high};
    console.log("https://www.youtube.com/watch?v="+colors.verbose(ytData.id));

    var filename = spotifyData.artistName +" - "+ spotifyData.songName
    // if callback then done downloading
    download("https://www.youtube.com/watch?v="+ytData.id, filename, function(filename) {

      // add metadata to file
      var metadata = {
        "artist": spotifyData.artistName,
        "title": spotifyData.songName,
        "album": spotifyData.album,
        "genre": spotifyData.genre
      };
      downloadImg(spotifyData.cover, spotifyData.artistName + " - " + spotifyData.songName, function(file){
        console.log(colors.info('done downloading mp3 cover'));
        var cover = {
          'attachments': [file]
        };
        ffmetadata.write(filename, metadata, cover, function(err) {
          if (err) {
            console.log(colors.error("Error writing metadata"), err);
            downloadImg(spotifyData.cover, spotifyData.artistName + " - " + spotifyData.songName, this(file)); // not sure if this works
          } else {
            console.log(colors.info("metadata written"));
            fs.unlinkSync(file);

            // calculates and sends back percentage to the browser
            amountOfSongsDone++;
            percentage = amountOfSongsDone/amountOfSongs*100;

            io.emit("progress", percentage);
          }
        });
      });
    });
  });
}

function downloadImg(uri, filename, callback){
  request.head(uri, function(err, res, body){
    // console.log('content-type:', res.headers['content-type']);
    var ext = "."+res.headers['content-type'].substring("image/".length, res.headers['content-type'].length);
    // console.log('content-length:', res.headers['content-length']);
    filename = __dirname+"/ 'music/"+filename+ext;
    request(uri).pipe(fs.createWriteStream(filename)).on('close', function() {
      callback(filename);
    });
  });
};

function download(ytLink, title, callback) {
  try {
    var dl = ytdl.exec(ytLink, ['-x', '--audio-format', 'mp3', "-o 'music/"+title+".%(ext)s'"], {}, (err, output)=>{
      if (err) {
        console.log(colors.warn(err));
        // if error try again
        download(ytLink, title, callback);
      } else {
        console.log(colors.data(output.join('\n')));
        callback(" 'music/"+title+".mp3");
      }
    });
  } catch (e) {
    console.log(colors.error(e));
  }
}

String.prototype.contains = function(p) {
  return (this.indexOf(p) > -1);
}
