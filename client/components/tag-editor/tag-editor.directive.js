/* Created by Leo on 23/06/2015. */
'use strict';

angular.module('krumiroApp')
  .directive('tagEditor', ['$timeout', function ($timeout) {
    return {
      restrict: 'E',
      scope: {tags: '=', alltags: '='},
      templateUrl: 'components/tag-editor/tag-editor.html',
      link: function (scope, elm, atr) {

        var input = elm[0].querySelector('input');
        scope.focused = false;
        scope.delete = function(index) {
          scope.tags.splice(index, 1);
        };

        scope.addtag = function(e) {
          switch (e.keyCode) {
            case 8:
              if (!scope.temptag && scope.tags && scope.tags.length>0)
                scope.tags.pop();
              break;
            case 13:
              if (scope.temptag) {
                scope.tags = _.union(scope.tags, [scope.temptag]);
                scope.temptag = '';
              }
              break;
          }
        };

        scope.setfocus = function() {
          $timeout(function() {
            input.focus();
          });
        };
      }
    }
  }]);
