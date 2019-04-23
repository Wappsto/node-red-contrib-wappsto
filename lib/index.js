const EventEmitter = require('events');
const WappApi = require('wapp-api');
const HTTP = require('./request');

module.exports = class API extends EventEmitter {
  constructor(opts) {
    super();
    this.sessionApp, this.versionID, this.device, this.sync;
    this.appID = opts.appID;
    this.values = {};
    this.addedValues = {};
    this.valueMap = {};
    this.http = new HTTP({
      baseUrl: opts.baseUrl,
      email: opts.email,
      password: opts.password,
      sessionID: opts.sessionID
    })
  }

  init() {
    if (this.sync) {
      return this.sync;
    }

    this.sync = (async () => {
      await this.http.getSession();

      let self = this;
      let {body} = await this.http.get('installation/'+this.appID);
      this.sessionApp = body.session;
      this.versionID = body.version_id;

      this.wappsto = new WappApi({
        baseUrl: this.http.baseUrl,
        session: this.sessionApp
      })

      try {
        var network = await new Promise((resolve, reject) => {
          self.wappsto.get('network', {}, {
            subscribe: true,
            expand: 5,
            success: resolve,
            error: reject
          });
        })
      } catch (e) {
        throw 'Could not get network.';
      }

      if (network.models.length > 0) {
        this.device = network.get('0.device.0');
      } else {
        try {
          await this.http.post(`acl/${this.appID}/permission`, {
            meta: {id: this.appID},
            restriction: [{
              method: {create: true, retrieve: true},
              create: ['network']
            }]
          });
        } catch (e) {
          if (e.body.code === 400016) {
            console.error(e.body.message);
          } else {
            throw e;
          }
        }

        network = new this.wappsto.models.Network();
        try {
          await network.save({
            name: 'Node-RED',
            device: [{name: 'Node-RED'}]
          }, {subscribe: true})
        } catch (e) {
          throw 'Network not created.';
        }
        this.device = network.get('device.0');
      }

      this.wappsto.wStream.on('message', e => {
        JSON.parse(e.data).forEach(e => {
          if (e.event === 'update' && e.state) {
            self.emit('msg:'+self.valueMap[e.state.meta.id], {
              permission: e.state.type,
              data: e.state.data
            });
          }
        })
      });
    })()
    return this.sync;
  }

  async addValue(id, isNew, value) {
    this.addedValues[id] = {obj: value, isNew: isNew};
    await this.sync;

    this.sync = (async () => {
      if (Object.keys(this.addedValues).length === 0) {
        return;
      }

      let self = this;
      let values = this.addedValues;
      this.addedValues = {};
      let col = this.device.get('value');
      let oldValueModels = new this.wappsto.models.Device({value: col.reset()}).get('value');
      let anyExistingValues = Object.keys(this.values).length === 0;

      let requestValueObj = (k, v) => {
        return new Promise((resolve, reject) => {
          self.wappsto.get('value', {type: v.obj.type}, {
            quantity: 1,
            expand: 5,
            error: (col, XHRResponse) => {},
            success: (col, response, XHRResponse) => {
              v.model = col.get('0');
              v.model.get('state').forEach(e => self.valueMap[e.get('meta.id')] = k);
              resolve();
            }
          });
        });
      }

      for (let [k, v] of Object.entries(values)) {
        if (this.values[k]) {
          if (v.isNew) {
            if (this.values[k].isNew) {
              let value = v.obj;
              let oldValue = this.values[k].model;
              let oldStateModels = {};
              oldValue.get('state').reset().forEach(e => oldStateModels[e.get('type')] = e);

              v.state = value.state.map(e => {
                let model = oldStateModels[e.type];
                if (model) {
                  e.meta = model.get('meta');
                  delete oldStateModels[e.type];
                }
                return e;
              })

              try {
                let remove = Object.values(oldStateModels).map(e => e.destroy());
                await Promise.all(remove);
              } catch (e) {
                throw 'State(s) not deleted.';
              }

              value.meta = oldValue.get('meta');
              v.model = new this.wappsto.models.Value(value);
              col.push(v.model);
            } else {
              await this.values[k].model.destroy();
              v.model = col.push(v.obj);
            }
          } else if (!v.isNew && this.values[k].isNew) {
            v.model = requestValueObj(k, v);
          } else {
            v.model = this.values[k].model;
          }
        } else {
          if (v.isNew) {
            if (anyExistingValues) {
              let val = JSON.parse(JSON.stringify(v.obj));
              delete val.state;
              let found = oldValueModels.find(val);
              if (!found) {
                let value = new this.wappsto.models.Value(v.obj);
                v.model = col.push(value);
                value = await value.save();
              } else {
                v.model = col.push(found);
              }
            } else {
              let value = new this.wappsto.models.Value(v.obj);
              v.model = col.push(value);
              value = await value.save();
            }
          } else {
            v.model = requestValueObj(k, v);
          }
        }
      }

      if (anyExistingValues) {
        let keep = col.toJSON().reduce((arr, e) => {
          return e.meta && arr.push(e.meta.id) && arr;
        }, []);
        let rm = oldValueModels.map(e => e.get('meta.id')).filter(e => !keep.includes(e));
        for (let e of rm) { // await oldValueModels.get(e).destroy();
          await this.http.delete('device/'+this.device.get('meta.id')+'/value/'+e, {
            headers: {'X-Session': this.sessionApp}
          });
        }
      } else {
        for (let [k, v] of Object.entries(this.values)) {
          if (!values[k]) {
            values[k] = v;
          }
        }
      }

      try { // await this.device.save(this.device.toJSON(), {merge: false});
        var device = await this.http.put(
          'device/'+this.device.get('meta.id')+'?expand=5',
          this.device.toJSON(),
          {headers: {'X-Session': this.sessionApp}}
        );
        device = device.body;
      } catch (e) {
        throw 'Device object not updated.';
      }

      this.valueMap = {};
      for (let [k, v] of Object.entries(values)) {
        if (v.model.get) {
          v.model.get('state').forEach(e => this.valueMap[e.get('meta.id')] = k);
        }
      }

      this.device = await this.device.fetch();
      this.values = values;
    })();
  }

  async removeValue(id, v) {
    let value = v || this.values[id];
    delete this.values[id];
    if (value && value.model) {
      try {
        await this.http.delete('/value/'+value.model.get('meta.id'), {
          headers: {'X-Session': this.sessionApp}
        });
      } catch (e) {
        console.error("Old value not deleted.");
      }
    }
    return Object.keys(this.values).length === 0;
  }

  async changeState(opts) {
    if (this.values[opts.id].model instanceof Promise) {
      throw 'Waiting for the value object';
    }

    let state = this.values[opts.id].model.get('state').find({
      type: opts.permission === 'r' ? 'Report' : 'Control'
    });

    if (state) {
      try { // return state.save({data: ''+opts.body}, {patch: true})
        this.http.patch('state/'+state.get('meta.id'), {data: ''+opts.body}, {
          headers: {'X-Session': this.sessionApp}
        })
      } catch (e) {
        throw 'Could not send data.';
      }
    } else {
      throw `State object of type '${opts.permission}' not found.`;
    }
  }

  async upload(data) {
    let versionID = this.versionID;
    let files = {};

    let create = async name => {
      let {body} = await this.http.post(
        'version/'+versionID+'/file',
        {name: name, use: 'background'}
      );
      return body.meta.id;
    }

    let url = 'version/'+versionID+'/file?this_use=background&expand=1';
    Object.keys(data).forEach(e => url+'&this_name='+e);
    let {body} = await this.http.get(url);
    body.forEach(e => files[e.name] = e.meta.id);

    for (let e of Object.keys(data)) {
      if (!files[e]) {
        files[e] = await create(e);
      }
    }

    let http = new HTTP({
      baseUrl: this.http.baseUrl.split('/services')[0],
      sessionID: await this.http.getSession(),
      prefix: '/files'
    })

    for (let [k, e] of Object.entries(files)) {
      await http.put('file/'+e, data[k]);
    }
  }

  async createInstallation() {
    await this.http.getSession();
    let {body} = await this.http.post('application', {
      version: [{
        name: 'Node-RED',
        supported_features: ['foreground', 'background']
      }]
    });
    body = await this.http.post('installation', {
      application: body.version[0].meta.id
    });
    return body.body.meta.id;
  }
}
