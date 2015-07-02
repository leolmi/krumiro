/* Created by Leo on 01/07/2015. */
'use strict';

var express = require('express');
var controller = require('./rap.controller');

var router = express.Router();

router.post('/', controller.data);

module.exports = router;

