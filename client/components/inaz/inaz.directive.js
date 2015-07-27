/* Created by Leo on 27/07/2015. */
'use strict';

angular.module('krumiroApp')
  .directive('inaz', ['Utilities',function(U) {
    return {
      restrict: 'E',
      scope: {context: '=ngModel'},
      templateUrl: 'components/inaz/inaz.html',
      link: function (scope, elm, atr) {
        /**
         * Calcola l'intervallo richiesto per il calcolo dei dati
         * @param interval
         * @returns {boolean}
         */
        function getInterval(interval){
          interval.da = U.parseDate(scope.context.inaz.analisys.da);
          interval.a = U.parseDate(scope.context.inaz.analisys.a);
          return interval.da > 0 && interval.a > 0;
        }

        /**
         * Calcola le ore lavorate
         * @param {[object]} items
         * @returns {number}
         */
        function calcWork(items){
          var result = 0;
          var e = 0;
          items.forEach(function(i){
            if (e>0) { result += (i.time-e); e=0; }
            else e = i.time;
          });
          return result;
        }

        /**
         * Struttura classe item [i]:
         *    i.day = '01/01/2010'
         *    i.items = [{time:491},{time:780},...]
         */
        scope.recalcAnal = function() {
          if (!scope.context.inaz.items || scope.context.inaz.items.length<=0) return;
          var interval = {da:0,a:0};
          if (!getInterval(interval)) return;
          var res ={ days:0, work:0, done:0, perm:0 };

          //Calcolo dei valori...
          scope.context.inaz.items.forEach(function(i){
            if (i.dayn>=interval.da && i.dayn<=interval.a){
              var done = calcWork(i.items);
              if (done>0) {
                res.days++;
                res.work += i.work || (8 * 60);
                res.done += done;
                res.perm += i.perm || 0;
              }
            }
          });

          scope.context.inaz.analisys.results = [
            { name: "Giorni considerati", value:res.days },
            { name: "Totale ore da lavorare", value:U.getTime(res.work) },
            { name: "Totale ore lavorate", value:U.getTime(res.done) },
            { name: "Permessi", value:U.getTime(res.perm) },
            { name: "Differenza*", value:U.getTime(res.done - res.work + res.perm) }];
        };

        if (!scope.context.inaz.analisys.calc)
          scope.context.inaz.analisys.calc = scope.recalcAnal;
      }
    }
  }]);
