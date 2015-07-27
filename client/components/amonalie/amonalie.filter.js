/* Created by Leo on 22/07/2015. */
'use strict';

angular.module('krumiroApp')
  .filter('amfilter', function() {
    //var breakEx = {};

    String.prototype.checkCase = function(casesens) {
      return casesens ? this.trim() : this.toLowerCase().trim();
    };
    Array.prototype.clean = function(deleteValue) {
      for (var i = 0; i < this.length; i++) {
        if (this[i] == deleteValue) {
          this.splice(i, 1);
          i--;
        }
      }
      return this;
    };

    function isNotNullOrEmpty(arr){
      return arr && arr.length>0;
    }

    function getTexts(text,o){
      var texts = [];
      if (isNotNullOrEmpty(o.multisep)>0){
        texts = text.split(o.multisep).clean('');
      } else {
        texts.push(text);
      }
      return texts;
    }

    function isCodesFilter(text) {
      if (!isNotNullOrEmpty(text)) return false;
      var codes = text.match(/\d+/g);
      if (!isNotNullOrEmpty(codes)) return false;
      var codesStr = codes.join(',');
      return codesStr.length>2 && text.length-codesStr.length<10;
    }

    function getItemsByCodes(items, text, o, output){
      var codes = text.match(/\d+/g);

      if (isNotNullOrEmpty(codes)) {
        keepItems(items, output, function (i) {
          return codes.some(function (c) {
            return (i.values[0].checkCase(o.casesens).indexOf(c.checkCase(o.casesens)) >= 0);
          });
        });
      }
      return output;
    }

    function getItemsByFields(items, text, headers, o, output) {
      var indexes = [];
      // costruisce l'elenco degli indici dei campi scelti dall'utente
      o.fields.forEach(function (f) {
        indexes.push(headers.indexOf(f));
      });

      if (isNotNullOrEmpty(text)) {
        // costruisce l'elenco dei valori da cercare
        var texts = getTexts(text,o);
        keepItems(items, output, function (i) {
          return indexes.some(function (x) {
            return texts.some(function(t){
              return (i.values[x].checkCase(o.casesens).indexOf(t.checkCase(o.casesens)) >= 0);
            });
          });
        });
        return output;
      }

      //se non è definita una ricerca valida restituisce tutti gli elementi
      return items;
    }

    function getItemsByText(items, text, o, output){
      if (isNotNullOrEmpty(text)) {
        var texts = getTexts(text,o);
        keepItems(items, output, function (i) {
          return texts.some(function(t) {
            return (JSON.stringify(i).checkCase(o.casesens).indexOf(t.checkCase(o.casesens)) >= 0);
          });
        });
        return output;
      }
      //se non è definita una ricerca valida restituisce tutti gli elementi
      return items;
    }

    /**
     * Itera gli item e aggiunge quelli che validano la funzione
     * @param {array} items
     * @param {array} output
     * @param {function} isvalid
     */
    function keepItems(items, output, isvalid) {
      // cerca gli elementi compatibili con i criteri di ricerca
      if (isNotNullOrEmpty(items)) {
        // per ogni item verifica...
        items.forEach(function (i) {
          if (isvalid(i)) output.push(i);
        });
        return true;
      }
      return false;
    }


    return function(items, amonalies) {
      var o = amonalies.o || {};
      var text = amonalies.filter;
      var headers = amonalies.headers.values;
      var output = [];

      // se sono stati scelti dei campi di ricerca questa viene
      // fatta esclusivamente su questi
      if (o.fields && o.fields.length > 0 && headers && headers.length > 0)
        return getItemsByFields(items, text, headers, o, output);

      // rileva se la richiesta è un elenco di codici
      if (isCodesFilter(text) || o.codes)
        return getItemsByCodes(items, text, o, output);

      // cerca il testo nel json
      return getItemsByText(items, text, o, output);
    }
  });
