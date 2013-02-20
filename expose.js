
/**
 * Module dependencies.
 */

var Session = require('./session');
var qs = require('querystring');
var url = require('url');
var hash = require('crypto').createHash;
var uid = require('uid2');
var debug = require('debug')('mydb-expose');

/**
 * Module exports.
 */

module.exports = Expose;

/**
 * Expose constructor.
 *
 * @param {RedisClient} redis client
 * @param {Monk.Manager} mongodb client
 * @param {String|Array|Object} session fields to expose
 * @api public
 */

function Expose(redis, mongo, expose){
  this.redis = redis;
  this.mongo = mongo;
  this.sessions = mongo.get('sessions');
  this.sessions.index('sid');
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

    if (req.session.$dirty()) {
      req.session.save(done);
    } else {
      done();
    }

    function done(err){
      if (err) return next(err);
      req.session = req.originalSession;
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
  var send = res.send;
  var next = req.next;
  var self = this;

  return function(data){
    res.send = send;

    if ('object' == typeof data && data.fulfill) {
      debug('handling res#send promise');
      if (req.get('X-MyDB-SocketId')) {
        debug('mydb - subscribing');
        self.subscribe(data, function(err, doc, id){
          if (err) {
            if ('Not found' == err.message) {
              debug('doc not found - sending 404');
              return res.send(404);
            } else {
              return next(err);
            }
          }

          if (id == req.get('X-MyDB-Id')) {
            debug('subscription id matches one provided by client');
            res.send(304);
          } else {
            debug('sending new subscription with document');
            res.set('X-MyDB-Id', id);
            res.send(doc);
          }
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
 * @param {Promise} promise
 * @param {Function} callback
 * @api public
 */

Expose.prototype.subscribe = function(promise, fn){
  var self = this;
  promise.once('complete', function(err, doc){
    if (err) return fn(err);
    if (!doc || !doc._id) return fn(new Error('Not found'));
    self.doSubscribe(
      promise.col.name,
      doc._id,
      promise.opts.fields,
      function(err, sid){
        if (err) return fn(err);
        fn(null, doc, sid);
      }
    );
  });
};

/**
 * Subscribes to the given document.
 *
 * @param {String} collection name
 * @param {ObjectId|String} doc oid
 * @Param {String} socketid
 * @param {Object} fields
 * @param {Function} callback
 * @api private
 */

Expose.prototype.doSubscribe = function(col, id, fields, fn){
  fields = fields || {};
  var qry = {};

  // document id
  qry.i = id;

  // document fields
  if (Object.keys(fields).length) qry.f = fields;

  // client sid
  qry.s = this.socketid;

  // subscription id is a hash of fields/oid
  var ffs = JSON.stringify(order(qry.f)).toLowerCase();
  var sid = qry.h = md5(id + '.' + ffs);

  // publish
  var data = JSON.stringify(qry);
  this.redis.publish('MYDB_SUBSCRIBE', data, function(err){
    if (err) return fn(err);
    debug('created subscription "%s" for doc "%s" with fields %j', sid, id, fields);
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

  // setup shortcut to instance
  req.mydb = res.mydb = this;

  // keep track of req and res objects
  this.req = req;
  this.res = res;
  this.next = next;

  // generate a socketid if one is not set
  this.socketid = req.get('X-MyDB-SocketId');
  if (!this.socketid) {
    this.socketid = uid(20);
  }

  // setup overrides
  res.end = this.end();
  res.send = this.send();

  if (req.session) {
    // session object
    req.session = this.sess();

    // populates the session and moves on
    var self = this;
    req.session.reload(function(err){
      if (err) return next(err);
      self.routes(next);
    });
  } else {
    debug('no session - skipping');
    next();
  }
};

/**
 * Introduce mydb-expose routes.
 *
 * @param {Function} next
 * @api private
 */

Expose.prototype.routes = function(next){
  if (/^\/session\/?(\?.*)?$/.test(this.req.url)) {
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
  return hash('md5').update(text).digest('hex');
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
