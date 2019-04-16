const path = require('path');
const red = require('node-red');

const usr = {flows: [], credentials: {}};
const dir = path.normalize(process.cwd()+'/../');

const settings = {
  userDir: dir,
  flowFile: dir+'flows.json',
  httpAdminRoot: false,
  readOnly: true,
  logging: {
    console: {level: 'info', metrics: false, audit: false}
  }
}

red._settings = settings;

red.start = (() => {
  var start = red.start;

  return async (data={}, ...args) => {
    usr.flows = data.flows || usr.flows;
    usr.credentials = data.credentials || usr.credentials;

    await red.stop();

    red.init(undefined, settings);
    red.runtime.storage.init(red);

    await red.runtime.storage.saveFlows(usr);
    return start(...args);
  }
}());

module.exports = red;
