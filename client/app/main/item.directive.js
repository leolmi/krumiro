/**
 * Created by Leo on 01/04/2015.
 */
'use strict';

angular.module('krumiroApp')
  .directive('tempiItem', ['$location', function ($location) {
    return {
      restrict: 'E',
      scope: {item: '=ngModel'},
      templateUrl: 'app/main/item.html',
      link: function (scope, elm, atr) {
        scope.changed = function() {
          scope.$parent.recalc();
        };

        scope.maincontext = scope.$parent.context;

        scope.format = function(type) {
          const m = scope.item[type].match(/\d+/g);
          if (m) scope.item[type] = m[0] + ':' + (m.length > 1 ? (m[1].length < 2 ? '0' + m[1] : m[1]) : '00');
        };

        scope.toggleAlarm = function(p) {
          // quando l'allarme sta suonando è disattivabile solo dal controllo generale
          if (scope.item[p + 'ed']) return;
          scope.item[p] = !scope.item[p];
          if (!scope.item[p]) {
            scope.item[p + 'ed'] = false;
          }
        }
      }
    }
  }]);
