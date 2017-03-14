/* Created by Leo on 21/09/2016. */
'use strict';

var mongoose = require('mongoose'),
  Schema = mongoose.Schema;


var TrulloBoxSchema = new Schema({
  title: String,
  desc: String,
  key: String,
  owner: String
});

module.exports = mongoose.model('TrulloBox', TrulloBoxSchema);
