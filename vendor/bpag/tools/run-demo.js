// Runs the demo script: applies demo/*.json in order through the reference write logic.
// Run: node tools/run-demo.js            reset to seed, then apply every step
//      node tools/run-demo.js 03         apply only step 03 to the current data
//      node tools/run-demo.js --dry      reset in memory and dry-run every step cumulatively (no files change)
'use strict';
const fs = require('fs');
const path = require('path');
const V = require('../validator/validate.js');
const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const DEMO = path.join(ROOT, 'demo');
const arg = process.argv[2];
const steps = fs.readdirSync(DEMO).filter((f) => f.endsWith('.json')).sort().filter((f) => !arg || arg === '--dry' || f.startsWith(arg));
const dry = arg === '--dry';
// Full run resets the files to the seed first; a dry run starts from the seed in memory only.
if (!arg) for (const f of fs.readdirSync(path.join(DATA, 'seed'))) fs.copyFileSync(path.join(DATA, 'seed', f), path.join(DATA, f));
let { schema, data, version } = V.loadDataset(DATA);
if (dry) {
  for (const t of Object.keys(schema.tables)) data[t] = JSON.parse(fs.readFileSync(path.join(DATA, 'seed', t + '.json'), 'utf8'));
  version = JSON.parse(fs.readFileSync(path.join(DATA, 'seed', '_version.json'), 'utf8'));
}
let ok = true;
for (const f of steps) {
  const req = JSON.parse(fs.readFileSync(path.join(DEMO, f), 'utf8'));
  const res = V.applyWrite(schema, data, req, { version });
  const expectReject = /rejected/.test(f);
  const pass = expectReject ? !res.committed : res.committed;
  if (!pass) ok = false;
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${f.padEnd(28)} ${res.committed ? 'committed v' + res.version.global : 'rejected'}` +
    (res.errors.length ? ' — ' + res.errors.map((e) => e.rule + ': ' + e.message).join('; ') : '') +
    (res.warnings && res.warnings.length ? ' [' + [...new Set(res.warnings.map((w) => w.rule))].join(', ') + ']' : '') +
    (res.affected_views ? ' → ' + res.affected_views.join(', ') : ''));
  if (res.committed) {
    data = res.data; version = res.version;
    if (!dry) V.saveDataset(DATA, data, version, res.log_entry, [...new Set(res.log_entry.changes.map((c) => c.table))]);
  }
}
process.exit(ok ? 0 : 1);
