var _ = require('lodash');
var Q = require('q');
var fs = require('fs');
var lib = require('./lib');
var logger = require('bunyan').createLogger({ name: 'hyr' });
var getInfo = require('./info');
var express = require('express');
var bodyParser = require('body-parser');
var serveDist = false;

var app = express();

app.get('/verify', function (req, res, next) {
  lib.getCaptcha().then(function (data) {
    res.send(data);
  }, next);
});

var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({
  port: 8080
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
    }, 1000);
  });
}

loopStart();

app.post('/start', bodyParser.json(), function (req, res, next) {
  loopStartData[req.body.session] = {
    product: req.body.product + '',
    type: req.body.type + '',
    quantity: req.body.quantity + ''
  };
  res.send({ message: 'OK' });
});

app.post('/abort', bodyParser.json(), function (req, res, next) {
  delete loopStartData[req.body.session];
  res.send({ message: 'OK' });
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
  })).then(function (sessions) {
    _.each(sessions, function (sess) {
      var quantity = null;
      var quantities = null;
      var product = null;
      var type = null;

      if (sess.balance > 10000) {
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

app.get('*', function (req, res, next) {
  var file = req.url;
  if (/\/$/.test(file)) {
    file += 'index.html';
  }
  file = file.replace(/^\/+/, '');
  var stream = fs.createReadStream((serveDist ? 'dist/latest/' : '') + file);
  stream.on('error', function (err) {
    next(err);
  });
  stream.pipe(res);
});

app.use(function (err, req, res, next) {
  logger.error(err);
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

  logger.info('Listening at http://%s:%s', host, port);
});
