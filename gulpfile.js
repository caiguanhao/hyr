var del = require('del');
var rev = require('gulp-rev');
var gulp = require('gulp');
var gzip = require('gulp-gzip');
var filter = require('gulp-filter');
var uglify = require('gulp-uglify');
var useref = require('gulp-useref');
var ngAnnotate = require('gulp-ng-annotate');
var preprocess = require('gulp-preprocess');
var revReplace = require('gulp-rev-replace');
var runSequence = require('run-sequence');
var angularTemplatecache = require('gulp-angular-templatecache');

var now = new Date();
var pad0 = function (n) { return n < 10 ? '0' + n : n; };
var VER = [
  now.getFullYear(), pad0(now.getMonth() + 1), pad0(now.getDate()),
  pad0(now.getHours()), pad0(now.getMinutes()), pad0(now.getSeconds())
].join('_');
var dist = 'dist/' + VER;
var MAX_REVS = 10; // maximum entries in /dist

gulp.task('clean', function () {
  return del(['.tmp']);
});

gulp.task('views', function () {
  return gulp.src(['main.html']).
    pipe(angularTemplatecache('templates.js', {
      root: '/',
      module: 'hyr'
    })).
    pipe(gulp.dest('.tmp'));
});

gulp.task('build', function () {
  var assets = useref.assets();
  var jsFilter = filter(['*.js', '!vendors.js'], {restore: true});
  var vendorJsFilter = filter(['vendors.js'], {restore: true});
  var cssFilter = filter(['*.css'], {restore: true});
  return gulp.src('index.html').
    pipe(preprocess({context: {PRODUCTION: true}})).
    pipe(assets).
    pipe(jsFilter).
    pipe(ngAnnotate()).
    pipe(uglify()).
    pipe(rev()).
    pipe(jsFilter.restore).
    pipe(vendorJsFilter).
    pipe(rev()).
    pipe(vendorJsFilter.restore).
    pipe(cssFilter).
    pipe(rev()).
    pipe(cssFilter.restore).
    pipe(assets.restore()).
    pipe(useref()).
    pipe(revReplace()).
    pipe(gulp.dest(dist));
});

gulp.task('gzip', function () {
  return gulp.src(dist + '/*').
    pipe(gzip()).
    pipe(gulp.dest(dist));
});

gulp.task('release', function (done) {
  require('child_process').exec('ln -nfs ' + VER + ' dist/latest', done);
});

gulp.task('clean-dist', function () {
  var fs = require('fs');
  var dirsToDel = [];
  var dirs = fs.readdirSync('dist').filter(function (file) {
    return fs.lstatSync('dist/' + file).isDirectory();
  });
  dirs.sort();
  if (dirs.length > MAX_REVS) {
    dirsToDel = dirs.slice(0, dirs.length - MAX_REVS).map(function (dir) {
      return 'dist/' + dir;
    });
  }
  return del(dirsToDel);
});

gulp.task('default', function (done) {
  runSequence(
    ['clean'],
    ['views'],
    ['build'],
    ['gzip'],
    ['release'],
    ['clean-dist'],
    done
  );
});
