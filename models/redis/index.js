'use strict';

var Redis = require('ioredis');
var Promise = require('bluebird');
var _ = require('lodash');
var utils = require('../../lib/utils');
var moment = require('moment');

/* an ioredis wrapper class */
function Client(opts) {
  var _this = this;
  this.options = opts;
  this._ioredis = opts.cluster ?
    new Redis.Cluster(opts.options) :
    new Redis(opts.options[0]);
  this._ioredis.once('connect', function (err) {
    _this._ioredis.client('setname', `${process.pid}.db`);
  });

  var redis = this._ioredis;
  this._ioredis.hmsetByObj = function (key, args, callback) {
    if (typeof args !== 'object') {
      throw new Error('input error');
    }

    var map = {};
    Object.keys(args).forEach(function (attr) {
      map[attr] = JSON.stringify(args[attr]);
    });

    var op = redis.hmset(key, map);

    return utils.functionReturn(op, callback);
  };
}

Client.prototype.saveUser = function (uid, userInfo, args) {
  var redis = this._ioredis;
  var promiseRes = new Promise(function (resolve, reject) {

    if (!(uid && userInfo)) {
      return reject(new Error('save fail')); 
    }
    var ops = [redis.hmsetByObj(`User_Hash:${uid}`, userInfo)];
    var obj = {};

    if (args.username) {
      obj[args.username] = uid;
    } else if (args.email) {
      obj[args.emial] = uid;
    } else if (args.phone) {
      objs[args.phone] = uid; 
    }
    ops.push(redis.hmsetByObj('Name2Uid_Hash', obj));
    return Promise.all(ops);
  });
  return promiseRes;
}

module.exports = Client;
