import { assert, assertEquals } from 'jsr:@std/assert@1'
import { ToolError } from './lib.ts'
import { applyMessage, DASHBOARDS, HEADER_VIEWS, parseViewArgs, PERIODS, REGIONS } from './views.ts'

const message = (fn: () => unknown): string => {
  try {
    fn()
  } catch (e) {
    assert(e instanceof ToolError, 'expected a ToolError')
    return e.message
  }
  throw new Error('expected a failure')
}

Deno.test('no template lists views, and takes nothing else', () => {
  assertEquals(parseViewArgs({}), { kind: 'list' })
  assert(message(() => parseViewArgs({ slot: 2 })).startsWith('invalid_parameter:'))
})

Deno.test('pdf takes a slide label, an optional page and slot', () => {
  assertEquals(parseViewArgs({ template: 'pdf', document: ' Slide:5 ', page: 3 }), { kind: 'pdf', label: 'slide:5', page: 3, slot: undefined })
  assertEquals(parseViewArgs({ template: 'PDF', document: 'slide:5', page: '2', slot: '4' }), { kind: 'pdf', label: 'slide:5', page: 2, slot: 4 })
})

Deno.test('pdf refuses other labels, bad pages and dashboard fields', () => {
  assert(message(() => parseViewArgs({ template: 'pdf' })).includes('needs "document"'))
  assert(message(() => parseViewArgs({ template: 'pdf', document: 'doc:3' })).includes('not a slide'))
  assert(message(() => parseViewArgs({ template: 'pdf', document: 'q3-report' })).includes('<entity>:<number>'))
  for (const page of [0, -1, 1.5, 'x']) assert(message(() => parseViewArgs({ template: 'pdf', document: 'slide:5', page })).includes('"page"'))
  assert(message(() => parseViewArgs({ template: 'pdf', document: 'slide:5', filters: {} })).includes('does not use filters'))
})

Deno.test('dashboard takes a known key and enum filters; defaults are left to the page', () => {
  assertEquals(parseViewArgs({ template: 'dashboard', dashboard: 'sales_overview' }), {
    kind: 'dashboard',
    params: { dashboard: 'sales_overview', filters: {} },
    slot: undefined,
  })
  assertEquals(
    parseViewArgs({ template: 'dashboard', dashboard: 'sales_overview', filters: { period: 'QTD', region: 'emea' } }).kind,
    'dashboard',
  )
})

Deno.test('dashboard refuses unknown keys, filters and values', () => {
  assert(message(() => parseViewArgs({ template: 'dashboard', dashboard: 'ops_health' })).includes('sales_overview'))
  assert(message(() => parseViewArgs({ template: 'dashboard', dashboard: 'sales_overview', filters: { period: '2y' } })).includes('7d, 30d'))
  assert(message(() => parseViewArgs({ template: 'dashboard', dashboard: 'sales_overview', filters: { region: 'mars' } })).includes('emea'))
  assert(message(() => parseViewArgs({ template: 'dashboard', dashboard: 'sales_overview', filters: { owner: 'x' } })).includes('unknown filter'))
  assert(message(() => parseViewArgs({ template: 'dashboard', dashboard: 'sales_overview', page: 2 })).includes('does not use page'))
})

Deno.test('slot is 1 to 10; unknown templates are refused', () => {
  for (const slot of [0, 11, 2.5]) assert(message(() => parseViewArgs({ template: 'dashboard', dashboard: 'sales_overview', slot })).includes('"slot"'))
  assert(message(() => parseViewArgs({ template: 'chat' })).includes('pdf, dashboard'))
})

// The enums must match view_check in the live views migration and the Lovable page (kept in step by hand).
Deno.test('registry matches the migration', () => {
  const sql = Deno.readTextFileSync(new URL('../../migrations/20261021120000_live_views.sql', import.meta.url))
  for (const d of DASHBOARDS) assert(sql.includes(`'${d}'`), d)
  assert(sql.includes(`in (${PERIODS.map((p) => `'${p}'`).join(', ')})`), 'periods')
  assert(sql.includes(`in (${REGIONS.map((r) => `'${r}'`).join(', ')})`), 'regions')
})

Deno.test('header views take no parameters', () => {
  assertEquals(parseViewArgs({ template: 'Model_Builder' }), { kind: 'header', template: 'model_builder', slot: undefined })
  assertEquals(parseViewArgs({ template: 'home', slot: 4 }), { kind: 'header', template: 'home', slot: 4 })
  assert(message(() => parseViewArgs({ template: 'project_manager', document: 'slide:1' })).includes('takes no parameters'))
})

Deno.test('the message says whether the view is the one in front of the user', () => {
  assert(applyMessage(3, 'X', { in_view: true, seen_lately: true }).includes('the one the user has open'))
  assert(applyMessage(3, 'X', { in_view: true, seen_lately: false }).includes('may not have it open'))
  assert(applyMessage(5, 'X', { in_view: false, seen_lately: false }).includes('If the user has view 5 open'))
})

Deno.test('engagement views match the engagement migration', () => {
  const sql = Deno.readTextFileSync(new URL('../../migrations/20261022150000_engagement.sql', import.meta.url))
  for (const k of Object.keys(HEADER_VIEWS)) assert(sql.includes(`'${k}'`), k)
})
