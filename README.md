# project uhf

A small static page for playing video over HLS. The page is a player: it loads a stream, starts it (with autoplay enabled), and can turn on captions, use AirPlay, and Chromecast.

Right now it plays Apple’s public test stream. The point of the page is to prove that the same player can later play our own files from S3. Captions for that will be CEA-608 or CEA-708 carried in the video, declared on the playlist, or whatever else we want them to be. 

WebVTT should also work in theory, which might be really fun because we could use a custom font.

`hugo server` serves it locally.
