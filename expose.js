
/**
 * Module dependencies.
 */

var Session = require('./session')
  , hash = require('crypto').createHash
  , debug = require('debug')('mydb-expose');

/**
 * Module exports.
 */

module.exports = Expose;

/**
 * Expose constructor.
 *
 * @param {RedisClient} redis client
 * @param {Monk.Manager} mongodb client
 * @api public
 */

function Expose(redis, mongo){
  this.redis = redis;
  this.mongo = mongo;
  this.sessions = mongo.col('sessions');
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

  return function end(data, encoding){
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
  var next = res.next;
  var self = this;

  return function send(data){
    res.send = send;

    if ('object' == typeof data && data.fulfill) {
      data.once('complete', function(err, doc){
        if (err) return next(err);
        if (null != req.query.my) {
          if (!doc._id) return res.send(501);
          self.subscribe(doc._id, function(err, id){
            if (err) return next(err);
            res.send(id);
          });
        } else {
          res.send(data);
        }
      });
    } else {
      res.send.apply(res, arguments);
    }
  };
};

/**
 * Subscribes to the given document.
 *
 * @param {ObjectId|String} doc oid
 * @param {Function} callback
 * @api private
 */

Expose.prototype.subscribe = function(id, fn){
  var sid = rand();
  this.redis.setex(sid, 60 * 60 * 24, id, function(err){
    if (err) return fn(err);
    debug('created subscription with id "%s" for doc "%s"', sid, id);
    fn(null, sid);
  });
};

/**
 * Returns the overriden `session`.
 *
 * @return {MyDBSession} session object
 */

Expose.prototype.sess = function(){
  var session = new Session(this.monk, this.req);
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
  if (!res.session) throw new Error('Missing `connect#session`.');

  // keep track of req and res objects
  this.req = req;
  this.res = res;
  this.next = next;

  // setup overrides
  res.end = this.end();
  res.send = this.send();
  req.session = this.sess();

  // setup shortcut to instance
  req.mydb = res.mydb = this;

  // populates the session and moves on
  req.session.reload(this.routes.bind(this, next));
};

/**
 * Introduce mydb-expose routes.
 *
 * @param {Function} next
 * @api private
 */

Expose.prototype.routes = function(next){
  if (/^\/session\/?(\?.*)?$/.test(this.req.url)) {
    this.send(this.sessions.findOne(this.session._id));
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
 * Returns a random id for the subscription.
 *
 * @api private
 */

function rand(){
  var entropy = Date.now() + Math.random();
  return hash('md5').update(entropy).digest('hex');
}
