# spotifyDownloader
downloads a spotify playlist, album, or all the tracks from an artist

## installation

* install ffmpeg: https://ffmpeg.org/download.html
* install youtube-dl: https://rg3.github.io/youtube-dl/
* install nodejs: https://nodejs.org/en/download/

```bash
git clone https://github.com/leon-4A6C/spotifyDownloader
cd spotifyDownloader
npm install
```

## usage

```bash
node index.js <spotify web player link: https://open.spotify.com>
```
it will download all the songs in the music folder

* if you try to download all the songs from an artist it will work but because most artist put their songs on multiple albums it will be a mess
