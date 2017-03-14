'use strict';

angular.module('krumiroApp')
  .directive('trullo', [
    function () {
      return {
        restrict: 'E',
        templateUrl: 'app/trullo/trullo.html',
        controllerAs: 'trullo',
        controller: function () {
          var trullo = this;

          trullo.active = false;
          trullo.toggle = function() {
            trullo.active = !trullo.active;
          };


          return trullo;
        }
      }
    }]);
