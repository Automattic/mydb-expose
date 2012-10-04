
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
  var qry = { sid: this.req.sessionId };
  var opts = { upsert: true };
  this.col.findAndModify(qry, qry, opts, function(err, obj){
    if (err) return fn(err);
    var keys = this.$keys;
    for (var i = 0; i < keys.length; i++) delete self[keys[i]];
    for (var i in obj) self[i] = obj[i];
    self.$keys = Object.keys(obj);
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
  this.$col.update(this._id, function(err){
    if (err) return fn(err);
  });
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
  this.$req.originalSession.regenerate(function(err){
    if (err) return fn(err);
    self.reload(fn);
  });
  return this;
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
    this.query({ $set: op }, fn);
  } else {
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
    this.$query({ $pop: op }, fn);
  } else {
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
    this.query({ $pop: op }, fn);
  } else {
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
    this.$query({ $unset: op }, fn);
  } else {
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
    this.$query({ $rename: op }, fn);
  } else {
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
    this.$query({ $push: op }, fn);
  } else {
    this.$buffer('$push', op);
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
    this.$query({ $pushAll: op }, fn);
  } else {
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
    this.$query({ $pull: op }, fn);
  } else {
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
    this.$query({ $pullAll: op }, fn);
  } else {
    this.$buffer('$pullAll', op);
  }

  return this;
};
