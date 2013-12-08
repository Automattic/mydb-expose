
/**
 * Module dependencies.
 */

var monk = require('monk');
var Expose = require('./expose');

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

  // secret
  var secret = opts.secret || 'youareagoodmydbcracker';

  // url
  var url = opts.url;

  if (!url) {
    throw new Error('Missing `url` (mydb server) option.');
  }

  if (typeof url == 'string') {
    var _url = url;
    url = function(){
      return _url;
    };
  }

  // create middleware
  return function(req, res, next){
    var expose = new Expose(url, secret, sessions, sessionExpose);
    expose.middleware(req, res, next);
  };
}
