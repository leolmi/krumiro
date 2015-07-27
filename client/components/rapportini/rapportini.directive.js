/* Created by Leo on 24/07/2015. */
'use strict';

angular.module('krumiroApp')
  .directive('rapportini', [function () {
    return {
      restrict: 'E',
      scope: {context: '=ngModel'},
      templateUrl: 'components/rapportini/rapportini.html',
      link: function (scope, elm, atr) {

        function parse(v,min,max) {
          var rv = parseInt(v) || 0;
          if (rv<min) rv=min;
          if (rv>max) rv=max;
          return rv;
        }

        scope.handleKeySearch = function(e) {
          if (e.keyCode==13)
            scope.$parent.reloadRap();
        };

        scope.toggleAdvancedRap = function() {
          scope.context.rap.advanced = !scope.context.rap.advanced;
        };

        scope.toggleSel = function(i) {
          i.selected = i.selected ? false : true;
          //scope.$apply(scope.getFilteredSummary());
          scope.getFilteredSummary();
        };

        scope.clearSel = function() {
          if (scope.filtered)
            scope.filtered.forEach(function(f){ f.selected = false; });
          scope.getFilteredSummary();
        };

        /**
         * Restituisce il numero di minuti dell'orario (per rapportini)
         * @param t
         * @returns {number}
         */
        function getMinutesRap(t) {
          if (!t) return 0;
          var pattern = /\d+/g;
          var values = t.match(pattern);
          var mt = 0;
          if (values && values.length>0) {
            var h = parse(values[0],0,23);
            var m = 0;
            if (values.length>1) {
              m = parse(values[1],0,99);
              m = m ? m/100 : 0;
            }
            mt = h+m;
          }
          return mt;
        }

        scope.getFilteredSummary = function() {
          var tot = 0;
          var totv = 0;
          var totsel = 0;
          var totselv = 0;
          var sel = 0;
          if (scope.filtered)
            scope.filtered.forEach(function(f){
              var m = getMinutesRap(f['C5']);
              var v = getMinutesRap(f['C7']);
              tot += m;
              totv += v;
              if (f.selected) {
                sel++;
                totsel += m;
                totselv += v;
              }
            });
          scope.rapSummary = tot;
          scope.rapSummaryV = totv;
          scope.rapSummaryGG = (tot / 8).toFixed(2);
          scope.rapSummaryVGG = (totv / 8).toFixed(2);
          scope.rapSummarySel = totsel;
          scope.rapSummarySelV = totselv;
          scope.rapSummarySelGG = (totsel / 8).toFixed(2);
          scope.rapSummarySelVGG = (totselv / 8).toFixed(2);
          scope.context.rap.selection = sel;
          return tot;
        };


        if (!scope.context.rap.clear)
          scope.context.rap.clear = scope.clearSel;
      }
    }
  }]);
