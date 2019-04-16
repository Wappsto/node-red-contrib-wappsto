module.exports = RED => {
  'use strict';

  var API = require('./lib');
  const baseUrl = process.env.baseUrl || 'https://wappsto.com';
  const installations = {};
  const valueNodes = {};

  function wappstoListener(data) {
    RED.nodes.createNode(this, data);
    this.status({});

    let self = this;
    let value = RED.nodes.getNode(data.value);
    if (!value) {
      return;
    }
    let api = value.api;

    let clb = body => {
      self.status({fill: 'green', shape: 'ring', text: RED._('wappsto.listener.status.received')});
      setTimeout(() => self.status({}), 1000);

      let payload = [undefined, undefined];
      if (body.permission === 'Report') {
        payload[0] = {payload: body.data};
      } else {
        payload[1] = {payload: body.data};
      }
      self.send(payload);
    }

    api.on('msg:'+data.value, clb);

    this.on('close', () => {
      api.removeListener('msg:'+data.value, clb);
    });
  }

  function wappstoWriter(data) {
    RED.nodes.createNode(this, data);
    this.status({});

    let self = this;
    let value = RED.nodes.getNode(data.value);
    if (!value) {
      return;
    }
    let api = value.api;

    this.on('input', async msg => {
      self.status({fill: 'green', shape: 'ring', text: RED._('wappsto.writer.status.sending')});

      try {
        await api.changeState({
          id: data.value,
          permission: data.permission,
          body: msg.payload
        })
        self.status({fill: 'green', shape: 'dot', text: RED._('wappsto.writer.status.sent')});
        setTimeout(() => self.status({}), 1000);
      } catch (e) {
        self.status({fill: 'red', shape: 'dot', text: RED._('wappsto.writer.status.error')});
        self.error(e);
      }
    });
  }

  function wappstoValue(data) {
    RED.nodes.createNode(this, data);

    let getValueObj = () => {
      let getState = t => ({type: t, data: data.initialValue});
      switch (data.permission) {
        case 'r':
          var state = [getState('Report')];
        break;
        case 'w':
          var state = [getState('Control')];
        break;
        case 'rw':
          var state = [getState('Report'), getState('Control')];
        break;
      }
      return {
        name: data.name,
        type: data.typee,
        permission: data.permission,
        status: 'ok',
        [data.dataType]: data.dataTypeObj,
        state: state
      }
    }

    let removeValue = async appID => {
      let api = installations[appID];
      let empty = await api.removeValue(data.id);
      if (empty) {
        api.wappsto && api.wappsto.wStream.close();
        delete installations[appID];
      }
      return api;
    }

    let listeners = [];
    let oldAppID = valueNodes[data.id];
    if (oldAppID && oldAppID !== data.installationID) {
      let oldApi = removeValue(oldAppID);
      listeners = oldApi.listeners('msg:'+data.value);
    }
    valueNodes[data.id] = data.installationID;

    var api = installations[data.installationID];
    if (!api) {
      api = new API({
        baseUrl: baseUrl,
        appID: data.installationID,
        email: data.email,
        password: this.credentials.password,
      });
      installations[data.installationID] = api;
      api.init().then(e => {}).catch(e => {
        console.error(e);
        self.error(e);
      });
      listeners.forEach(e => api.on('msg:'+data.id, e));
    }

    let self = this;
    this.api = api;

    api.addValue(data.id, data.isNew, getValueObj()).catch(e => self.error(e));

    this.on('close', (removed, done) => {
      if (removed) {
        removeValue(data.installationID).then(done);
      } else {
        done();
      }
    });
  }

  RED.nodes.registerType('wappsto-listener in', wappstoListener, {});
  RED.nodes.registerType('wappsto-writer out', wappstoWriter, {});
  RED.nodes.registerType('wappsto-value', wappstoValue, {
    credentials: {
      password: {type: 'password'}
    }
  });

  RED.httpAdmin.post('/wappsto/export', async (req, res) => {
    let api = installations[req.body.installationID];
    if (!api) {
      return res.status(400).send(RED._('wappsto.export.clickDeploy'));
    }

    const {nodes} = require('node-red');
    const {stripIndent} = require('common-tags');

    let {flows} = nodes.getFlows();
    let credentials = {};
    let libs = {
      'node-red': nodes.getNodeInfo('debug').version,
      'node-red-contrib-wappsto': nodes.getNodeInfo('wappsto-value').version,
    }

    flows.forEach(e => {
      let cred = nodes.getCredentials(e.id);
      if (cred) {
        credentials[e.id] = cred;
      }
      let info = nodes.getNodeInfo(e.type);
      if (info) {
        libs[info.module] = info.version;
      }
    });

    libs = JSON.stringify({dependencies: libs}, null, 2);
    flows = JSON.stringify(flows, null, 2);
    credentials = JSON.stringify(credentials, null, 2);

    let main = stripIndent(`
      // Enables Node-RED to run in Wappsto.
      const RED = require('node-red-contrib-wappsto/red');

      // Contains stored e.g nodes' API keys, passwords etc.
      const credentials = require('./credentials.json');

      // Exported flows from Node-RED.
      const flows = require('./flows.json');

      // Runs or restarts Node-RED runtime with new flows and credentials.
      RED.start({ flows: flows, credentials: credentials });
    `);

    try {
      await api.upload({
        'flows.json': flows,
        'credentials.json': credentials,
        'package.json': libs,
        'main.js': main
      });
      res.send(RED._('wappsto.export.ok'));
    } catch (e) {
      res.status(400).send(RED._('wappsto.export.tryAgain'));
    }
  });

  RED.httpAdmin.post('/wappsto/create', async (req, res) => {
    if (req.body.password === '__PWRD__') {
      const {nodes} = require('node-red');
      let cred = nodes.getCredentials(req.body.id);
      req.body.password = cred.password;
    }

    let api = new API({
      baseUrl: baseUrl,
      email: req.body.email,
      password: req.body.password
    });

    try {
      let installationID = await api.createInstallation();
      res.send(installationID);
    } catch (e) {
      res.status(400).send(e);
    }
  });
}
