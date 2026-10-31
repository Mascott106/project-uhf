# Future plans

A few of the earlier ideas from here are now implemented in the page.

- You can pick from more than one stream, and only one plays at a time. 
- WebVTT works, as Tears of Steel uses it. 
- A separate text track can use a custom font (`captionFont`). The embedded CEA-608 and CEA-708 captions stick with the player's own font. 
- Chromecast has been tried, and playback works there.

Next up is a stream we actually host. One short video, packaged as HLS, in a public S3 folder. The page already plays whatever playlist you give it, so this is just another row in the list.

AirPlay functionality still needs to be validated.

Captions on that file should be CEA-608 or CEA-708 inside the video, named on the playlist, or alternately, WebVTT.

After that, try it in a browser and over AirPlay. A custom WebVTT font only shows up in the browser. AirPlay and Chromecast draw the captions on the device.
