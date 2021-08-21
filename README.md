# STM Shuttle Tracker
Tracks STM "École" buses. [Try it out today!](https://stm.austinhuang.me)

Much thanks to [@felixinx](https://github.com/felixinx) for data assistance!

## Rebuild procedure
Please note that rehosting is only allowed for development purposes (e.g. improving this service).

* You need an environment variable named `STM_API_KEY`. The content should be the API key acquired from [STM Developer Portal](https://developpeurs.stm.info).
* Edit line 23 (time zone) of server.js accordingly.
* `npm i`, `npm start`, and you should be good to go!
