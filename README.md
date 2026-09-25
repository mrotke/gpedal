# GPedal

Virtually ride indoors with Google Street View and bluetooth bike power meters (Web Bluetooth API)

Try it out [https://chadj.github.io/gpedal/](https://chadj.github.io/gpedal/)

![Image of screenshot](https://chadj.github.io/gpedal/images/screenshot.jpg)

## Supported sensors

Bluetooth (Web Bluetooth API, Chrome/Edge):

* **Cycling Power** service (`0x1818`) - power meters, optionally with crank based cadence
* **Cycling Speed and Cadence** service (`0x1816`)
* **Heart Rate** service (`0x180D`)
* **Fitness Machine (FTMS)** service (`0x1826`) - smart trainers, smart bikes and DIY sensors.
  Power, cadence and heart rate are read from Indoor Bike Data (`0x2AD2`), with Cross Trainer
  Data (`0x2ACE`) and Rower Data (`0x2AD1`) also understood.  Multi packet ("More Data") notifications
  are handled and the optional Fitness Machine Feature characteristic (`0x2ACC`) is used, together with
  a short sample of live data, to decide whether a device is offered as a power, cadence and/or heart
  rate source.  GPedal only listens - it never takes control of the machine's resistance.

  This works with DIY builds such as [ESP32-FTMS-Bike](https://github.com/Rafaday/ESP32-FTMS-Bike),
  which turns a magnetic resistance exercise bike into an FTMS "ESP32 FTMS Bike" device reporting
  cadence and estimated power.

A device exposing both Cycling Power and FTMS (many smart trainers) is listed twice; the FTMS entry is
suffixed with "(FTMS)".

ANT+ sensors are supported through [ANT-WS](https://github.com/chadj/ant-ws) and BH Fitness BladeZ bikes through Web Serial.

## Building and running

Requires [Node.js](https://nodejs.org/).

1. Create the Strava credentials file (leave the values `undefined` to hide Strava upload):

   ```
   cp src/lib/oauth.sample.js src/lib/oauth.js
   ```

2. Install dependencies:

   ```
   npm install
   ```

3. Build the production bundle into `dist/bundle.js`:

   ```
   NODE_OPTIONS=--openssl-legacy-provider npm run build
   ```

   webpack 4 needs `--openssl-legacy-provider` on Node.js 17 or newer.  In PowerShell run
   `$env:NODE_OPTIONS="--openssl-legacy-provider"` first, then `npm run build`.

4. Run it.  Either start the development server, which serves `dist/` and rebuilds on every change:

   ```
   NODE_OPTIONS=--openssl-legacy-provider npm start
   ```

   and open [https://localhost:8443/](https://localhost:8443/) (accept the self signed certificate warning),
   or host the built `dist/` folder on any HTTPS web server.

Web Bluetooth only works in Chrome or Edge on a secure origin (HTTPS or `localhost`).  The Google Maps
API key in `dist/index.html` may be restricted to the original site - if Street View does not load,
replace it with your own key.  The key needs the Maps JavaScript API (maps and Street View) and the
Geocoding API.  The Elevation API is only used for GPX files that contain no `<ele>` elevations, so a
Google Maps Demo Key (which does not include Elevation) works with normal GPX exports; if the Elevation
service is unavailable such a route is ridden flat.
