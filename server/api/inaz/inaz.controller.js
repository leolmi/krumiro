/**
 * Created by Leo on 02/04/2015.
 */
'use strict';

var _ = require('lodash');
var cheerio = require("cheerio");
var u = require('../utilities/util');
var w = require('../utilities/web');
var INAZ = require('./inaz.model');


function check(user, o, cb) {
  cb = cb || noop;

  var data = {
    SuHrWeb:'0',
    IdLogin:user.name,
    IdPwd:user.password,
    ServerLDAP:process.env.INAZ_SERVER_LDAP
  };
  var str_data = w.getData(data,true);
  var options = {
    SSL: true,
    debuglines: o.debuglines,
    debug: o.debug,
    host: process.env.INAZ_HOST,
    method:'POST',
    path: process.env.INAZ_PATH_CHECK,
    keepAlive:true,
    headers:{
      'content-type':w.constants.content_type_appwww,
      'content-length':str_data.length,
      'connection': 'close'
    }
  };

  u.log('CHECK data:' + str_data,o.debug, o.debuglines);

  w.doHttpsRequest('check', options, str_data, undefined, function(o, r, c) {
    if (r.code!=200)
      return cb(new Error('[check] - terminato con codice: '+r.code));
    u.log('CHECK RESULT: '+c, o.debug, o.debuglines);
    if (!c || c.indexOf("[$OK$]:") != 0)
      return cb(new Error('Verifica password fallita: '+c));
    var encpsw = u.decodeFromEsa(c.substring(7));
    return cb(null, encpsw);
  });
}

function parseInaz(html) {
  html = html.replace(/<br>/g,'|');
  var table = [];
  var $ = cheerio.load(html);
  $('#ris_umane > tbody > tr').each(function() {
    var row = {};
    $(this).children().each(function(i, e){
      row['C'+i] = $(e).text();
    });
    table.push(row);
  });
  return table;
}



exports.data = function(req, res) {
  var reqopt = u.checkReqOpt(req);
  if (!reqopt) return w.error(res, new Error('Utente non definito correttamente!'));

  var options = {
    SSL: true,
    debuglines: reqopt.debuglines,
    debug: reqopt.debug,
    host: process.env.INAZ_HOST,
    method:'GET',
    path: process.env.INAZ_PATH_LOGIN,
    keepAlive:true,
    headers:{
      'accept':w.constants.content_accept_text,
      'accept-language':'it-IT',
      'content-type':w.constants.content_type_appwww,
      'user-agent':w.constants.user_agent_moz,
      'DNT':'1'
    }
  };

  var cookies = {};
  w.doHttpsRequest('accesso', options, undefined, undefined, function(o1, r1) {
    if (r1.code!=200)
      return w.error(res, new Error('[accesso] - terminata con codice: '+r1.code));

    cookies = r1.headers['set-cookie'];

    check(reqopt.user, options, function(err, encpsw) {
      if (err) return w.error(res, err);

      o1.headers.cookie = cookies;

      var sequence = [{
        title:'DEFAULT',
        method:'POST',
        path:process.env.INAZ_PATH_DEFAULT,
        referer:process.env.INAZ_PATH_REFERER_LOGIN,
        data: {
          IdLogin: reqopt.user.name,
          IdPwdCript: encpsw,
          IdFrom: 'LOGIN',
          ReturnTo: process.env.INAZ_PATH_REFERER_LOGIN
        }
      },{
        title:'TOPM',
        method:'GET',
        path:process.env.INAZ_PATH_TOPM,
        referer:process.env.INAZ_PATH_REFERER_DEFAULT
      },{
        title:'BLANK',
        method:'GET',
        path:process.env.INAZ_PATH_BLANK,
        referer:process.env.INAZ_PATH_REFERER_DEFAULT
      },{
        title:'HOME',
        method:'POST',
        path:process.env.INAZ_PATH_HOME,
        referer:process.env.INAZ_PATH_REFERER_TOPM,
        data: {
          AccessCode:process.env.INAZ_P2_AccessCode,
          ParamFrame:'',
          VoceMenu:'',
          ParamPage:''
        }
      },{
        title:'START',
        method:'POST',
        path:process.env.INAZ_PATH_START,
        referer:process.env.INAZ_PATH_REFERER_TOPM,
        data:{
          AccessCode:process.env.INAZ_P2_AccessCode,
          ParamFrame:paramsReplace(process.env.INAZ_START_ParamFrame),
          ParamPage:'',
          VoceMenu:process.env.INAZ_P1_VoceMenu
        }
      },{
        title:'FIND',
        method:'POST',
        path:process.env.INAZ_PATH_FIND,
        referer:process.env.INAZ_PATH_REFERER_START,
        data: {
          AccessCode:process.env.INAZ_P2_AccessCode,
          ParamPage:paramsReplace(process.env.INAZ_FIND_ParamPage)
        }
      },{
        title:'TIMB',
        method:'POST',
        path:process.env.INAZ_PATH_TIMB,
        referer:process.env.INAZ_PATH_REFERER_FIND,
        data: {
          AccessCode:process.env.INAZ_P2_AccessCode,
          ParamPage:paramsReplace(process.env.INAZ_TIMB_ParamPage),
          ListaSel:'',
          ActionPage:'',
          NomeFunzione:process.env.INAZ_TIMB_NomeFunzione,
          ValCampo:'',
          ValoriCampo:'',
          CampoKey:'',
          StatoRiga:'',
          ParPagina:'',
          Matches:''
        }
      }];

      w.chainOfRequests(o1, sequence, function(err, c3){
        if (err) return w.error(res, err, reqopt.debuglines);
        u.log('[chain] - RESULT: '+JSON.stringify(c3),reqopt.debug, reqopt.debuglines);

        var table = parseInaz(c3);
        u.log('[table] - parser: '+JSON.stringify(table),reqopt.debug, reqopt.debuglines);

        manageHistory(reqopt, table, function(err, results) {
          if (err)
            results.error = err;
          if (!reqopt.all)
            results.data = results.data.filter(function (d) { return d['C1'] == reqopt.today; }).reverse();
          u.log('[data] - risultati:'+JSON.stringify(results),reqopt.debug, reqopt.debuglines);
          if (reqopt.debug) results.debug = reqopt.debuglines;
          return w.ok(res, results);
        });
      });
    });
  });
};

function paramsReplace(voice) {
  voice = voice.replace('[P1]',process.env.INAZ_P1_VoceMenu);
  voice = voice.replace('[P2]',process.env.INAZ_P2_AccessCode);
  voice = voice.replace('[P3]',process.env.INAZ_P3_Query);
  return voice;
}



function manageHistory(reqopt, data, cb) {
  // STRUTTURA DEI RISULTATI:
  var results = {
    data: data,
    meta: []
  };
  // inserisce le peculiarità del giorno se esistono
  if (reqopt.perm>0 || reqopt.work!=480)
    results.meta.push({day:reqopt.today, perm:reqopt.perm, work:reqopt.work});

  var userdata = normalize(reqopt.user, results);
  if (!reqopt.all) {
    var partial = denormalize(userdata);
    cb(null, partial);
  }
  mergeHistory(userdata, function(err, res){
    u.log('[manageHistory] - merged data results:'+JSON.stringify(res), reqopt.debug, reqopt.debuglines);
    var dendata = denormalize(res);
    u.log('[manageHistory] - merged data denormalize results:'+JSON.stringify(dendata), reqopt.debug, reqopt.debuglines);
    if (reqopt.all) cb(err, dendata);
  }, reqopt.today);
}

/**
 * Restituisce un valore numerico univoco per l'item
 * @param d
 * @returns {Number}
 */
function getDataN(d) {
  return parseInt(d['C1'].substr(6,4)+d['C1'].substr(3,2)+d['C1'].substr(0,2)+ u.merge(d['C2'])+u.merge(d['C3']));
}

function getTimeM(d) {
  return (parseInt(d['C2'])*60)+parseInt(d['C3']);
}

function getValues(d) {
  var v = [];
  for(var p in d)
    v.push(d[p]);
  return v;
}

function replaceHistory(userdata, cb) {
  cb = cb || noop;
  console.log('[replaceHistory] - userdata:'+JSON.stringify(userdata));
  INAZ.remove({'user': userdata.user }, function(err){
    INAZ.create(userdata, function (err) {
      cb(err, userdata);
    });
  });
}

function sortData(userdata, inverse){
  var sign = inverse ? -1 : 1;
  userdata.data.sort(function(d1,d2){ return sign*(d1.key - d2.key); });
}

function mergeData(userdata, exdata) {
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
    sortData(exdata);
  }
}
function mergeMeta(userdata, exdata, today) {
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
}

/**
 *
 * @param userdata
 * @param today
 * @param cb
 */
function mergeHistory(userdata, cb, today) {
  cb = cb || noop;
  console.log('[mergeHistory] - userdata:'+JSON.stringify(userdata));

  INAZ.findOne({'user': userdata.user }, function (err, exdata) {
    if (err) { return cb(err, userdata); }
    //se non è mai stato censito inserisce i dati come sono
    if(!exdata) {
      sortData(userdata);
      INAZ.create(userdata, function(err) {
        cb(err, userdata);
      });
    }
    //se esiste gia effettua il merge
    else {
      console.log('[mergeHistory] - exdata:'+JSON.stringify(exdata));
      mergeData(userdata, exdata);
      mergeMeta(userdata, exdata, today);
      console.log('[mergeHistory] - final exdata:'+JSON.stringify(exdata));
      exdata.save(function (err) {
        cb(err, exdata);
      });
    }
  });
}




/**
 * Traduce i dati passati in dati utilizzabili nel db
 * @param {object} user
 * @param {object} history
 */
function normalize(user, history) {
  var userdata = {
    user: user.name,
    data: [],
    meta: []
  };
  if (history && history.data && history.data.length)
    history.data.forEach(function (h) {
      userdata.data.push({
        key:getDataN(h),
        time:getTimeM(h),
        C:getValues(h)
      })
    });
  if (history && history.meta && history.meta.length)
    userdata.meta = userdata.meta.concat(history.meta);
  return userdata;
}

exports.upload = function(req, res) {
  var reqopt = u.checkReqOpt(req);
  if (!reqopt) return w.error(res, new Error('Utente non definito correttamente!'));
  check(reqopt.user, null, function(err) {
    if (err) return w.error(res, err);
    if (!reqopt.history || reqopt.history.length <= 0) return w.error(res, new Error('Storico non definito!'));
    var history = {};
    try {
      history = JSON.parse(reqopt.history);
    } catch (err) {
      return w.error(res, err);
    }
    if (!history || (!history.data && !history.meta))
      return w.error(res, new Error('Storico senza contenuti!'));
    var dataempty = (!history.data || history.data.length <= 0);
    var metaempty = (!history.meta || history.meta.length <= 0);
    if (dataempty && metaempty)
      return w.error(res, new Error('Storico senza valori significativi!'));

    var userdata = normalize(reqopt.user, history);
    var merge = history.replace ? replaceHistory : mergeHistory;
    manageUploadResults(merge, res, reqopt, userdata);
  });
};

function manageUploadResults(merge, res, reqopt, userdata){
  merge(userdata, function (err) {
    if (err) return w.error(res, err);
    INAZ.findOne({'user': reqopt.user.name }, function (err, exdata) {
      if (err) return w.error(res, err);
      var dendata = denormalize(exdata);
      return w.ok(res, dendata);
    });
  }, reqopt.today);
}


function getDenRow(d) {
  var result = {};
  d.C.forEach(function(v,i){
    result['C'+i]=v;
  });
  result.key= d.key;
  return result;
}

function denormalize(exdata) {
  var result = {
    data:[],
    meta:[]
  };

  if (exdata){
    if (exdata.data && exdata.data.length) {
      exdata.data.forEach(function(d) {
        result.data.push(getDenRow(d));
      });
      sortData(result, true);
    }
    if (exdata.meta && exdata.meta.length)
      result.meta = result.meta.concat(exdata.meta);
  }
  return result;
}

exports.download = function(req, res) {
  var reqopt = u.checkReqOpt(req);
  console.log('opzioni: '+JSON.stringify(reqopt));
  if (!reqopt) return w.error(res, new Error('Utente non definito correttamente!'));
  check(reqopt.user, null, function(err) {
    if (err) return w.error(res, err);
    INAZ.findOne({'user': reqopt.user.name }, function (err, exdata) {
      if (err) { w.error(res, err); }
      var dendata = denormalize(exdata);
      w.ok(res, dendata);
    });
  })
};














exports.data1 = function(req, res) {
  var reqopt = u.checkReqOpt(req);
  if (!reqopt) return w.error(res, new Error('Utente non definito correttamente!'));


  var sequence1 = [{
    usecookies: true,
    host: process.env.INAZ_HOST,
    title:'ACCESS',
    method:'GET',
    keepAlive:true,
    path:process.env.INAZ_PATH_LOGIN,
    headers:{
      'accept': w.constants.content_accept_text,
      'accept-language':'it-IT',
      'content-type':w.constants.content_type_appwww,
      'user-agent':w.constants.user_agent_moz,
      'DNT':'1'
    }
  },{
    title:'CHECK',
    method:'POST',
    path: process.env.INAZ_PATH_CHECK,
    encodedata: true,
    data: {
      SuHrWeb:'0',
      IdLogin:reqopt.user.name,
      IdPwd:reqopt.user.password,
      ServerLDAP:process.env.INAZ_SERVER_LDAP
    },
    headers:{
      'Connection': 'close'
    }
  },{
    title:'DEFAULT',
    method:'POST',
    path:process.env.INAZ_PATH_DEFAULT,
    referer:process.env.INAZ_PATH_REFERER_LOGIN,
    validations: [{target:'IdPwdCript', func: u.decodeFromEsa}],
    data: {
      IdLogin: reqopt.user.name,
      IdPwdCript: '',
      IdFrom: 'LOGIN',
      RetturnTo: process.env.INAZ_PATH_REFERER_LOGIN
    }
  },{
    title:'TOPM',
    method:'GET',
    path:process.env.INAZ_PATH_TOPM,
    referer:process.env.INAZ_PATH_REFERER_DEFAULT
  },{
    title:'BLANK',
    method:'GET',
    path:process.env.INAZ_PATH_BLANK,
    referer:process.env.INAZ_PATH_REFERER_DEFAULT
  },{
    title:'HOME',
    method:'POST',
    path:process.env.INAZ_PATH_HOME,
    referer:process.env.INAZ_PATH_REFERER_TOPM,
    data: {
      AccessCode:process.env.INAZ_P2_AccessCode,
      ParamFrame:'',
      VoceMenu:'',
      ParamPage:''
    }
  },{
    title:'START',
    method:'POST',
    path:process.env.INAZ_PATH_START,
    referer:process.env.INAZ_PATH_REFERER_TOPM,
    data:{
      AccessCode:process.env.INAZ_P2_AccessCode,
      ParamFrame:paramsReplace(process.env.INAZ_START_ParamFrame),
      ParamPage:'',
      VoceMenu:process.env.INAZ_P1_VoceMenu
    }
  },{
    title:'FIND',
    method:'POST',
    path:process.env.INAZ_PATH_FIND,
    referer:process.env.INAZ_PATH_REFERER_START,
    data: {
      AccessCode:process.env.INAZ_P2_AccessCode,
      ParamPage:paramsReplace(process.env.INAZ_FIND_ParamPage)
    }
  },{
    title:'TIMB',
    method:'POST',
    path:process.env.INAZ_PATH_TIMB,
    referer:process.env.INAZ_PATH_REFERER_FIND,
    data: {
      AccessCode:process.env.INAZ_P2_AccessCode,
      ParamPage:paramsReplace(process.env.INAZ_TIMB_ParamPage),
      ListaSel:'',
      ActionPage:'',
      NomeFunzione:process.env.INAZ_TIMB_NomeFunzione,
      ValCampo:'',
      ValoriCampo:'',
      CampoKey:'',
      StatoRiga:'',
      ParPagina:'',
      Matches:''
    }
  }];

  console.log('sequenza:'+JSON.stringify(sequence1));
};
