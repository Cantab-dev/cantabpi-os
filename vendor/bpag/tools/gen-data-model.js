// Generates spec/01-data-model.md from data/_schema.json, so the document cannot drift from the schema.
// Run: node tools/gen-data-model.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const S = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/_schema.json'), 'utf8'));

const esc = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
function constraint(fd) {
  const c = [];
  if (fd.type === 'enum') c.push(fd.values.map((v) => '`' + v + '`').join(' · '));
  if (fd.type === 'ref') c.push('→ `' + fd.table + '`');
  if (fd.type === 'ref_list') c.push('→ `' + fd.table + '`, max ' + fd.max_items);
  if (fd.max_len) c.push('≤ ' + fd.max_len + ' chars');
  if (fd.max_lines) c.push('≤ ' + fd.max_lines + ' lines of ' + fd.line_len);
  if (fd.min !== undefined || fd.max !== undefined) c.push((fd.min !== undefined ? fd.min : '') + ' … ' + (fd.max !== undefined ? fd.max : ''));
  if (fd.decimals !== undefined) c.push(fd.decimals + ' dp');
  if (fd.pattern) c.push('pattern `' + fd.pattern + '`');
  if (fd.placeholders) c.push('placeholders: ' + (fd.placeholders.startsWith('view:') ? fd.placeholders.slice(5) : 'per `' + fd.placeholders.slice(6) + '`'));
  return c.join('; ');
}

const out = [];
out.push('# Data model');
out.push('');
out.push('Generated from `data/_schema.json` (contract version ' + S.contract_version + '). Do not edit by hand: change the schema and run `node tools/gen-data-model.js`.');
out.push('');
out.push('## Conventions');
out.push('');
for (const [k, v] of Object.entries(S.conventions)) out.push('- **' + k + '**: ' + v);
out.push('');
out.push('## Entity map');
out.push('');
out.push('| Table | Kind | Records | References |');
out.push('|---|---|---|---|');
for (const [t, d] of Object.entries(S.tables)) {
  const refs = [...new Set(Object.values(d.fields).filter((f) => f.table).map((f) => f.table))].join(', ');
  out.push(`| \`${t}\` | ${d.kind} | ${d.min}–${d.max} | ${refs || '—'} |`);
}
out.push('');
out.push('## Tables');
for (const [t, d] of Object.entries(S.tables)) {
  out.push('');
  out.push('### `' + t + '`');
  out.push('');
  out.push(d.description + ' Prefix `' + d.prefix + '`; ' + d.kind + (d.fixed_ids ? ' (id ' + d.fixed_ids.join(', ') + ')' : '') + (d.fixed_keys ? ' (keys ' + d.fixed_keys.values.join(', ') + ')' : '') + '; ' + d.min + '–' + d.max + ' records.' + (d.order_field ? ' Ordered by `' + d.order_field.field + '`' + (d.order_field.group_by.length ? ' within ' + d.order_field.group_by.join(', ') : '') + '.' : ''));
  out.push('');
  out.push('| Field | Type | Req. | Constraints | Description |');
  out.push('|---|---|---|---|---|');
  for (const [f, fd] of Object.entries(d.fields)) {
    out.push(`| \`${f}\` | ${fd.type} | ${fd.type === 'id' || fd.required ? 'yes' : ''} | ${esc(constraint(fd))} | ${esc(fd.description || '')} |`);
  }
  if (d.slots) {
    out.push('');
    out.push('Slots:');
    out.push('');
    out.push('| View | Slot | Fixed | Count | Max chars | Highlight |');
    out.push('|---|---|---|---|---|---|');
    for (const [v, sl] of Object.entries(d.slots)) for (const [s, sd] of Object.entries(sl)) {
      out.push(`| ${v} | \`${s}\` | ${sd.fixed ? 'yes' : 'no'} | ${sd.fixed ? '1' : sd.min + '–' + sd.max} | ${sd.max_len} | ${sd.highlight_max ? '≤ ' + sd.highlight_max : '—'} |`);
    }
  }
}
out.push('');
out.push('## Invariants');
out.push('');
out.push('Errors block a write; warnings are returned with a committed write.');
out.push('');
out.push('| Id | Severity | Tables | Rule |');
out.push('|---|---|---|---|');
for (const i of S.invariants) out.push(`| ${i.id} | ${i.severity} | ${i.tables.join(', ')} | ${esc(i.rule)} |`);
out.push('');
out.push('## Views');
out.push('');
out.push('| View | File | Audience | Reads |');
out.push('|---|---|---|---|');
for (const [k, v] of Object.entries(S.views)) out.push(`| ${v.label} (\`${k}\`) | \`${v.file}\` | ${v.audience} | ${v.reads.map((r) => '`' + r + '`').join(', ')} |`);
out.push('');
out.push('### Placeholders');
out.push('');
out.push('Formats: ' + Object.entries(S.placeholder_formats).map(([k, v]) => '`' + k + '` ' + v).join('; ') + '.');
out.push('');
out.push('| View | Placeholder | Format | Width | Meaning |');
out.push('|---|---|---|---|---|');
for (const [k, v] of Object.entries(S.views)) for (const [p, pd] of Object.entries(v.placeholders || {})) out.push(`| ${k} | \`{${p}}\` | ${pd.format} | ${pd.width} | ${esc(pd.description)} |`);
out.push('');
out.push('## Agent write scopes');
out.push('');
out.push('All agents may read every table. Writes are limited to the tables, operations and fields below.');
out.push('');
out.push('| Agent | Table | Create | Delete | Updatable fields | Row filter |');
out.push('|---|---|---|---|---|---|');
for (const [a, ad] of Object.entries(S.agents)) for (const [t, w] of Object.entries(ad.writes)) {
  out.push(`| ${a} | \`${t}\` | ${w.create ? 'yes' : ''} | ${w.delete ? 'yes' : ''} | ${w.update === '*' ? 'all' : (w.update || []).map((x) => '`' + x + '`').join(', ')} | ${w.row_filter ? Object.entries(w.row_filter).map(([k, v]) => '`' + k + ' = ' + v + '`').join(', ') : ''} |`);
}
out.push('');
fs.mkdirSync(path.join(ROOT, 'spec'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'spec/01-data-model.md'), out.join('\n'));
console.log('wrote spec/01-data-model.md', out.length, 'lines');
