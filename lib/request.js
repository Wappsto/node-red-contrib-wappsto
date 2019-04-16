const url = require('url');
const axios = require('axios');
const baseUrl = 'https://wappsto.com';

const urls = [
  baseUrl,
  'http://rest-service',
  'https://dev.wappsto.com',
  'https://qa.wappsto.com'
];

const _email = Symbol('email');
const _password = Symbol('password');
const _http = Symbol('http')

module.exports = class HTTP {
  constructor(opts) {
    this.sessionID = opts.sessionID;
    this[_email] = opts.email;
    this[_password] = opts.password;

    var url = new URL(opts.baseUrl || baseUrl).origin;
    if (urls.includes(url)) {
      this.baseUrl = url+(opts.prefix || '/services'),
      this[_http] = axios.create({
        baseURL: this.baseUrl,
        timeout: 5000,
        responseType: 'json',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      if (this.sessionID) {
        this[_http].defaults.headers['X-Session'] = this.sessionID;
      }
    } else {
      throw `Incorrect URL: ${url}.`
    }
  }

  async getSession() {
    if (!this.sessionID) {
      try {
        var {code, body} = await this.post('session', {
          username: this[_email],
          password: this[_password]
        })
        this.sessionID = body.meta.id;
        this[_http].defaults.headers['X-Session'] = body.meta.id;
      } catch (err) {
        throw 'Wrong credentials.'
      }
    }
    return this.sessionID;
  }

  async get(url, options={}) {
    try {
      var {status, data} = await this[_http].get(url, options);
      return {code: status, body: data};
    } catch (res) {
      return Promise.reject({code: res.response.status, body: res.response.data});
    }
  }

  async post(url, data, options={}) {
    try {
      var {status, data} = await this[_http].post(url, data, options);
      return {code: status, body: data};
    } catch (res) {
      return Promise.reject({code: res.response.status, body: res.response.data});
    }
  }

  async put(url, data, options={}) {
    try {
      var {status, data} = await this[_http].put(url, data, options);
      return {code: status, body: data};
    } catch (res) {
      return Promise.reject({code: res.response.status, body: res.response.data});
    }
  }

  async patch(url, data, options={}) {
    try {
      var {status, data} = await this[_http].patch(url, data, options);
      return {code: status, body: data};
    } catch (res) {
      return Promise.reject({code: res.response.status, body: res.response.data});
    }
  }

  async delete(url, options={}) {
    try {
      var {status, data} = await this[_http].delete(url, options);
      return {code: status, body: data};
    } catch (res) {
      return Promise.reject({code: res.response.status, body: res.response.data});
    }
  }
};
