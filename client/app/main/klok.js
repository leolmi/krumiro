'use strict';

angular.module('krumiroApp')
  .factory('klok', ['Utilities', function(U) {

    const _layout = {
      main: 'klok',
      center: {
        x: 300,
        y: 300
      },
      radius: 200
    };

    function text(main, work) {
      _set('maintime', main||'');
      _set('worktime', work||'none');
    }

    function _rad(CX, CY, r, a) {
      const rdn = (a - 90) * Math.PI / 180.0;
      return {
        x: CX + (r * Math.cos(rdn)),
        y: CY + (r * Math.sin(rdn))
      };
    }

    function _set(name, atrb, value) {
      const e = document.getElementById(name);
      if (!e) return;
      _.isUndefined(value) ? e.innerHTML = atrb : e.setAttribute(atrb, value);
    }

    function _d(startAngle, endAngle){
      const start = _rad(_layout.center.x, _layout.center.y, _layout.radius, endAngle);
      const end = _rad(_layout.center.x, _layout.center.y, _layout.radius, startAngle);
      const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
      return [
        "M", start.x, start.y,
        "A", _layout.radius.toFixed(2), _layout.radius.toFixed(2), 0, largeArcFlag, 0, end.x, end.y
      ].join(" ");
    }

    function arc(name, startAngle, endAngle){
      if (!name) {
        name = _layout.main;
        startAngle = 0;
        endAngle = 359.99;
      }
      const d = _d(startAngle, endAngle);
      _set(name, 'd', d);
    }

    function calc(items) {
      console.log('ITEMS:', items);
      const now = new Date();
      const info = {
        nowM: now.getMinutes() + now.getHours() * 60,
        workM: 0,
        items: []
      };
      var pre;
      items.forEach(function (i) {
        if (i.E) {
          if (!info.start) info.start = i.EM;
          const item = {
            EM: i.EM,
            UM: i.UM,
            dt: i.UM ? i.UM - i.EM : 0
          };
          if (pre && item.dt <= 0) item.dt = pre.EM - 1 - item.EM;
          info.workM += item.dt;
          info.items.push(item);
          pre = item;
        }
      });
      const first = _.first(info.items);
      const last = _.last(info.items);
      last.UM = last.UM || info.nowM;
      info.str = first.EM;
      info.tot = last.UM - first.EM;
      info.items.forEach(function (i) {
        i.start = (((i.EM - info.str) * 360) / info.tot).toFixed(2);
        i.end = (((i.UM - info.str) * 360) / info.tot).toFixed(2);
        i.d = _d(i.start, i.end);
      });
      info.work = U.getTime(info.workM);
      info.d = _d(first.start + 1, last.end - 1);
      return info;
    }

    return {
      calc: calc,
      text: text,
      arc: arc
    }
  }]);
