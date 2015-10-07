var fs = require('fs');
var express = require('express');
var backend = require('./backend');

var logger = require('bunyan').createLogger({ name: 'hyr' });

var app = express();

app.use('/_', backend);

if (process.env.NODE_ENV !== 'production') {
  var serveDist = false;

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
}

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

var server = app.listen(3000, '0.0.0.0', function () {
  var host = server.address().address;
  var port = server.address().port;

  logger.info('Listening at http://%s:%s', host, port);
});
