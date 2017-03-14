/* Created by Leo on 21/09/2016. */
'use strict';

var passport = require('passport');
var InazStrategy = require('passport-inaz').Strategy;
var inaz = require();

exports.setup = function (User, config) {
  passport.use(new InazStrategy({
      usernameField: 'name',
      passwordField: 'password' // this is the virtual field on the model
    },
    function(name, password, done) {
      User.findOne({
        name: name
      }, function(err, user) {
        if (err) return done(err);

        if (!user) {
          return done(null, false, { message: 'This user is not registered.' });
        }


        // if (!user.authenticate(password)) {
        //   return done(null, false, { message: 'This password is not correct.' });
        // }
        return done(null, user);
      });
    }
  ));
};
