import { assert, assertEquals } from 'jsr:@std/assert@1'
import { AGENTS, contract, query, write } from './project_data.ts'
import { DEMO, SCHEMA, SEED, validateDataset } from './package.ts'
import { ToolError } from './lib.ts'

type Row = Record<string, unknown>
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x))

/** An in-memory stand-in for project_read and project_commit. */
function store() {
  const s = { version: clone(SEED.version), data: clone(SEED.tables) as Record<string, Row[]>, log: [] as Row[] }
  const dataset = () => Promise.resolve({ version: clone(s.version), data: clone(s.data) })
  const commit = (p: Row) => {
    if (p.p_expected_version !== s.version.global) return Promise.resolve({ status: 'conflict' })
    Object.assign(s.data, clone(p.p_tables as Row))
    s.version = clone(p.p_version as typeof s.version)
    s.log.push(p.p_log as Row)
    return Promise.resolve({ status: 'ok' })
  }
  return { s, dataset, commit }
}

Deno.test('the seed passes the package validator with no errors', () => {
  const res = validateDataset(SCHEMA, clone(SEED.tables))
  assertEquals(res.errors, [])
  assertEquals(SEED.version.global, 6)
})

Deno.test('the seed points the deck at the public bucket', () => {
  assert(String(SEED.tables.deck[0].pdf_url).startsWith('https://'))
})

Deno.test('the package demo: steps 1-9 commit at versions 7-15, step 10 is refused', async () => {
  const { s, dataset, commit } = store()
  assertEquals(DEMO.length, 10)
  for (const [i, step] of DEMO.entries()) {
    const out = await write(dataset, commit, step.request as Row, () => '2026-10-22T10:00:00Z')
    if (i < 9) {
      assert(out.committed, `${step.file}: ${JSON.stringify(out.errors)}`)
      assertEquals((out.version as Row).global, 7 + i)
    } else {
      assertEquals(out.committed, false)
      assert(JSON.stringify(out.errors).includes('122 characters'), JSON.stringify(out.errors))
    }
  }
  assertEquals(s.version.global, 15)
  assertEquals(s.log.length, 9)
  assertEquals(validateDataset(SCHEMA, s.data).errors, [])
})

Deno.test('a write only saves the tables it touched', async () => {
  const { dataset } = store()
  let saved: Row = {}
  await write(dataset, (p) => { saved = p; return Promise.resolve({ status: 'ok' }) }, DEMO[0].request as Row)
  assertEquals(Object.keys(saved.p_tables as Row), ['tasks'])
  assertEquals(saved.p_expected_version, 6)
})

Deno.test('a version conflict is retried once against fresh data', async () => {
  const { dataset, commit } = store()
  let calls = 0
  const out = await write(dataset, (p) => (++calls === 1 ? Promise.resolve({ status: 'conflict' }) : commit(p)), DEMO[0].request as Row)
  assert(out.committed)
  assertEquals(calls, 2)
})

Deno.test('a scope violation is refused with the rule', async () => {
  const { dataset, commit } = store()
  const out = await write(dataset, commit, {
    agent: 'analyst', reason: 'test', ops: [{ op: 'update', table: 'tasks', id: 'tk-08', set: { status: 'done' } }],
  })
  assertEquals(out.committed, false)
  assertEquals((out.errors as Row[])[0].rule, 'scope')
})

Deno.test('dry_run checks without saving', async () => {
  const { s, dataset, commit } = store()
  const out = await write(dataset, commit, { ...(DEMO[0].request as Row), dry_run: true })
  assertEquals(out.dry_run, true)
  assertEquals(s.version.global, 6)
})

Deno.test('query filters, projects and expands', () => {
  const data = clone(SEED.tables) as Record<string, Row[]>
  const rows = query(data, { table: 'tasks', where: { status: ['late', 'at_risk'] }, fields: ['name', 'owner_id'], expand: ['owner_id'] })
  assert(rows.length > 0)
  for (const r of rows) {
    assertEquals(Object.keys(r).sort(), ['_expanded', 'id', 'name', 'owner_id'])
    assertEquals(((r._expanded as Row).owner_id as Row).id, r.owner_id)
  }
  let msg = ''
  try { query(data, { table: 'tasks', where: { colour: 'red' } }) } catch (e) { msg = (e as ToolError).message }
  assert(msg.includes('no field'))
})

Deno.test('contract gives the agent its own write scope', () => {
  assertEquals(AGENTS.length, 10)
  const c = contract('project_manager', SEED.version, '2026-10-21')
  assertEquals(c.contract_version, '2.0')
  assert('tasks' in (c.writes as Row))
  assert(!('sources' in (c.writes as Row)))
})

Deno.test('tool names: the package\'s verbs, none clashing with the other tools', async () => {
  const { registerTools } = await import('./tools.ts')
  const { registerViewTool } = await import('./views.ts')
  const { registerProjectDataTools } = await import('./project_data.ts')
  const names: string[] = []
  const server = { registerTool: (name: string) => { names.push(name) }, registerResource: () => {} } as never
  const db = {} as never
  const before = names.length
  registerProjectDataTools(server, db, db, null)
  assertEquals(names.slice(before), ['contract', 'query', 'write', 'log'])
  registerTools(server, db)
  registerViewTool(server, db)
  assertEquals(new Set(names).size, names.length, `duplicate tool name in ${names.join(', ')}`)
  assertEquals(names.length, 18)
  assert(!names.some((n) => n.startsWith('engagement_')))
})
