# mydb-expose

  Connect middleware to expose documents through MyDB.

## Example

```js
// dependencies
var mydb = require('mydb-expose');
var express = require('express');
var app = express();
var db = require('monk')():

// middleware
app.use(express.cookieParser());
app.use(mydb({ mongo: '127.0.0.1:27017', url: '127.0.0.1:3000' }));

// example session route
app.post('/login', function(req, res){
  req.session.set('user_id', '123');
  res.send(200);
});

// example document expose
app.get('/some/doc', function(req, res){
  res.send(db.get('collection').findOne({ some: 'query' }));
});
```

## API

### Middleware

  Options:
  
  - `url`
    - a string like `cloudup.mydb.io`
  - `redis`
    - a redis client instance or
    - a string like `localhost:6379`
  - `mongo`
    - a `monk` instance
    - a string like `localhost:27017/test`
  - `sessionExpose`
    - fields to expose from the session document (defaults to `'-sid'`)

### ServerResponse#send

  The express method is overridden to detect `monk`-style `Promise` 
  objects.

  If the request contains the header `X-Requested-With: MyDB`.

### ServerRequest#session

  Points to the 

### MySession

  Operations executed on the `session` object defer the response sent to
  the client automatically, unless a callback is passed to one of the
  functions below.

  Errors are `next`d automatically.

  The object is populated with the latest snapshot from the database.

#### reload(fn)

  Reloads the session from database.

#### set(key, val, fn)

  Calls `$set` with the given `key` and `val`.

#### unset(key, fn)

  Calls `$unset` with the given `key`.

#### pop(key, fn)

  Calls `$pop` with the given `key`.

#### shift(key, fn)

  Calls `$pop` with the given `key` and `-1`, producing a shift.

#### push(key, val, fn)

  Calls `$push` to the given `key` with `val`.

#### pushAll(key, vals, fn)

  Calls `$push` to the given `key` with `vals`.

#### pull(key, val, fn)

  Calls `$pull` with the given `key` and `val`.

#### pullAll(key, vals, fn)

  Calls `$pullAll` with the given `key` and `vals`.

#### rename(key, newKey, fn)

  Calls `$rename` with the given `key` and `newKey`.

#### get(key, fn)

  Gets the given `key` asynchronously. Normally you just want to access
  `req.session[key]`.
