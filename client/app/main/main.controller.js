/**
 * Created by Leo on 01/04/2015.
 */
angular.module('krumiroApp')
  .controller('TempiCtrl', ['$scope','$http','$interval','$timeout','$window','Utilities','AES','Logger','klok',
    function ($scope,$http,$interval,$timeout,$window,U,AES,Logger,klok) {
      const alarm = new Audio('assets/media/alarm.mp3');
      var alarmOwner;
      const SCRT = '431a12934fc4914912895c5103aa51b0';
      var helpstyle_hidden = '-1000px';
      const STORE_OPTIONS = 'OPT';
      var _tick;

      $scope.helpon = false;
      $scope.helpstyle = {top: helpstyle_hidden};
      $scope.showopt = false;
      $scope.optstyle = {height: 0};
      $scope.progress = {
        forecolor: 'yellowgreen',
        value: 0,
        diameter: 32,
        border: 1
      };
      $scope.context = {
        o: '8',  //ore di lavora da contratto
        p: '',   // permessi / malattie
        exit: '?', // orario d'uscita
        work: '', // tempo lavorato
        items: [{
          E: '8:30',
          U: ''
        }],
        options: {
          lockuser: false, //salva le credenziali per l'accesso successivo
          alarms: false, //attiva gli allarmi
          checknine: true,  //verifica l'ingresso dopo le 9:00
          checklunch: true, //verifica la pausa pranzo
          checkmine: true,  //verifica l'ingresso prima delle 8:30
          milkstart: true,  // munge all'avvio
          canautomilk: false,  //offre la possibilità di attivare l'automilk
          debug: false,
          halfday: (4 * 60),
          min_e: (8 * 60 + 30),
          max_e: (9 * 60),
          max_u: (23 * 60),
          min_lunch: 30,
          max_lunch: 90,
          start_lunch: (12 * 60 + 15),
          end_lunch: (14 * 60 + 30)
        },
        debug: {}
      };

      $scope.instractions = {
        title: 'Cosa puoi fare con CRUMIRO?',
        footer: 'Se non ti basta .....',
        sections: [{
          icon: 'fa-clock-o',
          title: 'Puoi simulare le tue entrate ed uscite...',
          desc: 'Inserendo le tue entrate e le tue uscite otterrai in automatico l\'individuazione della pausa pranzo e l\'ora di uscita.'
        }, {
          icon: 'fa-clock-o',
          title: 'Puoi impostare le ore di lavoro e di permesso...',
          desc: 'Valorizzando correttamente le ore di permesso o di lavoro nel giorno puoi variare il calcolo dell\'ora di uscita.'
        }, {
          icon: 'fa-cloud-download',
          title: 'Con le credenziali INAZ acquisisci i dati reali...',
          desc: 'Inserendo le credenziali INAZ puoi scaricare manualmente le bedgiature cliccando sulla nuvoletta.\r\nOppure, attivando l\'interruttore puoi lasciare fare all\'applicazione che allinerà i dati ogni mezzo minuto.'
        }, {
          icon: 'fa-bug',
          title: 'Consultare le anomalie...',
          desc: 'Inserendo le credenziali @Assistant puoi scaricare l\'elenco delle anomalie e filtrarle come desideri.'
        }, {
          icon: 'fa-calendar',
          title: 'Vedere lo storico delle tue bedgiature...',
          desc: 'Inserendo le credenziali INAZ puoi scaricare lo storico delle tue bedgiature cliccando sul calendarino sulla destra.'
        }, {
          icon: 'fa-paw',
          title: 'Vedere i rapportini lavorati nel mese...',
          desc: 'Inserendo le credenziali INAZ puoi visualizzare l\'elenco mensile dei rapportini e fare le tue ricerche calcolando le ore lavorate per commessa o lavoro o quant\'altro.'
        }, {
          icon: 'fa-bullhorn',
          title: 'Aggiungere un allarme per ogni orario che desideri...',
          desc: 'Attivando il megafonino in basso a sinistra puoi farti avvisare acusticamente (quindi devi avere il volume e degli altoparlanti attivi) all\'ora d\'uscita e, attivandoli separatamente ad ogni orario definito (altoparlantino nella cella dell\'orario valorizzato).'
        }, {
          icon: 'fa-trophy',
          title: 'Consultare lo stato dei permessi e delle ferie...',
          desc: 'Inserendo le credenziali INAZ puoi consultare lo stato delle tue ferie e permessi utilizzati e rimanenti nell\'anno in corso.'
        }]
      };

      /**
       * Compara i tempi
       * @param r1
       * @param r2
       * @returns {number}
       */
      function timeCompare(r1, r2) {
        if (r1.time > r2.time) return 1;
        if (r1.time < r2.time) return -1;
        return 0;
      }

      function handleError(err, title) {
        title = title || 'ERRORE richiesta file degli storici';
        var msg = (err && !$.isEmptyObject(err)) ? err.message : 'verificare le credenziali e riprovare.';
        Logger.error(title, msg);
      }

      function debugPrint(title, content) {
        if (!$scope.context.options.debug) return;
        $scope.debuglines = $scope.debuglines || [];
        $scope.debuglines.push(title);
        if ($.isArray(content))
          $scope.debuglines.push.apply($scope.debuglines, content);
        else
          $scope.debuglines.push(JSON.stringify(content));
      }

      $scope.toggleOptions = function () {
        $scope.showopt = !$scope.showopt;
        $scope.optstyle = {height: $scope.showopt ? "190px" : "0"}
      };

      $scope.toggleOptionValue = function (opt) {
        $scope.context.options[opt] = !$scope.context.options[opt];
        if (opt === 'debug' && !$scope.context.options[opt])
          $scope.debuglines = [];
        $scope.recalc();
        _updateOptionsStore();
      };

      function loadAllData(results) {
        $scope.context.allitems = results.data;
        $scope.context.meta = results.meta;
        $scope.calcAllItems();
      }

      function _decrypt(name) {
        var v = AES.decrypt(name, SCRT);
        return (v && v !== 'undefined') ? v : '';
      }

      function _encrypt(value) {
        var v = AES.encrypt(value, SCRT);
        return (v && v !== 'undefined') ? v : '';
      }

      function loadOptionsStore() {
        if (!localStorage) return;
        var content = localStorage.getItem(STORE_OPTIONS);
        if (!content || content.length <= 0) return;
        try {
          var storedopt = JSON.parse(content);
          if (storedopt) {
            $scope.context.options.lockuser = !!storedopt.lockuser;
            $scope.context.options.alarms = !!storedopt.alarms;
            $scope.context.options.checklunch = _.isUndefined(storedopt.checklunch)?true:storedopt.checklunch;
            $scope.context.options.checkmine = _.isUndefined(storedopt.checkmine)?true:storedopt.checkmine;
            $scope.context.options.checknine = _.isUndefined(storedopt.checknine)?true:storedopt.checknine;
            $scope.context.options.milkstart = _.isUndefined(storedopt.milkstart)?true:storedopt.milkstart;
            $scope.context.options.canautomilk = !!storedopt.canautomilk;
            $scope.context.amonalie.filter = storedopt.amonalieFilter;
            if ($scope.context.options.lockuser && storedopt.crd && storedopt.crd.name && storedopt.crd.pswd) {
              try {
                $scope.context.user.name = _decrypt(storedopt.crd.name);
                $scope.context.user.password = _decrypt(storedopt.crd.pswd);
                $scope.context.ass.name = _decrypt(storedopt.ass.name);
                $scope.context.ass.password = _decrypt(storedopt.ass.pswd);
              }
              catch (err) {
                Logger.error('Impossibile recuperare le credenziali', err);
              }
            }
          }
        }
        catch (err) {
          localStorage.clear();
        }
      }

      function _updateOptionsStore() {
        if (!localStorage) return;
        $scope.context.options.crd = {};
        $scope.context.options.ass = {};
        $scope.context.options.amonalieFilter = $scope.context.amonalie.filter;
        if ($scope.context.options.lockuser) {
          $scope.context.options.crd.name = _encrypt($scope.context.user.name);
          $scope.context.options.crd.pswd = _encrypt($scope.context.user.password);
          $scope.context.options.ass.name = _encrypt($scope.context.ass.name);
          $scope.context.options.ass.pswd = _encrypt($scope.context.ass.password);
        }
        var content = JSON.stringify($scope.context.options);
        localStorage.setItem(STORE_OPTIONS, content);
      }

      $scope.toggleLockUser = function () {
        $scope.context.options.lockuser = !$scope.context.options.lockuser;
        _updateOptionsStore();
      };

      /**
       * Avvia la mungitura di inaz
       * C0 - numero
       * C1 - data (dd/MM/yyyy)
       * C2 - ora
       * C3 - minuti
       * C4 - tipo (E o U)
       * @type {boolean}
       */
      $scope.milking = false;

      function milkinaz(all) {
        if ($scope.milking) return;
        //simula il submit per memorizzare password e login
        _updateOptionsStore();

        $scope.milking = true;
        var reqopt = {
          all: all,
          user: $scope.context.user,
          work: getMinutes($scope.context.o),
          perm: getMinutes($scope.context.p),
          debug: $scope.context.options.debug
        };
        $http.post('/api/inaz', reqopt)
          .then(function (resp) {
            var results = resp.data;
            debugPrint('Risultati della mungitura inaz:', results.debug);
            if (results && results.data.length) {
              if (all) {
                loadAllData(results);
              }
              else {
                var items = [];
                var i = {};
                results.data.forEach(function (r) {
                  r.time = getMinutes(r['C2'] + ':' + r['C3']);
                });
                results.data.sort(timeCompare);

                results.data.forEach(function (r) {
                  if (r['C4'] === 'E') {
                    if (i.E) {
                      items.push(i);
                      i = {};
                    }
                    i.E = r['C2'] + ':' + r['C3'];
                  }
                  else if (r['C4'] === 'U') {
                    if (i.U) {
                      items.push(i);
                      i = {};
                    }
                    i.U = r['C2'] + ':' + r['C3'];
                  }
                });
                if (i.E || i.U)
                  items.push(i);
                $scope.context.items = items;
                $scope.recalc();
              }
            }
            if (results && results.error) {
              Logger.warning("Attenzione", results.error);
            }
            $scope.milking = false;
          }, function (err) {
            if (err && err.debug)
              debugPrint('Risultati della mungitura inaz:', err.debug);
            $scope.milking = false;
            handleError(err);
          });
      }


      function milkinazstat() {
        if ($scope.milking) return;
        //simula il submit per memorizzare password e login
        _updateOptionsStore();

        $scope.milking = true;
        var reqopt = {
          user: $scope.context.user,
          debug: $scope.context.options.debug
        };
        $http.post('/api/inaz/stat', reqopt)
          .then(function (resp) {
            var results = resp.data;
            if (results && results.data.length) {
              const row = results.data[0];
              const data = [];
              data.push({title: 'Residuo Anno Prec.', value: row['C1'] + 'gg'});
              data.push({title: 'Maturato Anno', value: row['C2'] + 'gg'});
              data.push({title: 'Goduti ad oggi', value: row['C3'] + 'gg'});
              data.push({title: 'Obiettivo al mese corrente', value: row['C4'] + 'gg'});
              data.push({title: 'Scostamento', value: row['C5'] + 'gg'});
              data.push({title: 'Residuo attuale', value: row['C6'] + 'gg'});
              $scope.context.stat.data = data;
            }
            $scope.milking = false;
          }, function (err) {
            if (err && err.debug)
              debugPrint('Risultati della mungitura inaz:', err.debug);
            $scope.milking = false;
            handleError(err);
          });
      }

      var automilk;
      $scope.start = function () {
        $scope.stop();
        automilk = $interval(milkinaz, 30000);
      };
      $scope.stop = function () {
        if (automilk) {
          $interval.cancel(automilk);
          automilk = null;
        }
      };
      $scope.$on('$destroy', function () {
        $scope.stop();
        _updateOptionsStore();
      });

      /**
       * Verifica lo stato dell'automungitura
       */
      function checkAutoMilk() {
        if ($scope.context.user.auto && !automilk)
          $scope.start();
        else if (!$scope.context.user.auto && automilk)
          $scope.stop();
      }

      function parse(v, min, max) {
        var rv = parseInt(v) || 0;
        if (rv < min) rv = min;
        if (rv > max) rv = max;
        return rv;
      }

      /**
       * Restituisce il numero di minuti dell'orario
       * @param {string} t
       * @returns {number}
       */
      function getMinutes(t) {
        if (!t) return 0;
        var pattern = /\d+/g;
        var values = t.match(pattern);
        var mt = 0;
        if (values && values.length > 0) {
          var h = parse(values[0], 0, 23);
          var m = 0;
          if (values.length > 1) {
            m = parse(values[1], 0, 59);
          }
          mt = h * 60 + m;
        }
        return mt;
      }


      /**
       * Determina se l'intervallo entrata - uscita è interpretabile come la pausa pranzo
       * @param e
       * @param u
       * @returns {boolean}
       */
      function isLunch(e, u) {
        return (u > 0 && e > 0 && e > $scope.context.options.start_lunch && u < $scope.context.options.end_lunch);
      }

      var days = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
      var months = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
      /**
       * Restituisce la data nei formati:
       * se small:    '24/10/2012'
       * altrimenti:  'martedì 24 ottobre 2012'
       * @param {string} mode
       * @param {string} [sep]
       * @returns {string}
       */
      $scope.getDate = function (mode, sep) {
        sep = sep || '/';
        var date = new Date();
        if (mode === 'small')
          return date.getDate() + sep + (date.getMonth() + 1) + sep + date.getFullYear();
        if (mode === 'verysmall')
          return (date.getMonth() + 1) + sep + date.getFullYear();
        return days[date.getDay()] + ' ' + date.getDate() + ' ' + months[date.getMonth()] + ' ' + date.getFullYear();
      };

      /**
       * Restituisce il numero di minuti dell'orario
       * @param i
       * @param type
       * @returns {*}
       */
      function calcMinutes(i, type) {
        var m = getMinutes(i[type]);
        i[type + 'M'] = m;
        return m;
      }

      /**
       * Ricalcola l'orario d'uscita
       */
      $scope.recalc = function () {
        var mP = 0;
        var mE = 0;
        var mT = getMinutes($scope.context.o);
        var mPP = getMinutes($scope.context.p);
        var mL = 0;
        var lastok = false;
        var firstE = 0;
        var lastE = 0;
        var m1 = 0, m2 = 0;
        // verifica che sia stata fatta la pausa pranzo
        var lunch = false;
        // la pausa pranzo viene valutata solo se le ore di permesso non sono
        // uguali o superiori alla mezza giornata e l'opzione è attiva
        var lunchable = (mPP < $scope.context.options.halfday) && $scope.context.options.checklunch;
        $scope.context.items.forEach(function (i) {
          m1 = calcMinutes(i, 'E');
          /// il minimo ingresso è alle 8:30
          if (m1 < $scope.context.options.min_e && $scope.context.options.checkmine)
            m1 = $scope.context.options.min_e;
          /// la pausa pranzo va da un minimo di 30min ad un massimo di 90min
          if (!lunch && isLunch(m1, m2) && $scope.context.options.checklunch) {
            lunch = true;
            i.lunch = true;
            var p = m1 - m2;
            if (p < $scope.context.options.min_lunch) {
              mP = $scope.context.options.min_lunch - p;
              p = $scope.context.options.min_lunch;
            }
            if (p > $scope.context.options.max_lunch) {
              mP = p - $scope.context.options.max_lunch;
              p = $scope.context.options.max_lunch;
            }
            i.L = U.getTime(p);
          }
          else i.lunch = false;
          m2 = calcMinutes(i, 'U');
          lastok = (m2 > m1);
          // se l'intervallo è valido aggiunge le ore di lavoro
          if (lastok) {
            var l = (m2 - m1);
            i.minutes = U.getTime(l);
            mL += l;
          }
          else i.minutes = 0;

          if (m1 > 0 && i.E) {
            lastE = m1;
            if (firstE === 0) {
              firstE = m1;
              // l'ingresso dopo le 9:00 va scaglionato sulle mezz'ore
              // se l'opzione è attiva
              if (firstE > $scope.context.options.max_e && $scope.context.options.checknine) {
                var meT = firstE - $scope.context.options.max_e;
                var meM = Math.floor(meT / 30);
                if (meM * 30 < meT) meM++;
                mE = meM * 30 - meT;
              }
            }
            if (m2 > 0)
              lastE = m2
          }
        });
        if (lastok)
          $scope.context.items.push({E: '', U: ''});
        if (!lunch && lunchable)
          mP = $scope.context.options.min_lunch;
        var r = lastE + mT - mL + mP - mPP + mE;

        if (r <= $scope.context.options.min_e || r >= $scope.context.options.max_u) r = 0;

        $scope.context.startm = firstE;
        $scope.context.exitm = r;
        $scope.context.exit = (r > 0) ? U.getTime(r) : '?';
        watchTime();
        klok.calc();
      };

      /**
       * Resetta tutti gli orari inseriti
       * (preserva le opzioni e le credenziali)
       */
      $scope.clear = function () {

        var u = ($scope.context && $scope.context.user) ? $scope.context.user : {};
        var a = ($scope.context && $scope.context.ass) ? $scope.context.ass : {};
        var opt = $scope.context.options;
        $scope.context = {
          user: u,
          ass: a,
          o: '8',
          p: '0',
          exit: '?',
          items: [{
            E: '8:30',
            U: ''
          }],
          options: opt,
          inaz: {
            show: false,
            items: [],
            analisys: {
              show: false,
              da: '01/01/2015',
              a: $scope.getDate('small'),
              results: []
            }
          },
          stat: {
            show: false
          },
          rap: {
            items: [],
            show: false,
            date: $scope.getDate('verysmall'),
            advanced: false,
            todate: $scope.getDate('verysmall'),
            headers: ['Data', 'Cliente|Commessa', 'Lavoro', 'Attività', 'Descrizione|Idaol'],
            fields: [],
            selection: 0
          },
          amonalie: {
            o: {
              show: false,
              SSL: true,
              multisep: ',',
              casesens: false,
              fields: []
            },
            show: false,
            headers: {values: ['Codice', 'Data', 'Applicativo', 'Funzione', 'Versione', 'Stato', 'Oggetto', 'Descrizione', 'Istituto', 'Note', 'Tipo', 'Nome e cognome', 'ReferenteTec', 'Attribuzioni']},
            items: [],
            selection: []
          },
          sts:{
            show: false
          },
          debug: {}
        };
        loadOptionsStore();
        klok.init($scope.context);
        $scope.recalc();
      };

      $scope.refreshRapSummary = function() {
        function __parse(v,min,max) {
          var rv = parseInt(v) || 0;
          if (rv<min) rv=min;
          if (rv>max) rv=max;
          return rv;
        }
        function __getMin(t) {
          if (!t) return 0;
          const pattern = /\d+/g;
          var values = t.match(pattern);
          var mt = 0;
          if (values && values.length>0) {
            var h = __parse(values[0],0,23);
            var m = 0;
            if (values.length>1) {
              m = __parse(values[1],0,99);
              m = m ? m/100 : 0;
            }
            mt = h+m;
          }
          return mt;
        }
        var tot = 0, totv = 0, totsel = 0, totselv = 0, sel = 0;
        ($scope.context.filteredRaps||[]).forEach(function(f) {
          var m = __getMin(f['C5']);
          var v = __getMin(f['C7']);
          tot += m;
          totv += v;
          if (f.selected) {
            sel++;
            totsel += m;
            totselv += v;
          }
        });

        const o = parseInt($scope.context.o)||8;
        $scope.context.rap.summary = tot;
        $scope.context.rap.summaryV = totv;
        $scope.context.rap.summaryGG = (tot / o).toFixed(2);
        $scope.context.rap.summaryVGG = (totv / o).toFixed(2);
        $scope.context.rap.summarySel = totsel;
        $scope.context.rap.summarySelV = totselv;
        $scope.context.rap.summarySelGG = (totsel / o).toFixed(2);
        $scope.context.rap.summarySelVGG = (totselv / o).toFixed(2);
        $scope.context.rap.selection = sel;
        return tot;
      };

      $scope.toggleRapSel = function(rap) {
        rap.selected = !rap.selected;
        $scope.refreshRapSummary();
      };

      /**
       * Attiva o spenge l'automungitura
       */
      $scope.toggleAutoInaz = function () {
        $scope.context.user.auto = !$scope.context.user.auto;
        checkAutoMilk();
      };

      /**
       * Avvia o chiude il processo di mungitura di tutte le rilevazioni
       */
      $scope.toggleInaz = function () {
        $scope.context.inaz.show = !$scope.context.inaz.show;
        if ($scope.context.inaz.show) {
          $scope.context.rap.show = false;
          $scope.context.amonalie.show = false;
          if (!$scope.context.inaz.items || $scope.context.inaz.items.length <= 0)
            milkinaz(true);
        }
      };

      $scope.reloadInaz = function () {
        milkinaz(true);
      };

      function validateUser() {
        return ($scope.context.user.name && $scope.context.user.password);
      }

      /**
       * Se le credenziali sono valorizzate avvia il processo di mngitura
       */
      $scope.inaz = function () {
        if (!validateUser() || $scope.context.user.auto)
          return;
        milkinaz();
      };

      $scope.analisys = function () {
        $scope.context.inaz.analisys.show = !$scope.context.inaz.analisys.show;
        if ($scope.context.inaz.analisys.show)
          $scope.context.inaz.analisys.calc();
      };

      /**
       * Aggiunge un nuovo elemento all'elenco delle informazioni giornaliere
       * @param {[object]} daysItems
       * @param {string} day
       * @param {[object]} items
       */
      function addItems(daysItems, day, items) {
        if (items.length <= 0) return;
        var dayitem = {
          day: day,
          dayn: U.parseDate(day),
          items: items.sort(timeCompare)
        };
        //aggiunge i meta del giorno
        if ($scope.context.meta.length > 0) {
          var metas = $.grep($scope.context.meta, function (m) {
            return m.day === day;
          });
          if (metas && metas.length > 0) {
            if (metas[0].perm > 0) dayitem.perm = metas[0].perm;
            if (metas[0].work !== (8 * 60)) dayitem.work = metas[0].work;
          }
        }
        daysItems.push(dayitem);
      }

      /**
       * C0 - numero
       * C1 - data (dd/MM/yyyy)
       * C2 - ora
       * C3 - minuti
       * C4 - tipo (E o U)
       */
      $scope.calcAllItems = function () {
        if (!$scope.context.allitems || $scope.context.allitems.length <= 0) return;
        var items = [], daysItems = [];
        var day = '';
        $scope.context.allitems.forEach(function (i) {
          if (day !== i['C1']) {
            addItems(daysItems, day, items);
            day = i['C1'];
            items = [];
          }
          i.time = getMinutes(i['C2'] + ':' + i['C3']);
          items.push(i);
        });
        addItems(daysItems, day, items);
        $scope.context.inaz.items = daysItems;
      };

      /**
       * Restituisce i minuti dell'ora corrente
       * @returns {number}
       */
      function getNowM() {
        var now = new Date();
        return now.getHours() * 60 + now.getMinutes();
      }

      /**
       * attiva l'allarme per l'item
       * @param item
       * @param property
       * @returns {boolean}
       */
      function activateItemAlarm(item, property) {
        alarmOwner = {i: item, p: property};
        $scope.alarm();
        return true;
      }

      /**
       * Avvia la procedura di verifica degli orari ogni 10 secondi
       */
      function watchTime() {
        if (angular.isDefined(_tick) || !$scope.context.options.alarms) return;
        _tick = $interval(function () {
          var nowm = getNowM();
          //verifica orario uscita
          if ($scope.context.exitm && alarm.paused && nowm >= $scope.context.exitm) {
            $scope.alarmed = true;
            $scope.alarm();
          }
          else {
            //verifica orari intermedi
            $scope.context.items.some(function (i) {
              if (i['EM'] && i['EM'] <= nowm && i.ealarm) {
                return activateItemAlarm(i, 'ealarm');
              }
              else if (i['UM'] && i['UM'] <= nowm && i.ualarm) {
                return activateItemAlarm(i, 'ualarm');
              }
              return false;
            });
          }
        }, 10000);
      }

      /**
       * Ferma la procedura di verifica degli orari ogni 10 secondi
       */
      function stopWatchTime() {
        if (angular.isDefined(_tick)) {
          $interval.cancel(_tick);
          _tick = undefined;
        }
        $scope.alarmed = false;
      }
      $scope.stopAlarm = stopWatchTime;

      /**
       * suona l'allarme se spento o lo zittisce se acceso
       */
      $scope.alarm = function () {
        if (alarm.paused) {
          if ($scope.context.options.alarms)
            alarm.play();
          if (alarmOwner)
            alarmOwner.i[alarmOwner.p + 'ed'] = true;
        }
        else {
          alarm.pause();
          if (!alarmOwner)
            stopWatchTime();
          if (alarmOwner) {
            alarmOwner.i[alarmOwner.p + 'ed'] = false;
            alarmOwner.i[alarmOwner.p] = false;
            alarmOwner = null;
          }
        }
        $scope.isalarm = !alarm.paused;
      };

      /**
       * Attiva o disattiva l'opzione degli allarmi
       */
      $scope.toggleAlarms = function () {
        if ($scope.context.options.alarms) {
          $scope.context.options.alarms = false;
          stopWatchTime();
          if (!alarm.paused)
            $scope.alarm();
        }
        else {
          $scope.context.options.alarms = true;
          watchTime();
        }
        _updateOptionsStore();
      };

      /**
       * Attiva o disattiva l'help
       */
      $scope.help = function () {
        $scope.helpon = !$scope.helpon;
        $scope.helpstyle = {top: $scope.helpon ? '10px' : helpstyle_hidden};
      };

      $scope.downloadHistory = function () {
        if (!validateUser()) return;
        var reqopt = {
          user: $scope.context.user
        };
        $http.post('/api/inaz/download', reqopt)
          .then(function (resp) {
            var history = resp.data;
            debugPrint('Storico completo inaz:', history);
            var content = JSON.stringify(history);
            content = content.replace(/,"\$\$hashKey":"object:\d+"/g, '');
            content = content.replace(/},{/g, '},\r\n{');
            content = content.replace(/],"/g, '],\r\n"');
            content = content.replace(/:\[{/g, ':[\r\n{');
            var file = new Blob([content], {type: 'text/json;charset=utf-8'});
            var today = $scope.getDate(null, '-');
            saveAs(file, 'history_' + today + '.json');
          }, function (err) {
            handleError(err);
          });
      };

      $scope.uploadHistoryContent = function (args) {
        if (!validateUser()) return;
        var reader = new FileReader();
        reader.onload = function (onLoadEvent) {
          var reqopt = {
            user: $scope.context.user,
            history: onLoadEvent.target.result
          };
          $http.post('/api/inaz/upload', reqopt)
            .then(function (resp) {
              var results = resp.data;
              Logger.ok("Storici aggiornati correttamente!");
              loadAllData(results);
            }, function (err) {
              Logger.error('Errore in richiesta di aggiornamento storici', err);
            });
        };
        reader.readAsText(args.files[0]);
      };

      $scope.uploadHistory = function () {
        if (!validateUser()) return;
        angular.element('#history-file').trigger('click');
      };

      /**
       * Avvia la rappresentazione dell'orologio con un delay di 2 secondi
       */
      $interval(function () {
        var nm = getNowM();
        var lm = $scope.context.exitm - $scope.context.startm;
        var rm = getNowM() - $scope.context.startm;
        var elps = $scope.context.exitm - nm;
        $scope.progress.value = (lm <= 0 || rm <= 0) ? 0 : Math.floor((rm * 100) / lm);
        $scope.progress.elapsed = U.getTime(elps);
      }, 2000);

      function milkrap() {
        if ($scope.milking) return;

        $scope.milking = true;
        var reqopt = {
          user: $scope.context.user,
          date: $scope.context.rap.date,
          advanced: $scope.context.rap.advanced||U.mobile,
          todate: $scope.context.rap.todate,
          debug: $scope.context.options.debug
        };
        $http.post('/api/rap', reqopt)
          .then(function (resp) {
            const results = resp.data;
            debugPrint('Risultati della mungitura rapportini:', results.debug);
            var pre = null;
            (results.data||[]).forEach(function(i){
              if (pre && i['C0']===pre['C0']) pre.samedate = true;
              pre = i;
            });
            $scope.context.rap.items = results.data;
            $scope.milking = false;
          }, function (err) {
            $scope.milking = false;
            if ((err||{}).debug||((err||{}).data||{}).debug)
              debugPrint('Risultati della mungitura rapportini:', err.debug||(err.data||{}).debug);
            handleError(err, 'ERRORE richiesta rapportini');
          });
      }

      $scope.toggleRap = function () {
        $scope.context.rap.show = !$scope.context.rap.show;
        if ($scope.context.rap.show) {
          $scope.context.inaz.show = false;
          $scope.context.amonalie.show = false;
          if (!$scope.context.rap.items)
            milkrap();
        }
      };

      $scope.reloadRap = function () {
        milkrap();
      };

      $scope.toggleSts = function() {
        $scope.context.sts.show = !$scope.context.sts.show;
        if (!$scope.context.sts.show) {
          _updateOptionsStore();
        }
      };

      $scope.toggleAmonalie = function () {
        if (!$scope.context.amonalie.show) {
          $scope.context.inaz.show = false;
          $scope.context.rap.show = false;
        }
        $scope.context.amonalie.show = !$scope.context.amonalie.show;
      };

      function getRows(items) {
        var rows = [];
        items.forEach(function (i) {
          rows.push(getValues(i));
        });
        return rows;
      }

      function getValues(o) {
        var v = {values: []};
        for (var pn in o)
          v.values.push(o[''+pn]);
        return v;
      }

      $scope.reloadAmonalie = function () {
        if ($scope.milking) return;
        _updateOptionsStore();
        $scope.milking = true;
        var reqopt = {
          user: $scope.context.ass,
          SSL: $scope.context.amonalie.o.SSL,
          debug: $scope.context.options.debug
        };
        $http.post('/api/amonalie', reqopt)
          .then(function (resp) {
            var results = resp.data;
            debugPrint('Risultati della mungitura amonalie:', results.debug);
            var rows = getRows(results.data);
            $scope.context.amonalie.headers = rows.shift();
            $scope.context.amonalie.items = rows;

            $scope.milking = false;
          }, function (err) {
            $scope.milking = false;
            if (err && err.debug)
              debugPrint('Risultati della mungitura amonalie:', err.debug);
            handleError(err, 'ERRORE richiesta amonalie');
          });
      };

      $scope.toggleAmonalieOptions = function () {
        $scope.context.amonalie.o.show = !$scope.context.amonalie.o.show;
      };

      $scope.toggleStat = function () {
        $scope.context.stat.show = !$scope.context.stat.show;
        if ($scope.context.stat.show && !$scope.context.stat.data)
          milkinazstat();
      };


      $scope.downloadCed = function() {
        if ($scope.milking) return;
        _updateOptionsStore();

        $scope.milking = true;
        var reqopt = {
          user: $scope.context.user,
          debug: $scope.context.options.debug
        };
        $http.post('/api/inaz/paycheck', reqopt)
          .then(function (resp) {
            const results = resp.data;
            debugPrint('Risultati della mungitura busta paga:', results.debug);
            const file = new Blob([results.data], {type: 'application/pdf;charset=utf-8'});
            saveAs(file, 'busta.pdf');
            U.copyToClipboard(results.password);
            $scope.milking = false;
          }, function (err) {
            if (err && err.debug)
              debugPrint('Risultati della mungitura busta paga:', err.debug);
            $scope.milking = false;
            handleError(err);
          });
      };

      $scope.expanded = {};
      $scope.toggle = function(index) {
        $scope.expanded[index] = !$scope.expanded[index];
      };


      $scope.copyToClipboard = function (txt) {
        U.copyToClipboard(txt);
        Logger.ok("Testo copiato negli appunti!");
      };

      $http.get('/api/info')
        .then(function (resp) {
          var info = resp.data;
          $scope.product = info.product;
        });

      /**
       * Inizializza le opzioni
       */
      $scope.clear();

      $scope.mobileKlok = function() {
        $scope.alarmed ? $scope.stopAlarm() : $scope.inaz();
      };

      klok.init($scope.context);
      if ($scope.context.user.name && $scope.context.user.password && ($scope.context.options.milkstart || U.mobile)) $scope.inaz();
    }]);
