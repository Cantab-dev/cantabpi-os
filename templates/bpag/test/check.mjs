// Headless check of the built pages without the backend (docs/live-views-status.md §8.5).
// Serves harness.html and templates/bpag/dist/, and fakes the two read functions from vendor/bpag/data/*.json:
//   POST /rest/v1/rpc/engagement_read     {p_project, p_tables}   project 'p-empty' → {status: 'empty'}
//   POST /rest/v1/rpc/engagement_version  {p_project}
// Each page must render with no notice and no script error at 1280 and 400 px. Then: the empty state, the change
// from empty to data, and a redraw with a change marker within 2.5 s of a version bump.
//
//   node scripts/templates.mjs
//   PLAYWRIGHT_CORE=<folder with node_modules/playwright-core> CHROME=<chrome-headless-shell.exe> \
//     node templates/bpag/test/check.mjs [--shots <dir>]
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const require = createRequire(join(process.env.PLAYWRIGHT_CORE || process.cwd(), 'x.js'))
const { chromium } = require('playwright-core')
const here = new URL('./', import.meta.url)
const dist = new URL('../dist/', import.meta.url)
const data = new URL('../../../vendor/bpag/data/', import.meta.url)
const deck = new URL('../../../vendor/bpag/deck/scale-up-proposal.pdf', import.meta.url)
const shotsIdx = process.argv.indexOf('--shots')
const shots = shotsIdx > 0 ? process.argv[shotsIdx + 1] : null
if (shots) mkdirSync(shots, { recursive: true })

const schema = JSON.parse(readFileSync(new URL('_schema.json', data), 'utf8'))
const keys = Object.keys(schema.views)
let tables, version, emptyProjects
function resetData() {
  tables = {}
  for (const f of readdirSync(data)) if (f.endsWith('.json') && !f.startsWith('_')) tables[f.slice(0, -5)] = JSON.parse(readFileSync(new URL(f, data), 'utf8'))
  version = JSON.parse(readFileSync(new URL('_version.json', data), 'utf8'))
  emptyProjects = new Set(['p-empty', 'p-later'])
}
resetData()

const rpcCalls = []
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://x')
  const send = (code, type, body) => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(body) }
  if (req.method === 'GET' && url.pathname === '/harness.html') return send(200, 'text/html', readFileSync(new URL('harness.html', here)))
  if (req.method === 'GET' && url.pathname.startsWith('/dist/')) {
    try { return send(200, 'text/html', readFileSync(new URL(url.pathname.slice(6), dist))) } catch { return send(404, 'text/plain', 'not found') }
  }
  if (req.method === 'GET' && url.pathname === '/deck.pdf') return send(200, 'application/pdf', readFileSync(deck))
  if (req.method === 'POST' && url.pathname.startsWith('/rest/v1/rpc/')) {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      const fn = url.pathname.slice(13), args = JSON.parse(body || '{}')
      rpcCalls.push({ fn, args })
      if (req.headers.apikey !== 'pk_test' || req.headers.authorization !== 'Bearer tok_test') return send(401, 'application/json', '{"message":"bad auth"}')
      const empty = emptyProjects.has(args.p_project)
      if (fn === 'engagement_version') return send(200, 'application/json', JSON.stringify(empty ? { status: 'empty' } : { status: 'ok', version }))
      if (fn === 'engagement_read') {
        if (empty) return send(200, 'application/json', JSON.stringify({ status: 'empty' }))
        const out = {}
        for (const t of args.p_tables || Object.keys(tables)) if (tables[t]) out[t] = tables[t]
        // The live seed has an https deck address; here the deck comes from this server.
        if (out.deck) out.deck = out.deck.map((d) => ({ ...d, pdf_url: `http://localhost:${port}/deck.pdf` }))
        return send(200, 'application/json', JSON.stringify({ status: 'ok', version, tables: out }))
      }
      return send(404, 'application/json', '{}')
    })
    return
  }
  send(404, 'text/plain', 'not found')
})
await new Promise((r) => server.listen(0, r))
const port = server.address().port
const base = `http://localhost:${port}/harness.html`

const browser = await chromium.launch({ executablePath: process.env.CHROME })
const results = []
let failed = 0
function report(name, ok, detail = '') {
  results.push({ name, ok, detail })
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`)
}

/** Opens one view in the harness and waits until the runtime has drawn (or failed). */
async function open(key, width, project = 'p-demo') {
  const page = await browser.newPage({ viewport: { width, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })
  await page.goto(`${base}?view=${key}&project=${project}`)
  const frame = await (await page.waitForSelector('#frame')).contentFrame()
  await frame.waitForFunction(() => {
    const m = document.getElementById('cp-main'), h = document.getElementById('cp-header')
    return m && (m.querySelector('.cp-notice') || (h && h.querySelector('.cp-ctx')))
  }, null, { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(300)
  return { page, frame, errors }
}

async function state(frame) {
  return frame.evaluate(() => {
    const main = document.getElementById('cp-main')
    const content = [...main.children].filter((c) => c.id !== 'cp-notices' && !c.hidden)
    return {
      notices: [...document.querySelectorAll('.cp-notice')].map((n) => n.textContent),
      brand: !!document.querySelector('.cp-brand'),
      railVisible: (() => { const r = document.getElementById('cp-rail'); return !!r && !r.hidden && r.offsetWidth > 0 })(),
      ctx: (document.querySelector('.cp-ctx') || {}).textContent || '',
      drawn: content.reduce((n, c) => n + c.querySelectorAll('*').length, 0),
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }
  })
}

// 1. Each page at both widths.
for (const key of keys) {
  for (const width of [1280, 400]) {
    const { page, frame, errors } = await open(key, width)
    const s = await state(frame)
    if (shots) await page.screenshot({ path: join(shots, `${key}-${width}.png`), fullPage: false })
    const problems = []
    if (s.notices.length) problems.push('notice: ' + s.notices.join(' | '))
    if (errors.length) problems.push(errors.join(' | '))
    if (s.brand) problems.push('brand shown')
    if (s.railVisible) problems.push('rail shown')
    if (!/Client/.test(s.ctx)) problems.push('no engagement line')
    if (s.drawn < 20) problems.push(`only ${s.drawn} elements drawn`)
    report(`${key} @${width}`, !problems.length, problems.join('; ') || `${s.drawn} elements, overflow-x ${s.overflowX}px`)
    await page.close()
  }
}

// 2. Empty project: the message, nothing else.
{
  const { page, frame, errors } = await open('home', 1280, 'p-empty')
  const s = await state(frame)
  const want = 'This project has no engagement data yet. Ask Claude to load the demo (engagement_reset).'
  report('empty project shows the message', s.notices.length === 1 && s.notices[0] === want && s.drawn === 0 && !errors.length, JSON.stringify(s.notices) + (errors.length ? ' ' + errors.join(' | ') : ''))
  await page.close()
}

// 3. Empty, then data arrives (engagement_reset): drawn on the next poll.
{
  const { page, frame } = await open('analyst', 1280, 'p-later')
  emptyProjects.delete('p-later')
  await page.waitForTimeout(2500)
  const s = await state(frame)
  report('empty → data draws within 2.5 s', !s.notices.length && s.drawn > 20 && /Client/.test(s.ctx), `${s.drawn} elements`)
  await page.close()
  resetData()
}

// 4. A commit: version bump on one table the view reads → redraw with a change marker within 2.5 s.
{
  const { page, frame } = await open('home', 1280)
  const before = rpcCalls.length
  const rec = tables.phase_raci[0]
  version = { global: version.global + 1, tables: { ...version.tables, phase_raci: (version.tables.phase_raci || 0) + 1 } }
  rec.comment = 'Changed in the harness'
  rec._meta = { version: version.global, updated_at: new Date().toISOString(), updated_by: 'project_manager', reason: 'Harness bump' }
  await page.waitForTimeout(2500)
  const got = await frame.evaluate(() => ({
    text: document.body.textContent.includes('Changed in the harness'),
    flash: document.querySelectorAll('.flash').length,
    marked: document.querySelectorAll('[data-changed]').length,
  }))
  const reads = rpcCalls.slice(before).filter((c) => c.fn === 'engagement_read')
  const onlyChanged = reads.length === 1 && JSON.stringify(reads[0].args.p_tables) === '["phase_raci"]'
  report('version bump redraws with marker', got.text && got.flash > 0 && onlyChanged, JSON.stringify({ ...got, reads: reads.map((r) => r.args.p_tables) }))
  await page.close()
  resetData()
}

await browser.close()
server.close()
console.log(`\n${results.length - failed}/${results.length} passed.`)
process.exit(failed ? 1 : 0)
