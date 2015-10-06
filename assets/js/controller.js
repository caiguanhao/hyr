angular.module('hyr').
service('captchaData', function (
  $http,
  $timeout
) {
  var data;

  this.timeout = undefined;

  function reset () {
    data = undefined;
    $timeout.cancel(this.timeout);
  }

  this.reset = reset;
  this.get = function (forceReload) {
    if (data && !forceReload) {
      return data;
    }
    data = $http.get('/verify');
    this.timeout = $timeout(function () {
      reset();
    }, 2 * 60 * 1000);
    return data;
  };
}).
directive('captcha', function (
  $http,
  captchaData
) {
  return {
    scope: {
      captcha: '='
    },
    link: function ($scope, $element, $attrs) {
      function reloadCaptcha (forceReload) {
        captchaData.get(forceReload).then(function (res) {
          $scope.captcha = res.data.session;
          $element.attr('src', 'data:image/png;base64,' + res.data.captcha);
        });
      }
      reloadCaptcha();
      $scope.$parent.reloadCaptcha = reloadCaptcha;
    }
  };
}).
directive('info', function (
  $http,
  $interval
) {
  function timeAgo (time) {
    var diff = (new Date() - new Date(time)) / 1000;
    return diff < 1 && '刚刚' || (
      diff < 60 && Math.floor(diff) + '秒' ||
      diff < 120 && '1分钟' ||
      diff < 3600 && Math.floor(diff / 60) + '分钟' ||
      diff < 7200 && '1小时' ||
      diff < 86400 && Math.floor(diff / 3600) + '小时') + '前';
  }

  return {
    scope: {
      info: '='
    },
    link: function ($scope, $element, $attrs) {
      var info = $scope.info;
      if (/^[0-9-]+T[0-9:.]+Z$/.test(info)) {
        $element.text(timeAgo(info));
        $element.attr('title', new Date(info));
        var timer = $interval(function () {
          $element.text(timeAgo(info));
        }, 1000);
        $element.on('$destroy', function() {
          $interval.cancel(timer);
        });
      } else {
        $element.text(info);
      }
    }
  };
}).
config(function (
  $routeProvider
) {
  $routeProvider.
  when('/', {
    templateUrl: '/main.html',
    controller: 'MainCtrl as main',
    resolve: {
      Sessions: function (
        $http,
        $interval,
        localStorageService,
        Session
      ) {
        var cached = [];

        function get () {
          var sessions = localStorageService.get('sessions');
          if (!angular.isArray(sessions) || !sessions[0]) {
            return cached;
          }
          return $http.get('/info', {
            params: {
              session: _.map(sessions, 'session')
            }
          }).then(function (res) {
            _.each(res.data, function (session) {
              session.balance = 50000;
              if (!(session.balance > 10000)) {
                return;
              }
              var quantity = Math.floor(session.balance / 10000);
              var quantities = [];
              _.times(quantity, function (n) {
                quantities.push({
                  name: (n + 1) + '万',
                  value: n + 1
                });
              });
              session.quantity = quantity;
              session.quantities = quantities;
            });
            _.each(sessions, function (session) {
              _.assign(session, _.find(res.data, { session: session.session }));
            });
            var removed = _.remove(sessions, function (sess) {
              return !sess.alive;
            });
            if (removed.length) {
              Session.save(sessions);
            }
            cached.length = 0;
            _.assign(cached, sessions);
            return cached;
          });
        }

        $interval(function () {
          get();
        }, 5000);

        return get();
      }
    }
  });
}).
service('Session', function (
  localStorageService
) {
  this.save = function (sessions) {
    var sess = _.map(sessions, function (session) {
      return {
        name: session.name,
        session: session.session
      };
    });
    if (!angular.isArray(sess) || sess.length === 0) {
      localStorageService.remove('sessions');
    } else {
      localStorageService.set('sessions', sess);
    }
  };
}).
service('Status', function (
) {
  this.max = 20;

  this.statuses = [];

  this.stringify = function () {
    return this.statuses.join('\n');
  };

  function pad (n) {
    return n < 10 ? '0' + n : n;
  }

  function now () {
    var t = new Date();
    return pad(t.getHours()) + ':' + pad(t.getMinutes()) + ':' + pad(t.getSeconds());
  }

  var repeated = 1;
  this.add = function (msg) {
    var time = '[' + now() + ']';
    var first = this.statuses[0];
    if (first && first.slice(first.indexOf(' ') + 1) === msg) {
      repeated++;
      this.statuses[0] = time + '[' + repeated + '] ' + msg;
    } else {
      repeated = 1;
      this.statuses.unshift(time + '[1] ' + msg);
      if (this.statuses.length > this.max) {
        this.statuses.length = this.max;
      }
    }
  };
}).
service('Client', function (
) {
  this.client = undefined;
  this.clientUrl = undefined;

  this.connect = function (sessions) {
    var url = 'ws://' + window.location.hostname + ':8080/?';
    url += _.map(sessions, function (sess) {
      return 'session=' + sess.session;
    }).join('&');
    if (this.clientUrl === url) {
      return this.client;
    }
    if (this.client) {
      this.client.close();
    }
    this.clientUrl = url;
    this.client = new WebSocket(url);
    return this.client;
  };
}).
controller('MainCtrl', function (
  $filter,
  $http,
  $q,
  $route,
  $scope,
  captchaData,
  localStorageService,
  Client,
  Session,
  Sessions,
  Status
) {
  var self = this;

  this.sessions = Sessions;

  $scope.$watchCollection(function () {
    return Sessions;
  }, function () {
    var sess;
    if (self.session) {
      sess = _.find(self.sessions, { session: self.session.session });
    }
    self.session = sess || self.sessions[0];
  });

  this.status = Status;

  var ws = Client.connect(this.sessions);
  ws.onmessage = function (msg) {
    $scope.$apply(function () {
      self.status.add(msg.data);
    });
  };

  this.next = function () {
    var go = this.sessions.indexOf(this.session) + 1;
    if (go >= this.sessions.length) {
      go = 0;
    }
    this.session = this.sessions[go];
  };

  var names = {};
  _.each(this.sessions, function (sess) {
    var real = _.find(sess.info, { key: '真实姓名' });
    names[sess.name] = real ? real.value : undefined;
  });
  this.nameFor = function (sess) {
    var ret = sess.name;
    if (names[sess.name]) {
      ret += ' - ' + names[sess.name];
    }
    return ret;
  };

  this.login = function () {
    this.loggingin = true;
    $http.post('/login', {
      username: self.username,
      password: self.password,
      session: self.captcha_session,
      captcha: self.captcha
    }).then(function (res) {
      captchaData.reset();
      _.remove(self.sessions, function (sess) {
        return sess.name === res.data.username;
      });
      self.sessions.push({
        name: res.data.username,
        session: res.data.session
      });
      Session.save(self.sessions);
      $route.reload();
    }, function (err) {
      alert(err.data.error);
    }).finally(function () {
      self.loggingin = false;
    });
  };

  this.logout = function () {
    self.username = '';
    self.password = '';
    self.captcha = '';
    $q.when(this.abort()).finally(function () {
      _.remove(self.sessions, self.session);
      Session.save(self.sessions);
      $route.reload();
    });
  };

  this.start = function () {
    var session = this.session;
    if (!angular.isObject(session)) {
      return;
    }
    if (session.started) {
      return;
    }
    return $http.post('/start', {
      product: self.product,
      type: self.type,
      quantity: session.quantity,
      session: session.session
    }).then(function () {
      session.started = true;
    });
  };

  this.abort = function () {
    var session = this.session;
    if (!angular.isObject(session)) {
      return;
    }
    if (!session.started) {
      return;
    }
    return $http.post('/abort', {
      session: session.session
    }).then(function () {
      session.started = false;
    });
  };

  this.products = [
    {
      id: '101', name: '3个月 - 过往年化收益率8.00%'
    }, {
      id: '102', name: '6个月 - 过往年化收益率10.00%'
    }, {
      id: '103', name: '12个月 - 过往年化收益率12.50%'
    }, {
      id: '104', name: '18个月 - 过往年化收益率13.00%'
    }, {
      id: '105', name: '24个月 - 过往年化收益率14.00%'
    }
  ];
  this.product = '103';

  this.types = [
    {
      name: '收益复投', value: '1'
    }, {
      name: '收益返还', value: '2'
    }
  ];
  this.type = '2';
});
