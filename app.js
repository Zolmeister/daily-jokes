/**
 * Module dependencies.
 */

var express = require('express'),
  routes = require('./routes'),
  http = require('http'),
  path = require('path'),
  googleapis = require('googleapis'),
  OAuth2Client = googleapis.OAuth2Client,
  config = require('./config'),
  passport = require('passport'),
  mongojs = require('mongojs'),
  MongoStore = require('connect-mongo')(express)
  GoogleStrategy = require('passport-google-oauth').OAuth2Strategy,
  CronJob = require('cron').CronJob,
  request = require('request');

var oauth2Client = new OAuth2Client(config.CLIENT_ID, config.CLIENT_SECRET, config.REDIRECT_URL);

var db = mongojs(config.MONGO_DB, ['user']);
var User = db.user

passport.serializeUser(function (user, done) {
  done(null, user.googleId);
});

passport.deserializeUser(function (obj, done) {
  done(null, obj);
});

passport.use(new GoogleStrategy({
  clientID: config.CLIENT_ID,
  clientSecret: config.CLIENT_SECRET,
  callbackURL: config.REDIRECT_URL
}, function (accessToken, refreshToken, profile, done) {
  if (profile && profile.id) {
    // find or create user
    User.findOne({
      googleId: profile.id
    }, function (err, user) {
      if (err) return done(err)
      if (!user) {
        User.save({
          googleId: profile.id,
          refreshToken: refreshToken,
          accessToken: accessToken
        }, function (err, user) {
          done(err, user)
        })
      } else {
        done(err, user)
      }
    })
  } else {
    done(new Error('Bad data'))
  }
}));

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.cookieParser());
app.use(express.session({
  secret: 'mmmu784kxchJKASMS(eeikc,m 65ndnfhcjvhguhddddjhjhj%^#&&jhdyGHDFH',
  store: new MongoStore({
    url: config.MONGO_DB
  })
}));
app.use(passport.initialize());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

// send a joke to a user

function sendJoke(joke, oauthClient, googleClient, done) {
  googleClient
    .mirror.timeline.insert({
    "text": joke,
    "menuItems": [{
        "action": "DELETE"
      }]
  })
    .withAuthClient(oauthClient)
    .execute(done);
};

app.get('/', function (req, res) {
  if (!req.session.user) {
    res.render('index');
  } else {
    // let user set their settings
    res.render('index', {
      user: req.session.user
    });
  }
});

app.get('/logout', function (req, res) {
  req.session.user = null
  res.redirect('/')
})
app.get('/unsubscribe', function (req, res) {
  User.remove({
    googleId: req.session.user.googleId
  }, function (err) {
    if (err) console.log(err)
    res.redirect('/logout')
  })
})
app.get('/signup', passport.authenticate('google', {
  accessType: 'offline',
  approvalPrompt: 'force',
  scope: ['https://www.googleapis.com/auth/glass.timeline',
          'https://www.googleapis.com/auth/userinfo.profile']
}))

app.get('/oauth2callback', passport.authenticate('google', {
  failureRedirect: '/'
}), function (req, res) {
  // Successful authentication, redirect home.
  req.session.user = req.user
  res.redirect('/');
})

// development only
if ('development' == app.get('env')) {
  app.get('/test', function (req, res) {
    sendAllJokes()
    res.redirect('/')
  })
}


http.createServer(app).listen(app.get('port'), function () {
  console.log('Express server listening on port ' + app.get('port'));
});

function getJoke(cb) {
  request.get({url: 'http://api.icndb.com/jokes/random/', json: true}, function(err, data) {
    cb(err, data && data.body && data.body.value && data.body.value.joke)
  })
}

function sendAllJokes() {
  console.log('sending joke')
  getJoke(function (err, joke) {
    if(err || !joke) return console.error(err)
    User.find({}, function (err, users) {
      users.forEach(function (user) {
        oauth2Client.credentials = {
          access_token: user.accessToken,
          refresh_token: user.refreshToken
        }
        googleapis
          .discover('mirror', 'v1')
          .execute(function (err, client) {
          if (err) return console.error(err)
          sendJoke(joke, oauth2Client, client, function (err, data) {
            if (err) return console.error(err)
          })
        });
      })
    })
  })
}

var jokeJob = new CronJob({
  cronTime: '0 12 * * *', // every day at 12:00pm
  //cronTime: '* * * * * *', // every second
  onTick: function () {
    sendAllJokes()
  },
  start: true
})