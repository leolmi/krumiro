/**
 * Created by Leo on 01/04/2015.
 */
'use strict';

angular.module('krumiroApp')
  .config(function ($routeProvider) {
    $routeProvider
      .when('/', {
        templateUrl: function() {
          const mobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent.toLowerCase());
          const html_class = mobile ? 'mobile' : 'pc-style';
          $('html').addClass(html_class);
          // return mobile ? 'app/main/main-mb.html' : 'app/main/main.html';
          return mobile ? 'app/main/mobile.html' : 'app/main/main.html';
        },
        controller: 'TempiCtrl'
      });
  });
