/**
 * Created by Leo on 01/02/2015.
 */
'use strict';

var _ = require('lodash');

/**
 * Funzione vuota
 */
exports.noop = function(){};

/**
 * Modifica tutti i caratteri diversi dalle lettere e numeri in underscore
 * @param filename
 * @returns {*}
 */
function validateFileName(filename){
  return filename.replace(/[^0-9a-zA-Z]+/g, "_");
}
exports.validateFileName = validateFileName;


exports.uiid_templates = {
  guid: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx',
  id12: 'xxxxxxxxxxxx'
};

exports.uuid = function(template) {
  template = template || 'xxxxxxxxxxxx';
  var d = new Date().getTime();
  return template.replace(/[xy]/g, function(c) {
    var r = (d + Math.random()*16)%16 | 0;
    d = Math.floor(d/16);
    return (c==='x' ? r : (r&0x3|0x8)).toString(16);
  });
};

/**
 * Verifica che l'elemento non sia nullo e abbia una lunghezza maggiore di l (default=0)
 * @param arr
 * @param l
 * @returns {*|boolean}
 */
function isNotNullOrEmpty(arr, l){
  l = l || 0;
  return arr && arr.length>l;
}
exports.isNotNullOrEmpty = isNotNullOrEmpty;

function merge(v, tmpl) {
  tmpl = tmpl || '00';
  v = ''+v;
  var diff = tmpl.length-v.length;
  if (diff>0)
    v = tmpl.slice(0,diff) + v;
  return v;
}
exports.merge = merge;


function getCharEsa(cc, upper){
  if (!cc) return '';
  var h = cc.toString(16);
  if (upper) h = h.toUpperCase();
  if (h.length < 2)
    h = "0" + h;
  return h;
}

function isLitteral(cc) {
  return (cc>=65 && cc<=90) || (cc>=97 && cc<=122);
}

function encodeToEsa(s, pswmode) {
  var res = '';
  for (var i = 0,n = s.length; i<n; i++) {
    if (pswmode) {
      if (isLitteral(s.charCodeAt(i)))
        res += s[i];
      else {
        res += '%'+(s?getCharEsa(s.charCodeAt(i), true):'');
      }
    } else {
      res += s?getCharEsa(s.charCodeAt(i)):'';
    }
  }
  return res;
}
exports.encodeToEsa = encodeToEsa;

function decodeFromEsa(s) {
  var res = '';
  for (var i = 0, n = s.length; i<n; i += 2) {
    res += String.fromCharCode("0x" + s.substring(i, i + 2));
  }
  return res;
}
exports.decodeFromEsa = decodeFromEsa;


function getToday(time) {
  var now = new Date();
  var date = merge(now.getDate()) + '/' + merge((now.getMonth() + 1)) + '/' + now.getFullYear();
  if (time)
    date += ' '+now.getHours()+':'+now.getMinutes()+':'+now.getSeconds()+'.'+now.getMilliseconds();
  return date;
}
exports.getToday = getToday;

/**
 * Valida le opzioni (richiede la presenza di utente e password)
 * @param req //request
 * @returns {*} options
 */
function checkReqOpt(req) {
  var reqopt = req.body;
  if (reqopt) {
    reqopt.today = getToday();
    if (!_.has(reqopt, 'SSL') ) reqopt.SSL = true;
    reqopt.debuglines = [];
  }

  return (!reqopt || !reqopt.user || !reqopt.user.password || !reqopt.user.name) ? undefined : reqopt;
}
exports.checkReqOpt = checkReqOpt;

function deepClone(o) {
  return JSON.parse(JSON.stringify(o));
}
exports.deepClone = deepClone;


/**
 * Logga il testo
 * @param {string} txt
 * @param {boolean} [totarget]
 * @param {[]} [target]
 */
function log(txt, totarget, target) {
  if (!totarget) return;
  target = target || [];
  target.push('['+getToday(true)+'] '+txt);
  console.log(txt);
}
exports.log = log;


function findInCll(cll, voice, cb, indices) {
  indices = indices || [];
  (cll||[]).forEach(function (ci, idx) {
    if (ci === voice) {
      indices.push(idx);
      return cb(indices);
    } else if (_.isArray(ci)) {
      const idc = deepClone(indices);
      idc.push(idx);
      findInCll(ci, voice, cb, idc);
    }
  });
}
exports.findInCll = findInCll;

function getAt(cll, indices) {
  var v = cll;
  if (_.isArray(v)) (indices||[]).forEach(function(i){v = v[i];});
  return v;
}
exports.getAt = getAt;
