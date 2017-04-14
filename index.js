var yt = require('googleapis').youtube('v3');
var ytdl = require("youtube-dl");
var fs = require("fs");
var https = require("https");


// get the spotify token from the user
var app = require('http').createServer(handler);
var io = require('socket.io')(app);

app.listen(8000);

function handler(req, res) {
  fs.readFile(__dirname + "/index.html", function(err, data) {
    if (err) {
      res.writeHead(500);
      return res.end("error loading index.html");
    }

    res.writeHead(200);
    res.end(data);

  });
}

io.on("connection", function (socket) {
  socket.on("token", function(data) {
    console.log(data.code);
    getToken(data.code);
  });
});


function getToken(code) {
  const postData = JSON.stringify({
    'grant_type': 'authorization_code',
    'code': code,
    'redirect_uri': 'http://localhost:8000'
  });

  const options = {
    hostname: 'accounts.spotify.com',
    port: 80,
    path: '/api/token',
    method: 'POST',
    headers: {
      'Authorization': "Basic " + btoa("f7fd010eb8204b7aabe4077d249ba905") + ":" + btoa("dfcc36a349bb4219baade50a51381b9c")
    }
  };

  const req = https.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      console.log(`BODY: ${chunk}`);
    });
    res.on('end', () => {
      console.log('No more data in response.');
    });
  });

  req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
  });

  // write data to request body
  req.write(postData);
  req.end();
}

function btoa(s) {
  return new Buffer(s).toString('base64');
}


// getting the spotify link
var args = process.argv;
var sLink = args[2];

var Gapi = "AIzaSyCb4WEODouAbNve1H0HhqrYfcnh7SGCsf8";
console.log("click link to login to spotify");
console.log("https://accounts.spotify.com/authorize/?client_id=f7fd010eb8204b7aabe4077d249ba905&response_type=code&redirect_uri=http://localhost:8000");
// https.get({
//   host: "accounts.spotify.com",
//   path: "/authorize/?client_id=f7fd010eb8204b7aabe4077d249ba905&response_type=code&redirect_uri=https%3A%2F%2Fexample.com%2Fcallback",
//
// })

function doAllTheShit(Stoken) {
  console.log("Stoken: " + Stoken);
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
        console.log(pageData);
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
      if (info.items[i].snippet.title.toLowerCase().contains("official")) {
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
