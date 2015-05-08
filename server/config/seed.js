/**
 * Populate DB with sample data on server start
 * to disable, edit config/environment/index.js, and set `seedDB: false`
 */

'use strict';


var Inaz = require('../api/inaz/inaz.model');

Inaz.find({}).remove(function() {
  console.log('Database initialized!');
  //Inaz.create({
  //  user: 'olmi',
  //  data:[
  //    { key:201504241758, time:1078, C:["16","24/04/2015","17","58","U",""] },
  //    { key:201504241329, time:809, C:["17","24/04/2015","13","29","E",""] },
  //    { key:201504241230, time:750, C:["18","24/04/2015","12","30","U",""] },
  //    { key:201504240846, time:526, C:["19","24/04/2015","8","46","E",""] }
  //  ],
  //  meta:[]
  //});
});
