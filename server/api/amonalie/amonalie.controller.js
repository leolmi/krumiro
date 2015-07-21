/* Created by Leo on 20/07/2015. */
'use strict';
var _ = require('lodash');
var u = require('../utilities/util');
var w = require('../utilities/web');
var cheerio = require("cheerio");

var content_type_multipart = 'multipart/form-data; boundary=';
var multipart_boundary_prefix = '---------------------------';
var multipart_body_header = 'Content-Disposition: form-data; name=';
var download_body = {
  idRecord:'',
  selIdx:'-1',
  startRow:'1',
  src_id:'',
  chkf_1:'on',
  src_istituto:'',
  chkf_2:'on',
  src_gruppo:'',
  src_applicativo:'',
  chkf_3:'on',
  src_funzione:'',
  chkf_4:'on',
  src_versione:'',
  chkf_5:'on',
  src_ambiente:'',
  src_tiposegn_cliente:'',
  src_tiposegn:'',
  chkf_7:'on',
  src_tiposegn_int:'',
  src_priorita_cliente:'',
  src_priorita:'',
  chkf_9:'on',
  src_priorita_int:'',
  chkf_10:'on',
  src_stato:'',
  chkf_11:'on',
  src_sottostato:'',
  src_stato_lab:'',
  src_laboratorio:'',
  src_rifcliente:'',
  chkf_14:'on',
  src_riflab:'',
  src_visibilita:'',
  src_sPresidio:'',
  src_sAttribuzione:'',
  chkf_49:'on',
  src_data_segnalazione_from:'',
  src_data_segnalazione_timeFrom:'',
  src_data_segnalazione_to:'',
  src_data_segnalazione_timeTo:'',
  chkf_17:'on',
  src_data_stato_from:'',
  src_data_stato_to:'',
  src_data_rilascio_from:'',
  src_data_rilascio_to:'',
  src_data_rilint_from:'',
  src_data_rilint_to:'',
  src_data_inlav_from:'',
  src_data_inlav_to:'',
  src_data_attlab_from:'',
  src_data_attlab_to:'',
  chkf_38:'on',
  src_var_tempi:'',
  src_giorni_previsti:'',
  chkf_21:'on',
  src_versione_correttiva:'',
  chkf_22:'on',
  src_Autore:'',
  chkf_23:'on',
  src_ref_Tec:'',
  chkf_27:'on',
  src_soggetto:'',
  chkf_33:'on',
  src_data_note_cli_from:'',
  src_data_note_cli_to:'',
  src_relazione:'',
  src_descrizione:'',
  chkf_29:'on',
  src_note:'',
  chkf_30:'on',
  src_note_int:'',
  chkf_31:'on',
  block_campiFiltro_state:'view',
  block_campiFiltro_mngRec:'',
  filter:'-- Salva filtro --',
  customFilter:'',
  block_filtri_state:'view',
  block_filtri_mngRec:'',
  resetSrc:'',
  searchRcdsrcRcd:'0',
  report:'xls2',
  panel_formPanel:'panel_formPanel3',
  formPanel_evid:'',
  searchRcd:'1',
  arrFields:"<wddxPacket version='1.0'><header/><data><string></string></data></wddxPacket>",
  arrId:"<wddxPacket version='1.0'><header/><data><string></string></data></wddxPacket>",
  chkFields:'',
  attribuzione_id:'',
  nota_id:'',
  writeTo:'message',
  state:'view',
  mngRec:''
};

function parseAmonalie(html){
  var table = [];
  var $ = cheerio.load(html);
  $('table').last().find('tr').each(function() {
    var row = {};
    $(this).children().each(function(i, e){
      row['C'+i] = $(e).text().trim();
    });
    table.push(row);
  });
  return table;
}

function buildMultipartBody(data) {
  var id = u.uuid();
  var boundary = multipart_boundary_prefix+id;
  var result = {
    boundary: boundary,
    body:''
  };
  for(var p in data) {
    result.body += '--'+boundary+'\r\n'+multipart_body_header+'"'+p+'"\r\n\r\n'+data[p].toString()+'\r\n';
  }
  result.body += '--'+boundary+'--';
  return result;
}

function milk(o, cb) {
  cb = cb || u.noop;
  var options = {
    SSL: o.SSL,
    host:  process.env.AMN_HOST,
    method:'GET',
    keepAlive:true,
    verbose:false,
    headers:{
      'accept': w.constants.content_accept_text,
      'accept-language': w.constants.accept_language_iteeng,
      'content-type':w.constants.content_type_appwww,
      'user-agent':w.constants.user_agent_moz,
      'DNT':'1'
    }
  };
  var data = buildMultipartBody(download_body);
  var sequence = [{
    title:'ACCESS',
    path: process.env.AMN_PATH_LOGIN
  },{
    title:'LOGIN',
    method:'POST',
    path: process.env.AMN_PATH_LOGIN,
    referer: process.env.AMN_REFERER_LOGIN,
    data: {
      fuseaction: 'home.validate',
      username:o.user.name,
      password:o.user.password,
      sub_validate:'Login'
    }
  },{
    title: 'SID',
    method: 'GET',
    path: process.env.AMN_PATH_SID,
    referer: process.env.AMN_REFERER_SID,

    noheaders:['content-type','content-length']
  },{
    title:'DOWNLOAD',
    method:'POST',
    path: process.env.AMN_PATH_DOWNLOAD,
    referer: process.env.AMN_REFERER_DOWNLOAD,
    data:data.body,
    headers: {
      'content-type':content_type_multipart+data.boundary
    }
  }];

  w.chainOfRequests(options, sequence, function(err, c) {
    if (err) return cb(err);
    var table = parseAmonalie(c);
    //console.log('DATI: '+JSON.stringify(table));
    return cb(null, table);
  });
}


exports.data = function(req, res) {
  var o = u.checkReqOpt(req);
  if (!o) return w.error(res, new Error('Utente non definito correttamente!'));

  milk(o, function(err, table){
    if (err) return w.error(res, err);
    return w.ok(res, table);
  });
};
