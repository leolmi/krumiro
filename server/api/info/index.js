/* Created by Leo on 14/08/2015. */
'use strict';

var express = require('express');
var controller = require('./info.controller');

var router = express.Router();

router.get('/', controller.info);

module.exports = router;
