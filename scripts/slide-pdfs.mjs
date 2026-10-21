// Dummy slide PDFs for the live views POC (docs/live-views-status.md §2.4).
// For every user's "Company intro deck" (6 pages) and "Acme pitch" (4 pages): builds a PDF with a large page number
// on each page, uploads it to the private bucket slide-pdfs at <user id>/<label>.pdf, and sets the slide's
// storage_url to that object's address.
//
//   node scripts/slide-pdfs.mjs              upload; needs CANTAB_SERVICE_KEY (service-role or secret key) in .env.local
//   node scripts/slide-pdfs.mjs --out <dir>  only write the two PDFs to <dir>; no key, no upload
//
// Never prints the key. Safe to rerun: uploads overwrite and storage_url is set again to the same value.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SB = 'https://etofljbxzllkucmearwl.supabase.co'
const BUCKET = 'slide-pdfs'
const DECKS = [
  { match: /company intro deck$/i, title: 'Company intro deck', pages: 6 },
  { match: /acme pitch$/i, title: 'Acme pitch', pages: 4 },
]

/** A minimal PDF: 16:9 pages, Helvetica, ASCII text only. */
function buildPdf(title, pageCount) {
  const esc = (s) => s.replace(/[\\()]/g, (c) => '\\' + c)
  const objects = []
  const add = (body) => objects.push(body) // object number = index + 1
  add('<< /Type /Catalog /Pages 2 0 R >>')
  add(null) // pages tree, filled in below
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
  const kids = []
  for (let p = 1; p <= pageCount; p++) {
    const stream = [
      'BT /F1 36 Tf 60 460 Td (' + esc(title) + ') Tj ET',
      'BT /F1 200 Tf ' + (p < 10 ? 420 : 370) + ' 170 Td (' + p + ') Tj ET',
      'BT /F2 20 Tf 60 60 Td (' + esc(`Page ${p} of ${pageCount}  -  dummy PDF for the Cantab OS live views POC`) + ') Tj ET',
    ].join('\n')
    add(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`)
    const contentNo = objects.length
    add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 960 540] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentNo} 0 R >>`)
    kids.push(`${objects.length} 0 R`)
  }
  objects[1] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pageCount} >>`

  let out = '%PDF-1.4\n'
  const offsets = []
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out))
    out += `${i + 1} 0 obj\n${body}\nendobj\n`
  })
  const xref = Buffer.byteLength(out)
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out, 'latin1')
}

const outIdx = process.argv.indexOf('--out')
if (outIdx > 0) {
  const dir = process.argv[outIdx + 1]
  mkdirSync(dir, { recursive: true })
  for (const d of DECKS) {
    const file = join(dir, d.title.toLowerCase().replace(/\s+/g, '-') + '.pdf')
    writeFileSync(file, buildPdf(d.title, d.pages))
    console.log('wrote', file)
  }
  process.exit(0)
}

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
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

const slides = await (await call('GET', '/rest/v1/slides?select=id,label,name,profile_id&order=label_no')).json()
let done = 0
for (const s of slides) {
  const deck = DECKS.find((d) => d.match.test(s.name))
  if (!deck) continue
  const path = `${s.profile_id}/${s.label.replace(':', '-')}.pdf`
  await call('POST', `/storage/v1/object/${BUCKET}/${path}`, buildPdf(deck.title, deck.pages), {
    'Content-Type': 'application/pdf',
    'x-upsert': 'true',
  })
  await call('PATCH', `/rest/v1/slides?id=eq.${s.id}`, JSON.stringify({ storage_url: `${SB}/storage/v1/object/${BUCKET}/${path}` }), {
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
  })
  console.log(`${s.label} (${s.name}): ${deck.pages} pages uploaded, storage_url set`)
  done++
}
console.log(`${done} slide(s) done.`)
