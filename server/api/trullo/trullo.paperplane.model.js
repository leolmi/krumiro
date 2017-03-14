/* Created by Leo on 21/09/2016. */
'use strict';

var mongoose = require('mongoose'),
  Schema = mongoose.Schema;


var TrulloPaperPlaneItemSchema = new Schema({
  desc: String,
  owners: [String],
  done: Bolean
});

var TrulloPaperPlaneSchema = new Schema({
  title: String,
  desc: String,
  group: String,
  owners: [String],
  items:[TrulloPaperPlaneItemSchema],
  state: String,
  source: String,
  sourceId: String,
  creationDate: Number,
  modifiedDate: Number
});

module.exports = mongoose.model('TrulloPaperPlane', TrulloPaperPlaneSchema);
