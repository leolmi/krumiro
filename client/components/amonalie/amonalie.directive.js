/* Created by Leo on 21/07/2015. */
/*
  "C0":"Codice",
  "C1":"Data",
  "C2":"Applicativo",
  "C3":"Funzione",
  "C4":"Versione",
  "C5":"Priorità",
  "C6":"Priorità interna",
  "C7":"Stato",
  "C8":"Oggetto",
  "C9":"Descrizione",
  "C10":"Istituto",
  "C11":"Id Sistema Cliente",
  "C12":"Note",
  "C13":"Tipo",
  "C14":"Data inizio lavori",
  "C15":"GG di lavoro previsti",
  "C16":"Versione correttiva",
  "C17":"Nome e cognome",
  "C18":"ReferenteTec",
  "C19":"Attribuzioni"
*/
angular.module('krumiroApp')
    .directive('amonalie', [function () {
        return {
            restrict: 'E',
            scope: {context: '=ngModel'},
            templateUrl: 'components/amonalie/amonalie.html',
            link: function (scope, elm, atr) {

              scope.toggleDetails = function(r) {
                r.details = r.details ? false : true;
              };

              scope.toggleAmOptionValue = function(pn){
                scope.context.amonalie.o[pn] = !scope.context.amonalie.o[pn];
              };

              //scope.isSelected = function(r) { return (scope.context.amonalie.selection.indexOf(r)>=0); };
              //
              //scope.getStyle = function(r){
              //  var s = {};
              //  if (scope.context.amonalie.selection.indexOf(r)>=0){
              //    s['row-selected']=true;
              //  }
              //  return s;
              //};
              //
              //scope.select = function(r) {
              //  if (!r) return;
              //  if (!scope.context.amonalie.selection)
              //    scope.context.amonalie.selection = [];
              //  var idx = scope.context.amonalie.selection.indexOf(r);
              //  if (idx<0)
              //    scope.context.amonalie.selection.push(a);
              //  else
              //    scope.context.amonalie.selection.splice(idx,1);
              //};
            }
        }
    }]);
