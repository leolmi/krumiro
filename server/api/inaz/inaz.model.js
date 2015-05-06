/**
 * Created by Leo on 05/05/2015.
 */
'use strict';

var mongoose = require('mongoose'),
  Schema = mongoose.Schema;

var InazDataRowSchema = new Schema({
  key:Number,
  time:Number,
  C:[String]
});

var InazMetaRowSchema = new Schema({
  day:String,
  perm:Number,
  work:Number
});

var InazDataSchema = new Schema({
  user: String,
  data:[InazDataRowSchema],
  meta:[InazMetaRowSchema]
});

module.exports = mongoose.model('InazData', InazDataSchema);
