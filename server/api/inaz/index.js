/**
 * Created by Leo on 02/04/2015.
 */
'use strict';

var express = require('express');
var controller = require('./inaz.controller');

var router = express.Router();

router.post('/', controller.bedge);
router.post('/download', controller.download);
router.post('/upload', controller.upload);
router.post('/stat', controller.stat);
// router.post('/paycheck', controller.paycheck);


module.exports = router;
