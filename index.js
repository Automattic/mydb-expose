
/**
 * Module dependencies.
 */

var monk = require('monk')
  , redis = require('redis').createClient
  , Expose = require('./expose');

/**
 * Module exports.
 */

module.exports = mydb;

/**
 * Middleware.
 *
 * @api private
 */

function mydb(opts){
  opts = opts || {};

  // mongodb
  if ('object' != typeof opts.mongo) {
    opts.mongo = monk(opts.mongo || 'localhost:27017/mydb');
  }

  var sessions = opts.mongo.get('sessions');
  sessions.index('sid');

  // session exposed fields
  // XXX: move into `mydb-session`
  var sessionExpose = opts.sessionExpose || '-sid';

  // create middleware
  return function(req, res, next){
    var expose = new Expose(opts.redis, sessions, sessionExpose);
    expose.middleware(req, res, next);
  };
}
