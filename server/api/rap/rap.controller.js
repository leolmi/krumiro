/* Created by Leo on 01/07/2015. */
'use strict';
var _ = require('lodash');
var cheerio = require("cheerio");
var u = require('../utilities/util');
var w = require('../utilities/web');

var content_type_appwww = 'application/x-www-form-urlencoded';
var user_agent_moz = 'Mozilla/5.0 (Windows NT 6.3; WOW64; Trident/7.0; rv:11.0) like Gecko';
var content_accept_text = 'text/html, application/xhtml+xml, */*';


function getToday() {
  var now = new Date();
  return u.merge(now.getDate()) + '/' + u.merge((now.getMonth() + 1)) + '/' + now.getFullYear();
}

function checkReqOpt(req) {
  var reqopt = req.body;
  if (reqopt) reqopt.today = getToday();
  return (!reqopt || !reqopt.user || !reqopt.user.password || !reqopt.user.name) ? undefined : reqopt;
}

function isEmpty(r) { return (!r || !r.hasOwnProperty('C0')); }

function getType(r) {
  var style = r.attr('style');
  if (style.indexOf('background-color:Snow;')>=0 ||
    style.indexOf('background-color:WhiteSmoke;')>=0) return 'day';
  if (style.indexOf('background-color:LightCyan;')>=0) return 'work'
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




exports.data = function(req, res) {
  var reqopt = checkReqOpt(req);
  if (!reqopt) return w.error(res, new Error('Utente non definito correttamente!'));
  if (!reqopt.date)
    reqopt.date = '7/2015';

  console.log('RAP: '+JSON.stringify(reqopt));

  var options = {
    host:  process.env.RAP_HOST,
    method:'GET',
    keepAlive:true,
    verbose:false,
    keepers:[
      { name:'__VIEWSTATE', pattern:'<input.*?name="__VIEWSTATE".*?value="(.*?)".*?>'},
      { name:'__VIEWSTATEGENERATOR', pattern:'<input.*?name="__VIEWSTATEGENERATOR".*?value="(.*?)".*?>' },
      { name:'__EVENTVALIDATION', pattern:'<input.*?name="__EVENTVALIDATION".*?value="(.*?)".*?>' }
    ],
    headers:{
      'authorization': w.getBasicAuth(reqopt.user.name,reqopt.user.password),
      'accept':content_accept_text,
      'accept-language':'it-IT',
      'content-type':content_type_appwww,
      'user-agent':user_agent_moz,
      'DNT':'1'
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
      txtdatarap: reqopt.date,
      btnupdView: 'Riepilogo'
    }
  }];

  w.chainOfRequests(options, sequence, function(err, c) {
    if (err) return w.error(res, err);

    var table = parseRap(c);
    return w.ok(res, table);
  });
};
