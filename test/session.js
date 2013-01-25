
/**
 * Module dependencies.
 */

var Session = require('../session')
  , expect = require('expect.js');

describe('Session#toJSON()', function(){
  it('should return a JSON representation', function(){
    var obj = { first: 'tobi', last: 'ferret' };
    var req = { session: obj, req: req };
    var sess = new Session('users', req);

    expect(sess.toJSON()).to.eql({
      first: 'tobi',
      last: 'ferret'
    });
  })
})
