
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

  // redis
  if ('object' != typeof opts.redis) {
    opts.redis = opts.redis || 'localhost:6379';
    var pieces = opts.redis.split(':');
    var port = pieces.pop();
    var host = pieces.pop();
    opts.redis = redis(port, host);
  }

  // mongodb
  if ('object' != typeof opts.mongo) {
    opts.mongo = monk(opts.mongo || 'localhost:27017/mydb');
  }

  // create middleware
  var expose = new Expose(opts.redis, opts.mongo);
  return expose.fn();
}
