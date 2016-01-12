"use strict";

/**
 * Module dependencies.
 */

const Expose = require('./expose');

/**
 * `mydb-expose` middleware.
 *
 * @param {mongodb.Db} database to store sessions in
 * @param {Object} options
 * @api public
 */

function mydbExpose(db, options) {
  if ('undefined' === typeof db) {
    throw new Error('mydb-expose: No mongodb instance specified.')
  }

  options = options || {};
  options.session = options.session || {};

  // sessions collection
  // XXX: move session logic into `mydb-session`  
  let sessions = db.collection(options.session.collection || 'sessions');
  sessions.ensureIndex('sid');

  // session fields to expose
  let sessionExpose = options.session.expose || { 'sid': 0 };

  // secret
  let secret = options.secret || 'youareagoodmydbcracker';

  // url
  let url = options.url;

  if (!url) {
    throw new Error('mydb-expose: Missing `url` (mydb server) option.');
  }

  if (typeof url == 'string') {
    let _url = url;
    url = function(){
      return _url;
    };
  }

  // create middleware
  return function (req, res, next) {
    let expose = new Expose(url, secret, sessions, sessionExpose);
    expose.middleware(req, res, next);
  };
}

/**
 * Module exports.
 */

module.exports = mydbExpose;