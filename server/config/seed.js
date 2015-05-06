/**
 * Populate DB with sample data on server start
 * to disable, edit config/environment/index.js, and set `seedDB: false`
 */

'use strict';

//var Thing = require('../api/thing/thing.model');
//
//
//Thing.find({}).remove(function() {
//  Thing.create({
//    name : 'Development Tools',
//    info : 'Integration with popular tools such as Bower, Grunt, Karma, Mocha, JSHint, Node Inspector, Livereload, Protractor, Jade, Stylus, Sass, CoffeeScript, and Less.'
//  }, {
//    name : 'Server and Client integration',
//    info : 'Built with a powerful and fun stack: MongoDB, Express, AngularJS, and Node.'
//  }, {
//    name : 'Smart Build System',
//    info : 'Build system ignores `spec` files, allowing you to keep tests alongside code. Automatic injection of scripts and styles into your index.html'
//  },  {
//    name : 'Modular Structure',
//    info : 'Best practice client and server structures allow for more code reusability and maximum scalability'
//  },  {
//    name : 'Optimized Build',
//    info : 'Build process packs up your templates as a single JavaScript payload, minifies your scripts/css/images, and rewrites asset names for caching.'
//  },{
//    name : 'Deployment Ready',
//    info : 'Easily deploy your app to Heroku or Openshift with the heroku and openshift subgenerators'
//  });
//});


var Inaz = require('../api/inaz/inaz.model');

Inaz.find({}).remove(function() {
  Inaz.create({
    user: 'olmi',
    data:[
      { key:201504241758, time:1078, C:["16","24/04/2015","17","58","U",""] },
      { key:201504241329, time:809, C:["17","24/04/2015","13","29","E",""] },
      { key:201504241230, time:750, C:["18","24/04/2015","12","30","U",""] },
      { key:201504240846, time:526, C:["19","24/04/2015","8","46","E",""] }
    ],
    meta:[]
  });
});
