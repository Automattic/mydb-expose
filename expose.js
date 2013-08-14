
/**
 * Module dependencies.
 */

var qs = require('querystring');
var url = require('url');
var uid = require('uid2');
var http = require('http');
var crypto = require('crypto');
var request = require('superagent');
var Session = require('./session');
var debug = require('debug')('mydb-expose');

/**
 * Module exports.
 */

module.exports = Expose;

/**
 * Expose constructor.
 *
 * @param {Function} url getter
 * @param {String} mydb secret
 * @param {Monk.Collection} sessions collection
 * @param {String|Array|Object} session fields to expose
 * @api public
 */

function Expose(url, secret, sessions, expose){
  this.url = url;
  this.secret = secret;
  this.sessions = sessions;
  this.sessionExpose = expose;
}

/**
 * Returns the overriden `end`.
 *
 * @return {Function} end
 * @api private
 */

Expose.prototype.end = function(){
  var req = this.req;
  var res = this.res;
  var end = this.res.end;
  var next = this.next;

  return function(data, encoding){
    res.end = end;

    if (req.session && req.session.$dirty()) {
      req.session.save(done);
    } else {
      done();
    }

    function done(err){
      if (err) return next(err);
      if (req.originalSession) {
        debug('restoring original session');
        req.session = req.originalSession;
      }
      res.end(data, encoding);
    }
  };
};

/**
 * Returns the overriden `send`.
 *
 * @return {Function} send
 * @api private
 */

Expose.prototype.send = function(){
  var req = this.req;
  var res = this.res;
  var subscribe = req.subscribe;
  var send = res.send;
  var next = req.next;
  var self = this;

  return function(data){
    res.send = send;

    if ('object' == typeof data && data.fulfill) {
      debug('handling res#send promise');
      if (req.get('X-MyDB-SocketId')) {
        debug('mydb - subscribing');
        data.on('complete', function(err, doc){
          if (err) return next(err);
          if (!doc || !doc._id) return res.send(404);
          subscribe(doc._id, data.opts.fields, function(err, id){
            if (err) return next(err);
            if (id == req.get('X-MyDB-Id')) {
              debug('subscription id matches one provided by client');
              res.send(304);
            } else {
              debug('sending new subscription with document');
              res.set('X-MyDB-Id', id);
              res.send(doc);
            }
          });
        });
      } else {
        debug('no mydb - not subscribing');
        data.once('complete', function(err, doc){
          if (err) return next(err);
          if (!doc) return res.send(404);
          res.send(doc);
        });
      }
    } else {
      res.send.apply(res, arguments);
    }
  };
};

/**
 * Fetches a document from a promise.
 *
 * @return {Function} send
 * @api private
 */

Expose.prototype.subscribe = function(){
  var req = this.req;
  var res = this.res;
  var send = res.send;
  var next = req.next;
  var self = this;

  /**
   * Subscribe.
   *
   * @param {String|ObjectId|Promise} data
   * @param {String|Array|Object} fields (optional)
   * @param {Function} callback (optional)
   * @api public
   */

  return function subscribe(data, fields, fn){
    if ('function' == typeof fields) {
      fn = fields;
      fields = null;
    }

    if (data.fulfill) {
      data.on('complete', function(err, doc){
        if (err) return fn(err);
        if (!doc) return fn(new Error('Not found'));
        to(doc._id, fields || data.opts.fields);
      });
    } else {
      to(data);
    }

    function to(id){
      id = id.toString();
      self.createSubscription(req.mydb_socketid, id, fields, fn);
    }
  };
};

/**
 * Subscribes to the given document.
 *
 * @param {String} socketid
 * @param {ObjectId|String} doc oid
 * @Param {String} socketid
 * @param {Object|String|Array} fields
 * @param {Function} callback
 * @api private
 */

Expose.prototype.createSubscription = function(socketid, id, fields, fn){
  fields = fields || {};
  var qry = {};

  // document id
  qry.document_id = id;

  // document fields
  fields = toFields(fields);
  if (Object.keys(fields).length) qry.fields = fields;

  // client sid
  qry.socket_id = socketid;

  // subscription id is a hash of fields/oid
  var ffs = JSON.stringify(order(fields || {}));
  var sid = qry.subscription_id = md5(socketid + '.' + id + '.' + ffs);

  // publish
  var data = JSON.stringify(qry);
  var start = Date.now();
  var req = request
  .post(this.url.call(this) + '/mydb/subscribe')
  .set('Content-Type', 'application/json')
  .set('X-MyDB-Signature', sign(data, this.secret))
  .send(data)
  .end(function(err, res){
    if (err) {
      debug('socket error');
      return fn(err);
    }

    if (res.error) {
      debug('subscription error %j', res.error);
      return fn(res.error);
    }

    debug('mydb subscribe took %d', Date.now() - start);
    fn(null, sid);
  });
};

/**
 * Returns the overriden `session`.
 *
 * @return {MyDBSession} session object
 */

Expose.prototype.sess = function(){
  var session = new Session(this.sessions, this.req);
  this.req.originalSession = this.req.session;
  return session;
};

/**
 * Connect middleware.
 *
 * @param {ServerRequest} request
 * @param {ServerResponse} response
 * @return {Function} middleware
 * @api private
 */

Expose.prototype.middleware = function expose(req, res, next){
  // prevent double middleware
  if (req.mydb) {
    debug('skipping - mydb-expose already mounted');
    return next();
  }

  var self = this;

  // setup shortcut to instance
  req.mydb = res.mydb = this;

  // keep track of req and res objects
  this.req = req;
  this.res = res;
  this.next = next;

  // setup overrides
  res.subscribe = req.subscribe = this.subscribe();
  res.end = this.end();
  res.send = this.send();

  // generate a socketid if one is not set
  req.mydb_socketid = req.get('X-MyDB-SocketId');
  if (!req.mydb_socketid) {
    debug('creating new socketid');
    uid(12, function(err, id) {
      if (err) return next(err);
      req.mydb_socketid = id;
      done();
    });
  } else {
    debug('using socketid provided with request');
    done();
  }

  function done(){
    if (req.session) {
      // session object
      req.session = self.sess();

      // populates the session and moves on
      req.session.reload(function(err){
        if (err) return next(err);
        self.routes(next);
      });
    } else {
      debug('no session - skipping');
      next();
    }
  }
};

/**
 * Introduce mydb-expose routes.
 *
 * @param {Function} next
 * @api private
 */

Expose.prototype.routes = function(next){
  if (/^\/session\/?(\?.*)?$/.test(this.req.url) && 'GET' == this.req.method) {
    var col = this.sessions;
    var sid = this.req.session._id;
    var pro = col.findOne(sid, this.sessionExpose);
    this.res.send(pro);
  } else {
    next();
  }
};

/**
 * Returns the connect middleware.
 *
 * @api private
 */

Expose.prototype.fn = function(){
  return this.middleware.bind(this);
};

/**
 * MD5 helper.
 *
 * @param {String} text
 * @api private
 */

function md5(text){
  return crypto.createHash('md5')
  .update(text)
  .digest('hex');
}

/**
 * Orders an object.
 *
 * @api private
 */

function order(o){
   var a = [], i;

   for (i in o) {
     if (o.hasOwnProperty(i)) {
       a.push([i,o[i]]);
     }
   }

   a.sort(function(a,b){
     return a[0] > b[0] ? 1 : -1;
   });

   return a;
}

/**
 * Fields argument helper.
 *
 * @param {String|Array|Object} fields
 * @api private
 */

function toFields(obj) {
  if (!Array.isArray(obj) && 'object' == typeof obj) {
    return obj;
  }

  var fields = {};
  obj = 'string' == typeof obj ? obj.split(' ') : (obj || []);

  for (var i = 0, l = obj.length; i < l; i++) {
    if ('-' == obj[i][0]) {
      fields[obj[i].substr(1)] = 0;
    } else {
      fields[obj[i]] = 1;
    }
  }

  return fields;
}

/**
 * HMac signing helper.
 *
 * @param {String} data
 * @param {String} secret
 * @api private
 */

function sign(data, secret){
  return crypto
  .createHmac('sha1', secret)
  .update(data)
  .digest('hex');
}
