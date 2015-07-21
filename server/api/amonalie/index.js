/* Created by Leo on 20/07/2015. */
'use strict';

var express = require('express');
var controller = require('./amonalie.controller');

var router = express.Router();

router.post('/', controller.data);

module.exports = router;
