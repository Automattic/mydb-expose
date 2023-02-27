"use strict";

/**
 * Test dependencies.
 */

const mydbExpose = require('..');
const mydb = require('mydb');
const http = require('http');
const express = require('express');
const expect = require('expect.js');
const request = require('supertest');
const mongodb = require('mongodb');
const expressSession = require('express-session');

/**
 * Test.
 */

describe('mydb-expose', function(){
  let db, users, woots, sessions;

  /**
   * Middleware helper for tests.
   *
   * @api private
   */

  function expose(){
    return mydbExpose(db, { url: mydb(http.createServer()) });
  }

  /**
   * Returns the session middleware.
   *
   * @api private
   */

  function session(){
    return expressSession({ secret: 'woot', resave: false, saveUninitialized: true });
  }
  
  before(function (done) {
    mongodb.MongoClient
      .connect('mongodb://localhost:31003')
      .then(_client => {
        db = _client.db('mydb-expose-test');
        users = db.collection('users-' + Date.now());
        woots = db.collection('woots-' + Date.now());
        sessions = db.collection('sessions');    
        done();
      })
      .catch(done);
  });
  
  describe('res#send', function(){
    
    let doc1, doc2;
    
    before(function(done) {
      doc1 = { _id: new mongodb.ObjectID(), tobi: 'rox' };
      doc2 = { _id: new mongodb.ObjectID(), jane: 'too' };

      Promise
        .all([users.insert(doc1), users.insert(doc2)])
        .then(() => {
          done();
        })
        .catch(done);
    })

    it('Collection#findOne', function(done){
      var app = express();
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
      app.use(session());
      app.use(expose());
      request(app).get('/session').end(function(err, res){
        if (err) return done(err);

        // we first assert a session doc was created
        sessions.findOne({ _id: new mongodb.ObjectId(res.body._id) }, function(err, sess){
          
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
        .get('/2')
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
      app.use(session());
      app.use(expose());

      app.get('/', function(req, res, next){
        res.sendStatus(200);
      });
      app.get('/2', function(req, res, next){
        req.session.set('woot', 'a');
        req.session.push('likes', 'ferrets');
        res.sendStatus(200);
      });
      app.get('/3', function(req, res, next){
        expect(req.session.woot).to.be('a');
        expect(req.session.likes).to.eql(['ferrets']);
        res.sendStatus(200);
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
