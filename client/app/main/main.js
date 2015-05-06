/**
 * Created by Leo on 01/04/2015.
 */
'use strict';

angular.module('krumiroApp')
  .config(function ($routeProvider) {
    $routeProvider
      .when('/', {
        templateUrl: 'app/main/main.html',
        controller: 'TempiCtrl'
      });
  });
