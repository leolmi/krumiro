/**
 * Created by Leo on 02/04/2015.
 */
'use strict';

const _ = require('lodash');
const streams = require('memory-streams');
const u = require('../utilities/util');
const w = require('../utilities/web');
const uz = require('./inaz.utilities');
const INAZ = require('./inaz.model');
const C = process.env;

/**
 * Check delle credenziali
 * @param user
 * @param o
 * @param cb
 */
function check(user, o, cb) {
  cb = cb || noop;

  var data = {
    SuHrWeb: '0',
    IdLogin: user.name,
    IdPwd: user.password,
    ServerLDAP: C.INAZ_SERVER_LDAP
  };
  var str_data = w.getData(data,true);
  var options = {
    SSL: true,
    debuglines: o.debuglines,
    debug: o.debug,
    host: C.INAZ_HOST,
    method:'POST',
    path: C.INAZ_PATH_CHECK,
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
    const encpsw = u.decodeFromEsa(c.substring(7));
    return cb(null, encpsw);
  });
}
exports.check = check;

/**
 * Accede e verifica le credenziali
 * @param req
 * @param res
 * @param o
 * @param cb
 * @returns {*}
 * @private
 */
function _enterInaz(req, res, o, cb){
  var reqopt = u.checkReqOpt(req);
  if (!reqopt) return w.error(res, new Error('Utente non definito correttamente!'));


  const options = {
    SSL: true,
    debuglines: reqopt.debuglines,
    debug: reqopt.debug,
    host: C.INAZ_HOST,
    method:'GET',
    path: C.INAZ_PATH_LOGIN,
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

  _.keys(o.parameters||{}).forEach(function(p){
    w.checkKeeper(options, p, o.parameters[p]);
  });


  var cookies = {};
  w.doHttpsRequest('accesso', options, undefined, undefined, function(opt, result) {
    if (result.code!==200)
      return w.error(res, new Error('[accesso] - terminata con codice: '+result.code));

    cookies = result.headers['set-cookie'];

    check(reqopt.user, options, function(err, encpsw) {
      if (err) return w.error(res, err);

      opt.headers.cookie = cookies;

      var sequence = [{
        title:'DEFAULT',
        method:'POST',
        path:C.INAZ_PATH_DEFAULT,
        referer:C.INAZ_PATH_REFERER_LOGIN,
        data: {
          IdLogin: reqopt.user.name,
          IdPwdCript: encpsw,
          IdFrom: 'LOGIN',
          ReturnTo: C.INAZ_PATH_REFERER_LOGIN
        }
      },{
        title:'TOPM',
        method:'GET',
        path:C.INAZ_PATH_TOPM,
        referer:C.INAZ_PATH_REFERER_DEFAULT,
        keepers:[{
          name: 'AccessCode2',
          mode: 'onetime',
          pattern: '<.*id="AccessCode2".*value="(.*)">'
        },{
          name: '_KeepMenuInfo',
          mode: 'onetime',
          action: uz.keepMenuKeys(o)
        }]
      },{
        title:'BLANK',
        method:'GET',
        path:C.INAZ_PATH_BLANK,
        referer:C.INAZ_PATH_REFERER_DEFAULT
      },{
        title:'HOME',
        method:'POST',
        path:C.INAZ_PATH_HOME,
        referer:C.INAZ_PATH_REFERER_TOPM,
        data: {
          AccessCode:C.INAZ_P2_AccessCode,
          AccessCode2: '{AccessCode2}',
          ParamFrame:'',
          VoceMenu:'',
          ParamPage:''
        }
      }];
      //Aggiunge gli step
      o.steps.forEach(function(s){
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

/**
 * Recupera le informazioni sulle bedgiature
 * @param req
 * @param res
 */
exports.bedge = function(req, res) {
  const o = {
    parameters: {
      VoceMenu: C.INAZ_P1_VoceMenu
    },
    steps: [{
      title: 'START',
      method: 'POST',
      path: C.INAZ_PATH_START,
      referer: C.INAZ_PATH_REFERER_TOPM,
      data: {
        AccessCode: C.INAZ_P2_AccessCode,
        AccessCode2: '{AccessCode2}',
        ParamFrame: C.INAZSTAT_START_ParamFrame,
        Page: 'NONE',
        VoceMenu: '{VoceMenu}',
        KKmenu: '{KKmenu}',
        KAction: '{KAction}',
        ParamPage: '',
        ForceTop3: ''
      },
      keepers: [{
        name: 'MyPageId',
        mode: 'onetime',
        pattern: '<.*id="MyPageId".*value="(.*)">'
      }]
    }, {
      title: 'FIND',
      method: 'POST',
      path: C.INAZ_PATH_FIND,
      referer: C.INAZ_PATH_REFERER_START,
      data: {
        AccessCode: C.INAZ_P2_AccessCode,
        AccessCode2: '{AccessCode2}',
        ParamPage: uz.replace(C.INAZ_FIND_ParamPage),
        TipoPerm: C.INAZ_START_TipoPerm
      }
    }, {
      title: 'TIMB',
      method: 'POST',
      path: C.INAZ_PATH_TIMB,
      referer: C.INAZ_PATH_REFERER_FIND,
      data: {
        AccessCode: C.INAZ_P2_AccessCode,
        AccessCode2: '{AccessCode2}',
        MyPageId: '{MyPageId}',
        ParamPage: uz.replace(C.INAZ_TIMB_ParamPage),
        ListaSel: '',
        ListaSelCrypt: '',
        ActionPage: '',
        NomeFunzione: C.INAZ_TIMB_NomeFunzione,
        ValCampo: '',
        ValoriCampo: '',
        CampoKey: '',
        StatoRiga: '',
        ParPagina: '',
        TipoPerm: C.INAZ_START_TipoPerm,
        Matches: ''
      }
    }]
  };
  _enterInaz(req, res, o, function(opt, content) {
    var table = uz.parse(content);
    u.log('[table] - timbrature: '+JSON.stringify(table),opt.debug, opt.debuglines);

    _manageHistory(opt, table, function(err, results) {
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

/**
 * Recupera le informazioni sullo stato ferie-permessi
 * @param req
 * @param res
 */
exports.stat = function(req, res) {
  const o = {
    parameters: {
      VoceMenu: C.INAZ_P4_VoceMenu,
    },
    steps: [{
      title: 'START',
      method: 'POST',
      path: C.INAZ_PATH_START,
      referer: C.INAZ_PATH_REFERER_TOPM,
      data: {
        AccessCode: C.INAZ_P2_AccessCode,
        AccessCode2: '{AccessCode2}',
        ParamFrame: C.INAZSTAT_START_ParamFrame,
        Page: 'NONE',
        VoceMenu: '{VoceMenu}',
        KKmenu: '{KKmenu}',
        KAction: '{KAction}',
        ParamPage: '',
        ForceTop3: ''
      },
      keepers: [{
        name: 'MyPageId',
        mode: 'onetime',
        pattern: '<.*id="MyPageId".*value="(.*)">'
      }]
    }, {
      title: 'FIND',
      method: 'POST',
      path: C.INAZ_PATH_FIND,
      referer: C.INAZ_PATH_REFERER_START,
      data: {
        AccessCode: C.INAZ_P2_AccessCode,
        AccessCode2: '{AccessCode2}',
        ParamPage: uz.replace(C.INAZSTAT_FIND_ParamPage),
        TipoPerm: C.INAZ_START_TipoPerm
      }
    }, {
      title: 'TIMB',
      method: 'POST',
      path: C.INAZ_PATH_TIMB,
      referer: C.INAZ_PATH_REFERER_FIND,
      data: {
        AccessCode: C.INAZ_P2_AccessCode,
        AccessCode2: '{AccessCode2}',
        MyPageId: '{MyPageId}',
        ParamPage: uz.replace(C.INAZSTAT_TIMB_ParamPage),
        ListaSel: '',
        ListaSelCrypt: '',
        ActionPage: '',
        NomeFunzione: C.INAZSTAT_TIMB_NomeFunzione,
        ValCampo: '',
        ValoriCampo: '',
        CampoKey: '',
        StatoRiga: '',
        ParPagina: '',
        TipoPerm: C.INAZ_START_TipoPerm,
        Matches: ''
      }
    }]
  };

  _enterInaz(req, res, o, function(opt, content) {
    const table = uz.parse(content);
    u.log('[table] - stat: '+JSON.stringify(table),opt.debug, opt.debuglines);
    const results = {data: table};
    if (opt.debug) results.debug = opt.debuglines;
    return w.ok(res, results);
  });
};

exports.paycheck = function(req, res) {
  const result = new streams.WritableStream();
  const o = {
    parameters: {
      VoceMenu: C.INAZ_P6_VoceMenu
    },
    steps: [{
      title: 'START',
      method: 'POST',
      path: C.INAZ_PATH_START,
      referer: C.INAZ_PATH_REFERER_TOPM,
      data: {
        AccessCode: C.INAZ_P2_AccessCode,
        AccessCode2: '{AccessCode2}',
        ParamFrame: C.INAZCED_START_ParamFrame,
        VoceMenu: '{VoceMenu}',
        KKmenu: '{KKmenu}',
        KAction: '{KAction}',
        ParamPage: '',
        ForceTop3: ''
      }
    }, {
      title: 'CED',
      method: 'POST',
      path: C.INAZ_PATH_CED,
      referer: C.INAZ_PATH_REFERER_START,
      data: {
        AccessCode: C.INAZ_P2_AccessCode,
        AccessCode2: '{AccessCode2}',
        ParamPage: uz.replace(C.INAZ_CED_ParamPage),
        TipoPerm: C.INAZ_START_TipoPerm
      },
      keepers: [{
        name: 'CEDURL',
        mode: 'onetime',
        action: uz.keepPdfUrl
      }]
    },{
      title: 'CED',
      method: 'GET',
      target: result,
      path: C.INAZ_CED_DocFilePath+'{CEDURL}'
    }]
  };
  _enterInaz(req, res, o, function(opt) {
    const results = {data: result.toString()};
    u.log('[table] - busta paga', opt.debug, opt.debuglines);
    if (opt.debug) results.debug = opt.debuglines;
    w.ok(res, results);
  });
};


function _manageHistory(reqopt, data, cb) {
  // STRUTTURA DEI RISULTATI:
  var results = {
    data: data,
    meta: []
  };
  // inserisce le peculiarità del giorno se esistono
  //if (reqopt.perm>0 || reqopt.work!=480)
    results.meta.push({day:reqopt.today, perm:reqopt.perm, work:reqopt.work});

  var userdata = uz.normalize(reqopt.user, results);
  if (!reqopt.all) {
    var partial = uz.denormalize(userdata);
    cb(null, partial);
  }
  _mergeHistory(userdata, function(err, res){
    u.log('[manageHistory] - merged data results:'+JSON.stringify(res), reqopt.debug, reqopt.debuglines);
    var dendata = uz.denormalize(res);
    u.log('[manageHistory] - merged data denormalize results:'+JSON.stringify(dendata), reqopt.debug, reqopt.debuglines);
    if (reqopt.all) cb(err, dendata);
  }, reqopt.today);
}

function _replaceHistory(userdata, cb) {
  cb = cb || noop;
  console.log('[replaceHistory] - userdata:'+JSON.stringify(userdata));
  INAZ.remove({'user': userdata.user }, function(){
    INAZ.create(userdata, function (err) {
      cb(err, userdata);
    });
  });
}


/**
 *
 * @param userdata
 * @param today
 * @param cb
 */
function _mergeHistory(userdata, cb, today) {
  cb = cb || noop;
  console.log('[mergeHistory] - userdata:'+JSON.stringify(userdata));

  INAZ.findOne({'user': userdata.user }, function (err, exdata) {
    if (err) { return cb(err, userdata); }
    //se non è mai stato censito inserisce i dati come sono
    if(!exdata) {
      uz.sortData(userdata);
      INAZ.create(userdata, function(err) {
        cb(err, userdata);
      });
    }
    //se esiste gia effettua il merge
    else {
      console.log('[mergeHistory] - exdata:'+JSON.stringify(exdata));
      uz.mergeData(userdata, exdata);
      uz.mergeMeta(userdata, exdata, today);
      console.log('[mergeHistory] - final exdata:'+JSON.stringify(exdata));
      exdata.save(function (err) {
        cb(err, exdata);
      });
    }
  });
}

function _manageUploadResults(merge, res, reqopt, userdata){
  merge(userdata, function (err) {
    if (err) return w.error(res, err);
    INAZ.findOne({'user': reqopt.user.name }, function (err, exdata) {
      if (err) return w.error(res, err);
      var dendata = uz.denormalize(exdata);
      return w.ok(res, dendata);
    });
  }, reqopt.today);
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

    var userdata = uz.normalize(reqopt.user, history);
    var merge = history.replace ? _replaceHistory : _mergeHistory;
    _manageUploadResults(merge, res, reqopt, userdata);
  });
};

exports.download = function(req, res) {
  var reqopt = u.checkReqOpt(req);
  console.log('opzioni: '+JSON.stringify(reqopt));
  if (!reqopt) return w.error(res, new Error('Utente non definito correttamente!'));
  check(reqopt.user, null, function(err) {
    if (err) return w.error(res, err);
    INAZ.findOne({'user': reqopt.user.name }, function (err, exdata) {
      if (err) { w.error(res, err); }
      var dendata = uz.denormalize(exdata);
      w.ok(res, dendata);
    });
  })
};

