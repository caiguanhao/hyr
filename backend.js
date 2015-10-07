var _ = require('lodash');
var Q = require('q');
var ws = require('ws');
var lib = require('./lib');
var getInfo = require('./info');
var express = require('express');
var bodyParser = require('body-parser');
var backend = express.Router();

module.exports = backend;

backend.get('/verify', function (req, res, next) {
  lib.getCaptcha().then(function (data) {
    res.send(data);
  }, next);
});

var WebSocketServer = ws.Server;
var wss = new WebSocketServer({
  port: 49821
});
wss.on('connection', function (ws) {
  ws.send('Welcome');
});

function sendMessage (session, data) {
  var clients = _.filter(wss.clients, function (client) {
    return client.upgradeReq.url.indexOf(session) > -1;
  });
  if (clients.length > 0) {
    var content = typeof data === 'string' ? data : JSON.stringify(data);
    _.each(clients, function (client) {
      client.send(content);
    });
  }
}

var loopStartData = {};

function loopStart () {
  var sessions = Object.keys(loopStartData);
  var promises = sessions.map(function (session) {
    var url = '/dtpay/confirmationpay.html';
    var data = loopStartData[session];
    return lib.request('POST', url, {
      'id': data.product,
      'shouyi': data.type,
      'money': data.quantity,
      'authcode': ''
    }, {
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

backend.post('/start', bodyParser.json(), function (req, res, next) {
  loopStartData[req.body.session] = {
    product: req.body.product + '',
    type: req.body.type + '',
    quantity: req.body.quantity + ''
  };
  res.send({ message: 'OK' });
});

backend.post('/abort', bodyParser.json(), function (req, res, next) {
  delete loopStartData[req.body.session];
  res.send({ message: 'OK' });
});

backend.get('/info', function (req, res, next) {
  var sessions = req.query.session;
  if (_.isString(sessions)) {
    sessions = [sessions];
  } else if (!_.isArray(sessions)) {
    sessions = [];
  }
  Q.all(_.map(sessions, function (session) {
    return getInfo(session);
  })).then(function (sessions) {
    _.each(sessions, function (sess) {
      var quantity = null;
      var quantities = null;
      var product = null;
      var type = null;

      if (sess.balance >= 10000) {
        quantity = Math.floor(sess.balance / 10000);
        quantities = [];
        _.times(quantity, function (n) {
          quantities.push({
            name: (n + 1) + '万',
            value: n + 1
          });
        });
      }

      var data = loopStartData[sess.session];
      if (data) {
        product = data.product;
        type = data.type;
        quantity = +data.quantity || quantity;
      }
      sess.started = !!data;
      sess.quantities = quantities;
      sess.quantity = quantity;
      sess.product = product;
      sess.type = type;
    });

    res.send(sessions);
  }, next);
});

backend.post('/login', bodyParser.json(), function (req, res, next) {
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
