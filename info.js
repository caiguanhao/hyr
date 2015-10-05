var Q = require('q');
var lib = require('./lib');
var htmlparser = require("htmlparser2");

function getBalance (html) {
  var lastPText;
  var get = { key: false, value: false };
  var ret = [];
  var deferred = Q.defer();
  var parser = new htmlparser.Parser({
    onopentag: function (name, attrs) {
      if (attrs.class === 'sy_yuenum' || attrs.class === 'T_table_p') {
        get.value = true;
      }
      if (name === 'p') {
        get.key = true;
      }
    },
    ontext: function (text) {
      if (get.value) {
        ret.push({
          key: lastPText,
          value: (+text.replace(',', '')).toFixed(2)
        });
        get.value = false;
      }
      if (get.key) {
        lastPText = text;
        get.key = false;
      }
    },
    onend: function () {
      deferred.resolve(ret);
    }
  }, {
    decodeEntities: true
  });
  parser.write(html);
  parser.end();
  return deferred.promise;
}

function getAccountInfo (html) {
  var info = [];
  var range = -1;
  var rangeColspan = -1;
  var deferred = Q.defer();
  var parser = new htmlparser.Parser({
    onopentag: function (name, attrs) {
      if (name === 'table' && attrs.class === 'dlm_jbxx') {
        range = 0;
      }
      if (range > -1) {
        if (name === 'tr') {
          range = 1;
          rangeColspan = -1;
        }
        if (name === 'td') {
          range++;
          if (+attrs.colspan > 1) {
            rangeColspan = 0;
          }
        }
      }
    },
    onclosetag: function (name, attrs) {
      if (info && name === 'table') {
        range = -1;
      }
    },
    ontext: function (text) {
      if (range > 1 && range < 4) {
        if (rangeColspan < 1) {
          info.push(text.trim());
        }
        if (rangeColspan > -1) {
          rangeColspan++;
        }
      }
    },
    onend: function () {
      var ret = [];
      info.forEach(function (val, key) {
        if ((key + 1) % 2 === 0) {
          ret.push({
            key: info[key - 1].replace('：', ''),
            value: val
          });
        }
      });
      deferred.resolve(ret);
    }
  }, {
    decodeEntities: true
  });
  parser.write(html);
  parser.end();
  return deferred.promise;
}

function getInfo (session) {
  var header = {
    'Cookie': 'PHPSESSID=' + session
  };
  return Q.all([
    lib.request('GET', '/user.html', null, header),
    lib.request('GET', '/accountmge.html', null, header)
  ]).then(function (ret) {
    return Q.all([
      getBalance(ret[0].body),
      getAccountInfo(ret[1].body)
    ]);
  }).then(function (ret) {
    return {
      session: session,
      info: ret[0].concat(ret[1])
    };
  });
}

module.exports = getInfo;
