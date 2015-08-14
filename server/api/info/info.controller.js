/* Created by Leo on 14/08/2015. */
'use strict';

var w = require('../utilities/web');

exports.info = function(req, res) {
  var infos = {
    product: {
      name:'crumiro',
      version:'1.5.3'
    }
  };
  return w.ok(res, infos);
};
