var _ = require('lodash');
var Q = require('q');
var fs = require('fs');
var lib = require('./lib');
var getInfo = require('./info');
var express = require('express');
var bodyParser = require('body-parser');

var app = express();

app.get('/', function (req, res) {
  fs.createReadStream('index.html').pipe(res);
});

app.get('/verify', function (req, res, next) {
  lib.getCaptcha().then(function (data) {
    res.send(data);
  }, next);
});

app.get('/info', function (req, res, next) {
  var sessions = req.query.session;
  if (_.isString(sessions)) {
    sessions = [sessions];
  } else if (!_.isArray(sessions)) {
    sessions = [];
  }
  Q.all(_.map(sessions, function (session) {
    return getInfo(session);
  })).then(function (data) {
    res.send(data);
  }, next);
});

app.post('/login', bodyParser.json(), function (req, res, next) {
  var data = {
    'LoginForm[username]': req.body.username,
    'LoginForm[password]': req.body.password,
    'LoginForm[verifyCode]': req.body.captcha
  };
  lib.request('POST', '/site/login.html', data, {
    'Cookie': 'PHPSESSID=' + req.body.session
  }).then(function (resp) {
    var session = lib.getSession(resp.headers);
    if (!session) {
      throw '密码或验证码错误。';
    }
    res.send({
      username: req.body.username,
      session: session
    });
  }).catch(next);
});

var url = require('url');
var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({
  port: 8080
});
wss.on('connection', function (ws) {
  ws.send('Welcome');
});

function sendMessage (session, data) {
  var clients = wss.clients;
  for (var i = 0; i < clients.length; i++) {
    var client = clients[i];
    var u = url.parse(client.upgradeReq.url, true);
    if (u.query.session === session) {
      client.send(JSON.stringify(data));
    }
  }
}

var loopStartData = {};

function loopStart () {
  var sessions = Object.keys(loopStartData);
  var promises = sessions.map(function (session) {
    var url = '/dtpay/confirmationpay.html';
    return lib.request('POST', url, loopStartData[session], {
      'Cookie': 'PHPSESSID=' + session
    }).then(function (resp) {
      sendMessage(session, resp.body);
    }, function (err) {
      sendMessage(session, err);
    });
  });
  Q.all(promises).finally(function () {
    setTimeout(function () {
      loopStart();
    }, 100);
  });
}

loopStart();

app.post('/start', bodyParser.json(), function (req, res, next) {
  var data = {
    'id': req.body.product + '',
    'shouyi': req.body.type + '',
    'money': req.body.quantity + '',
    'authcode': ''
  };
  loopStartData[req.body.session] = data;
  res.send({
    message: 'OK'
  });
});

app.post('/abort', bodyParser.json(), function (req, res, next) {
  delete loopStartData[req.body.session];
  res.send({
    message: 'OK'
  });
});

app.get('*', function (req, res, next) {
  var file = req.url.replace(/^\/+/, '');
  var stream = fs.createReadStream(file);
  stream.on('error', function (err) {
    next(err);
  });
  stream.pipe(res);
});

app.use(function (err, req, res, next) {
  if (err && err.code === 'ENOENT') {
    return next();
  }
  res.status(500).send({ error: err });
});

app.use(function (req, res, next) {
  res.status(404).send({ error: 'Page Not Found.' });
});

var server = app.listen(3000, 'localhost', function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('Listening at http://%s:%s', host, port);
});
