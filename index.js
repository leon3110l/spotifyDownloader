// all the dependencies
var yt = require('googleapis').youtube('v3');
var ytApi = "AIzaSyCb4WEODouAbNve1H0HhqrYfcnh7SGCsf8";
var fs = require("fs-extra");
var https = require("https");
var request = require("request");
var termList = require("./termList.json");
var colors = require('colors/safe');
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
var ffmetadata = require("ffmetadata");

String.prototype.contains = function(p) {
  return (this.indexOf(p) > -1);
}

var spotify = new spotifyApi("f7fd010eb8204b7aabe4077d249ba905", "dfcc36a349bb4219baade50a51381b9c", spotifyCallback);

// checks if directory covers exists and if not it will make it
fs.existsSync("covers") || fs.mkdirSync("covers");


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
    spotify.oauthCode = data.code;
    spotify.getToken();
  });
});

console.log(colors.help("click link to login to spotify"));
console.log(colors.link("https://accounts.spotify.com/authorize/?client_id="+spotify.client_id+"&response_type=code&redirect_uri=http://localhost:8000"));

// getting the spotify link
var args = process.argv;
var sLink = args[2];
var linkData = {};
if (sLink.contains("playlist")) {
  linkData["username"] = sLink.substring(sLink.indexOf("user")+5, sLink.length);
  linkData["username"] = linkData["username"].substring(0, linkData["username"].indexOf("/"));
  linkData["playlist"] = sLink.substring(sLink.indexOf("playlist")+9, sLink.length);
} else if (sLink.contains("album")) {
  linkData["album"] = sLink.substring(sLink.indexOf("album")+6, sLink.length);
}

var spotifyData = [];
var totalSongs;
var totalDownloaded = 0;
function spotifyCallback(res, code, err) {
  if (code == "playlistTracks") {
    totalSongs = res.total;
    if (res.next) {
      console.log("next!");
      spotify.getPlaylistTracks(linkData["playlist"], linkData["username"], {offset:res.offset+100, limit:100});
    }
    console.log(res.items.length);
    for (var i = 0; i < res.items.length; i++) {
      spotifyData.push({
        "artist": res.items[i].track.artists[0].name,
        "song": res.items[i].track.name,
        "album": res.items[i].track.album.name,
        "cover": res.items[i].track.album.images[0].url,
        "id": res.items[i].track.artists[0].id,
        "track": null,
        "date": null
      });
      spotify.getArtist(spotifyData[i+res.offset].id);
    }
  } else if(code == "albumTracks") {
    totalSongs = res.tracks.total;
    for (var i = 0; i < res.tracks.items.length; i++) {
      spotifyData.push({
        "artist": res.artists[0].name,
        "song": res.tracks.items[i].name,
        "track": res.tracks.items[i].track_number+"/"+totalSongs,
        "album": res.name,
        "date": res.release_date,
        "cover": res.images[0].url,
        "id": res.artists[0].id
      });
      spotify.getArtist(spotifyData[i].id);
    }
  } else if (code == "token") {
    if (linkData.playlist) {
      spotify.getPlaylistTracks(linkData["playlist"], linkData["username"]);
    } else if(linkData.album) {
      spotify.getAlbum(linkData["album"]);
    }
  } else if (code == "artist") {
    for (var i = 0; i < spotifyData.length; i++) {
      if (spotifyData[i].id === res.id && !spotifyData[i].genre) {
        spotifyData[i]["genre"] = res.genres[0];
        // do a yt search
        ytSearch(spotifyData[i].artist+" - "+spotifyData[i].song, 5, ytApi, (result, i)=>{
          var best = null;
          loop1:
          for (var j = 0; j < result.items.length; j++) {
            if (result.items[j].id.kind === 'youtube#video') {
              loop2:
              for (var k = 0; k < termList.length; k++) {
                if (result.items[j].snippet.title.toLowerCase().contains(termList[k])) {
                  var best = j;
                  break loop1;
                }
              }
            }
          }
          if (!best) {
            for (var j = 0; j < result.items.length; j++) {
              if (result.items[j].id.kind === "youtube#video") {
                var best = j;
                break;
              }
            }
          }
          console.log("https://www.youtube.com/watch?v="+colors.verbose(result.items[best].id.videoId));
          // download youtube mp3
          var title = spotifyData[i].artist+" - "+spotifyData[i].song;
          console.log(colors.verbose(title));
          downloadMp3("https://www.youtube.com/watch?v="+result.items[best].id.videoId, __dirname+"/music/"+title, (error, stdout, stderr, path)=> {
            console.log(colors.info(title+" downloaded"));
            //download cover
            downloadImg(spotifyData[i].cover, __dirname+"/covers/"+title, (dir) => {
              console.log(colors.info("downloaded cover"));
              var options = {
                "attachments": [dir]
              };
              var metadata = {
                "artist": spotifyData[i].artist,
                "album": spotifyData[i].album,
                "title": spotifyData[i].song,
                "genre": spotifyData[i].genre,
                "track": spotifyData[i].track,
                "date": spotifyData[i].date
              }
              ffmetadata.write(path, metadata, options, (err)=> {
                if (err) {
                  console.log(colors.error("error writing metadata"));
                } else {
                  console.log(colors.info("wrote metadata successfully"));
                  totalDownloaded++;
                  var percentage = totalDownloaded/totalSongs*100;
                  io.emit("progress", percentage);
                  if (percentage == 100) {
                    console.log(colors.info("DONE downloading all files"));
                    app.close();
                    fs.emptyDir(__dirname+'/covers', (err)=>{
                      if (err) {
                        console.log(colors.error("couldn't delete cover folder"));
                      }
                    });
                  }
                }
              });
            });
          });
        }, i);
      }
    }
  }
}

//path includes filename but excludes extension
function downloadMp3(ytLink, path, callback) {
  var exec = require("child_process").exec;
  var cmd = 'youtube-dl -x --audio-format mp3 -o "'+path+'.%(ext)s" '+ytLink;
  exec(cmd, (error, stdout, stderr)=> {
    if (!error && !stderr) {
      callback(error, stdout, stderr, path+".mp3");
    } else {
      // brute force it
      console.log(error);
      console.log(stderr);
      downloadMp3(ytLink, path, callback);
    }
  });
}

function ytSearch(searchTerm, maxResults, apiKey, callback, i) {
  yt.search.list({
    part: "snippet",
    q: searchTerm,
    maxResults: maxResults,
    auth: apiKey
  }, (err, result)=>{
    callback(result, i);
    return result;
  });
}

// do not give dir an extension like .jpeg, gif or what ever, you can give it an name afterwards but no extension
function downloadImg(url, dir, callback){
  request.head(url, function(err, res, body){
    var ext = "."+res.headers['content-type'].substring("image/".length, res.headers['content-type'].length);
    dir+= ext;
    request(url).pipe(fs.createWriteStream(dir)).on('close', function() {
      callback(dir);
    });
  });
}





// spotifyApi object

function spotifyApi(client_id, client_secret, callback) {
  this.client_id = client_id;
  this.client_secret = client_secret;
  this.token;
  this.oauthCode;
  this.callback = callback;
}

spotifyApi.prototype.getToken = function() {
  var data = {
    'grant_type': "authorization_code",
    'code': this.oauthCode,
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
      this.token = body.access_token;
      this.callback(this.token, "token");
      return this.token;
    }
  });
}
function encodeB64(s) {
  return Buffer.from(s).toString("base64");
}

spotifyApi.prototype.getPlaylistTracks = function(playlistId, username, options) {
  https.get({
    host: "api.spotify.com",
    path: "/v1/users/"+username+"/playlists/"+playlistId+"/tracks"+optionsToUriParams(options),
    headers: {"Accept": "application/json", "Authorization": "Bearer "+this.token}}, (res)=>{
      var pageData = "";
      res.setEncoding("utf-8");
      res.on('data', (chunk)=> {
        pageData += chunk;
      });
      res.on('end', ()=> {
        this.callback(JSON.parse(pageData), "playlistTracks");
        return JSON.parse(pageData);
      });
    }
  );
}

spotifyApi.prototype.getArtist = function(artistId, options) {
  https.get({
    host: "api.spotify.com",
    path: "/v1/artists/"+artistId+optionsToUriParams(options),
    headers: {"Accept": "application/json", "Authorization": "Bearer "+this.token}}, (res)=>{
      var pageData = "";
      res.setEncoding("utf-8");
      res.on('data', (chunk)=> {
        pageData += chunk;
      });
      res.on('end', ()=> {
        this.callback(JSON.parse(pageData), "artist");
        return JSON.parse(pageData);
      });
    }
  );
}

spotifyApi.prototype.getAlbum = function(albumId, options) {
  https.get({
    host: "api.spotify.com",
    path: "/v1/albums/"+albumId+optionsToUriParams(options),
    headers: {"Accept": "application/json", "Authorization": "Bearer "+this.token}}, (res)=>{
      var pageData = "";
      res.setEncoding("utf-8");
      res.on('data', (chunk)=> {
        pageData += chunk;
      });
      res.on('end', ()=> {
        this.callback(JSON.parse(pageData), "albumTracks");
        return JSON.parse(pageData);
      });
    }
  );
}

function optionsToUriParams(options) {
  if (!options) {
    return ""
  }
  var uri = "?";
  var counter = 0
  for (var x in options) {
    if (options.hasOwnProperty(x)) {
      if (counter == 0) {
        uri += x+"="+options[x];
      } else {
        uri += "&"+x+"="+options[x];
      }
      counter++;
    }
  }
  return uri
}
