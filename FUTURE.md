# Future plans

The next thing to prove is the same page playing a stream we host. One short video, packaged as HLS, sitting in a public S3 folder. The page already loads whatever master playlist URL it is given, so that part is a config change.

Captions on that first file should be CEA-608 or CEA-708 inside the video, named on the playlist. WebVTT is still worth a try later. A separate text track could use a custom font, which the embedded captions cannot.

Once that plays, check it in a browser, over AirPlay, and on a Chromecast. More than one video can come after that.
