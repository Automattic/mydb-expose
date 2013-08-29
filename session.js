
/**
 * Module dependencies.
 */

var debug = require('debug')('mydb-expose:session');

/**
 * Module exports.
 */

module.exports = Session;

/**
 * Noop.
 */

function noop(){}

/**
 * Session.
 *
 * @param {monk.Collections} collection
 * @param {ServerRequest} request
 * @api public
 */

function Session(col, req){
  // prefix to minimize collisions with keys
  this.$col = col;
  this.$req = req;
  this.$qry = {};
  this.$keys = [];

  // copy properties from the original session
  for (var i in req.session){
    if ('_csrf' == i) continue;
    if (!this[i]) this[i] = req.session[i];
  }
}

/**
 * Checks for dirty state.
 *
 * @return {Boolean}
 * @api public
 */

Session.prototype.$dirty = function(){
  return Object.keys(this.$qry).length > 0;
};

/**
 * Buffers a given query.
 *
 * @param {String} operation
 * @param {Object} operation obj
 * @api private
 */

Session.prototype.$buffer = function(op, obj){
  this.$qry[op] = this.$qry[op] || {};
  for (var i in obj) this.$qry[op][i] = obj[i];
};

/**
 * Populates the object.
 *
 * @param {Function} callback
 * @api private
 */

Session.prototype.reload = function(fn){
  fn = fn || noop;
  var self = this;
  var qry = { sid: this.$req.originalSession.id };
  var set = {
    sid: this.$req.originalSession.id,
    active_at: new Date,
    user_agent: this.$req.headers['user-agent'],
    state: 'online'
  };
  var opts = { upsert: true };
  debug('reload %s', qry.sid);
  this.$col.findAndModify(qry, { $set: set }, opts, function(err, obj){
    if (err) return fn(err);
    var keys = self.$keys;
    for (var i = 0; i < keys.length; i++) delete self[keys[i]];
    for (var i in obj) self[i] = obj[i];
    self.$keys = Object.keys(obj);
    debug('reloaded with %j', obj);
    fn(null);
  });
};

/**
 * Saves the document by performing the buffered operations.
 *
 * @api private
 */

Session.prototype.save = function(fn){
  fn = fn || noop;
  if (!this._id) return fn(new Error('Session not properly loaded'));
  debug('saving');
  this.$query(this.$qry, fn);
};

/**
 * Regenerates the original session.
 *
 * @param {Function} callback
 * @api public
 */

Session.prototype.regenerate = function(fn){
  fn = fn || noop;
  var self = this;
  this.$qry = {};
  debug('regenerating');
  this.$req.originalSession.regenerate(function(err){
    if (err) return fn(err);
    self.reload(fn);
  });
  return this;
};

/**
 * Runs a query directly.
 *
 * @param {Object} query
 * @param {Function} callback
 * @api private
 */

Session.prototype.$query = function(qry, fn){
  if (!this._id) return fn(new Error('Session not properly loaded'));
  this.$col.update(this._id, qry, fn);
};

/**
 * Sets `key` to `val`.
 *
 * @param {String} key
 * @param {Object} value
 * @param {Function} optional, callback
 * @api public
 */

Session.prototype.set = function(key, val, fn){
  var op = {};
  op[key] = val;

  if (fn) {
    debug('set %s : %j', key, val);
    this.$query({ $set: op }, fn);
  } else {
    debug('buffered set %s : %j', key, val);
    this.$buffer('$set', op);
  }

  return this;
};

/**
 * Pops `key`.
 *
 * @param {String} key
 * @param {Function} optional, callback
 * @api public
 */

Session.prototype.pop = function(key, fn){
  var op = {};
  op[key] = 1;

  if (fn) {
    debug('pop %s', key);
    this.$query({ $pop: op }, fn);
  } else {
    debug('buffered pop %s', key);
    this.$buffer('$pop', op);
  }

  return this;
};

/**
 * Shifts `key`.
 *
 * @param {String} key
 * @param {Function} optional, callback
 * @api public
 */

Session.prototype.shift = function(key, fn){
  var op = {};
  op[key] = -1;

  if (fn) {
    debug('shift %s', op);
    this.$query({ $pop: op }, fn);
  } else {
    debug('buffered shift %s', op);
    this.$buffer('$pop', op);
  }

  return this;
};

/**
 * Unsets `key`.
 *
 * @param {String} key to unset
 * @Param {Function} callback
 * @api public
 */

Session.prototype.unset = function(key, fn){
  var op = {};
  op[key] = 1;

  if (fn) {
    debug('unset %s', key);
    this.$query({ $unset: op }, fn);
  } else {
    debug('buffered unset %s', key);
    this.$buffer('$unset', op);
  }

  return this;
};

/**
 * Renames `key` to `key2`.
 *
 * @param {String} key to be renamed
 * @param {String} new key name
 * @param {Functio} optional, callback
 * @api private
 */

Session.prototype.rename = function(key, key2, fn){
  var op = {};
  op[key] = key2;

  if (fn) {
    debug('rename %s to %s', key, key2);
    this.$query({ $rename: op }, fn);
  } else {
    debug('buffered rename %s to %s', key, key2);
    this.$buffer('$rename', op);
  }

  return this;
};

/**
 * Pushes `val` to `key`.
 *
 * @param {String} key
 * @param {Object} value to push
 * @param {Function} optional, callback
 * @api public
 */

Session.prototype.push = function(key, val, fn){
  var op = {};
  op[key] = val;

  if (fn) {
    debug('push %s %j', key, val);
    this.$query({ $push: op }, fn);
  } else {
    debug('buffered push %s %j', key, val);
    this.$buffer('$push', op);
  }

  return this;
};

/**
 * Pushes `val` to `key` (set).
 *
 * @param {String} key
 * @param {Object} value to push
 * @param {Function} optional, callback
 * @api public
 */

Session.prototype.addToSet = function(key, val, fn){
  var op = {};
  op[key] = val;

  if (fn) {
    debug('add to set %s %j', key, val);
    this.$query({ $addToSet: op }, fn);
  } else {
    debug('buffered add to set %s %j', key, val);
    this.$buffer('$addToSet', op);
  }

  return this;
};

/**
 * Pushes `vals` to `key`.
 *
 * @param {String} key
 * @param {Array} value to push
 * @param {Function} optional, callback
 * @api public
 */

Session.prototype.pushAll = function(key, vals, fn){
  var op = {};
  op[key] = vals;

  if (fn) {
    debug('push all %s %j', key, vals);
    this.$query({ $pushAll: op }, fn);
  } else {
    debug('buffered push all %s %j', key, vals);
    this.$buffer('$pushAll', op);
  }

  return this;
};

/**
 * Pulls `val` from `key`.
 *
 * @param {String} key
 * @param {Object} value to push
 * @param {Function} optional, callback
 * @api public
 */

Session.prototype.pull = function(key, val, fn){
  var op = {};
  op[key] = val;

  if (fn) {
    debug('pull %s %j', key, val);
    this.$query({ $pull: op }, fn);
  } else {
    debug('buffered pull %s %j', key, val);
    this.$buffer('$pull', op);
  }

  return this;
};

/**
 * Pulls `vals` from `key`.
 *
 * @param {String} key
 * @param {Array} values to push
 * @param {Function} optional, callback
 * @api public
 */

Session.prototype.pullAll = function(key, vals, fn){
  var op = {};
  op[key] = vals;

  if (fn) {
    debug('pull all %s %j', key, vals);
    this.$query({ $pullAll: op }, fn);
  } else {
    debug('buffered pull all %s %j', key, vals);
    this.$buffer('$pullAll', op);
  }

  return this;
};

/**
 * Return JSON representation.
 *
 * @return {Object}
 * @api public
 */

Session.prototype.toJSON = function(){
  var obj = {};

  for (var key in this) {
    if (!this.hasOwnProperty(key)) continue;
    if ('$' == key[0]) continue;
    obj[key] = this[key];
  }

  return obj;
};
