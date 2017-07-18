var kafka = require('kafka-node');
var _ = require('lodash');
var Promise = require('bluebird');
var Redis = require('../models/redis');

var OP = {
  c: 'create',
  u: 'update',
  d: 'delete',
};

var DEFAULTS = {
  topics: ['dbserver1.kafka.user', 'modification-device'],
  options: {
    host: 'zookeeper:2181',
    zk: undefined,
    batch: undefined,
    ssl: true, // TODO : later
    id: 'consumer1',
    consumerId: null,
    groupId: 'exampletestgroup',
    protocol: ['roundrobin'],
    fromOffset: 'latest', // default
    outOfRangeOffset: 'earliest', //default
    migrateHLC: false,
    migrateRolling: true,
  },
  db: {
    'db': 'redis',
    'cluster': false,
    'options': [{ 'host': 'localhost', 'port': '6379' }],
  },
};

/** synchronize change event to redis
 * @param payload
 */
function sync(payload, redis) {

  /* parse payload
     a. table (default db)
     b. operation */
  var operation = OP[payload.op] + payload.source.table;
  var uid = '';
  var args = {};
  var userInfo = {};
  var did = '';
  var mac = '';
  var accessLevel = '';
  var oldValue = [];
  var newValue = {};
  var gid = '';
  var ops = [];
  console.log('Operation:  ' + operation + '.');

  /* redis modification */
  var promiseRes;
  switch (operation) {

    /*********************Users************************/
    case 'createUsers':
      uid = payload.after.uid;
      var pickArr = ['username', 'password', 'email', 'phone', 'create_at', 'password_salt'];
      pickArr.push('configuration');
      pickArr.push('config_ts');
      args =  _.pick(payload.after, pickArr);
      userInfo = args;
      promiseRes = new Promise(function (resolve, reject) {

    if (!(uid && userInfo)) {
      return reject(new Error('save fail')); 
    }
    ops = [redis.hmsetByObj(`User_Hash:${uid}`, userInfo)];
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

     // promiseRes = redis.saveUser(uid, userInfo, args);
      break;
    case 'updateUsers':
      uid = payload.after.uid;
      args = {};
      oldValue = [];
      newValue = {};
      _.forOwn(payload.after, function (value, key) {
        if (payload.before[key] !== value) {
          _.assign(args, _.pick(payload.after, key));
          if (key === 'username' || key === 'email' || key === 'phone') {
            newValue[value] = uid;
            if (payload.before[key] !== null) {
              oldValue.push(payload.before[key]);
            }

          }

        }

      });

      ops = [
        redis.hmsetByObj('User_Hash:' + uid, args),
      ];
      if (JSON.stringify(newValue) !== '{}') {
        ops.push(redis.hmsetByObj('Name2Uid_Hash', newValue));
        if (oldValue.toString() !== '') {
          ops.push(redis.hdel('Name2Uid_Hash', oldValue));
        }

      }

      promiseRes = new Promise.all(ops);
      break;
    case 'deleteUsers':
      uid = payload.before.uid;
      ops = [redis.del('User_Hash:' + uid)]; //  delete Hash User_Hash:${uid}
      oldValue = [];
      _.forOwn(_.pick(payload.before, ['username', 'phone', 'email']), function (value, key) {
        oldValue.push(value);
      });

      if (JSON.stringify(oldValue) !== '[]') {
        ops.push(redis.hdel('Name2Uid_Hash', oldValue));
      }

      promiseRes = new Promise.all(ops);
      break;

    /*********************Devices************************/
    case 'createDevices':
      did = payload.after.did;
      mac = payload.after.mac;
      var deviceAttri = _.pick(payload.after,
        ['name', 'product_key', 'mac', 'MQTT_host', 'passcode']);
      promiseRes = redis.hmgetall2Obj('Mac2DidAll_Hash', mac)
        .then(function (reply) {
          var didsStr = reply[mac];
          if (didsStr) { // didsStr = didsStr ? didsStr + ':' + did : did;
            didsStr = didsStr + ':' + did;
          } else {
            didsStr = did;
          }

          var mac2did = {};
          mac2did[mac] = did;
          var mac2didall = {};
          mac2didall[mac] = didsStr;
          ops = [
            redis.hmsetByObj('Mac2Did_Hash', mac2did),
            redis.hmsetByObj('Device_Hash:' + did, deviceAttri),
            redis.hmsetByObj('Mac2DidAll_Hash', mac2didall),
          ];
          return Promise.all(ops);
        });

      break;
    case 'updateDevices':
      did = payload.after.did;
      args = {};
      _.forOwn(payload.after, function (value, key) {
        if (payload.before[key] !== value) {
          _.assign(args, _.pick(payload.after, key));
        }

      });

      args = _.pick(args, ['name', 'product_key', 'MQTT_host', 'passcode']);
      promiseRes = redis.hmsetByObj('Device_Hash:' + did, args);
      break;
    case 'deleteDevices':
      did = payload.before.did;
      mac = payload.before.mac;
      ops = [
        redis.del('Device_Hash:' + did), // delete Hash Device_Hash:${did}
        redis.hdel('Mac2Did_Hash', mac),
      ];
      promiseRes = new Promise.all(ops);
      break;

    /*******************User2Devices**********************/
    case 'createUser2Devices':
      uid = payload.after.uid;
      did = payload.after.did;
      accessLevel = payload.after.access_level;
      var user2devices = {};
      user2devices[did] = accessLevel;
      var device2users = {};
      device2users[uid] = accessLevel;
      ops = [
        redis.hmsetByObj('User2Devices_Hash:' + uid, user2devices),
        redis.hmsetByObj('Device2Users_Hash:' + did, device2users),
      ];
      promiseRes = new Promise.all(ops);
      break;
    case 'updateUser2Devices':
      uid = payload.after.uid;
      did = payload.after.did;
      ops = [];
      if (payload.after.access_level !== payload.before.access_level) {
        var newAccessLevel = payload.after.access_level;
        var fordid = {};
        fordid[did] = newAccessLevel;
        var foruid = {};
        foruid[uid] = newAccessLevel;
        ops.push(redis.hmsetByObj('User2Devices_Hash:' + uid, fordid));
        ops.push(redis.hmsetByObj('Device2Users_Hash:' + did, foruid));
      }

      // TODO : update name or other custome info
      args = {};
      _.forOwn(payload.after, function (value, key) {
        if (payload.before[key] !== value) {
          _.assign(args, _.pick(payload.after, key));
        }

      });

      args = _.pick(args, ['name', 'custome']);

      promiseRes = new Promise.all(ops);
      break;
    case 'deleteUser2Devices':
      uid = payload.before.uid;
      did = payload.before.did;
      ops = [
        redis.hdel('User2Devices_Hash:' + uid, did),
        redis.hdel('Device2Users_Hash:' + did, uid),
        redis.del('User2Devices_Hash:' + uid + ':' + did),
      ];
      promiseRes = new Promise.all(ops);
      break;

    /*********************Groups************************/
    case 'createGroups':
      gid = payload.after.gid;
      uid = payload.after.uid;
      var groupInfo = _.pick(payload.after, ['name', 'description', 'product_key']);
      ops = [
        redis.sadd('CtrlGroup_Set:' + uid, gid),
        redis.hmsetByObj('CtrlGroup_Hash:' + uid + ':' + gid, groupInfo),
      ];
      promiseRes = new Promise.all(ops);
      break;
    case 'updateGroups':
      gid = payload.after.gid;
      uid = payload.after.uid;
      args = {};
      _.forOwn(payload.after, function (value, key) {
        if (payload.before[key] !== value) {
          _.assign(args, _.pick(payload.after, key));
        }

      });

      args = _.pick(args, ['name', 'product_key', 'description']);
      promiseRes = redis.hmsetByObj('CtrlGroup_Hash:' + uid + ':' + gid, args);
      break;
    case 'deleteGroups':
      gid = payload.before.gid;
      uid = payload.before.uid;
      ops = [
        redis.srem('CtrlGroup_Set:' + uid, gid),
        redis.del('CtrlGroup_Hash:' + uid + ':' + gid),
      ];
      promiseRes = new Promise.all(ops);
      break;

    /*********************Group2Devices************************/
    case 'createGroup2Devices':
      uid = payload.after.uid;
      gid = payload.after.gid;
      did = payload.after.did;
      ops = [
        redis.sadd('CtrlGroup2Devices_Set:' + uid + ':' + gid, did),
        redis.sadd('Device2CtrlGroups_Set:' + did, uid + ':' + gid),
      ];
      promiseRes = new Promise.all(ops);
      break;
    case 'deleteGroup2Devices':
      uid = payload.before.uid;
      gid = payload.before.gid;
      did = payload.before.did;
      ops = [
        redis.srem('CtrlGroup2Devices_Set:' + uid + ':' + gid, did),
        redis.srem('Device2CtrlGroups_Set:' + did, uid + ':' + gid),
      ];
      promiseRes = new Promise.all(ops);
      break;

    /*********************Developers************************/
    case 'createDevelopers':
    case 'updateDevelopers':
    case 'deleteDevelopers':
      if (payload.op === 'c') { // create
        var developerAttri = _.pick(payload.after,
          ['password', 'email', 'is_login', 'name', 'company_name', 'phone', 'company_address']);
        ops = [
          redis.sadd('Developer_Set', payload.after.developer_id),
          redis.hmsetByObj('Developer_Hash:' + payload.after.developer_id, developerAttri),
        ];
      } else if (payload.op === 'u') { // update
        args = {};
        _.forOwn(payload.after, function (value, key) {
          if (payload.before[key] !== value) {
            _.assign(args, _.pick(payload.after, key));
          }

        });

        args = _.pick(args,
          ['password', 'email', 'is_login', 'name', 'company_name', 'phone', 'company_address']);
        ops = [redis.hmsetByObj('Developer_Hash:' + payload.after.developer_id, args)];
      } else if (payload.op === 'd') { //delete
        ops = [
          redis.srem('Developer_Set', payload.before.developer_id),
          redis.del('Developer_Hash:' + payload.before.developer_id),
        ];
      }

      promiseRes = new Promise.all(ops);
      break;

    /*********************Products************************/
    case 'createProducts':
    case 'updateProducts':
    case 'deleteProducts':
      if (payload.op === 'c') { // create
        args = _.pick(payload.after,
          ['product_key', 'developer_email', 'developer_name', 'product_name', 'create_at',
            'com_method', 'product_type', 'conn_product_key', 'remark', 'datapoint', 'update_at',
          ]);
        ops = [
          redis.sadd('ProductKey_Set', payload.after.product_key),
          redis.hmsetByObj('Product_Hash:' + payload.after.product_key, args),
        ];
      } else if (payload.op === 'u') { // update
        args = {};
        _.forOwn(payload.after, function (value, key) {
          if (payload.before[key] !== value) {
            _.assign(args, _.pick(payload.after, key));
          }

        });

        args = _.pick(args,
          ['product_key', 'developer_email', 'developer_name', 'product_name', 'create_at',
            'com_method', 'product_type', 'conn_product_key', 'remark', 'datapoint', 'update_at',
          ]);
        ops = [redis.hmsetByObj('Product_Hash:' + payload.after.product_key, args)];
      } else if (payload.op === 'd') { //delete
        ops = [
          redis.srem('ProductKey_Set', payload.before.product_key),
          redis.del('Product_Hash:' + payload.before.product_key),
        ];
      }

      promiseRes = new Promise.all(ops);
      break;

    /*******************Developer2Products**********************/
    case 'createDeveloper2Pros':
      promiseRes = redis.zadd('ProductKey_SortedSet:' + payload.after.developer_id,
        payload.after.time, payload.after.product_key);
      break;
    case 'deleteDeveloper2Pros':
      promiseRes = redis.zrem('ProductKey_SortedSet:' + payload.before.developer_id,
        payload.before.product_key);
      break;

    /*********************OTAs************************/
    case 'createOTAs':
      args = _.pick(payload.after,
        ['name', 'type', 'directory', 'description', 'push_method',
        'hard_version', 'soft_version', 'is_pushing', 'product_key', 'file_name',
        'file_size', 'md5', 'pushed_devnum', 'pushed_alldevnum', 'kind_devnum',
        'using_devnum', 'time'
        ]);
      promiseRes = redis.hmsetByObj('OTA_Hash:' + payload.after.ota_id, args);
      break;
    case 'updateOTAs':
      args = {};
      _.forOwn(payload.after, function (value, key) {
        if (payload.before[key] !== value) {
          _.assign(args, _.pick(payload.after, key));
        }

      });

      args = _.pick(args,
        ['name', 'type', 'directory', 'description', 'push_method',
        'hard_version', 'soft_version', 'is_pushing', 'product_key', 'file_name',
        'file_size', 'md5', 'pushed_devnum', 'pushed_alldevnum', 'kind_devnum',
        'using_devnum', 'time'
        ]);
      promiseRes = redis.hmsetByObj('OTA_Hash:' + payload.after.ota_id, args);
      break;
    case 'deleteOTAs':
      promiseRes = redis.del('OTA_Hash:' + payload.before.ota_id);
      break;

    /*******************Product2OTAs**********************/
    case 'createProduct2OTAs':
      var ProductKey = payload.after.product_key;
      var hardVersion = payload.after.hard_version;
      var softVersion = payload.after.soft_version;
      var timeScore = payload.after.time;
      args = {};
      args[hardVersion] = softVersion;
      ops = [
        redis.zadd('OTA_SortedSet:' + ProductKey, timeScore, hardVersion),
        redis.zadd('OTA_SortedSet:' + ProductKey + ':' + hardVersion, timeScore, softVersion),
        redis.hmsetByObj('OTAPush_Hash:' + ProductKey, args),
      ];
      promiseRes = new Promise.all(ops);
      break;
    case 'deleteProduct2OTAs':
      var productKey = payload.before.product_key;
      var HardVersion = payload.before.hard_version;
      var SoftVersion = payload.before.soft_version;
      ops = [
        redis.zrem('OTA_SortedSet:' + productKey, HardVersion),
        redis.zrem('OTA_SortedSet:' + productKey + ':' + HardVersion, SoftVersion),
        redis.hdel('OTAPush_Hash:' + productKey, HardVersion),
      ];
      promiseRes = new Promise.all(ops);
      break;

    /*********************default************************/
    case 'updateProduct2OTAs':
    case 'updateGroup2Devices':
    case 'updateDeveloper2Products':
      promiseRes = new Promise(function (resolve, reject) {
        return resolve();
      });

      break;
    default:
      promiseRes = new Promise(function (resolve, reject) {
        return resolve();
      });

      break;
  }
  return promiseRes;
}

function consumption(message) {

  /* print message */
  console.log('                   ');
  console.log('coming message...');
  console.log('%s from Topic=%s Partition=%s Offset=%d',
    this.consumer.client.clientId,
    message.topic,
    message.partition,
    message.offset);

  /* get payload */
  var pld = JSON.parse(message.value);
  if (pld.payload === null) {
    console.log('Message : payload is null...');
  } else {
    var payload = {
      source: pld.payload.source,
      op: pld.payload.op,
      before: null,
      after: null,
    };

    switch (pld.payload.op) {
      case 'c': //create or insert
        if (pld.payload.before === null) {
          payload.after = pld.payload.after;
        }

        break;
      case 'u': //update
        if (pld.payload.before !== null && pld.payload.after !== null) {
          payload.before = pld.payload.before;
          payload.after = pld.payload.after;
        }

        break;
      case 'd': //delete
        if (pld.payload.after === null) {
          payload.before = pld.payload.before;
        }

        break;
      default: break;
    }

    /* make synchronization to redis */
    sync(payload, this.redis).catch(function (err) {
      console.log(err);
    });

  }
}

function Synchronizer(options) {

  this.consumer = {};
  this.options = _.defaults(options || {}, DEFAULTS);

}

Synchronizer.prototype.start = function () {
  var _this = this;
  var opt = this.options;

  /* create consumer */
  var ConsumerGroup = kafka.ConsumerGroup;
  var consumerGroup = new ConsumerGroup(opt.options, opt.topics);
  this.consumer = consumerGroup;

  /* redis connection */
  this.redis = new Redis(opt.db)._ioredis;

  /* connected */
  this.consumer.on('connect', function (){
   console.log('connected.');
  });
  /* listen on message */
  this.consumer.on('message', consumption.bind(_this));

  /* listen on error */
  this.consumer.on('error', function (err) {
    console.log(err);
  });

};

module.exports = Synchronizer;
