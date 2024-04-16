// For Oauth I followed this tutorial:
// https://youtu.be/Q0a0594tOrc?si=3G7J2qtLh20ajefH

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth2').Strategy;

// Require passport to use the GoogleStrategy for Oauth, with our client id and client secret
passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/google/callback",
    passReqToCallback: true
  },
  function(request, accessToken, refreshToken, profile, done) {
    return done(null, profile);
  }
));

// We aren't using these but are needed for setup

passport.serializeUser(function(user, done) {
    done(null, user);
});

passport.deserializeUser(function(user, done) {
    done(null, user);
});