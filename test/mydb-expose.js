
/**
 * MongoDB URI for tests.
 */

var mongo = 'localhost/mydb-expose-test' || process.env.MONGO_URI;

/**
 * Test dependencies.
 */

var my = require('mydb')
  , monk = require('monk')(mongo)
  , redis = require('redis').createClient()
  , express = require('express')
  , expect = require('expect.js')
  , request = require('supertest');

/**
 * Test collection.
 */

var users = monk.get('users-' + Date.now());
var sessions = monk.get('sessions');

/**
 * Middleware helper for tests.
 *
 * @api private
 */

function mydb(){
  return my({ mongo: mongo });
}

/**
 * Test.
 */

describe('mydb-expose', function(){

  describe('middleware', function(){
    it('should fail if `connect#session` is not included', function(done){
      var app = express();
      expect(function(){
        app.use(mydb());
      }).to.throwError(/missing `connect#session`/);
    });
  });

  describe('res#send', function(){
    var doc1 = { _id: users.id(), tobi: 'rox' };
    var doc2 = { _id: users.id(), jane: 'too' };
    users.insert(doc1);
    users.insert(doc2);

    it('Collection#findOne', function(done){
      var app = express();
      app.use(express.session());
      app.use(mydb());
      app.get('/doc', function(req, res){
        res.send(users.findOne(doc1._id));
      });
      request(app).get('/doc').expect(doc1, done);
    });

    it('Collection#find', function(done){
      var app = express();
      app.use(express.session());
      app.use(mydb());
      app.get('/document', function(req, res){
        res.send(users.find({}));
      });
      request(app).get('/document').expect([doc1, doc2], done);
    });

    it('Collection#findOne + mydb', function(done){
      var app = express();
      app.use(express.session());
      app.use(mydb());
      app.get('/doc', function(req, res){
        res.send(users.findOne(doc1._id));
      });
      request(app).get('/doc?my=1').end(function(err, res){
        if (err) return done(err);
        redis.get(res.text, function(err, id){
          if (err) return done(err);
          expect(id).to.be(doc1._id.toString());
          done();
        });
      });
    });

    it('Collection#find + mydb', function(done){
      var app = express();
      app.use(express.session());
      app.use(mydb());
      app.get('/doc', function(req, res){
        res.send(users.findOne(doc1._id));
      });
      request(app).get('/doc?my=1').end(function(err, res){
        if (err) return done(err);
        redis.get(res.text, function(err, id){
          if (err) return done(err);
          expect(id).to.be(doc1._id.toString());
          done();
        });
      });
    });
  });

  describe('/session', function(){
    it('responds json', function(done){
      var app = express();
      app.use(express.session());
      app.use(mydb());
      request(app).get('/session').end(function(err, res){
        if (err) return done(err);

        // check document
        var cookie = res.headers['set-cookie'].match(/connect\.sid=(\w+)/)[1];
        expect(res.body._id).to.be.a('string');
        expect(res.body.sid).to.be(cookie);

        // we first assert a session doc was created
        sessions.findOne(res.body._id, function(err, sess){
          if (err) return done(err);
          expect(sess.sid).to.be(cookie);

          request(app)
          .set('Cookie', res.headers['set-cookie'])
          .get('/session')
          .end(function(err, res){
            if (err) return done(err);
          });
        });
      });
    });

    it('responds with sid for mydb', function(done){
      var app = express();
      app.use(express.session());
      app.use(mydb());
      app.get('/', function(req, res, next){
        res.send(req.sessionId);
      });

      request(app).get('/').end(function(err, res){
        if (err) return done(err);
        var sid = res.text;

        request(app)
        .set('Cookie', res.headers['set-cookie'])
        .get('/session?my=1')
        .end(function(err, res){
          if (err) return done(err);
          redis.get(res.text, function(err, id){
            if (err) return done(err);
            sessions.findById(id, function(err, session){
              if (err) return done(err);
              expect(session.sid).to.be(sid);
              done();
            });
          });
        });
      });
    });
  });

  describe('req#session', function(){
    it('automatically populated', function(done){
      var app = express();
      app.use(express.session());
      app.use(mydb());
      app.get('/', function(req, res, next){
        expect(req.session.sid).to.eql(req.sessionId);
        res.send('' + req.session._id);
      });
      app.get('/2', function(req, res, next){
        res.send('' + req.session._id);
      });
      request(app).get('/').expect(200).end(function(err, res1){
        if (err) return done(err);
        request(app)
        .set('Cookie', res1.headers['set-cookie'])
        .get('/')
        .expect(200).end(function(err, res2){
          expect(res1.text).to.be(res2.text);
          done();
        });
      });
    });

    it('supports operations', function(done){
      var app = express();
      app.use(express.session());
      app.use(mydb());
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
        expect(req.sesison.likes).to.eql(['ferrets']);
        res.send(200);
      });
      request(app).get('/').expect(200).end(function(err, res){
        if (err) return done(err);
        request(app)
        .set('Cookie', res.headers['set-cookie'])
        .get('/2')
        .end(function(err){
          if (err) return done(err);
          request(app)
          .set('Cookie', res.headers['set-cookie'])
          .get('/3')
          .expect(200, done);
        });
      });
    });
  });

});
