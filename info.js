var _ = require('lodash');
var Q = require('q');
var lib = require('./lib');
var htmlparser = require("htmlparser2");

module.exports = getInfo;

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
  var get = 0;
  var info = [];
  var key = undefined;
  var value = undefined;
  var deferred = Q.defer();
  var parser = new htmlparser.Parser({
    onopentag: function (name, attrs) {
      if (get === 0 && name === 'table' && attrs.class === 'dlm_jbxx') {
        get = 1;
      }
      if (get > 0) {
        if (name === 'tr') {
          get = 2;
        } else if (name === 'td') {
          get++;
        }
      }
    },
    onclosetag: function (name) {
      if (name === 'tr') {
        info.push({
          key: key,
          value: value
        });
        key = undefined;
        value = undefined;
      } else if (name === 'table') {
        get = -1;
      }
    },
    ontext: function (text) {
      if (get < 3) return;
      text = text.trim();
      if (!text) return;
      if (get === 3) {
        key = text.replace('：', '');
      } else if (get === 4) {
        value = text;
      }
    },
    onend: function () {
      deferred.resolve(_.filter(info, function (i) {
        return !_.isUndefined(i.value);
      }));
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
      getRecords(ret[0].body),
      getAccountInfo(ret[1].body)
    ]);
  }).then(function (ret) {
    var balance = (ret[0][0] ? +ret[0][0].value : 0) || 50000;
    var account = _.filter(ret[2], function (a) {
      return a.value !== '未填写';
    });
    var info = ret[0].concat(account);
    var alive = !!info.length;
    info.unshift({
      key: '更新时间',
      value: new Date()
    });
    return {
      alive: alive,
      session: session,
      records: ret[1],
      info: info,
      balance: balance
    };
  });
}

function getRecords (html) {
  var get = 0;
  var ret = [{
    name: '定利宝出借记录',
    keys: [],
    records: []
  }, {
    name: '散标出借记录',
    keys: [],
    records: []
  }];
  var tableIndex = -1;
  var trIndex = -1;
  var deferred = Q.defer();
  var parser = new htmlparser.Parser({
    onopentag: function (name, attrs) {
      if (get === 0 && name === 'table' && /sy_tabel_jilv/.test(attrs.class)) {
        get = 1;
        trIndex = -1;
        tableIndex++;
      }
      if (get > 0) {
        get = 1;
        if (name === 'tr') {
          trIndex++;
          if (trIndex > 0) {
            ret[tableIndex].records[trIndex - 1] = [];
          }
        } else if (name === 'th') {
          get = 2;
        } else if (name === 'td') {
          get = 3;
        }
      }
    },
    onclosetag: function (name) {
      if (name === 'table') {
        get = 0;
      }
    },
    ontext: function (text) {
      if (get < 2) return;
      text = text.trim();
      if (!text) return;
      if (get === 2) {
        ret[tableIndex].keys.push(text);
      } else {
        ret[tableIndex].records[trIndex - 1].push(text);
      }
    },
    onend: function () {
      _.each(ret, function (r) {
        var keyLen = r.keys.length;
        _.remove(r.records, function (rec) {
          return rec.length !== keyLen;
        });
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
