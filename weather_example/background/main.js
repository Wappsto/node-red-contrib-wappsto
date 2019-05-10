/* Enable background logs: */
require('wapp-api/console').start();

/* Load wapp-api: */
const Wappsto = require('wapp-api');
const wapp = new Wappsto();

/* Enables Node-RED to run in Wappsto: */
const RED = require('node-red-contrib-wappsto/red');

/* Contains stored e.g nodes' API keys, passwords etc. */
const credentials = require('./credentials.json');

/* Flows from Node-RED: */
const flows = require('./flows.json');

/* Find nodes that need the installation ID: */
flows.forEach(e => {
  if (e.installationID) {
    e.installationID = process.env.installationID;
  }
})

function start(apikey) {
  /* Assign API key to Open Weather Map node: */
  Object.values(credentials)[0].apikey = apikey;

  /* Runs or restarts Node-RED runtime
     with the provided flows and credentials: */
  RED.start({ flows: flows, credentials: credentials });
}

/* Fetch 'data' object to get the 'apikey': */
wapp.get('data', {}, { expand: 1, subscribe: true }).then(data => {
  start(data.get('0.apikey'));

  /* Initialize stream connection: */
  wapp.wStream.on('message', e => {
    JSON.parse(e.data).forEach(msg => {
      if (msg.meta_object.type === 'data') {
        start(msg.data.apiKey);
      }
    });
  });
}).catch(err => console.error(err));
