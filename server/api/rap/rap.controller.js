/* Created by Leo on 01/07/2015. */
'use strict';
var _ = require('lodash');
var cheerio = require("cheerio");
var u = require('../utilities/util');
var w = require('../utilities/web');

function getToday() {
  var now = new Date();
  return u.merge(now.getDate()) + '/' + u.merge((now.getMonth() + 1)) + '/' + now.getFullYear();
}

function isEmpty(r) { return (!r || !r.hasOwnProperty('C0')); }

function getType(r) {
  var style = r.attr('style');
  if (style.indexOf('background-color:Snow;')>=0 ||
    style.indexOf('background-color:WhiteSmoke;')>=0) return 'day';
  if (style.indexOf('background-color:LightCyan;')>=0) return 'work';
  return '';
}

function parseRap(content) {
  content = content.replace(/<br>/g,'|');
  var table = [];
  var row = {};
  var date = undefined;
  var loc = undefined;
  var travel = undefined;
  var $ = cheerio.load(content);
  $('#tblRap > tr').each(function(ri) {
    //console.log('riga corrente: '+$(this).text()+'   style:'+$(this).attr('style'));
    //riga intestazione
    if (getType($(this))=='day'){
      //console.log('RIGA: '+ri+'   valori:'+JSON.stringify(row));
      if (!isEmpty(row)) table.push(row);
      var absence = false;
      $(this).children().each(function(i, e) {
        if (i==0) date = $(e).text();
        if (i==4) loc = $(e).text().trim();
        if (i==5) travel = $(e).text();
        if (i==3 && $(e).text())
          absence=true;
        if (absence) {
          row['C0'] = date;
          //descrizione assenza
          if (i==3) row['C1'] = $(e).text();
          //ore di assenza
          if (i==6) row['C5'] = $(e).text();
        }
      });
      if (!isEmpty(row)) table.push(row);
      row = {};
    }
    //riga singolo valore
    if (getType($(this))=='work'){
      $(this).children().each(function(i, e){ row['C'+i] = $(e).text(); });
      row['C0'] = date;
      row['C6'] = loc;
      row['C7'] = travel;
      if (!isEmpty(row)) table.push(row);
      row = {};
      date = undefined;
      travel = undefined;
      loc = undefined;
    }
  });
  if (!isEmpty(row)) table.push(row);
  return table;
}

function getMonthN(date){
  var pattern = /\d+/g;
  var values = date.match(pattern);
  if (values && values.length>1)
    return parseInt(values[0])+ parseInt(values[1])*12;
}
function getMonth(N){
  var y = Math.floor(N/12);
  return (N-y*12)+'/'+y;
}

function getMonths(o){
  var months = [];
  var m1 = getMonthN(o.date);
  var m2 = getMonthN(o.todate);
  for (var y=Math.min(m1,m2),yf=Math.max(m1,m2); y<=yf; y++){
    months.push(getMonth(y));
  }
  return months;
}

exports.data = function(req, res) {
  var o = u.checkReqOpt(req);
  if (!o) return w.error(res, new Error('Utente non definito correttamente!'));
  if (!o.date) return w.error(res, new Error('Data di riferimento non definita correttamente!'));

  o.debuglines = [];
  var results = {};
  if (o.advanced && o.todate){
    var months = getMonths(o);
    multimilk(o, months, function(err, table){
      //console.log('Fine estrazione multipla. errori:'+(err ? 'si' : 'no'));
      if (err) return w.error(res, err, o.debuglines);
      results.data = table;
      if (o.debug) results.debug = o.debuglines;
      return w.ok(res, results);
    });
  }
  else{
    milk(o, function(err, table){
      if (err) return w.error(res, err, o.debuglines);
      results.data = table;
      if (o.debug) results.debug = o.debuglines;
      return w.ok(res, results);
    });
  }
};
/**
 *
 * @param {object} o
 * @param {array} months
 * @param {function} cb
 * @param {number} [index]
 * @param {array} [results]
 */
function multimilk(o, months, cb, index, results) {
  index = index || 0;
  results = results || [];
  var opt = {
    user: o.user,
    date: months[index],
    debug: o.debug,
    debuglines: o.debuglines
  };
  //console.log('Multimilk: '+months[index]);
  milk(opt, function(err, table){
    if (err) return cb(err);
    results = _.union(results, table);
    if (index==months.length-1)
      return cb(null, results);
    multimilk(o, months, cb, index+1, results);
  });
}

function milk(o, cb) {
  cb = cb || u.noop;

  var options = {
    SSL: true,
    host: process.env.RAP_HOST,
    method: 'GET',
    keepAlive: true,
    debug: o.debug,
    debuglines: o.debuglines,
    keepers: [
      {
        name: '__VIEWSTATE',
        pattern: '<input.*?name="__VIEWSTATE".*?value="(.*?)".*?>',
        always: true
      },
      {
        name: '__VIEWSTATEGENERATOR',
        pattern: '<input.*?name="__VIEWSTATEGENERATOR".*?value="(.*?)".*?>',
        always: true
      },
      {
        name: '__EVENTVALIDATION',
        pattern: '<input.*?name="__EVENTVALIDATION".*?value="(.*?)".*?>',
        always: true
      }
    ],
    headers: {
      'authorization': w.getBasicAuth(o.user.name, o.user.password),
      'accept': w.constants.content_accept_text,
      'accept-language': 'it-IT',
      'content-type': w.constants.content_type_appwww,
      'user-agent': w.constants.user_agent_moz,
      'DNT': '1'
    }
  };

  var sequence = [{
    title:'ACCESS',
    path: process.env.RAP_PATH_LOGIN
  }, {
    title:'DATA_1',
    method:'POST',
    path:process.env.RAP_PATH_DATA1,
    referer:process.env.RAP_PATH_REFERER_DATA1,
    data: {
      __LASTFOCUS:'',
      __EVENTTARGET:'',
      __EVENTARGUMENT:'',
      lblscreenwidth:'1920',
      txtdatarap:'1/1/2015',
      'dtgRap:_ctl3:hcAtt':'',
      txtWarning1:'',
      txtWarning2:'',
      txtWarning3:'',
      'btnPrint.x':12,
      'btnPrint.y':6
    }
  },{
    title:'DATA_2',
    method:'POST',
    path:process.env.RAP_PATH_DATA2,
    referer:process.env.RAP_PATH_REFERER_DATA2,
    data: {
      txtdatarap: o.date,
      btnupdView: 'Riepilogo'
    }
  }];

  w.chainOfRequests(options, sequence, function(err, c) {
    console.log('RESULT ', err, c);
    if (err) return cb(err);

    console.log('CONTENT: ', c);
    var table = parseRap(c);
    //var txt = JSON.stringify(amonalie);
    //txt = txt.replace(/},{/g,'\r\n');
    //console.log('DATI: '+txt);
    return cb(null, table);
  });
}



