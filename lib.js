var Q = require('q');
var http = require('http');
var querystring = require('querystring');

var UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/45.0.2454.99 Safari/537.36';

module.exports.request = request;
module.exports.getSession = getSession;
module.exports.getCaptcha = getCaptcha;

function request (method, url, data, addHeader) {
  var deferred = Q.defer();

  var headers = {
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Referer': 'http://www.hengyirong.com/site/login.html',
    'User-Agent': UA
  };

  var postData;

  if (data) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
    postData = querystring.stringify(data);
    headers['Content-Length'] = postData.length;
  }

  if (typeof addHeader === 'object') {
    for (var header in addHeader) {
      headers[header] = addHeader[header];
    }
  }

  var req = http.request({
    hostname: 'www.hengyirong.com',
    port: 80,
    path: url,
    method: method,
    headers: headers
  }, function (res) {
    if (res.statusCode < 100 || res.statusCode > 399) {
      deferred.reject(res.statusMessage);
      return;
    }

    res.setEncoding('utf-8');

    var body = '';
    res.on('data', function (chunk) {
      body += chunk;
    });

    res.on('end', function () {
      if (body[0] === '{' || body[0] === '[') {
        try {
          body = JSON.parse(body);
        } catch (e) {}
      }
      deferred.resolve({
        headers: res.headers,
        body: body
      });
    });
  });

  req.on('error', function (err) {
    deferred.reject(err);
  });

  if (postData) {
    req.write(postData);
  }

  req.end();

  req.setTimeout(5000, function () {
    deferred.reject('timeout');
  });

  return deferred.promise;
}

function getSession (headers) {
  var cookies = headers['set-cookie'];
  if (cookies instanceof Array) {
    var php = cookies.filter(function (content) {
      return content.indexOf('PHPSESSID=') === 0;
    });
    if (php instanceof Array) {
      var session = php[0];
      if (session) {
        return session.slice('PHPSESSID='.length, session.indexOf(';'));
      }
    }
  }
  return null;
}

function getCaptcha () {
  var deferred = Q.defer();
  var req = http.get({
    hostname: 'www.hengyirong.com',
    port: 80,
    path: '/site/captcha/',
    headers: {
      'User-Agent': UA
    }
  }, function (res) {
    var data = [];
    res.on('data', function (chunk) {
      data.push(chunk);
    });
    res.on('end', function () {
      deferred.resolve({
        session: getSession(res.headers),
        captcha: Buffer.concat(data).toString('base64')
      });
    });
  });
  req.on('error', function (err) {
    deferred.reject(err);
  });
  return deferred.promise;
}
