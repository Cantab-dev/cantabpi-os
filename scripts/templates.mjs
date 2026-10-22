// The package's views as self-contained pages (docs/live-views-status.md §4, Pages).
// For every view in vendor/bpag/data/_schema.json → views: takes its HTML file, inlines theme.css, the ported runtime
// (templates/bpag/runtime.js) and the schema as window.CP_SCHEMA, and writes templates/bpag/dist/<key>.html.
//
//   node scripts/templates.mjs            build only; no key, no upload
//   node scripts/templates.mjs --upload   build, upsert the pages into view_templates (key, html, contract_version)
//                                         and upload the deck to the public bucket engagement-assets at
//                                         bpag/scale-up-proposal.pdf; needs CANTAB_SERVICE_KEY in .env.local
//
// Never prints the key. Safe to rerun: rows are upserted and the deck is overwritten.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const SB = 'https://etofljbxzllkucmearwl.supabase.co'
const BUCKET = 'engagement-assets'
const DECK_PATH = 'bpag/scale-up-proposal.pdf'
const root = new URL('../', import.meta.url)
const pkg = new URL('vendor/bpag/', root)
const dist = new URL('templates/bpag/dist/', root)

const read = (url) => readFileSync(url, 'utf8')
const schemaText = read(new URL('data/_schema.json', pkg))
const schema = JSON.parse(schemaText)
const css = read(new URL('assets/theme.css', pkg))
const runtime = read(new URL('templates/bpag/runtime.js', root))

// Inlined text must not close its own element early.
if (/<\/style/i.test(css)) throw new Error('theme.css contains </style')
if (/<\/script/i.test(runtime)) throw new Error('runtime.js contains </script')
const schemaJs = JSON.stringify(schema).split('<').join(String.fromCharCode(92) + 'u003c') // '<' escaped, so the schema cannot close its script element

/** Replaces exactly one match of re in html, or fails naming the file. */
function replaceOnce(html, re, by, file) {
  const n = (html.match(new RegExp(re.source, 'g')) || []).length
  if (n !== 1) throw new Error(`${file}: expected one ${re} , found ${n}`)
  return html.replace(re, () => by)
}

mkdirSync(dist, { recursive: true })
const pages = []
for (const [key, view] of Object.entries(schema.views)) {
  const file = view.file
  let html = read(new URL(file, pkg))
  html = replaceOnce(html, /<link rel="stylesheet" href="(?:\.\.\/)?assets\/theme\.css">/, `<style>\n${css}</style>`, file)
  html = replaceOnce(html, /<script src="(?:\.\.\/)?assets\/runtime\.js"><\/script>/,
    `<script>window.CP_SCHEMA = ${schemaJs};</script>\n<script>\n${runtime}</script>`, file)
  // Anything else relative to the package folder would not resolve inside the host page's iframe.
  const left = html.match(/(?:src|href)="(?!https?:|#|data:)[^"]+"/g)
  if (left) throw new Error(`${file}: relative references left: ${left.join(', ')}`)
  writeFileSync(new URL(`${key}.html`, dist), html)
  pages.push({ key, html, contract_version: schema.contract_version })
  console.log(`${key}: ${file} → templates/bpag/dist/${key}.html (${Math.round(Buffer.byteLength(html) / 1024)} KB)`)
}
console.log(`${pages.length} page(s) built, contract ${schema.contract_version}.`)

if (!process.argv.includes('--upload')) process.exit(0)

const env = readFileSync(new URL('.env.local', root), 'utf8')
const KEY = (/^CANTAB_SERVICE_KEY=(.*)$/m.exec(env)?.[1] ?? '').trim().replace(/^"(.*)"$/, '$1')
if (!KEY) {
  console.error('CANTAB_SERVICE_KEY is missing from .env.local (Supabase dashboard > Project Settings > API keys).')
  process.exit(1)
}
// A new-style secret key goes in apikey only; a legacy service_role JWT goes in both headers.
const auth = KEY.startsWith('sb_secret_') ? { apikey: KEY } : { apikey: KEY, Authorization: `Bearer ${KEY}` }

async function call(method, path, body, headers = {}) {
  const res = await fetch(SB + path, { method, headers: { ...auth, ...headers }, body })
  if (!res.ok) throw new Error(`${method} ${path.split('?')[0]}: ${res.status} ${await res.text()}`)
  return res
}

await call('POST', '/rest/v1/view_templates?on_conflict=key', JSON.stringify(pages), {
  'Content-Type': 'application/json',
  Prefer: 'resolution=merge-duplicates,return=minimal',
})
console.log(`view_templates: ${pages.length} row(s) upserted (${pages.map((p) => p.key).join(', ')}).`)

await call('POST', `/storage/v1/object/${BUCKET}/${DECK_PATH}`, readFileSync(new URL('deck/scale-up-proposal.pdf', pkg)), {
  'Content-Type': 'application/pdf',
  'x-upsert': 'true',
})
console.log(`Deck uploaded: ${SB}/storage/v1/object/public/${BUCKET}/${DECK_PATH}`)
