/* Cantab Pi engagement environment: shared runtime for the shell and all views.
   Fixed code: views call CP.boot({ view, base, render }) and draw only from the ctx they receive.
   Responsibilities: load schema and tables, check the contract version, guard records, render the header and agent rail,
   fill placeholders, mark agent changes, and poll for new data versions. */
/* Cantab OS port (docs/live-views-status.md §8.5). A copy of vendor/bpag/assets/runtime.js; what changed:
   1. Host. When the page runs in the Lovable page's iframe, window.parent.CP_HOST
      { supabaseUrl, publishableKey, projectId, getToken, openView } is the data source. Without it the runtime
      behaves as in the package (files under data/).
   2. Data. Tables come from rpc/engagement_read (p_project, p_tables) and versions from rpc/engagement_version
      (p_project), fetched with the publishable key as apikey and the user's token from getToken() as bearer,
      instead of data/<table>.json and data/_version.json. Polling every 2 s is unchanged.
   3. Schema. window.CP_SCHEMA (inlined by scripts/templates.mjs) instead of data/_schema.json.
   4. Embed mode (whenever there is a host): no brand, no agent rail; the engagement line stays.
   5. Links to other views (brand, rail) call CP_HOST.openView(key) instead of navigating; the rail skips its
      HEAD check for pages that do not exist as files.
   6. status 'empty' hides the view and shows "This project has no engagement data yet. Ask Claude to load the
      demo (engagement_reset)."; the poll keeps running and draws the view once data arrives.
   Everything else, including what views receive in ctx, is the package's code unchanged. */
(function () {
  'use strict';
  var CONTRACT = '2.0';
  var SHELL_TABLES = ['engagement', 'phases'];
  var POLL_MS = 2000;
  var PH_RE = /\{([a-z_]+\.[a-z_]+)\}/g;
  var S = { base: '', view: null, render: null, schema: null, raw: {}, version: null, lastRendered: 0, first: true, empty: false };
  var CP = {};
  var HOST = null;
  try { HOST = window.parent !== window && window.parent.CP_HOST ? window.parent.CP_HOST : null; } catch (e) { HOST = null; }
  var EMBED = !!HOST;
  var EMPTY_TEXT = 'This project has no engagement data yet. Ask Claude to load the demo (engagement_reset).';

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (attrs[k] == null) continue;
      if (k === 'class') e.className = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  CP.el = el;
  var NS = 'http://www.w3.org/2000/svg';
  CP.svg = function (tag, attrs, text) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  };

  function getJSON(path) {
    return fetch(S.base + path, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error(path + ' ' + r.status);
      return r.json();
    });
  }

  // Host data source: Supabase RPC as the signed-in user. Returns the function's jsonb ({status: 'ok' | 'empty', ...}).
  function rpc(name, args) {
    return Promise.resolve(HOST.getToken()).then(function (token) {
      return fetch(HOST.supabaseUrl + '/rest/v1/rpc/' + name, {
        method: 'POST', cache: 'no-store',
        headers: { apikey: HOST.publishableKey, Authorization: 'Bearer ' + (token || HOST.publishableKey), 'Content-Type': 'application/json' },
        body: JSON.stringify(args)
      });
    }).then(function (r) {
      if (!r.ok) throw new Error(name + ' ' + r.status);
      return r.json();
    });
  }
  // The package's _version.json, or null when the project has no engagement.
  function getVersion() {
    if (!HOST) return getJSON('data/_version.json');
    return rpc('engagement_version', { p_project: HOST.projectId }).then(function (res) {
      return res && res.status === 'ok' ? res.version : null;
    });
  }
  function setEmpty(on) {
    S.empty = on;
    var main = document.getElementById('cp-main');
    if (!main) return;
    Array.prototype.forEach.call(main.children, function (c) { if (c.id !== 'cp-notices') c.hidden = on; });
    var notices = document.getElementById('cp-notices');
    if (on && notices) { notices.innerHTML = ''; notices.appendChild(el('div', { 'class': 'cp-notice cp-empty', role: 'status', text: EMPTY_TEXT })); }
    var header = document.getElementById('cp-header');
    if (on && header) header.innerHTML = '';
  }

  function neededTables() {
    var v = S.schema.views[S.view];
    var set = {};
    SHELL_TABLES.concat(v ? v.reads : []).forEach(function (t) { set[t] = 1; });
    return Object.keys(set);
  }

  function loadTables(list) {
    if (HOST) {
      return rpc('engagement_read', { p_project: HOST.projectId, p_tables: list }).then(function (res) {
        if (!res || res.status !== 'ok') { setEmpty(true); return; }
        if (S.empty) setEmpty(false);
        list.forEach(function (t) {
          var rows = res.tables ? res.tables[t] : undefined;
          if (Array.isArray(rows)) S.raw[t] = rows;
          else { S.raw[t] = []; S.loadErrors = (S.loadErrors || []).concat(t); }
        });
      });
    }
    return Promise.all(list.map(function (t) {
      return getJSON('data/' + t + '.json').then(function (rows) { S.raw[t] = Array.isArray(rows) ? rows : []; })
        .catch(function () { S.raw[t] = []; S.loadErrors = (S.loadErrors || []).concat(t); });
    }));
  }

  // ---------- guard: drop records the template cannot draw, truncate over-long text ----------
  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  function guard() {
    var T = S.schema.tables, data = {}, hidden = {}, ids = {};
    Object.keys(S.raw).forEach(function (t) { ids[t] = {}; S.raw[t].forEach(function (r) { if (r && r.id) ids[t][r.id] = 1; }); });
    Object.keys(S.raw).forEach(function (t) {
      var def = T[t]; data[t] = []; hidden[t] = 0;
      if (!def) return;
      S.raw[t].forEach(function (r0) {
        if (!r0 || typeof r0 !== 'object' || !r0.id) { hidden[t]++; return; }
        var r = Object.assign({}, r0), ok = true;
        Object.keys(def.fields).forEach(function (f) {
          var fd = def.fields[f], v = r[f], empty = v === undefined || v === null || v === '';
          if (fd.type === 'id') return;
          if (empty) { if (fd.required) ok = false; return; }
          if (fd.type === 'enum' && fd.values.indexOf(v) < 0) ok = false;
          if ((fd.type === 'number' || fd.type === 'integer') && (typeof v !== 'number' || !isFinite(v))) ok = false;
          if (fd.type === 'date' && !DATE_RE.test(v)) ok = false;
          if (fd.type === 'ref' && ids[fd.table] && !ids[fd.table][v] && fd.required) ok = false;
          if (fd.type === 'ref_list' && !Array.isArray(v)) r[f] = [];
          if ((fd.type === 'string' || fd.type === 'text') && typeof v === 'string') {
            var max = fd.max_len;
            if (t === 'narratives' && f === 'text' && def.slots && def.slots[r.view] && def.slots[r.view][r.slot]) max = def.slots[r.view][r.slot].max_len;
            if (max && !PH_RE.test(v) && v.length > max) r[f] = v.slice(0, max - 1) + '…';
            PH_RE.lastIndex = 0;
          }
        });
        if (ok) data[t].push(r); else hidden[t]++;
      });
    });
    return { data: data, hidden: hidden };
  }

  // ---------- calendar ----------
  var DAY = 86400000;
  function d(s) { return new Date(s + 'T00:00:00Z'); }
  function calendar(en) {
    var start = d(en.start);
    var week = function (s) { return Math.floor((d(s) - start) / DAY / 7) + 1; };
    return {
      start: en.start, end: en.end, asOf: en.as_of,
      week: week, totalWeeks: week(en.end), asOfWeek: week(en.as_of),
      weekStart: function (w) { return new Date(start.getTime() + (w - 1) * 7 * DAY).toISOString().slice(0, 10); },
      days: function (a, b) { return Math.round((d(b) - d(a)) / DAY); }
    };
  }
  CP.date = d;

  // ---------- formatting ----------
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var SYM = { EUR: '€', USD: '$', GBP: '£', CHF: 'CHF ' };
  function fmtFactory(currency) {
    var sym = SYM[currency] || '';
    var minus = '−';
    return {
      sym: sym,
      money_m: function (v) { if (v == null || !isFinite(v)) return '—'; return (v < 0 ? minus : '') + sym + Math.round(Math.abs(v)) + 'm'; },
      money_k: function (v) { if (v == null || !isFinite(v)) return '—'; return (v < 0 ? minus : '') + sym + Math.round(Math.abs(v) / 1000).toLocaleString('en-GB') + 'k'; },
      money: function (v) { if (v == null || !isFinite(v)) return '—'; return (v < 0 ? minus : '') + sym + Math.round(Math.abs(v)).toLocaleString('en-GB'); },
      num: function (v, dp) { if (v == null || !isFinite(v)) return '—'; var s = Math.abs(v).toLocaleString('en-GB', { minimumFractionDigits: dp || 0, maximumFractionDigits: dp || 0 }); return (v < 0 ? minus : '') + s; },
      signed: function (v, dp) { if (v == null || !isFinite(v)) return '—'; var s = Math.abs(v).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: dp == null ? 1 : dp }); return (v > 0 ? '+' : v < 0 ? minus : '') + s; },
      date: function (s) { if (!s) return '—'; var x = d(s); return x.getUTCDate() + ' ' + MONTHS[x.getUTCMonth()]; },
      dateLong: function (s) { if (!s) return '—'; var x = d(s); return x.getUTCDate() + ' ' + MONTHS[x.getUTCMonth()] + ' ' + x.getUTCFullYear(); },
      label: function (s) { return String(s || '').replace(/_/g, ' ').replace(/^./, function (c) { return c.toUpperCase(); }); }
    };
  }

  function fill(text, values) {
    return String(text == null ? '' : text).replace(PH_RE, function (m, name) {
      return values && values[name] != null ? String(values[name]) : '—';
    });
  }

  // ---------- change markers ----------
  function agentLabel(a) { var x = S.schema.agents[a]; return x ? x.label : a; }
  function changedNote(rec) {
    if (!rec || !rec._meta || rec._meta.updated_by === 'seed') return null;
    return 'Changed by ' + agentLabel(rec._meta.updated_by) + ': ' + rec._meta.reason;
  }
  function mark(node, rec, withDot) {
    var note = changedNote(rec);
    if (!node || !note) return node;
    node.setAttribute('data-changed', '1');
    node.setAttribute('title', note);
    if (withDot !== false && node.appendChild && !(node instanceof SVGElement)) {
      node.appendChild(el('span', { 'class': 'chg-dot', 'aria-label': note, role: 'img' }));
    }
    if (!S.first && rec._meta.version > S.lastRendered) {
      node.classList.add('flash');
    }
    return node;
  }

  // ---------- shell ----------
  // A link to another view: with a host it asks the host to switch this slot instead of navigating.
  function viewLink(a, key) {
    if (HOST && HOST.openView) a.addEventListener('click', function (e) { e.preventDefault(); HOST.openView(key); });
    return a;
  }
  function renderShell(ctx) {
    var en = ctx.en, cal = ctx.cal;
    var phase = ctx.data.phases.filter(function (p) { return p.start <= en.as_of && en.as_of <= p.end; })[0];
    var header = document.getElementById('cp-header');
    if (header) {
      header.className = 'cp-header';
      header.innerHTML = '';
      header.appendChild(el('div', { 'class': 'cp-header-in' }, [
        EMBED ? null : viewLink(el('a', { 'class': 'cp-brand', href: S.base + 'index.html' }, [
          el('span', { 'class': 'cp-mark', 'aria-hidden': 'true', text: 'π' }),
          el('span', { 'class': 'cp-word' }, ['Cantab ', el('span', { text: 'Pi' })])
        ]), 'home'),
        el('div', { 'class': 'cp-ctx' }, [
          el('span', null, ['Client ', el('b', { text: en.client })]),
          el('span', null, [el('b', { text: en.name })]),
          el('span', null, ['Phase ', el('b', { text: phase ? phase.name : '—' })]),
          el('span', null, ['Week ', el('b', { text: cal.asOfWeek + ' of ' + cal.totalWeeks })]),
          el('span', null, ['As of ', el('b', { text: ctx.fmt.dateLong(en.as_of) })])
        ])
      ]));
    }
    var rail = document.getElementById('cp-rail');
    if (rail && EMBED) rail.hidden = true;
    else if (rail && !rail.dataset.built) {
      rail.dataset.built = '1';
      rail.className = 'cp-rail';
      rail.setAttribute('aria-label', 'Agents');
      var views = S.schema.views;
      var groups = [['Engagement', function (k) { return k === 'home'; }], ['Client-facing', function (k, v) { return k !== 'home' && v.audience === 'client'; }], ['Team', function (k, v) { return k !== 'home' && v.audience === 'team'; }]];
      groups.forEach(function (g) {
        var box = el('div', { 'class': 'cp-rail-group' }, [el('div', { 'class': 'cp-rail-title', text: g[0] })]);
        Object.keys(views).forEach(function (k) {
          var v = views[k];
          if (!g[1](k, v)) return;
          var a = viewLink(el('a', { href: S.base + v.file, text: v.label }), k);
          if (k === S.view) a.setAttribute('aria-current', 'page');
          box.appendChild(a);
          if (k !== S.view && !HOST) fetch(S.base + v.file, { method: 'HEAD', cache: 'no-store' }).then(function (r) { if (!r.ok) a.classList.add('pending'); }).catch(function () { a.classList.add('pending'); });
        });
        rail.appendChild(box);
      });
    }
  }

  // ---------- shared derivations ----------
  // Value bridge: steps in order with running levels; used by the value, story and model views.
  function deriveBridge(data) {
    var steps = (data.value_steps || []).slice().sort(function (a, b) { return a.order - b.order; });
    var run = 0, out = [];
    steps.forEach(function (s) {
      var before = run, lo, hi;
      if (s.kind === 'start') { run = s.value; lo = 0; hi = run; }
      else if (s.kind === 'subtotal') { lo = 0; hi = run; }
      else { run = Math.round((run + s.value) * 10000) / 10000; lo = Math.min(before, run); hi = Math.max(before, run); }
      out.push({ step: s, before: before, level: run, lo: lo, hi: hi, total: s.kind !== 'delta' });
    });
    var vt = (data.value_settings || [])[0] || {};
    var idx = function (id) { for (var i = 0; i < out.length; i++) if (out[i].step.id === id) return i; return -1; };
    var fi = idx(vt.annotation_from_id), ti = idx(vt.annotation_to_id);
    var subs = out.filter(function (b) { return b.step.kind === 'subtotal'; });
    return {
      bars: out,
      start: out.length ? out[0].level : null,
      firstSubtotal: subs.length ? subs[0].level : null,
      lastSubtotal: subs.length ? subs[subs.length - 1].level : null,
      fromIndex: fi, toIndex: ti,
      netImpact: (fi >= 0 && ti >= 0) ? Math.round((out[ti].level - out[fi].level) * 10) / 10 : null,
      settings: vt
    };
  }
  // Nice axis: about `ticks` intervals covering [min, max].
  function niceScale(min, max, ticks) {
    if (!(max > min)) { max = min + 1; }
    var raw = (max - min) / (ticks || 5);
    var mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var step = [1, 2, 2.5, 5, 10].map(function (m) { return m * mag; }).filter(function (s) { return s >= raw; })[0];
    var lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
    var list = []; for (var v = lo; v <= hi + step / 2; v += step) list.push(Math.round(v * 1000) / 1000);
    return { min: lo, max: hi, step: step, ticks: list };
  }
  CP.niceScale = niceScale;

  // ---------- context passed to views ----------
  function buildCtx() {
    var g = guard();
    var by = {};
    Object.keys(g.data).forEach(function (t) { by[t] = {}; g.data[t].forEach(function (r) { by[t][r.id] = r; }); });
    var en = (g.data.engagement || [])[0];
    if (!en) throw new Error('The engagement record is missing.');
    var fmt = fmtFactory(en.currency);
    return {
      schema: S.schema, view: S.view, data: g.data, by: by, hidden: g.hidden, en: en,
      cal: calendar(en), fmt: fmt, fill: fill, mark: mark, changedNote: changedNote,
      version: S.version, first: S.first, el: el, svg: CP.svg, agentLabel: agentLabel,
      bridge: function () { return deriveBridge(g.data); },
      isFresh: function (rec) { return !S.first && !!rec && !!rec._meta && rec._meta.version > S.lastRendered; },
      niceScale: niceScale,
      get: function (t, id) { return (by[t] && id != null) ? by[t][id] || null : null; },
      name: function (pid) { var p = by.people && by.people[pid]; return p ? p.name : '—'; },
      hiddenNotice: function (container, tables) {
        var n = 0; (tables || Object.keys(g.hidden)).forEach(function (t) { n += g.hidden[t] || 0; });
        if (n && container) container.appendChild(el('div', { 'class': 'cp-notice', role: 'status', text: n + (n === 1 ? ' item is' : ' items are') + ' hidden because the data does not match this view.' }));
      }
    };
  }

  function draw() {
    var ctx;
    var main = document.getElementById('cp-main');
    try {
      ctx = buildCtx();
      renderShell(ctx);
      var notices = document.getElementById('cp-notices');
      if (notices) {
        notices.innerHTML = '';
        if (S.schema.contract_version !== CONTRACT) notices.appendChild(el('div', { 'class': 'cp-notice', role: 'status', text: 'This view was built for data contract ' + CONTRACT + '; the data is on ' + S.schema.contract_version + '. Some items may not show.' }));
        if (S.loadErrors && S.loadErrors.length) notices.appendChild(el('div', { 'class': 'cp-notice', role: 'status', text: 'Could not load: ' + S.loadErrors.join(', ') + '.' }));
        ctx.hiddenNotice(notices, S.schema.views[S.view] ? S.schema.views[S.view].reads : null);
      }
      S.render(ctx);
    } catch (e) {
      if (main) {
        main.innerHTML = '';
        main.appendChild(el('div', { 'class': 'cp-notice', role: 'alert', text: 'This view could not be drawn from the current data: ' + e.message }));
      }
      if (window.console) console.error(e);
    }
    S.lastRendered = S.version ? S.version.global : 0;
    S.first = false;
  }

  function poll() {
    getVersion().then(function (v) {
      if (!v) { if (!S.empty) setEmpty(true); return; }
      if (S.empty || !S.version) {
        S.version = v;
        return loadTables(neededTables()).then(function () { if (!S.empty) draw(); });
      }
      if (v.global === S.version.global) return;
      var changed = neededTables().filter(function (t) { return (v.tables[t] || 0) !== ((S.version.tables || {})[t] || 0); });
      S.version = v;
      return loadTables(changed).then(function () { if (changed.length) draw(); });
    }).catch(function () {}).then(function () { setTimeout(poll, POLL_MS); });
  }

  // Redraw from the data already loaded, e.g. after a selection in the view changes.
  CP.redraw = function () { if (S.schema) draw(); };

  CP.boot = function (opts) {
    S.base = opts.base || '';
    S.view = opts.view;
    S.render = opts.render;
    return (window.CP_SCHEMA ? Promise.resolve(window.CP_SCHEMA) : getJSON('data/_schema.json')).then(function (schema) {
      S.schema = schema;
      return Promise.all([
        loadTables(neededTables()),
        getVersion().then(function (v) { S.version = v; }).catch(function () { S.version = { global: 0, tables: {} }; })
      ]);
    }).then(function () {
      if (S.empty || !S.version) { setEmpty(true); setTimeout(poll, POLL_MS); return; }
      S.lastRendered = S.version.global;
      draw();
      setTimeout(poll, POLL_MS);
    }).catch(function (e) {
      var main = document.getElementById('cp-main');
      if (main) { main.innerHTML = ''; main.appendChild(el('div', { 'class': 'cp-notice', role: 'alert', text: 'The engagement data could not be loaded (' + e.message + ').' })); }
    });
  };

  window.CP = CP;
})();
