angular.module('hyr').
directive('captcha', function (
  $http
) {
  return {
    scope: {
      captcha: '='
    },
    link: function ($scope, $element, $attrs) {
      function reloadCaptcha () {
        $http.get('/verify').then(function (res) {
          $scope.captcha = res.data.session;
          $element.attr('src', 'data:image/png;base64,' + res.data.captcha);
        });
      }
      reloadCaptcha();
      $scope.$parent.reloadCaptcha = reloadCaptcha;
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
        localStorageService,
        Session
      ) {
        var sessions = localStorageService.get('sessions');
        if (!angular.isArray(sessions) || !sessions[0]) {
          return;
        }
        return $http.get('/info', {
          params: {
            session: _.map(sessions, 'session')
          }
        }).then(function (res) {
          _.each(res.data, function (session) {
            if (!angular.isArray(session.info) || session.info.length === 0) {
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
            session.info = _.find(res.data, { session: session.session });
          });
          var removed = _.remove(sessions, function (session) {
            return session.info.balance < 0;
          });
          if (removed.length) {
            Session.save(sessions);
          }
          return sessions;
        });
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

  this.add = function (msg) {
    this.statuses.unshift(msg);
    if (this.statuses.length > this.max) {
      this.statuses.length = this.max;
    }
  };
}).
service('Client', function (
) {
  this.client = undefined;

  this.connect = function (sessions) {
    var url = 'ws://' + window.location.hostname + ':8080/?';
    url += _.map(sessions, function (sess) {
      return 'session=' + sess.session;
    }).join('&');
    this.client = new WebSocket(url);;
    return this.client;
  };
}).
controller('MainCtrl', function (
  $filter,
  $http,
  $route,
  $scope,
  localStorageService,
  Client,
  Session,
  Sessions,
  Status
) {
  var self = this;

  this.sessions = Sessions || [];
  this.session = this.sessions[0];

  this.status = Status;

  var ws = Client.connect(this.sessions);
  ws.onmessage = function (msg) {
    var date = '[' + new Date(msg.timeStamp).toJSON() + '] ';
    $scope.$apply(function () {
      self.status.add(date + msg.data);
    });
  };

  this.login = function () {
    this.loggingin = true;
    $http.post('/login', {
      username: self.username,
      password: self.password,
      session: self.captcha_session,
      captcha: self.captcha
    }).then(function (res) {
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
    _.remove(self.sessions, self.session);
    Session.save(self.sessions);
    $route.reload();
  };

  this.start = function () {
    var session = this.session;
    if (!angular.isObject(session)) {
      return;
    }
    $http.post('/start', {
      product: self.product,
      type: self.type,
      quantity: session.quantity,
      session: session.session
    }).then(function () {
      self.started = true;
    });
  };

  this.abort = function () {
    var session = this.session;
    if (!angular.isObject(session)) {
      return;
    }
    $http.post('/start', {
      session: session.session
    }).then(function () {
      self.started = false;
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
