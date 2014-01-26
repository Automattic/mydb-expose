
/**
 * MongoDB URI for tests.
 */

var mongo = 'localhost/mydb-expose-test' || process.env.MONGO_URI;

/**
 * Test dependencies.
 */

var my = require('..');
var mydb = require('mydb');
var http = require('http').Server;
var monk = require('monk')(mongo);
var express = require('express');
var expect = require('expect.js');
var request = require('supertest');

/**
 * Test collection.
 */

var users = monk.get('users-' + Date.now());
var woots = monk.get('woots-' + Date.now());
var sessions = monk.get('sessions');

/**
 * Middleware helper for tests.
 *
 * @api private
 */

function expose(){
  return my({ mongo: mongo, url: mydb(http()) });
}

/**
 * Returns the `cookieParser` middleware.
 */

function cookies(){
  return express.cookieParser();
}

/**
 * Returns the session middleware.
 *
 * @api private
 */

function session(){
  return express.session({ secret: 'woot' });
}

/**
 * Test.
 */

describe('mydb-expose', function(){

  describe('res#send', function(){
    var doc1 = { _id: users.id(), tobi: 'rox' };
    var doc2 = { _id: users.id(), jane: 'too' };
    users.insert(doc1);
    users.insert(doc2);

    it('Collection#findOne', function(done){
      var app = express();
      app.use(cookies());
      app.use(session());
      app.use(expose());
      app.get('/doc', function(req, res){
        res.send(users.findOne(doc1._id));
      });
      request(app).get('/doc').expect({
        _id: doc1._id.toString(),
        tobi: doc1.tobi
      }, done);
    });

    it('Collection#find', function(done){
      var app = express();
      app.use(cookies());
      app.use(session());
      app.use(expose());
      app.get('/document', function(req, res){
        res.send(users.find({}));
      });
      request(app).get('/document').expect([
        { _id: doc1._id.toString(), tobi: doc1.tobi },
        { _id: doc2._id.toString(), jane: doc2.jane }
      ], done);
    });

    it('Collection#find + 404', function(done){
      var app = express();
      app.use(cookies());
      app.use(session());
      app.use(expose());
      app.get('/missing-doc', function(req, res){
        res.send(users.findOne({ asd: 'testing testing 404' }));
      });
      request(app)
      .get('/missing-doc')
      .end(function(err, res){
        if (err) return done(err);
        expect(res.status).to.be(404);
        done();
      });
    });
  });

  describe('/session', function(){
    it('responds json', function(done){
      var app = express();
      app.use(cookies());
      app.use(session());
      app.use(expose());
      request(app).get('/session').end(function(err, res){
        if (err) return done(err);

        // we first assert a session doc was created
        sessions.findOne(res.body._id, function(err, sess){
          if (err) return done(err);
          expect(sess.sid).to.be.a('string');

          request(app)
          .get('/session')
          .set('Cookie', res.headers['set-cookie'][0].split(';')[0])
          .end(function(err, res){
            if (err) return done(err);
            expect(res.body._id).to.be(sess._id.toString());
            expect(res.body.sid).to.be(undefined);
            done();
          });
        });
      });
    });

    it('ignores non-GET', function(done){
      var app = express();
      app.use(cookies());
      app.use(session());
      app.use(expose());
      request(app).post('/session').end(function(err, res){
        if (err) return done(err);
        expect(res.status).to.be(404);
        done();
      });
    });

    it('responds with a mydb id', function(done){
      var app = express();
      app.use(cookies());
      app.use(session());
      app.use(expose());
      app.get('/', function(req, res, next){
        res.send(req.sessionID);
      });

      request(app).get('/').end(function(err, res){
        if (err) return done(err);
        var sid = res.text;

        request(app)
        .get('/session?my=1')
        .set('X-MyDB-SocketId', 'woot')
        .set('Cookie', res.headers['set-cookie'][0].split(';')[0])
        .end(function(err, res){
          if (err) return done(err);
          expect(res.body._id).to.be.a('string');
          expect(res.headers['x-mydb-id']).to.be.a('string');
          done();
        });
      });
    });

    it('responds with 304', function(done){
      var app = express();
      app.use(cookies());
      app.use(session());
      app.use(expose());
      app.get('/', function(req, res, next){
        res.send(req.sessionID);
      });

      request(app)
      .get('/')
      .end(function(err, res){
        if (err) return done(err);
        var sid = res.text;
        var cookie = res.headers['set-cookie'][0].split(';')[0];

        request(app)
        .get('/session?my=1')
        .set('X-MyDB-SocketId', 'woot')
        .set('Cookie', cookie)
        .end(function(err, res){
          if (err) return done(err);
          expect(res.body._id).to.be.a('string');
          var id = res.headers['x-mydb-id'];

          request(app)
          .get('/session?my=1')
          .set('X-MyDB-Id', id)
          .set('X-MyDB-SocketId', 'woot')
          .set('Cookie', cookie)
          .end(function(err, res){
            expect(err).to.be(null);
            expect(res.status).to.be(304);
            done();
          });
        });
      });
    });
  });

  describe('req#session', function(){
    it('automatically populated', function(done){
      var app = express();
      app.use(cookies());
      app.use(session());
      app.use(expose());
      app.get('/', function(req, res, next){
        expect(req.session.sid).to.eql(req.sessionID);
        res.send('' + req.session._id);
      });
      app.get('/2', function(req, res, next){
        res.send('' + req.session._id);
      });
      request(app)
      .get('/')
      .expect(200)
      .end(function(err, res1){
        if (err) return done(err);
        var cookie = res1.headers['set-cookie'][0].split(';')[0];

        request(app)
        .get('/')
        .set('Cookie', cookie)
        .expect(200)
        .end(function(err, res2){
          expect(res1.text).to.be(res2.text);
          done();
        });
      });
    });

    it('supports operations', function(done){
      var app = express();
      app.use(cookies());
      app.use(session());
      app.use(expose());

      app.get('/', function(req, res, next){
        res.send(200);
      });
      app.get('/2', function(req, res, next){
        req.session.set('woot', 'a');
        req.session.push('likes', 'ferrets');
        res.send(200);
      });
      app.get('/3', function(req, res, next){
        expect(req.session.woot).to.be('a');
        expect(req.session.likes).to.eql(['ferrets']);
        res.send(200);
      });

      request(app)
      .get('/')
      .expect(200)
      .end(function(err, res){
        if (err) return done(err);
        var cookie = res.headers['set-cookie'][0].split(';')[0];

        request(app)
        .get('/2')
        .set('Cookie', cookie)
        .end(function(err){
          if (err) return done(err);
          var cookie = res.headers['set-cookie'][0].split(';')[0];

          request(app)
          .get('/3')
          .set('Cookie', cookie)
          .expect(200, done);
        });
      });
    });
  });

});
