/* Created by Leo on 01/07/2015. */
'use strict';

var mongoose = require('mongoose'),
  Schema = mongoose.Schema;

var RapDataRowSchema = new Schema({
  key:Number,
  time:Number,
  C:[String]
});


var RapDataSchema = new Schema({
  user: String,
  data:[RapDataRowSchema]
});

module.exports = mongoose.model('RapData', RapDataSchema);
