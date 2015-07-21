/* Created by Leo on 21/07/2015. */
'use strict';

angular.module('krumiroApp')
  .directive('filter', [function () {
    return {
      restrict: 'E',
      scope: {context: '=ngModel'},
      templateUrl: 'components/filter/filter.html',
      link: function (scope, elm, atr) {

        function newFilter() {
          return {
            F: {field: '', operator: '=', value: ''},
            o: {},
            e: {}
          }
        }

        var filter = {
          C: {},
          o: {},
          e: {}
        };


        var F1 = {
          C:{
            F: { campo: 'A', operatore: '', valore: '' },
            o: {
              F: { campo: 'B', operatore: '', valore: '' },
              o: {},
              e: {}
            },
            e: {
              F: { campo: 'C', operatore: '', valore: '' },
              o: {
                F: { campo: 'D', operatore: '', valore: '' },
                o: {},
                e: {}
              },
              e: {}
            }
          },
          o:{
            F:{ campo: 'C', operatore: '', valore: '' },
            o:{},
            e:{
              F: { campo: 'F', operatore: '', valore: '' },
              o: {},
              e: {}
            }
          },
          e:{}
        };
        var F2 = {};
      }
    }
  }]);
