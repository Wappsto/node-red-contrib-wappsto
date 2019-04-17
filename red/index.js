const http = require('http');
const express = require("express");
const red = require('node-red');

var flows = [], credentials = {};

const settings = {
  userDir: process.cwd(),
  credentialSecret: false,
  readOnly: true,
  logging: {
    console: {level: 'info', metrics: false, audit: false}
  }
}

red._settings = settings;

red.start = (() => {
  let start = red.start;
  let doStart = true;

  return async (data={}, ...args) => {
    flows = data.flows || flows;
    credentials = data.credentials || credentials;

    if (doStart) {
      let server = http.createServer(express());
      red.init(server, settings);
      await start(...args);
      doStart = false;
    }

    for (let [k, v] of Object.entries(credentials)) {
      await red.runtime._.nodes.addCredentials(k, v);
    }
    return red.runtime.flows.setFlows({deploymentType: 'full', flows: {flows: flows}});
  }
})();

module.exports = red;
