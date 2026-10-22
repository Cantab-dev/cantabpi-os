// Reference implementation of the engagement data store rules.
// - validateDataset(schema, data): full render-contract check -> { errors, warnings }
// - applyWrite(schema, data, request, opts): the tool's `write` verb -> { committed, errors, warnings, ... }
// CLI:
//   node validator/validate.js [dataDir]                 validate the dataset
//   node validator/validate.js --apply request.json [dataDir]   apply a write request (commits if valid)
//   node validator/validate.js --reset [dataDir]         restore data from dataDir/seed
'use strict';
const fs = require('fs');
const path = require('path');

// ---------- helpers ----------
const isEmpty = (v) => v === undefined || v === null || v === '';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PH_RE = /\{([a-z_]+\.[a-z_]+)\}/g;
const TAG_RE = /<\/?[a-zA-Z][^>]*>/;
const CTRL_RE = /[\u0000-\u0009\u000B-\u001F\u007F]/;
const dayMs = 86400000;
const toDate = (s) => new Date(s + 'T00:00:00Z');
const validDate = (s) => typeof s === 'string' && DATE_RE.test(s) && !isNaN(toDate(s)) && toDate(s).toISOString().slice(0, 10) === s;
const byId = (rows) => Object.fromEntries((rows || []).map((r) => [r.id, r]));
const clone = (x) => JSON.parse(JSON.stringify(x));

function engagementCalendar(data) {
  const en = (data.engagement || [])[0];
  if (!en || !validDate(en.start) || !validDate(en.end) || !validDate(en.as_of)) return null;
  const week = (d) => Math.floor((toDate(d) - toDate(en.start)) / dayMs / 7) + 1;
  return { en, week, totalWeeks: week(en.end), asOfWeek: week(en.as_of) };
}

function placeholderSet(schema, viewName) {
  const v = schema.views[viewName];
  return v ? v.placeholders || {} : null;
}

// Length of a text with each placeholder counted at its declared width.
function renderedLength(text, phs) {
  return text.replace(PH_RE, (m, name) => 'x'.repeat((phs && phs[name] && phs[name].width) || m.length)).length;
}

// ---------- validation ----------
function validateDataset(schema, data) {
  const errors = [];
  const warnings = [];
  const err = (rule, table, id, message, extra) => errors.push(Object.assign({ rule, table, id: id || null, message }, extra || {}));
  const warn = (rule, table, id, message) => warnings.push({ rule, table, id: id || null, message });
  const T = schema.tables;
  const idx = {};
  for (const t of Object.keys(T)) idx[t] = byId(data[t] || []);

  // --- I26 + field rules ---
  for (const [t, def] of Object.entries(T)) {
    const rows = data[t];
    if (!Array.isArray(rows)) { err('I26', t, null, 'table missing or not an array'); continue; }
    if (rows.length < def.min || rows.length > def.max) err('I26', t, null, `has ${rows.length} records`, { allowed: `${def.min}..${def.max}` });
    const seen = new Set();
    const idRe = new RegExp('^' + def.prefix + '-\\d{2,3}$');
    for (const r of rows) {
      if (!r || typeof r !== 'object') { err('I26', t, null, 'record is not an object'); continue; }
      if (!idRe.test(r.id || '')) err('I26', t, r.id, `id must match ${def.prefix}-NN`);
      if (seen.has(r.id)) err('I26', t, r.id, 'duplicate id');
      seen.add(r.id);
      if (!r._meta || !Number.isInteger(r._meta.version) || !r._meta.updated_at || !r._meta.updated_by) err('I26', t, r.id, '_meta missing or incomplete');
      for (const k of Object.keys(r)) if (k !== '_meta' && !def.fields[k]) err('field', t, r.id, `unknown field ${k}`);
      for (const [f, fd] of Object.entries(def.fields)) {
        if (fd.type === 'id') continue;
        checkField(t, r, f, fd);
      }
    }
    if (def.fixed_ids) for (const fid of def.fixed_ids) if (!idx[t][fid]) err('I26', t, fid, 'fixed record missing');
    if (def.fixed_keys) {
      const f = def.fixed_keys.field;
      for (const key of def.fixed_keys.values) {
        const c = rows.filter((r) => r[f] === key).length;
        if (c !== 1) err('I25', t, null, `key ${key} must exist exactly once (found ${c})`);
      }
    }
    if (def.order_field) {
      const { field, group_by } = def.order_field;
      const groups = {};
      for (const r of rows) {
        const g = group_by.map((k) => r[k] == null ? '' : r[k]).join('|');
        (groups[g] = groups[g] || []).push(r[field]);
      }
      for (const [g, vals] of Object.entries(groups)) {
        const s = vals.slice().sort((a, b) => a - b);
        if (!s.every((v, i) => v === i + 1)) err('I26', t, null, `${field} values must run 1..n` + (g ? ` within group ${g}` : ''), { found: s });
      }
    }
  }

  function checkField(t, r, f, fd) {
    const v = r[f];
    const id = r.id;
    if (isEmpty(v) || (fd.type === 'ref_list' && Array.isArray(v) && v.length === 0)) {
      if (fd.required) err('field', t, id, `${f} is required`);
      return;
    }
    const bad = (msg, allowed) => err('field', t, id, `${f} ${msg}`, allowed !== undefined ? { allowed } : undefined);
    switch (fd.type) {
      case 'string':
      case 'text': {
        if (typeof v !== 'string') return bad('must be text');
        if (CTRL_RE.test(v)) return bad('contains control characters');
        if (TAG_RE.test(v)) return bad('contains markup; plain text only');
        let max = fd.max_len;
        if (t === 'narratives' && f === 'text') {
          const slot = ((T.narratives.slots[r.view] || {})[r.slot]);
          if (slot) max = slot.max_len;
        }
        let phs = null;
        if (fd.placeholders) {
          const view = fd.placeholders.startsWith('view:') ? fd.placeholders.slice(5) : r[fd.placeholders.slice(6)];
          phs = placeholderSet(schema, view) || {};
          for (const m of v.matchAll(PH_RE)) if (!phs[m[1]]) err('I22', t, id, `${f} uses undeclared placeholder {${m[1]}}`, { allowed: Object.keys(phs) });
          if (/[{}]/.test(v.replace(PH_RE, ''))) bad('contains a brace that is not a valid placeholder');
        } else if (/\{[a-z_]+\.[a-z_]+\}/.test(v)) bad('placeholders are not allowed in this field');
        const len = renderedLength(v, phs);
        if (len > max) bad(`is ${len} characters`, `<= ${max}`);
        if (fd.type === 'string') {
          const lines = v.split('\n');
          const maxLines = fd.max_lines || 1;
          if (lines.length > maxLines) bad(`has ${lines.length} lines`, `<= ${maxLines}`);
          if (fd.line_len) lines.forEach((ln) => { if (ln.length > fd.line_len) bad(`line "${ln}" is ${ln.length} characters`, `<= ${fd.line_len} per line`); });
        }
        if (fd.pattern && !new RegExp(fd.pattern).test(v)) bad('has an invalid format', fd.pattern);
        return;
      }
      case 'integer':
        if (!Number.isInteger(v)) return bad('must be a whole number');
        if (fd.min !== undefined && v < fd.min) bad(`is ${v}`, `>= ${fd.min}`);
        if (fd.max !== undefined && v > fd.max) bad(`is ${v}`, `<= ${fd.max}`);
        return;
      case 'number': {
        if (typeof v !== 'number' || !isFinite(v)) return bad('must be a number');
        if (fd.min !== undefined && v < fd.min) bad(`is ${v}`, `>= ${fd.min}`);
        if (fd.max !== undefined && v > fd.max) bad(`is ${v}`, `<= ${fd.max}`);
        if (fd.decimals !== undefined) {
          const p = Math.pow(10, fd.decimals);
          if (Math.abs(Math.round(v * p) - v * p) > 1e-6) bad(`has more than ${fd.decimals} decimals`);
        }
        return;
      }
      case 'boolean':
        if (typeof v !== 'boolean') bad('must be true or false');
        return;
      case 'date':
        if (!validDate(v)) bad('must be a date YYYY-MM-DD');
        return;
      case 'enum':
        if (!fd.values.includes(v)) bad(`is "${v}"`, fd.values);
        return;
      case 'ref':
        if (!idx[fd.table][v]) bad(`refers to missing ${fd.table} ${v}`);
        return;
      case 'ref_list':
        if (!Array.isArray(v)) return bad('must be a list');
        if (v.length > fd.max_items) bad(`has ${v.length} items`, `<= ${fd.max_items}`);
        if (new Set(v).size !== v.length) bad('has duplicates');
        v.forEach((x) => { if (!idx[fd.table][x]) bad(`refers to missing ${fd.table} ${x}`); });
        return;
      default:
        bad(`has unknown type ${fd.type}`);
    }
  }

  // Stop before invariants if structure is broken (they assume valid fields)
  if (errors.length) return { errors, warnings };

  const cal = engagementCalendar(data);
  const en = cal.en;
  const P = idx.people, PH = idx.phases, MS = idx.milestones, DL = idx.deliverables, TK = idx.tasks, IN = idx.issue_nodes, VS = idx.value_steps, MC = idx.model_cells;
  const consulting = (pid) => P[pid] && P[pid].org === 'consulting';
  const inRange = (d, a, b) => d >= a && d <= b;

  // I01
  if (!(en.start < en.end)) err('I01', 'engagement', en.id, 'start must be before end');
  if (!inRange(en.as_of, en.start, en.end)) err('I01', 'engagement', en.id, 'as_of must lie within the engagement');
  if (toDate(en.start).getUTCDay() !== 1) err('I01', 'engagement', en.id, 'start must be a Monday');
  // I02
  if (!consulting(en.partner_id)) err('I02', 'engagement', en.id, 'partner must be a consulting person');
  if (!consulting(en.manager_id)) err('I02', 'engagement', en.id, 'manager must be a consulting person');
  if (P[en.sponsor_id].org !== 'client') err('I02', 'engagement', en.id, 'sponsor must be a client person');
  // I03
  for (const p of data.people) {
    const has = !isEmpty(p.rate_day) && !isEmpty(p.capacity_days_week);
    const none = isEmpty(p.rate_day) && isEmpty(p.capacity_days_week);
    if (p.org === 'consulting' && !has) err('I03', 'people', p.id, 'consulting people need rate_day and capacity_days_week');
    if (p.org === 'client' && !none) err('I03', 'people', p.id, 'client people have no rate_day or capacity_days_week');
  }
  // I04
  const phs = data.phases.slice().sort((a, b) => a.order - b.order);
  phs.forEach((p, i) => {
    if (p.start > p.end) err('I04', 'phases', p.id, 'start after end');
    if (i > 0 && p.start <= phs[i - 1].end) err('I04', 'phases', p.id, 'overlaps the previous phase');
  });
  if (phs[0].start !== en.start) err('I04', 'phases', phs[0].id, 'first phase must start on engagement.start');
  if (phs[phs.length - 1].end !== en.end) err('I04', 'phases', phs[phs.length - 1].id, 'last phase must end on engagement.end');
  // I05
  const dateFields = { milestones: ['date'], deliverables: ['due'], tasks: ['start', 'end'], reviews: ['date'], actions: ['due'], deck: ['date'], proposal: ['date'] };
  for (const [t, fs_] of Object.entries(dateFields)) for (const r of data[t]) for (const f of fs_) {
    if (!isEmpty(r[f]) && !inRange(r[f], en.start, en.end)) err('I05', t, r.id, `${f} ${r[f]} is outside the engagement (${en.start} to ${en.end})`);
  }
  // I06, I07
  for (const m of data.milestones) {
    const ph = PH[m.phase_id];
    if (!inRange(m.date, ph.start, ph.end)) err('I06', 'milestones', m.id, `date must lie within phase ${ph.id} (${ph.start} to ${ph.end})`);
    if ((m.status === 'done' || m.status === 'missed') && m.date > en.as_of) err('I07', 'milestones', m.id, `status ${m.status} requires date <= as_of`);
  }
  // I08
  for (const d of data.deliverables) {
    const ph = PH[d.phase_id];
    if (!consulting(d.owner_id)) err('I08', 'deliverables', d.id, 'owner must be a consulting person');
    if (!inRange(d.due, ph.start, ph.end)) err('I08', 'deliverables', d.id, `due must lie within phase ${ph.id}`);
    if (!isEmpty(d.milestone_id)) {
      const m = MS[d.milestone_id];
      if (m.phase_id !== d.phase_id) err('I08', 'deliverables', d.id, 'milestone must be in the same phase');
      if (d.due > m.date) err('I08', 'deliverables', d.id, `due must be on or before milestone date ${m.date}`);
    }
    if (d.status === 'late' && !(d.due < en.as_of)) err('I08', 'deliverables', d.id, 'status late requires due < as_of');
  }
  // I09, I10
  for (const k of data.tasks) {
    const ph = PH[k.phase_id];
    if (!consulting(k.owner_id)) err('I09', 'tasks', k.id, 'owner must be a consulting person');
    if (k.start > k.end) err('I09', 'tasks', k.id, 'start after end');
    if (!inRange(k.start, ph.start, ph.end) || !inRange(k.end, ph.start, ph.end)) err('I09', 'tasks', k.id, `dates must lie within phase ${ph.id} (${ph.start} to ${ph.end})`);
    if (!isEmpty(k.deliverable_id) && DL[k.deliverable_id].phase_id !== k.phase_id) err('I09', 'tasks', k.id, 'deliverable must be in the same phase');
    const p = k.progress_pct;
    if (k.status === 'done' && (p !== 100 || k.end > en.as_of)) err('I10', 'tasks', k.id, 'done requires progress 100 and end <= as_of');
    if (k.status === 'not_started' && (p !== 0 || k.start <= en.as_of)) err('I10', 'tasks', k.id, 'not_started requires progress 0 and start > as_of');
    if (['in_progress', 'at_risk', 'late'].includes(k.status) && (k.start > en.as_of || p >= 100)) err('I10', 'tasks', k.id, `${k.status} requires start <= as_of and progress < 100`);
    if (k.status === 'late' && !(k.end < en.as_of)) err('I10', 'tasks', k.id, 'late requires end < as_of');
  }
  // I11 cycles
  {
    const state = {};
    const visit = (id, stack) => {
      if (state[id] === 2) return;
      if (state[id] === 1) { err('I11', 'tasks', id, 'dependency cycle: ' + stack.concat(id).join(' > ')); return; }
      state[id] = 1;
      for (const d of TK[id].depends_on || []) {
        if (d === id) err('I11', 'tasks', id, 'depends on itself');
        else visit(d, stack.concat(id));
      }
      state[id] = 2;
    };
    data.tasks.forEach((k) => visit(k.id, []));
  }
  // I12
  {
    const pair = new Set();
    const per = {};
    for (const r of data.raci) {
      const key = r.deliverable_id + '|' + r.person_id;
      if (pair.has(key)) err('I12', 'raci', r.id, 'person already has a role on this deliverable');
      pair.add(key);
      (per[r.deliverable_id] = per[r.deliverable_id] || []).push(r);
    }
    for (const d of data.deliverables) {
      const rows = per[d.id] || [];
      const a = rows.filter((r) => r.role === 'A').length;
      const rr = rows.filter((r) => r.role === 'R').length;
      if (a !== 1) err('I12', 'raci', null, `deliverable ${d.id} needs exactly one A (has ${a})`);
      if (rr < 1) err('I12', 'raci', null, `deliverable ${d.id} needs at least one R`);
      const own = rows.find((r) => r.person_id === d.owner_id);
      if (!own || !['R', 'A'].includes(own.role)) err('I12', 'raci', null, `owner of ${d.id} must hold R or A`);
    }
  }
  // I13
  {
    const cons = data.people.filter((p) => p.org === 'consulting').map((p) => p.id);
    const grid = new Set();
    for (const e of data.time_entries) {
      if (!consulting(e.person_id)) err('I13', 'time_entries', e.id, 'person must be consulting');
      if (e.week > cal.totalWeeks) err('I13', 'time_entries', e.id, `week ${e.week} is after the last engagement week ${cal.totalWeeks}`);
      const key = e.person_id + '|' + e.week;
      if (grid.has(key)) err('I13', 'time_entries', e.id, 'duplicate person and week');
      grid.add(key);
      const hasActual = !isEmpty(e.actual_days);
      if (e.week < cal.asOfWeek && !hasActual) err('I13', 'time_entries', e.id, `actual_days required for week ${e.week} (before as-of week ${cal.asOfWeek})`);
      if (e.week >= cal.asOfWeek && hasActual) err('I13', 'time_entries', e.id, `actual_days must be empty from as-of week ${cal.asOfWeek}`);
    }
    for (const pid of cons) for (let w = 1; w <= cal.totalWeeks; w++) if (!grid.has(pid + '|' + w)) err('I13', 'time_entries', null, `missing entry for ${pid} week ${w}`);
  }
  // I14
  {
    const per = {};
    for (const r of data.reviews) {
      if (r.date > en.as_of) err('I14', 'reviews', r.id, 'review date after as_of');
      (per[r.deliverable_id] = per[r.deliverable_id] || []).push(r);
    }
    for (const [d, rows] of Object.entries(per)) {
      const s = rows.slice().sort((a, b) => a.date.localeCompare(b.date) || a.cycle - b.cycle);
      s.forEach((r, i) => { if (r.cycle !== i + 1) err('I14', 'reviews', r.id, `cycles for ${d} must run 1..n in date order`); });
    }
  }
  // I15
  {
    const q = data.issue_nodes.filter((n) => n.kind === 'question');
    if (q.length !== 1) err('I15', 'issue_nodes', null, `exactly one question required (found ${q.length})`);
    const kids = {};
    for (const n of data.issue_nodes) {
      const parent = isEmpty(n.parent_id) ? null : IN[n.parent_id];
      if (n.kind === 'question' && parent) err('I15', 'issue_nodes', n.id, 'question has no parent');
      if (n.kind === 'branch' && (!parent || parent.kind !== 'question')) err('I15', 'issue_nodes', n.id, 'branch parent must be the question');
      if (n.kind === 'hypothesis' && (!parent || parent.kind !== 'branch')) err('I15', 'issue_nodes', n.id, 'hypothesis parent must be a branch');
      if (n.kind === 'branch' && isEmpty(n.answer)) err('I15', 'issue_nodes', n.id, 'branch needs an answer');
      if (n.kind !== 'branch' && !isEmpty(n.answer)) err('I15', 'issue_nodes', n.id, 'only branches have an answer');
      if (n.kind === 'hypothesis' && (isEmpty(n.status) || isEmpty(n.analysis))) err('I15', 'issue_nodes', n.id, 'hypothesis needs status and analysis');
      if (n.kind !== 'hypothesis' && (!isEmpty(n.status) || !isEmpty(n.analysis))) err('I15', 'issue_nodes', n.id, 'only hypotheses have status and analysis');
      if (parent) (kids[parent.id] = kids[parent.id] || []).push(n);
    }
    if (q.length === 1) {
      const nb = (kids[q[0].id] || []).length;
      if (nb < 2 || nb > 5) err('I15', 'issue_nodes', q[0].id, `question needs 2-5 branches (has ${nb})`);
    }
    for (const b of data.issue_nodes.filter((n) => n.kind === 'branch')) {
      const nh = (kids[b.id] || []).length;
      if (nh < 1 || nh > 5) err('I15', 'issue_nodes', b.id, `branch needs 1-5 hypotheses (has ${nh})`);
    }
  }
  // I16
  for (const f of data.findings) if (IN[f.hypothesis_id].kind !== 'hypothesis') err('I16', 'findings', f.id, 'hypothesis_id must point to a hypothesis');
  for (const s of data.value_steps) if (!isEmpty(s.hypothesis_id) && IN[s.hypothesis_id].kind !== 'hypothesis') err('I16', 'value_steps', s.id, 'hypothesis_id must point to a hypothesis');
  // I17 bridge
  const bridge = deriveBridge(data.value_steps);
  {
    const st = bridge.steps;
    st.forEach((s, i) => {
      if (s.kind === 'start' && i !== 0) err('I17', 'value_steps', s.id, 'only the first step may be a start');
      if (i === 0 && s.kind !== 'start') err('I17', 'value_steps', s.id, 'the first step must be a start');
      if (s.kind === 'subtotal' && !isEmpty(s.value)) err('I17', 'value_steps', s.id, 'subtotal steps take no value (derived)');
      if (s.kind !== 'subtotal' && isEmpty(s.value)) err('I17', 'value_steps', s.id, `${s.kind} step needs a value`);
      if (s.kind === 'delta' && s.value === 0) err('I17', 'value_steps', s.id, 'delta must be non-zero');
    });
    if (st.length && st[st.length - 1].kind !== 'subtotal') err('I17', 'value_steps', st[st.length - 1].id, 'the last step must be a subtotal');
    bridge.levels.forEach((lv, i) => { if (lv < 0) err('I17', 'value_steps', st[i].id, `running level ${lv} is below zero`); });
  }
  // I18
  const vt = data.value_settings[0];
  {
    const a = vt.annotation_from_id, b = vt.annotation_to_id;
    if (isEmpty(a) !== isEmpty(b)) err('I18', 'value_settings', vt.id, 'set both annotation ends or neither');
    else if (!isEmpty(a)) {
      const A = VS[a], B = VS[b];
      if (!['start', 'subtotal'].includes(A.kind)) err('I18', 'value_settings', vt.id, 'annotation_from_id must be a start or subtotal step');
      if (B.kind !== 'subtotal') err('I18', 'value_settings', vt.id, 'annotation_to_id must be a subtotal step');
      if (!(A.order < B.order)) err('I18', 'value_settings', vt.id, 'annotation_from must come before annotation_to');
    }
  }
  // I19
  for (const d of data.sensitivity_drivers) {
    if (!(d.downside_value <= vt.npv_base && vt.npv_base <= d.upside_value)) err('I19', 'sensitivity_drivers', d.id, `values must bracket npv_base ${vt.npv_base}`, { found: [d.downside_value, d.upside_value] });
    if (!(d.downside_value < d.upside_value)) err('I19', 'sensitivity_drivers', d.id, 'downside_value must be below upside_value');
  }
  // I20
  {
    const refs = {};
    for (const c of data.model_cells) {
      const key = c.sheet + '!' + c.ref;
      if (refs[key]) err('I20', 'model_cells', c.id, `ref ${key} is used twice`);
      refs[key] = c;
    }
    for (const c of data.model_cells) {
      if (c.kind === 'input' && !isEmpty(c.formula)) err('I20', 'model_cells', c.id, 'input rows have no formula');
      if (c.kind !== 'input' && isEmpty(c.formula)) err('I20', 'model_cells', c.id, `${c.kind} rows need a formula`);
      if (!isEmpty(c.formula)) for (const ref of formulaRefs(c.formula, c.sheet)) {
        if (!refs[ref]) err('I20', 'model_cells', c.id, `formula references missing cell ${ref}`);
      }
    }
  }
  // I21
  {
    const slots = T.narratives.slots;
    const count = {};
    for (const n of data.narratives) {
      const def = (slots[n.view] || {})[n.slot];
      if (!def) { err('I21', 'narratives', n.id, `slot ${n.slot} does not exist for view ${n.view}`); continue; }
      const key = n.view + '|' + n.slot;
      (count[key] = count[key] || []).push(n);
      if (n.highlight && !def.highlight_max) err('I21', 'narratives', n.id, `slot ${n.slot} does not allow highlight`);
    }
    for (const [view, sl] of Object.entries(slots)) for (const [slot, def] of Object.entries(sl)) {
      const rows = count[view + '|' + slot] || [];
      if (def.fixed && rows.length !== 1) err('I21', 'narratives', null, `fixed slot ${view}/${slot} must exist exactly once (found ${rows.length})`);
      if (!def.fixed && (rows.length < def.min || rows.length > def.max)) err('I21', 'narratives', null, `slot ${view}/${slot} needs ${def.min}-${def.max} records (found ${rows.length})`);
      if (def.highlight_max !== undefined && rows.filter((r) => r.highlight).length > def.highlight_max) err('I21', 'narratives', null, `slot ${view}/${slot} allows at most ${def.highlight_max} highlighted`);
    }
  }
  // I23
  {
    const nums = data.slides.map((s) => s.number).sort((a, b) => a - b);
    if (!nums.every((v, i) => v === i + 1)) err('I23', 'slides', null, 'slide numbers must run 1..n');
  }
  // I24 agent lines: fields by block
  for (const l of data.agent_lines) {
    const has = (k) => !isEmpty(l[k]);
    if (l.block === 'tools') {
      if (!has('access') || !has('resource')) err('I24', 'agent_lines', l.id, 'tools lines need access and resource');
      if (has('type') || has('value')) err('I24', 'agent_lines', l.id, 'tools lines take no type or value');
    } else if (l.block === 'state') {
      if (!has('type')) err('I24', 'agent_lines', l.id, 'state lines need a type');
      if (has('access') || has('resource')) err('I24', 'agent_lines', l.id, 'state lines take no access or resource');
    } else if (has('access') || has('resource') || has('type') || has('value')) err('I24', 'agent_lines', l.id, 'guardrail lines take no access, resource, type or value');
  }
  // I25
  {
    const pr = data.proposal[0];
    if (P[pr.addressee_id].org !== 'client') err('I25', 'proposal', pr.id, 'addressee must be a client person');
    const seen = new Set();
    for (const s of data.proposal_staffing) {
      if (!consulting(s.person_id)) err('I25', 'proposal_staffing', s.id, 'person must be consulting');
      if (seen.has(s.person_id)) err('I25', 'proposal_staffing', s.id, 'person listed twice');
      seen.add(s.person_id);
    }
  }

  // I27 phase RACI
  {
    const pair = new Set();
    const per = {};
    for (const r of data.phase_raci) {
      const key = r.phase_id + '|' + r.person_id;
      if (pair.has(key)) err('I27', 'phase_raci', r.id, 'person already has a role in this phase');
      pair.add(key);
      (per[r.phase_id] = per[r.phase_id] || []).push(r);
    }
    for (const [ph, rows] of Object.entries(per)) {
      const a = rows.filter((r) => r.role === 'A').length, rr = rows.filter((r) => r.role === 'R').length;
      if (a !== 1) err('I27', 'phase_raci', null, `phase ${ph} needs exactly one A (has ${a})`);
      if (rr < 1) err('I27', 'phase_raci', null, `phase ${ph} needs at least one R`);
    }
  }

  // ---- warnings ----
  // W01
  bridge.steps.forEach((s, i) => {
    if (isEmpty(s.model_cell_id)) return;
    const cell = MC[s.model_cell_id];
    if (s.kind === 'subtotal') {
      if (Math.abs(bridge.levels[i] - cell.value) > 0.5) warn('W01', 'value_steps', s.id, `derived level ${bridge.levels[i]} differs from model ${cell.sheet}!${cell.ref} = ${round(cell.value, 1)}`);
    } else if (round(s.value, 1) !== round(cell.value, 1)) warn('W01', 'value_steps', s.id, `value ${s.value} differs from model ${cell.sheet}!${cell.ref} = ${round(cell.value, 1)}`);
  });
  // W02
  if (!isEmpty(vt.npv_cell_id) && Math.round(MC[vt.npv_cell_id].value) !== vt.npv_base) warn('W02', 'value_settings', vt.id, `npv_base ${vt.npv_base} differs from model output ${Math.round(MC[vt.npv_cell_id].value)}`);
  // W03
  for (const n of data.narratives) if (/[€$£]\s?\d/.test(n.text)) warn('W03', 'narratives', n.id, 'quotes a literal money figure; prefer a placeholder');
  // W04
  for (const k of data.tasks) {
    if (!isEmpty(k.deliverable_id) && k.end > DL[k.deliverable_id].due) warn('W04', 'tasks', k.id, `ends ${k.end}, after deliverable ${k.deliverable_id} due ${DL[k.deliverable_id].due}`);
    for (const d of k.depends_on || []) if (TK[d].end >= k.start) warn('W04', 'tasks', k.id, `starts ${k.start} before dependency ${d} ends ${TK[d].end}`);
  }
  for (const d of data.deliverables) if (!isEmpty(d.milestone_id) && d.due > MS[d.milestone_id].date) warn('W04', 'deliverables', d.id, 'due after its milestone');

  return { errors, warnings };
}

function round(v, d) { const p = Math.pow(10, d); return Math.round(v * p) / p; }

function deriveBridge(steps) {
  const st = steps.slice().sort((a, b) => a.order - b.order);
  let run = 0;
  const levels = st.map((s) => {
    if (s.kind === 'start') run = s.value || 0;
    else if (s.kind === 'delta') run = round(run + (s.value || 0), 4);
    return run;
  });
  return { steps: st, levels };
}

function formulaRefs(formula, sheet) {
  const out = [];
  const re = /(?:(Inputs|Calculations|Outputs)!)?C(\d{1,2})(?::C(\d{1,2}))?/g;
  for (const m of formula.matchAll(re)) {
    const sh = m[1] || sheet;
    const a = +m[2], b = m[3] ? +m[3] : a;
    for (let i = a; i <= b; i++) out.push(sh + '!C' + i);
  }
  return out;
}

// ---------- write (the tool's `write` verb) ----------
function sanitize(v) {
  if (typeof v !== 'string') return v;
  return v.replace(/\r\n?/g, '\n').replace(/<\/?[a-zA-Z][^>]*>/g, '').replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '');
}

function applyWrite(schema, data, request, opts) {
  opts = opts || {};
  const now = opts.now || new Date().toISOString();
  const version = opts.version || { global: 0, tables: {} };
  const errors = [];
  const fail = (op, rule, message, extra) => errors.push(Object.assign({ op, rule, message }, extra || {}));
  const agentDef = schema.agents[request.agent];
  if (!agentDef) return { committed: false, errors: [{ rule: 'agent', message: `unknown agent ${request.agent}` }], warnings: [] };
  if (!request.reason || typeof request.reason !== 'string') return { committed: false, errors: [{ rule: 'reason', message: 'reason is required' }], warnings: [] };
  if (request.if_version !== undefined && request.if_version !== version.global) return { committed: false, errors: [{ rule: 'version_conflict', message: `data is at version ${version.global}, request expected ${request.if_version}` }], warnings: [] };

  const next = clone(data);
  const touched = [];
  const logChanges = [];
  const tmpIds = {};
  // "$name" values refer to records created earlier in the same batch with "tmp": "name"
  const resolve = (v) => {
    if (typeof v === 'string' && v.startsWith('$')) return Object.prototype.hasOwnProperty.call(tmpIds, v.slice(1)) ? tmpIds[v.slice(1)] : v;
    if (Array.isArray(v)) return v.map(resolve);
    return v;
  };
  (request.ops || []).forEach((o, i) => {
    const n = i + 1;
    if (o.set) o = Object.assign({}, o, { set: Object.fromEntries(Object.entries(o.set).map(([k, v]) => [k, resolve(v)])) });
    if (o.record) o = Object.assign({}, o, { record: Object.fromEntries(Object.entries(o.record).map(([k, v]) => [k, resolve(v)])) });
    if (o.id) o = Object.assign({}, o, { id: resolve(o.id) });
    const tdef = schema.tables[o.table];
    if (!tdef) return fail(n, 'table', `unknown table ${o.table}`);
    const scope = agentDef.writes[o.table];
    if (!scope) return fail(n, 'scope', `agent ${request.agent} may not write ${o.table}`);
    const rows = next[o.table];
    const matchFilter = (rec) => !scope.row_filter || Object.entries(scope.row_filter).every(([k, v]) => rec[k] === v);
    if (o.op === 'update') {
      const rec = rows.find((r) => r.id === o.id);
      if (!rec) return fail(n, 'not_found', `${o.table} ${o.id} not found`);
      if (!matchFilter(rec)) return fail(n, 'scope', `agent ${request.agent} may not change this ${o.table} record`, { allowed: scope.row_filter });
      const set = o.set || {};
      const before = {};
      for (const [k, v] of Object.entries(set)) {
        if (k === 'id' || k === '_meta') return fail(n, 'scope', `${k} cannot be written`);
        if (!tdef.fields[k]) return fail(n, 'field', `unknown field ${k}`);
        if (scope.update !== '*' && !(scope.update || []).includes(k)) return fail(n, 'scope', `agent ${request.agent} may not change ${o.table}.${k}`, { allowed: scope.update });
        before[k] = rec[k] === undefined ? null : rec[k];
        if (isEmpty(v)) delete rec[k]; else rec[k] = sanitize(v);
      }
      if (!matchFilter(rec)) return fail(n, 'scope', 'the change would move the record outside this agent\'s scope');
      touched.push([o.table, rec.id]);
      logChanges.push({ op: 'update', table: o.table, id: rec.id, before, after: set });
    } else if (o.op === 'create') {
      if (!scope.create) return fail(n, 'scope', `agent ${request.agent} may not create ${o.table} records`);
      if (tdef.kind !== 'list') return fail(n, 'fixed', `${o.table} records are fixed; update them instead`);
      const rec = {};
      for (const [k, v] of Object.entries(o.record || {})) {
        if (k === 'id' || k === '_meta') return fail(n, 'scope', `${k} is assigned by the tool`);
        if (!tdef.fields[k]) return fail(n, 'field', `unknown field ${k}`);
        if (!isEmpty(v)) rec[k] = sanitize(v);
      }
      if (!matchFilter(rec)) return fail(n, 'scope', `new record must match ${JSON.stringify(scope.row_filter)}`);
      const max = rows.reduce((m, r) => Math.max(m, parseInt(String(r.id).split('-')[1], 10) || 0), 0);
      const width = tdef.max > 99 ? 3 : 2;
      rec.id = tdef.prefix + '-' + String(max + 1).padStart(Math.max(width, String(max + 1).length), '0');
      rec._meta = {};
      rows.push(rec);
      if (o.tmp) tmpIds[o.tmp] = rec.id;
      touched.push([o.table, rec.id]);
      logChanges.push({ op: 'create', table: o.table, id: rec.id, before: null, after: o.record });
    } else if (o.op === 'delete') {
      if (!scope.delete) return fail(n, 'scope', `agent ${request.agent} may not delete ${o.table} records`);
      if (tdef.kind !== 'list') return fail(n, 'fixed', `${o.table} records are fixed`);
      const at = rows.findIndex((r) => r.id === o.id);
      if (at < 0) return fail(n, 'not_found', `${o.table} ${o.id} not found`);
      if (!matchFilter(rows[at])) return fail(n, 'scope', `agent ${request.agent} may not delete this ${o.table} record`);
      const refs = referencesTo(schema, next, o.table, o.id);
      if (refs.length) return fail(n, 'referenced', `${o.table} ${o.id} is referenced by ${refs.join(', ')}`);
      const [gone] = rows.splice(at, 1);
      touched.push([o.table, o.id]);
      logChanges.push({ op: 'delete', table: o.table, id: o.id, before: (({ _meta, ...x }) => x)(gone), after: null });
    } else fail(n, 'op', `unknown op ${o.op}`);
  });
  if (errors.length) return { committed: false, errors, warnings: [] };

  // Renumber ordered fields per group, preserving relative order (ties: existing record first)
  const touchedTables = [...new Set(touched.map((x) => x[0]))];
  for (const t of touchedTables) {
    const of = schema.tables[t].order_field;
    if (!of) continue;
    const groups = {};
    next[t].forEach((r, i) => { const g = of.group_by.map((k) => r[k] == null ? '' : r[k]).join('|'); (groups[g] = groups[g] || []).push([r, i]); });
    for (const list of Object.values(groups)) {
      list.sort((a, b) => (a[0][of.field] - b[0][of.field]) || (a[1] - b[1]));
      list.forEach(([r], k) => {
        if (r[of.field] !== k + 1) {
          r[of.field] = k + 1;
          if (!touched.some((x) => x[0] === t && x[1] === r.id)) touched.push([t, r.id]);
        }
      });
    }
  }

  // Provisional meta so validation sees complete records
  const newGlobal = version.global + 1;
  for (const [t, id] of touched) {
    const rec = next[t].find((r) => r.id === id);
    if (rec) rec._meta = { version: newGlobal, updated_at: now, updated_by: request.agent, reason: request.reason };
  }
  const res = validateDataset(schema, next);
  const affected = Object.entries(schema.views).filter(([, v]) => v.reads.some((t) => touchedTables.includes(t))).map(([k]) => k);
  if (res.errors.length) return { committed: false, errors: res.errors, warnings: res.warnings };
  const written = touched.map((x) => x[1]);
  if (request.dry_run) return { committed: false, dry_run: true, errors: [], warnings: res.warnings, would_write: written, affected_views: affected };
  const newVersion = { global: newGlobal, tables: Object.assign({}, version.tables) };
  touchedTables.forEach((t) => { newVersion.tables[t] = newGlobal; });
  return {
    committed: true, errors: [], warnings: res.warnings, written, affected_views: affected,
    version: newVersion, data: next,
    log_entry: { version: newGlobal, at: now, agent: request.agent, reason: request.reason, changes: logChanges }
  };
}

function referencesTo(schema, data, table, id) {
  const out = [];
  for (const [t, def] of Object.entries(schema.tables)) for (const [f, fd] of Object.entries(def.fields)) {
    if (fd.table !== table) continue;
    for (const r of data[t]) {
      if (fd.type === 'ref' && r[f] === id) out.push(`${t} ${r.id}`);
      if (fd.type === 'ref_list' && (r[f] || []).includes(id)) out.push(`${t} ${r.id}`);
    }
  }
  return out;
}

// ---------- I/O ----------
function loadDataset(dir) {
  const schema = JSON.parse(fs.readFileSync(path.join(dir, '_schema.json'), 'utf8'));
  const data = {};
  for (const t of Object.keys(schema.tables)) {
    const f = path.join(dir, t + '.json');
    data[t] = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : undefined;
  }
  const vf = path.join(dir, '_version.json');
  const version = fs.existsSync(vf) ? JSON.parse(fs.readFileSync(vf, 'utf8')) : { global: 0, tables: {} };
  return { schema, data, version };
}

function saveDataset(dir, data, version, logEntry, tables) {
  for (const t of tables) fs.writeFileSync(path.join(dir, t + '.json'), JSON.stringify(data[t], null, 2) + '\n');
  fs.writeFileSync(path.join(dir, '_version.json'), JSON.stringify(version, null, 2) + '\n');
  const lf = path.join(dir, '_log.json');
  const log = fs.existsSync(lf) ? JSON.parse(fs.readFileSync(lf, 'utf8')) : [];
  log.push(logEntry);
  fs.writeFileSync(lf, JSON.stringify(log.slice(-200), null, 2) + '\n');
}

module.exports = { validateDataset, applyWrite, deriveBridge, formulaRefs, loadDataset, saveDataset, engagementCalendar };

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] === '--reset') {
    const dir = args[1] || path.join(__dirname, '..', 'data');
    for (const f of fs.readdirSync(path.join(dir, 'seed'))) fs.copyFileSync(path.join(dir, 'seed', f), path.join(dir, f));
    console.log('Reset to seed.');
    process.exit(0);
  }
  if (args[0] === '--apply') {
    const req = JSON.parse(fs.readFileSync(args[1], 'utf8'));
    const dir = args[2] || path.join(__dirname, '..', 'data');
    const { schema, data, version } = loadDataset(dir);
    const res = applyWrite(schema, data, req, { version });
    if (res.committed) {
      const tables = [...new Set(res.log_entry.changes.map((c) => c.table))];
      // renumbering may touch more records in the same tables only
      saveDataset(dir, res.data, res.version, res.log_entry, tables);
    }
    const { data: _d, ...out } = res;
    console.log(JSON.stringify(out, null, 2));
    process.exit(res.committed || res.dry_run ? 0 : 1);
  }
  const dir = args[0] || path.join(__dirname, '..', 'data');
  const { schema, data } = loadDataset(dir);
  const { errors, warnings } = validateDataset(schema, data);
  for (const e of errors) console.log('ERROR  ', e.rule.padEnd(6), (e.table || '').padEnd(20), (e.id || '').padEnd(7), e.message, e.allowed !== undefined ? '| allowed: ' + JSON.stringify(e.allowed) : '');
  for (const w of warnings) console.log('WARN   ', w.rule.padEnd(6), (w.table || '').padEnd(20), (w.id || '').padEnd(7), w.message);
  console.log(`\n${errors.length} errors, ${warnings.length} warnings`);
  process.exit(errors.length ? 1 : 0);
}
