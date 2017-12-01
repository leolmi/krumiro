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

exports.check = check;


function parseInaz(html) {
  html = html.replace(/<br>/g,'|');
  var table = [];
  var $ = cheerio.load(html);
  $('#ris_umane').find('tbody > tr').each(function() {
    var row = {};
    $(this).children().each(function(i, e){
      row['C'+i] = $(e).text();
    });
    table.push(row);
  });
  return table;
}


function enterInaz(req, res, steps, cb){
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
      'upgrade-insecure-requests':'1',
      'DNT':'1'
    }
  };

  var cookies = {};
  w.doHttpsRequest('accesso', options, undefined, undefined, function(opt, result) {
    if (result.code!=200)
      return w.error(res, new Error('[accesso] - terminata con codice: '+result.code));

    cookies = result.headers['set-cookie'];

    check(reqopt.user, options, function(err, encpsw) {
      if (err) return w.error(res, err);

      opt.headers.cookie = cookies;

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
        referer:process.env.INAZ_PATH_REFERER_DEFAULT,
        keepers:[{
          name: 'AccessCode2',
          mode: 'onetime',
          pattern: '<.*id="AccessCode2".*value="(.*)">'
        },{
          name: '_KeepMenuInfo',
          mode: 'onetime',
          action: keepKeys
        }]
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
          AccessCode2: '{AccessCode2}',
          ParamFrame:'',
          VoceMenu:'',
          ParamPage:''
        }
      }];
      //Aggiunge gli step
      steps.forEach(function(s){
        sequence.push(s);
      });

      w.chainOfRequests(opt, sequence, function(err, content){
        if (err) return w.error(res, err, reqopt.debuglines);
        u.log('[chain] - RESULT: '+JSON.stringify(content),reqopt.debug, reqopt.debuglines);

        cb(reqopt, content)
      });
    });
  });
}

exports.data = function(req, res) {
  var steps = [{
        title:'START',
        method:'POST',
        path:process.env.INAZ_PATH_START,
        referer:process.env.INAZ_PATH_REFERER_TOPM,
        data:{
          AccessCode:process.env.INAZ_P2_AccessCode,
          AccessCode2: '{AccessCode2}',
          ParamFrame: process.env.INAZSTAT_START_ParamFrame,
          Page:'NONE',
          VoceMenu:process.env.INAZ_P1_VoceMenu,
          KKmenu:'{KKmenu}',
          KAction:'{KAction}',
          ParamPage: '',
          ForceTop3: ''
        },
        keepers:[{
          name: 'MyPageId',
          mode: 'onetime',
          pattern: '<.*id="MyPageId".*value="(.*)">'
        }]
      },{
        title:'FIND',
        method:'POST',
        path:process.env.INAZ_PATH_FIND,
        referer:process.env.INAZ_PATH_REFERER_START,
        data: {
          AccessCode:process.env.INAZ_P2_AccessCode,
          AccessCode2: '{AccessCode2}',
          ParamPage:paramsReplace(process.env.INAZ_FIND_ParamPage),
          TipoPerm:process.env.INAZ_START_TipoPerm
        }
      },{
        title:'TIMB',
        method:'POST',
        path:process.env.INAZ_PATH_TIMB,
        referer:process.env.INAZ_PATH_REFERER_FIND,
        data: {
          AccessCode:process.env.INAZ_P2_AccessCode,
          AccessCode2: '{AccessCode2}',
          MyPageId: '{MyPageId}',
          ParamPage:paramsReplace(process.env.INAZ_TIMB_ParamPage),
          ListaSel:'',
          ListaSelCrypt: '',
          ActionPage: '',
          NomeFunzione:process.env.INAZ_TIMB_NomeFunzione,
          ValCampo:'',
          ValoriCampo:'',
          CampoKey:'',
          StatoRiga:'',
          ParPagina:'',
          TipoPerm: process.env.INAZ_START_TipoPerm,
          Matches: ''
        }
      }];
  enterInaz(req, res, steps, function(opt, content) {
    var table = parseInaz(content);
    u.log('[table] - timbrature: '+JSON.stringify(table),opt.debug, opt.debuglines);

    manageHistory(opt, table, function(err, results) {
      if (err)
        results.error = err;
      if (!opt.all)
        results.data = results.data.filter(function (d) { return d['C1'] == opt.today; }).reverse();
      u.log('[data] - risultati:'+JSON.stringify(results), opt.debug, opt.debuglines);
      if (opt.debug) results.debug = opt.debuglines;
      return w.ok(res, results);
    });
  });
};

exports.stat = function(req, res) {
  var steps = [{
    title:'START',
    method:'POST',
    path:process.env.INAZ_PATH_START,
    referer:process.env.INAZ_PATH_REFERER_TOPM,
    data:{
      AccessCode:process.env.INAZ_P2_AccessCode,
      ParamFrame:paramsReplace(process.env.INAZSTAT_START_ParamFrame),
      VoceMenu:process.env.INAZ_P4_VoceMenu,
      KKmenu:process.env.INAZSTAT_PARAM_KKMENU,
      KAction:process.env.INAZSTAT_PARAM_KACTION,
      ParamPage:''
    }
  },{
    title:'FIND',
    method:'POST',
    path:process.env.INAZ_PATH_FIND,
    referer:process.env.INAZ_PATH_REFERER_START,
    data: {
      AccessCode:process.env.INAZ_P2_AccessCode,
      ParamPage:paramsReplace(process.env.INAZSTAT_FIND_ParamPage)
    }
  },{
    title:'TIMB',
    method:'POST',
    path:process.env.INAZ_PATH_TIMB,
    referer:process.env.INAZ_PATH_REFERER_FIND,
    data: {
      AccessCode:process.env.INAZ_P2_AccessCode,
      ParamPage:paramsReplace(process.env.INAZSTAT_TIMB_ParamPage),
      ListaSel:'',
      ActionPage:'',
      NomeFunzione:process.env.INAZSTAT_TIMB_NomeFunzione,
      ValCampo:'',
      ValoriCampo:'',
      CampoKey:'',
      StatoRiga:'',
      ParPagina:'',
      Matches:''
    }
  }];

  enterInaz(req, res, steps, function(opt, content) {
    var table = parseInaz(content);
    u.log('[table] - stat: '+JSON.stringify(table),opt.debug, opt.debuglines);
    var results = {
      data: table
    };
    if (opt.debug) results.debug = opt.debuglines;
    return w.ok(res, results);
  });
};


function paramsReplace(voice) {
  voice = voice.replace('[P1]',process.env.INAZ_P1_VoceMenu);
  voice = voice.replace('[P2]',process.env.INAZ_P2_AccessCode);
  voice = voice.replace('[P3]',process.env.INAZ_P3_Query);
  voice = voice.replace('[P4]',process.env.INAZ_P4_VoceMenu);
  voice = voice.replace('[P5]',process.env.INAZ_P5_Query);
  return voice;
}



function manageHistory(reqopt, data, cb) {
  // STRUTTURA DEI RISULTATI:
  var results = {
    data: data,
    meta: []
  };
  // inserisce le peculiarità del giorno se esistono
  //if (reqopt.perm>0 || reqopt.work!=480)
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
    if (d.hasOwnProperty(p))
      v.push(d[p]);
  return v;
}

function replaceHistory(userdata, cb) {
  cb = cb || noop;
  console.log('[replaceHistory] - userdata:'+JSON.stringify(userdata));
  INAZ.remove({'user': userdata.user }, function(){
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



function _getList(menu, txt) {
  const rgx = new RegExp('\\s' + menu + '=(.*?)(?=;)', 'g');
  const m = rgx.exec(txt);
  const list_str = m ? m[1] : '[]';
  return JSON.parse(list_str);
}

function _deepClone(o) {
  return JSON.parse(JSON.stringify(o));
}

function _find(cll, voice, cb, indices) {
  indices = indices || [];
  cll.forEach(function (ci, idx) {
    if (ci === voice) {
      indices.push(idx);
      return cb(indices);
    } else if (_.isArray(ci)) {
      const idc = _deepClone(indices);
      idc.push(idx);
      _find(ci, voice, cb, idc);
    }
  });
}

function _getAt(cll, indices) {
  var v = cll;
  if (_.isArray(v)) (indices||[]).forEach(function(i){v = v[i];})
  return v;
}

function parseMenuVoice(content, voice, menus, cb) {
  var voices = _getList(menus[0], content);
  _find(voices, voice, function(indices) {
    const result = {};
    menus.forEach(function(mn){
      const m = _getList(mn, content);
      result[mn] = _getAt(m, indices);
    });
    cb(result)
  });
}

function keepKeys(item, options, content) {
  const menus = process.env.INAZ_START_MenuTree.split(',');
  const code = parseInt(process.env.INAZ_P1_VoceMenu);
  parseMenuVoice(content, code, menus, function(data){
    w.checkKeeper(options, process.env.INAZ_START_MenuName, (data||{})[process.env.INAZ_START_MenuName_V]);
    w.checkKeeper(options, process.env.INAZ_START_MenuAction, (data||{})[process.env.INAZ_START_MenuAction_V]);
  });
  return 'executed';
}
