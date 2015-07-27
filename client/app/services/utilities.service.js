/* Created by Leo on 27/07/2015. */
'use strict';

angular.module("krumiroApp")
  .factory("Utilities",[function(){
    /**
     * Mergia due stringhe:
     * esempio: '3'  tmpl='00'  -> '03'
     * @param {string} v
     * @param {string} [tmpl]
     * @returns {string}
     */
    function merge(v, tmpl) {
      tmpl = tmpl || '00';
      if (v.length<tmpl.length)
        v = tmpl.substr(0, tmpl.length-v.length)+v;
      return v;
    }

    /**
     * Decifra la stringa che rappresenta la data
     * @param {string} str
     * @returns {number}
     */
    function parseDate(str) {
      var pattern = /(\d{1,2})\/(\d{1,2})\/(\d{4})/g;
      if (!str || str.length > 10 || str.length<8) return 0;
      var m = pattern.exec(str);
      if (!m) return 0;
      return parseInt(m[3]+merge(m[2])+merge(m[1]));
    }

    /**
     * Restituisce il valore numerico (minuti) in formato time:
     * 500 ->  8:20
     * @param {Number} m
     * @returns {string}
     */
    function getTime(m) {
      var sign = (m<0) ? -1 : 1;
      if (m<0) m = -m;
      var hT = Math.floor(m/60);
      var mT = m-(hT*60);
      if (mT.toString().length<2) mT='0'+mT;
      return (hT*sign)+':'+mT;
    }

    //note:
    //function parsestr(s){
    //  s = s.replace(/\t/g,'');
    //  s = s.split(/\r\n\r\n\r\n\r\n/g);
    //  return s;
    //}
    //$scope.test1 = parsestr($scope.test);

    return{
      merge:merge,
      getTime:getTime,
      parseDate:parseDate
    }
  }]);
