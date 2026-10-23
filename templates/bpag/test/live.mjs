// Live headless check of the eleven agent views on os.cantabpi.com, as claude@test.com on its selected project
// (select "Dummy - Big Pharma AG", project:10, first; reselect Atlas afterwards). Signs in with CANTAB_TEST_PASSWORD from
// .env.local, sets slot 1 with the view tool, and checks each view at 1280 and 400 px; then a phase_raci write (demo
// step 8) with Home open must be marked without reloading the frame. Resets the project data to the seed before and after with scripts/demo-project.mjs (the Supabase CLI login).
//   PLAYWRIGHT_CORE=<folder with node_modules/playwright-core> CHROME=<chrome-headless-shell.exe> //     node templates/bpag/test/live.mjs
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const require = createRequire(join(process.env.PLAYWRIGHT_CORE || process.cwd(), 'x.js'))
const { chromium } = require('playwright-core')
const repo = new URL('../../../', import.meta.url)

const SB = 'https://etofljbxzllkucmearwl.supabase.co'
const PUB = 'sb_publishable_34K6u6ySwpvniPF2qj8-sQ_LjAd6eXO'
const env = readFileSync(new URL('.env.local', repo), 'utf8')
const pass = env.match(/^CANTAB_TEST_PASSWORD=(.*)$/m)[1].trim().replace(/^"(.*)"$/, '$1')
const session = await (await fetch(`${SB}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: PUB, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'claude@test.com', password: pass }),
})).json()
if (!session.access_token) throw new Error('sign-in failed')

let n = 0
async function tool(name, args) {
  const r = await fetch(`${SB}/functions/v1/mcp`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++n, method: 'tools/call', params: { name, arguments: args } }),
  })
  const txt = await r.text()
  const line = txt.split('\n').find((l) => l.startsWith('data: ')) ?? txt
  const msg = JSON.parse(line.replace(/^data: /, ''))
  if (msg.error || msg.result?.isError) throw new Error(`${name}: ${JSON.stringify(msg).slice(0, 300)}`)
  return msg.result
}

// The demo is reset from Claude Code, not through the MCP tools (there is no reset tool).
function resetDemo() {
  const r = spawnSync('node scripts/demo-project.mjs claude@test.com', { cwd: new URL('.', repo), shell: true, encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`demo reset failed: ${r.stdout}${r.stderr}`)
}

const KEYS = ['home', 'engagement_starter', 'analyst', 'value_estimator', 'presentation_builder', 'project_manager',
  'team_manager', 'story_builder', 'agent_builder', 'proposal_builder', 'model_builder']
const browser = await chromium.launch({
  executablePath: process.env.CHROME,
})
const ctx = await browser.newContext()
await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v) } catch {} },
  ['sb-etofljbxzllkucmearwl-auth-token', JSON.stringify(session)])

async function open(width) {
  const page = await ctx.newPage()
  await page.setViewportSize({ width, height: 900 })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto('https://os.cantabpi.com/v/1')
  const deadline = Date.now() + 20000
  let frame
  while (Date.now() < deadline && !frame) {
    for (const f of page.frames()) {
      if (f === page.mainFrame()) continue
      try { if (await f.evaluate(() => !!document.getElementById('cp-main'))) frame = f } catch {}
    }
    if (!frame) await page.waitForTimeout(300)
  }
  if (!frame) return { page, frame: null, errors }
  await frame.waitForFunction(() => {
    const m = document.getElementById('cp-main'); return m && (m.querySelector('.cp-notice') || document.querySelector('.cp-ctx'))
  }, null, { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(800)
  return { page, frame, errors }
}

const state = (frame) => frame.evaluate(() => {
  const main = document.getElementById('cp-main')
  const content = [...main.children].filter((c) => c.id !== 'cp-notices' && !c.hidden)
  return {
    notices: [...document.querySelectorAll('.cp-notice')].map((x) => x.textContent),
    ctx: (document.querySelector('.cp-ctx') || {}).textContent || '',
    drawn: content.reduce((k, c) => k + c.querySelectorAll('*').length, 0),
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }
})

let passed = 0, fail = 0
const report = (name, ok, info = '') => { ok ? passed++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  ' + info : ''}`) }

resetDemo()
for (const key of KEYS) {
  await tool('view', { template: key, slot: 1 })
  for (const width of [1280, 400]) {
    const { page, frame, errors } = await open(width)
    if (!frame) { report(`${key} @${width}`, false, 'no frame'); await page.close(); continue }
    const s = await state(frame)
    const ok = !s.notices.length && !errors.length && s.drawn > 20 && /Big Pharma/.test(s.ctx) && (width > 400 || s.overflowX <= 0)
    report(`${key} @${width}`, ok, `${s.drawn} elements${s.notices.length ? ' notice: ' + s.notices.join('|') : ''}${errors.length ? ' errors: ' + errors.join('|') : ''}${s.overflowX > 0 ? ' overflowX ' + s.overflowX : ''}`)
    await page.close()
  }
}

// A write while Home is open: redraw with a marker, frame not reloaded. (Home marks phase_raci; the project manager view
// marks only actions, so a task write shows no marker there.)
await tool('view', { template: 'home', slot: 1 })
{
  const { page, frame } = await open(1280)
  await frame.evaluate(() => { window.__keep = 1 })
  const demo = JSON.parse(readFileSync(new URL('vendor/bpag/demo/08-engagement-starter.json', repo), 'utf8'))
  const t0 = Date.now()
  await tool('write', demo)
  let got
  while (Date.now() - t0 < 6000) {
    got = await frame.evaluate(() => ({ keep: window.__keep === 1, flash: document.querySelectorAll('.flash').length,
      marked: document.querySelectorAll('[data-changed]').length }))
    if (got.flash) break
    await page.waitForTimeout(200)
  }
  report('write redraws with a marker, frame kept', got.keep && got.flash > 0, `${JSON.stringify(got)} after ${Date.now() - t0} ms`)
  await page.close()
}

resetDemo()
await browser.close()
console.log(`\n${passed} passed, ${fail} failed`)
