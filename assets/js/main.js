angular.module('hyr', [
  'ngRoute',
  'LocalStorageModule'
]).config(function (
  $locationProvider,
  localStorageServiceProvider
) {
  localStorageServiceProvider.setPrefix('hyr');
  $locationProvider.html5Mode(true);
});;
