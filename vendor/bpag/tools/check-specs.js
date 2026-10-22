// Cross-checks the view specs against the schema, the view files and the tool.
// 1. Every table and field listed under "Data read" exists and is in the view's `reads`.
// 2. The view file exists and boots with the view key named in the spec.
// 3. Every demo write (JSON block with "agent" and "ops") is dry-run against the seed;
//    a write is expected to commit unless it appears under a heading containing "Rejected".
// Run: node tools/check-specs.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const V = require(path.join(ROOT, 'validator/validate.js'));
const { schema, data, version } = V.loadDataset(path.join(ROOT, 'data'));
const dir = path.join(ROOT, 'spec/views');
let problems = 0;
const say = (ok, msg) => { if (!ok) problems++; console.log((ok ? '  ok   ' : '  FAIL ') + msg); };

for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.md')).sort()) {
  const md = fs.readFileSync(path.join(dir, f), 'utf8');
  const head = md.match(/File `([^`]+)` · view key `([^`]+)`/);
  console.log('\n' + f);
  if (!head) { say(false, 'header line missing'); continue; }
  const [, file, key] = head;
  const view = schema.views[key];
  say(!!view, `view key ${key} is in the schema`);
  say(view && view.file === file, `file ${file} matches the schema`);
  const htmlPath = path.join(ROOT, file);
  say(fs.existsSync(htmlPath), `${file} exists`);
  if (fs.existsSync(htmlPath)) say(new RegExp(`view: '${key}'`).test(fs.readFileSync(htmlPath, 'utf8')), `${file} boots view '${key}'`);
  const sec = md.split('## 3. Data read')[1].split('## 4.')[0];
  for (const line of sec.split('\n').filter((l) => /^\| `/.test(l))) {
    const cells = line.split('|').map((x) => x.trim()).filter(Boolean);
    const table = cells[0].replace(/`/g, '');
    const fields = cells[1].split(',').map((x) => x.trim().replace(/`/g, ''));
    const t = schema.tables[table];
    say(!!t && view.reads.includes(table), `reads ${table}`);
    const missing = t ? fields.filter((x) => !t.fields[x]) : fields;
    say(missing.length === 0, `${table} fields exist` + (missing.length ? ' (missing: ' + missing.join(', ') + ')' : ''));
  }
  // demo writes
  const parts = md.split(/\n(?=\*\*[A-Z]\.)/);
  for (const p of parts) {
    const label = (p.match(/^\*\*([A-Z]\.[^*]*)\*\*/) || [])[1];
    const expectReject = /Rejected/i.test(label || '');
    for (const m of p.matchAll(/```json\n([\s\S]*?)```/g)) {
      let req;
      try { req = JSON.parse(m[1]); } catch (e) { say(false, `JSON parses (${label}): ${e.message}`); continue; }
      if (!req.agent || !req.ops) continue;
      const res = V.applyWrite(schema, data, Object.assign({}, req, { dry_run: true }), { version, now: '2026-10-21T12:00:00Z' });
      const ok = expectReject ? !res.dry_run : !!res.dry_run;
      say(ok, `${label} ${expectReject ? 'is rejected' : 'commits'}` + (res.errors && res.errors.length ? ' — ' + res.errors.map((e) => (e.rule + ': ' + e.message)).join('; ') : '') + (res.warnings && res.warnings.length ? ' [warnings: ' + [...new Set(res.warnings.map((w) => w.rule))].join(', ') + ']' : ''));
    }
  }
}
console.log(`\n${problems} problem(s)`);
process.exit(problems ? 1 : 0);
