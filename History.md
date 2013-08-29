
2.0.7 / 2013-08-29
==================

 * session: express csrf warning workaround

2.0.6 / 2013-08-15
==================

  * session: save more information in session

2.0.5 / 2013-08-14
==================

  * remove agent

2.0.4 / 2013-08-14
==================

  * expose: fix agent setting

2.0.3 / 2013-08-14
==================

  * expose: use an agent

2.0.2 / 2013-08-14
==================

  * expose: track subscription times

2.0.1 / 2013-06-14
==================

  * expose: handle socket errors

2.0.0 / 2013-06-14
==================

  * switch to RESTful subscription, ditch redis

1.1.8 / 2013-04-23
==================

  * expose: make mydb-expose session independent

1.1.7 / 2013-04-15
==================

  * expose: fix nasty state bug thanks to @visionmedia

1.1.6 / 2013-04-14
==================

  * expose: handle error

1.1.5 / 2013-04-14
==================

  * expose: make uid generation asynchronous

1.1.4 / 2013-04-04
==================

  * expose: fix fields retrieval from promise
  * test: for non-GET

1.1.3 / 2013-04-04
==================

  * expose: added `GET` check for `/session`

1.1.2 / 2013-03-07
==================

  * session: introduce `user_agent` in session

1.1.1 / 2013-02-21
==================

  * expose: consider socketid in hash

1.1.0 / 2013-02-21
==================

  * test: added `res#subscribe` tests
  * expose: added `toFields` helper
  * expose: expose `res.subscribe` and `req.subscribe`
  * expose: rename `doSubscripe` to `createSubscription`
  * expose: implemented `res.subscribe`
  * send: use `res.subscribe`
  * index: fix variable shadowing

1.0.1 / 2013-02-20
==================

  * expose: fix race condition
  * test: jesus christ redis

1.0.0 / 2013-02-19
==================

  * expose: fix publish callback
  * expose: improve subscription ids
  * expose: fix error reporting
  * package: added `uid2` dep
  * expose: prevent potential thrown JSON circular structure error
  * expose: create a new random `SocketId` if one is not present
  * expose: `doSubscribe` now performs a REDIS publish instead
  * expose: refactored `subscribe`
  * expose: added support for 404s for non-mydb requests
  * expose: handle error from `subscribe` method
  * epxose: use `MyDB` instead
  * expose: make check for mydb request based on presence of `X-MyDB-SocketId` header
  * expose: style
  * expose: added public subscribe method
  * expose: added new response mechanism

0.6.7 / 2013-02-05
==================

  * expose: added fix for circular JSON

0.6.6 / 2013-01-25 
==================

  * tweak Session#JSON() to return sess data only

0.6.5 / 2013-01-25 
==================

  * add Session#toJSON() to prevent cyclic ref

0.6.4 / 2013-01-25 
==================

  * add more debug() instrumentation

0.6.3 / 2013-01-09
==================

  * expose: allow session-less exposing

0.6.2 / 2012-11-08
==================

  * expose: fix error handling in `res.send` queries

0.6.1 / 2012-10-24
==================

  * expose: consider fields in hashing

0.6.0 / 2012-10-17
==================

  * index: added `sessionExpose` opt
  * expose: implement custom session fields

0.5.0 / 2012-10-16
==================

  * session: add `addToSet` method

0.4.2 / 2012-10-14
==================

  * session: maintain properties from `req.session`

0.4.1 / 2012-10-13
==================

  * expose: prevent including `mydb-expose` twice

0.4.0 / 2012-10-09
==================

  * expose: hash collection and id with sessionID

0.3.0 / 2012-10-09
==================

  * expose: send 404 when promise resolves to nothing
  * Makefile: tweak `slow`

0.2.1 / 2012-10-07
==================

  * index: fixed default mongodb uri

0.2.0 / 2012-10-06
==================

  * expose: added collection name support to subscriptions

0.1.0 / 2012-10-03
==================

  * mydb-expose: initial release
