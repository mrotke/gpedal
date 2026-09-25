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

## Building

```
cp src/lib/oauth.sample.js src/lib/oauth.js
npm install
npm run build
```

webpack 4 needs `NODE_OPTIONS=--openssl-legacy-provider` on Node.js 17 or newer.
