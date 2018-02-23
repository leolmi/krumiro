'use strict';

angular.module('krumiroApp')
  .factory('klok', ['Utilities', '$interval', function(U, $interval) {

    const _layout = {
      main: 'klok',
      center: {
        x: 300,
        y: 300
      },
      radius: 200
    };
    var _context = {};
    var _state = {};

    function _set(name, atrb, value) {
      const e = document.getElementById(name);
      if (!e) return;
      _.isUndefined(value) ? e.innerHTML = atrb : e.setAttribute(atrb, value);
    }

    function _text(info) {
      _set('maintime', info.exit||'');
      _set('worktime', info.work||'');
      _set('pausetime', info.pause||'');
      _set('giftwtime', info.gift.w||'');
      _set('giftptime', info.gift.p||'');
    }

    function init(context) {
      _context = context;
      if (U.mobile) $interval(calc, 30000);
    }

    function _rad(CX, CY, r, a) {
      const rdn = (a - 90) * Math.PI / 180.0;
      return {
        x: CX + (r * Math.cos(rdn)),
        y: CY + (r * Math.sin(rdn))
      };
    }

    function _d(startAngle, endAngle) {
      if (_.isObject(startAngle)) {
        endAngle = startAngle.end - 1;
        startAngle = startAngle.start;
      }
      if (endAngle>360) endAngle = 360;
      if (startAngle >= endAngle) return null;
      const start = _rad(_layout.center.x, _layout.center.y, _layout.radius, endAngle);
      const end = _rad(_layout.center.x, _layout.center.y, _layout.radius, startAngle);
      const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
      return [
        "M", start.x, start.y,
        "A", _layout.radius.toFixed(2), _layout.radius.toFixed(2), 0, largeArcFlag, 0, end.x, end.y
      ].join(" ");
    }

    function _arc(name, startAngle, endAngle){
      if (!name) {
        name = _layout.main;
        startAngle = 0;
        endAngle = 359.99;
      }
      const d = _d(startAngle, endAngle);
      _set(name, 'd', d);
    }

    function _time(v) {
      return (v > 0) ? U.getTime(v) : '';
    }

    function _calc() {
      const now = new Date();
      const info = {
        nowm: now.getMinutes() + now.getHours() * 60,
        workm: 0,
        exitm: _context.exitm,
        exit: _context.exit,
        gift: {},
        items: [],
        tot: 0,
        over: {},   // over time
        out: {},    // out of time
        angle: function (v) {
          return ((v - this.str) * 360) / (this.tot || 1)
        }
      };
      var pre;
      _context.items.forEach(function (i) {
        if (i.E) {
          if (!info.start) info.start = i.EM;
          const item = {};
          item.EM = pre && pre.UM > i.EM ? pre.UM + 10 : i.EM;
          item.UM = i.UM > item.EM ? i.UM : 0;
          item.dt = item.UM > item.EM ? item.UM - item.EM : 0;
          if (pre && item.dt <= 0) item.dt = pre.EM - 1 - item.EM;
          info.items.push(item);
          pre = item;
        }
      });
      const first = _.first(info.items);
      const last = _.last(info.items);
      info.closed = !!last.UM;
      if (!info.closed) {
        last.UM = info.nowm >= last.EM ? info.nowm : last.EM + 10;
        last.dt = last.UM - last.EM;
      }
      info.str = first.EM;
      info.tot = info.exitm - first.EM;
      info.items.forEach(function (i) {
        i.start = info.angle(i.EM);
        i.end = info.angle(i.UM);
        i.d = _d(i);
        info.workm += i.UM - i.EM;
      });
      info.work = U.getTime(info.workm);
      info.done = info.closed && ((info.workm >= _context.targetworkm) || (_context.options.checkrange && info.nowm >= _context.options.max_u));
      const now_angle = info.angle(info.nowm);
      const end = info.done ? last.end : Math.max(last.end||0, now_angle);
      // over tempo passato (tutto)
      info.d = _d(first.start + 1, end - 1);
      // over (tempo non passato)
      if (last.UM > info.nowm) {
        info.over.start = now_angle;
        info.over.end = info.angle(last.UM);
        info.over.d = _d(info.over);
      }
      // out (tempo oltre il limite)
      // const max = Math.max(info.nowm, last.UM);
      // if ((max > info.exitm) && !info.done) {
      if (!info.done && (info.nowm > info.exitm)) {
        info.out.start = info.angle(info.start);
        info.out.end = info.angle(info.start + info.nowm - info.exitm);
        info.out.d = _d(info.out);
        info.gift.wm = (info.nowm - info.exitm);
      } else if (info.done && (last.UM > info.exitm)) {
        info.out.start = info.angle(info.start);
        info.out.end = info.angle(info.start + last.UM - info.exitm);
        info.out.d = _d(info.out);
        info.gift.wm = (last.UM - info.exitm);
      }
      var p = 0;
      if (info.done) {
        p = last.UM - info.start - info.workm;
      } else if (info.nowm - info.start > info.workm) {
        p = info.nowm - info.workm - info.start;
      }
      info.pause = _time(p);
      // se la pausa è durata meno di 30 min
      // mostra il delta non usufruito
      if (_context.options.checklunch && p > 0 && p < 30 && info.items.length>1) {
        info.outp = {
          start: info.angle(last.EM),
          end: info.angle(last.EM + 30 - p)
        };
        info.outp.d = _d(info.outp);
        info.gift.pm = (30 - p);
      }
      info.gift.w = _time(info.gift.wm);
      info.gift.p = _time(info.gift.pm);
      console.log('ITEMS', _context.items);
      console.log('KLOK', info);
      _arc();
      _text(info);
      _state = info;
      return _state;
    }

    function calc() {
      _context.klok = _calc();
    }

    function state() {
      return _state;
    }

    return {
      state: state,
      init: init,
      calc: calc
    }
  }]);
