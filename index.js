// all the dependencies
var yt = require('googleapis').youtube('v3');
var ytApi = "AIzaSyCb4WEODouAbNve1H0HhqrYfcnh7SGCsf8";
var fs = require("fs-extra");
var https = require("https");
var request = require("request");
var termList = require("./termList.json");
var colors = require('colors/safe');
var downloaded = require("./downloadedPlaylists.json");
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

var outputDir = __dirname;

String.prototype.contains = function(p) {
  return (this.indexOf(p) > -1);
}

var spotify = new spotifyApi("f7fd010eb8204b7aabe4077d249ba905", "dfcc36a349bb4219baade50a51381b9c", spotifyCallback);

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
var linkData = {playlist: [], album: [], artist: []};
// check the arguments given to the script
for (var i = 2; i < args.length; i++) {
  if (args[i].contains("playlist")) {
    var username = args[i].substring(args[i].indexOf("user")+5, args[i].length);
    username = username.substring(0, username.indexOf("/"));
    playlist = args[i].substring(args[i].indexOf("playlist")+9, args[i].length);
    linkData.playlist.push({username: username, playlist: playlist});
  }
  if (args[i].contains("album")) {
    var album = args[i].substring(args[i].indexOf("album")+6, args[i].length);
    linkData.album.push({album: album});
  }
  if (args[i].contains("artist")) {
    var artist = args[i].substring(args[i].indexOf("artist")+7, args[i].length);
    linkData.artist.push({artist: artist});
  }
  if (args[i] === "--update" || args[i] === "-u") {
    // updates the playlists. this will download any new songs in the downloaded playlists.
    linkData["update"] = true;
  }
  if (args[i] === "-o") {
    outputDir = args[i+1];
  }
}

// checks if directory covers exists and if not it will make it
fs.existsSync(outputDir + "/covers") || fs.mkdirSync(outputDir + "/covers");

var spotifyData = [];
var downloadedData = [];
var totalSongs = 0;
var totalDownloaded = 0;
var songCount = 0; // for debugging
var youtubeSearches = 0; // for debugging
var artistCalls = 0; // for debugging
function spotifyCallback(res, code, err) {
  if (code == "playlistTracks") {
    if (res.next) {
      var playlist = res.href.substring(res.href.indexOf("playlists")+10, res.href.length);
      playlist = playlist.substring(0, playlist.indexOf("/"));
      var username = res.href.substring(res.href.indexOf("users")+6, res.href.length);
      username = username.substring(0, username.indexOf("/"));
      spotify.getPlaylistTracks(playlist, username, {offset:res.offset+100, limit:100});
    } else {
      totalSongs += res.total;
    }
    for (var i = 0; i < res.items.length; i++) {
      // if it finds the song, don't download it
      if (downloaded.downloaded.find(x => x.artist === res.items[i].track.artists[0].name && x.song === res.items[i].track.name)) {
        found = true;
        totalSongs--;
        checkProgress();
      }
      if (!found) {
        songCount++;
        spotifyData.push({
          "artist": res.items[i].track.artists[0].name,
          "song": res.items[i].track.name,
          "album": res.items[i].track.album.name,
          "cover": res.items[i].track.album.images[0].url,
          "id": res.items[i].track.artists[0].id,
          "track": null,
          "date": null
        });
        downloadedData.push({"artist": res.items[i].track.artists[0].name, "song": res.items[i].track.name});
        spotify.getArtist(res.items[i].track.artists[0].id);
      }
    }
  } else if (code == "artistAlbums") {
    for (var i = 0; i < res.items.length; i++) {
      spotify.getAlbum(res.items[i].id);
    }
  } else if(code == "albumTracks") {
    for (var i = 0; i < res.tracks.items.length; i++) {
      var found = false;
      for (var j = 0; j < spotifyData.length; j++) {
        if (spotifyData[j].id == res.artists[0].id && spotifyData[j].song == res.tracks.items[i].name) {
          found = true;
        }
      }
      // if it finds the song, don't download it
      if (downloaded.downloaded.find(x => x.artist === res.artists[0].name && x.song === res.tracks.items[i].name)) {
        found = true;
        checkProgress();
      }
      if (!found) {
        spotifyData.push({
          "artist": res.artists[0].name,
          "song": res.tracks.items[i].name,
          "track": res.tracks.items[i].track_number+"/"+res.tracks.total,
          "album": res.name,
          "date": res.release_date,
          "cover": res.images[0].url,
          "id": res.artists[0].id
        });
        downloadedData.push({"artist": res.items[i].track.artists[0].name, "song": res.items[i].track.name});
        totalSongs++;
        spotify.getArtist(res.artists[0].id);
      }
    }
  } else if (code == "token") {
    if (linkData.playlist[0]) {
      for (var i = 0; i < linkData.playlist.length; i++) {
        spotify.getPlaylistTracks(linkData.playlist[i]["playlist"], linkData.playlist[i]["username"]);
      }
    }
    if(linkData.album[0]) {
      for (var i = 0; i < linkData.album.length; i++) {
        spotify.getAlbum(linkData.album[i]["album"]);
      }
    }
    if (linkData.artist[0]) {
      for (var i = 0; i < linkData.artist.length; i++) {
        spotify.getArtistAlbums(linkData.artist[i]["artist"]);
      }
    }
    if (linkData.update) {
      // downloads all the playlists you have downloaded
      for (var i = 0; i < downloaded.playlist.length; i++) {
        spotify.getPlaylistTracks(downloaded.playlist[i].playlist, downloaded.playlist[i].username);
      }
      for (var i = 0; i < downloaded.album.length; i++) {
        spotify.getAlbum(downloaded.album[i].album);
      }
      for (var i = 0; i < downloaded.artist.length; i++) {
        spotify.getArtistAlbums(downloaded.artist[i].artist);
      }
    }
  } else if (code == "artist") {
    artistCalls++;
    var spotData = spotifyData.find(x => x.id === res.id); // find the item
    if (!spotData) {
      console.log("skipped " + res.name);
      return
    }
    spotifyData.splice(spotifyData.indexOf(spotData), 1); // remove it from the array
    if (res.genres[0] != undefined) {
      spotData["genre"] = res.genres[0];
    } else {
      spotData["genre"] = "";
    }
    // if it finds the song, don't download it
    if (downloaded.downloaded.find(x => x.artist === spotData.artist && x.song === spotData.song)) {
      totalSongs--;
      checkProgress();
      return
    }
    // do a yt search
    (function(spotData) {
      ytSearch(spotData.artist+" - "+spotData.song, 5, ytApi, result => {
        youtubeSearches++;
        loop1:
        for (var j = 0; j < result.items.length; j++) {
          if (result.items[j].id.kind === 'youtube#video') {
            loop2:
            for (var k = 0; k < termList.length; k++) {
              if (result.items[j].snippet.title.toLowerCase().contains(termList[k]) || result.items[j].snippet.channelTitle.toLowerCase().contains(termList[k]) || result.items[j].snippet.channelTitle.toLowerCase().contains(spotData.artist)) {
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
        var title = spotData.artist+" - "+spotData.song;
        console.log(colors.verbose(title));
        downloadMp3("https://www.youtube.com/watch?v="+result.items[best].id.videoId, outputDir+"/Music/"+title, (error, stdout, stderr, path)=> {
          console.log(colors.info(title+" downloaded"));
          //download cover
          downloadImg(spotData.cover, outputDir+"/covers/"+title, (dir) => {
            console.log(colors.info("downloaded cover"));
            var options = {
              "attachments": [dir]
            };
            var metadata = {
              "artist": spotData.artist,
              "album": spotData.album,
              "title": spotData.song,
              "genre": spotData.genre,
              "track": spotData.track,
              "date": spotData.date
            }
            ffmetadata.write(path, metadata, options, (err)=> {
              if (err) {
                console.log(colors.error("error writing metadata"));
              } else {
                console.log(colors.info("wrote metadata successfully"));
                totalDownloaded++;
                checkProgress();
              }
            });
          });
        });
      }, i);
    }(spotData));
  }
}

function checkProgress() {
  var percentage = totalDownloaded/totalSongs*100;
  if (totalSongs === 0) {
    percentage = 100;
  }
  io.emit("progress", percentage);
  if (percentage == 100) {
    console.log(colors.info("DONE downloading all files"));
    if (linkData.update) {
      console.log(colors.info("updated all the files"));
    }

    linkData.playlist.forEach(item => {
      // if it doesn't exist, prevents doubles
      if (!downloaded.playlist.find(x => x.playlist === item.playlist && x.username === item.playlist)) {
        downloaded.playlist.push({"playlist": item.playlist, "username": item.username});
      }
    });
    linkData.album.forEach(item => {
      // if it doesn't exist, prevents doubles
      if (!downloaded.album.find(x => x.album === item.album)) {
        downloaded.album.push({album: item.album});
      }
    });
    linkData.artist.forEach(item => {
      // if it doesn't exist, prevents doubles
      if (!downloaded.artist.find(x => x.artist === item.artist)) {
        downloaded.artist.push({artist: item.artist});
      }
    });

    downloadedData.forEach(item => {
      downloaded.downloaded.push(item);
    });

    app.close();
    fs.remove(outputDir+'/covers', (err)=>{
      if (err) {
        console.log(colors.error("couldn't delete cover folder"));
      }
    });
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

function ytSearch(searchTerm, maxResults, apiKey, callback) {
  yt.search.list({
    part: "snippet",
    q: searchTerm,
    maxResults: maxResults,
    auth: apiKey
  }, (err, result)=>{
    if (err) {
      console.log(err);
      ytSearch(searchTerm, maxResults, apiKey, callback); // if error try again
    } else {
      callback(result);
      return result;
    }
  });
}

// do not give dir an extension like .jpeg, gif or what ever, you can give it an name afterwards but no extension
function downloadImg(url, dir, callback){
  request.head(url, function(err, res, body){
    var ext = "."+res.headers['content-type'].substring("image/".length, res.headers['content-type'].length);
    dir += ext;
    request(url).pipe(fs.createWriteStream(dir)).on('close', function() {
      callback(dir);
    });
  });
}



process.on("exit", () => {
  fs.writeFileSync("downloadedPlaylists.json", JSON.stringify(downloaded));
  console.log("wrote downloadedPlaylists.json file");
})


var apiErrors = 0;


// spotifyApi object

function spotifyApi(client_id, client_secret, callback) {
  this.client_id = client_id;
  this.client_secret = client_secret;
  this.token;
  this.oauthCode;
  this.callback = callback;
  this.timeoutTime = 10000; // if it gets an error wait this many seconds and try again.
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
        pageData = JSON.parse(pageData);
        if (pageData.error && pageData.error.status === 429) {
          console.log("error");
          apiErrors++;
          setTimeout(() => {
            this.getPlaylistTracks(playlistId, username, options);
          }, this.timeoutTime);
        } else {
          this.callback(pageData, "playlistTracks");
          return pageData;
        }
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
        pageData = JSON.parse(pageData);
        if (pageData.error && pageData.error.status === 429) {
          console.log("error");
          apiErrors++;
          setTimeout(() => {
            this.getArtist(artistId, options);
          }, this.timeoutTime);
        } else {
          this.callback(pageData, "artist");
          return pageData;
        }
      });
    }
  );
}

spotifyApi.prototype.getArtistAlbums = function(artistId, options) {
  https.get({
    host: "api.spotify.com",
    path: "https://api.spotify.com/v1/artists/"+artistId+"/albums"+optionsToUriParams(options),
    headers: {"Accept": "application/json", "Authorization": "Bearer "+this.token}}, (res)=>{
      var pageData = "";
      res.setEncoding("utf-8");
      res.on('data', (chunk)=> {
        pageData += chunk;
      });
      res.on('end', ()=> {
        pageData = JSON.parse(pageData);
        if (pageData.error && pageData.error.status === 429) {
          console.log("error");
          apiErrors++;
          setTimeout(() => {
            this.getArtistAlbums(artistId, options);
          }, this.timeoutTime);
        } else {
          this.callback(pageData, "artistAlbums");
          return pageData;
        }
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
        pageData = JSON.parse(pageData);
        if (pageData.error && pageData.error.status === 429) {
          console.log("error");
          apiErrors++;
          setTimeout(() => {
            this.getAlbum(albumId, options);
          }, this.timeoutTime);
        } else {
          this.callback(pageData, "albumTracks");
          return pageData;
        }
      });
    }
  );
}

// setInterval(() => {
//   console.log(apiErrors, songCount, totalSongs, youtubeSearches, artistCalls);
// }, 10000);

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
