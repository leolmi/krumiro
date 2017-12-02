/* Created by Leo on 02/12/2017. */
'use strict';
const _ = require('lodash');
const cheerio = require("cheerio");
const u = require('../utilities/util');
const w = require('../utilities/web');
const C = process.env;

const _parameters = [
  {bookmark:'[P1]', value:C.INAZ_P1_VoceMenu},
  {bookmark:'[P2]', value:C.INAZ_P2_AccessCode},
  {bookmark:'[P3]', value:C.INAZ_P3_Query},
  {bookmark:'[P4]', value:C.INAZ_P4_VoceMenu},
  {bookmark:'[P5]', value:C.INAZ_P5_Query}
];

/**
 * Restituisce la tabella degli orari
 * @param html
 * @returns {Array}
 */
exports.parse = function(html, root) {
  root = root||'#ris_umane';
  html = html.replace(/<br>/g,'|');
  var table = [];
  var $ = cheerio.load(html);
  $(root).find('tbody > tr').each(function() {
    var row = {};
    $(this).children().each(function(i, e){
      row['C'+i] = $(e).text();
    });
    table.push(row);
  });
  return table;
};

/**
 * Sostituisce i valori dei parametri predefiniti
 * @param voice
 * @returns {*}
 */
function _replace(voice) {
  _parameters.forEach(function(p){
    voice = voice.replace(p.bookmark,p.value);
  });
  return voice;
}
exports.replace = _replace;

  /**
 * Restituisce un valore numerico univoco per l'item
 * @param d
 * @returns {Number}
 */
function _getDataN(d) {
  return parseInt(d['C1'].substr(6,4)+d['C1'].substr(3,2)+d['C1'].substr(0,2)+ u.merge(d['C2'])+u.merge(d['C3']));
}

function _getTimeM(d) {
  return (parseInt(d['C2'])*60)+parseInt(d['C3']);
}

function _getValues(d) {
  var v = [];
  for(var p in d)
    if (d.hasOwnProperty(p))
      v.push(d[p]);
  return v;
}

/**
 * Traduce i dati passati in dati utilizzabili nel db
 * @param {object} user
 * @param {object} history
 */
exports.normalize = function(user, history) {
  var userdata = {
    user: user.name,
    data: [],
    meta: []
  };
  if (history && history.data && history.data.length)
    history.data.forEach(function (h) {
      userdata.data.push({
        key: _getDataN(h),
        time: _getTimeM(h),
        C: _getValues(h)
      })
    });
  if (history && history.meta && history.meta.length)
    userdata.meta = userdata.meta.concat(history.meta);
  return userdata;
};

function _getDenRow(d) {
  var result = {};
  d.C.forEach(function(v,i){
    result['C'+i]=v;
  });
  result.key= d.key;
  return result;
}

function _sortData(userdata, inverse){
  var sign = inverse ? -1 : 1;
  userdata.data.sort(function(d1,d2){ return sign*(d1.key - d2.key); });
}
exports.sortData = _sortData;

exports.denormalize = function(exdata) {
  var result = {
    data:[],
    meta:[]
  };

  if (exdata){
    if (exdata.data && exdata.data.length) {
      exdata.data.forEach(function(d) {
        result.data.push(_getDenRow(d));
      });
      _sortData(result, true);
    }
    if (exdata.meta && exdata.meta.length)
      result.meta = result.meta.concat(exdata.meta);
  }
  return result;
};


exports.mergeData = function(userdata, exdata) {
  if (userdata.data && userdata.data.length>0) {
    console.log('[mergeData] - userdata:' + JSON.stringify(userdata));
    //deve eliminare tutti quelli le cui date sono presenti nei nuovi record
    // giorni delle nuove rilevazioni
    var days = [];
    userdata.data.forEach(function (d) {
      if (days.indexOf(d.C[1]) < 0)
        days.push(d.C[1]);
    });
    console.log('[mergeData] - userdata days:' + JSON.stringify(days));
    // rimuove tutte le rilevazioni ai giorni specificati
    console.log('[mergeData] - before remove:' + JSON.stringify(exdata.data));
    _.remove(exdata.data, function (d) {
      return (days.indexOf(d.C[1]) >= 0);
    });
    console.log('[mergeData] - after remove:' + JSON.stringify(exdata.data));
    exdata.data = exdata.data.concat(userdata.data);
    _sortData(exdata);
  }
};

exports.mergeMeta = function(userdata, exdata, today) {
  if (userdata.meta && userdata.meta.length>0) {
    var days = [];
    userdata.meta.forEach(function (m) {
      if (days.indexOf(m.day) < 0) days.push(m.day);
    });
    days.push(today);
    var metas = exdata.meta.filter(function (m) {
      return (days.indexOf(m.day) < 0);
    });
    exdata.meta = metas.concat(userdata.meta);
  }
};


function _getList(menu, txt) {
  const rgx = new RegExp('\\s' + menu + '=(.*?)(?=;)', 'g');
  const m = rgx.exec(txt);
  const list_str = m ? m[1] : '[]';
  return JSON.parse(list_str);
}


function _parseMenuVoice(content, voice, menus, cb) {
  var voices = _getList(menus[0], content);
  u.findInCll(voices, voice, function(indices) {
    const result = {};
    menus.forEach(function(mn){
      const m = _getList(mn, content);
      result[mn] = u.getAt(m, indices);
    });
    cb(result)
  });
}

exports.keepMenuKeys = function(o) {
  return function (item, options, content) {
    const menus = C.INAZ_START_MenuTree.split(',');
    const code = parseInt(o.parameters.VoceMenu);
    _parseMenuVoice(content, code, menus, function (data) {
      w.checkKeeper(options, C.INAZ_START_MenuName, (data || {})[C.INAZ_START_MenuName_V]);
      w.checkKeeper(options, C.INAZ_START_MenuAction, (data || {})[C.INAZ_START_MenuAction_V]);
    });
    return 'executed';
  }
};

exports.keepPdfUrl = function (item, options, content) {
  const m = (/<tr.*id="\$doclaser_dip\$0\$0".*VisualizzaDoc\('(.*?)(?=')/g).exec(content);
  const url_cnt = m ? m[1] : '';
  return u.encodeToEsa(url_cnt);
};
