/**
 * Created by Leo on 30/04/2015.
 */
'use strict';

var u = require('./util');
var _ = require('lodash');
var https = require('https');
var http = require('http');
var querystring = require('querystring');

var automaticHeaders = {
  connection: true,
  'content-length': true,
  'transfer-encoding': true,
  date: true
};

http.OutgoingMessage.prototype.setHeader = function(name, value) {
  if (arguments.length < 2) {
    throw new Error('`name` and `value` are required for setHeader().');
  }

  if (this._header) {
    throw new Error('Can\'t set headers after they are sent.');
  }

  // NO LOWER CASE
  var key = name.toLowerCase();
  this._headers = this._headers || {};
  this._headerNames = this._headerNames || {};
  this._headers[key] = value;
  this._headerNames[key] = name;

  if (automaticHeaders[key]) {
    this._removedHeader[key] = false;
  }
};

exports.constants = {
  content_type_appwww: 'application/x-www-form-urlencoded',
  user_agent_moz: 'Mozilla/5.0 (Windows NT 6.3; WOW64; Trident/7.0; rv:11.0) like Gecko',
  content_accept_text: 'text/html, application/xhtml+xml, */*',
  accept_language_iteeng: 'it,it-IT;q=0.8,en;q=0.6,en-US;q=0.4'
};


/**
 * Return standard 200
 * @param res
 * @param [obj]
 * @returns {*}
 */
var ok = function(res, obj) {return res.json(200, obj);};
exports.ok = ok;

/**
 * Return standard 201
 * @param res
 * @param [obj]
 * @returns {*}
 */
var created = function(res, obj) {return res.json(201, obj);};
exports.created = created;

/**
 * Return standard 204
 * @param res
 * @returns {*}
 */
var deleted = function(res) {return res.json(204);};
exports.deleted = deleted;

/**
 * Return standard 404
 * @param res
 * @returns {*}
 */
var notfound = function(res) {return res.send(404); };
exports.notfound = notfound;

/**
 * Return standard 500
 * @param res
 * @param err
 * @returns {*}
 */
var error = function(res, err) { return res.send(500, err); };
exports.error = error;





function getData(o, encode) {
  if (typeof o == 'string') {
    return o;
  } else if (encode) {
    var eo = {}
    for (var p in o)
      eo[p] = u.encodeToEsa(o[p]);
    return querystring.stringify(eo);
  } else {
    return querystring.stringify(o);
  }
}
exports.getData = getData;


function getBasicAuth(username, password) {
  return 'Basic ' + new Buffer(username + ':' + password).toString('base64');
}
exports.getBasicAuth = getBasicAuth;


var getRedirectPath = function(opt, nxt) {
  if (nxt.indexOf('..')==0) {
    nxt = nxt.slice(2);
  } else {
    var prev = opt.path.split('/');
    var next = nxt.split('/');
    prev.pop();
    var mrg = _.union(prev, next);
    nxt = '/'+mrg.join('/');
  }
  console.log('Reindirizzato a: '+nxt);
  return nxt;
};


/**
 * Richiesta
 * @param desc
 * @param options
 * @param data
 * @param target
 * @param cb
 */
var doHttpsRequest = function(desc, options, data, target, cb) {
  var skipped = false;
  var download = false;
  cb = cb || noop;
  if (options.verbose)
    console.log('['+desc+']-OPTIONS: ' + JSON.stringify(options));

  var handler = (options.SSL) ? https : http;
  var req = handler.request(options, function(res) {
    var result = {
      code:res.statusCode,
      headers:res.headers
    };
    if (options.verbose)
      console.log('['+desc+']-RESULTS: ' + JSON.stringify(result));

    var newpath = res.headers.location;
    if ((res.statusCode.toString()=='302' || res.statusCode.toString()=='301') && newpath) {
      skipped = true;
      if (options.verbose)
        console.log('new location:'+newpath);
      var path = getRedirectPath(options ,newpath);
      if (path==options.path){
        console.log('Location is the same!');
        return;
      }
      options.path = path;
      if (options.verbose)
        console.log('Redir new path:'+options.path);
      if (res.headers['set-cookie'])
        options.headers.cookie = res.headers['set-cookie'];
      doHttpsRequest('redir - '+desc, options, data, null, cb);
    }

    if (target) {
      download = true;
      res.setEncoding('binary');
      res.pipe(target);
      target.on('finish', function() {
        if (options.verbose)
          console.log('Finito di scrivere il file!');
        target.close(cb(options,result, null));
      });
    }
    else res.setEncoding('utf8');

    var content = '';

    res.on('data', function (chunk) {
      if (options.verbose)
        console.log('['+desc+']-download data: '+chunk);
      content+=chunk;
    });
    res.on('end', function () {
      if (options.verbose)
        console.log('['+desc+']-Fine richiesta!   skipped='+skipped+'   download='+download+'  target='+(target ? 'si' : 'no'));
      if (!skipped && !target && !download) {
        options.headers = _.merge(options.headers, req.headers);
        cb(options, result, content);
      }
    });
  });

  req.on('error', function(e) {
    console.log('['+desc+']-problem with request: ' + e.message);
  });

  if (data) {
    if (options.verbose)
      console.log('['+desc+']-send data: '+data);
    req.write(data);
  }

  req.end();
};
exports.doHttpsRequest = doHttpsRequest;


function checkKeepers(options, content) {
  if (options.keepers && options.keepers.length && content){
    options.keepers.forEach(function(k){
      if (k.mode && k.mode=='onetime' && k.value) {
        //skip keeper
      } else {
        var rgx = new RegExp(k.pattern, 'g');
        var v = rgx.exec(content);
        if (v && v.length) k.value = v[1];
      }
    });
  }
}


/**
 * Effettua una catena di chiamate sequenziali
 * @param {object} options
 * @param {array} sequence
 * @param {number} i
 * @param {Function} cb
 */
function chainOfRequestsX(options, sequence, i, cb) {
  if (sequence[i].method) options.method = sequence[i].method;
  if (sequence[i].path) options.path = sequence[i].path;
  if (sequence[i].referer) options.headers.referer = sequence[i].referer;
  if (sequence[i].headers) {
    for(var pn in sequence[i].headers)
      options.headers[pn] = sequence[i].headers[pn];
  }

  if (options.keepers && options.keepers.length){
    options.keepers.forEach(function(k){
      if (k.value) {
        if (!sequence[i].data)
          sequence[i].data = {};
        sequence[i].data[k.name] = k.value;
      }
    });
  }
  if (sequence[i].noheaders) {
    sequence[i].noheaders.forEach(function (noh) {
      if (options.headers[noh]) {
        delete options.headers[noh];
      }
    });
  }

  var data_str = undefined;
  if (sequence[i].data_str)
    data_str = sequence[i].data_str;
  else if (sequence[i].data)
    data_str = getData(sequence[i].data);

  options.headers['content-length'] = data_str ? data_str.length : '0';


  if (options.verbose)
    console.log('['+sequence[i].title+']-REQUEST BODY: '+data_str);
  doHttpsRequest(sequence[i].title, options, data_str, undefined, function(o, r, c) {
    if (r.code!=200)
      return cb(new Error('['+sequence[i].title+'] - terminata con codice: '+r.code));
    if (options.verbose)
      console.log('['+(i+1)+' '+sequence[i].title+'] - RICHIESTA EFFETTUATA CON SUCCESSO, CONTENT: '+c);

    if (i>=sequence.length-1 || sequence[i].end)
      return cb(null, c);

    if (r.headers['set-cookie'])
      options.headers.cookie = r.headers['set-cookie'];

    checkKeepers(options, c);

    chainOfRequestsX(options, sequence, i + 1, cb);
  });
}

/**
 * Effettua una catena di chiamate sequenziali
 * @param {object} options
 * @param {object} sequence
 * @param {function} cb
 */
function chainOfRequests(options, sequence, cb) {
  return chainOfRequestsX(options, sequence, 0, cb);
}
exports.chainOfRequests = chainOfRequests;

