import type { McpServer } from '@modelcontextprotocol/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { failure, ToolError, type ToolResult } from './lib.ts'
import { applyWrite, SCHEMA, SEED } from './engagement_pkg.ts'

// Siniša's views package, ported onto Supabase (docs/live-views-status.md §8, interface §8.5). The five tools follow
// the package's data tool (vendor/bpag/spec/02-data-tool.md). Reads act as the user (RLS). Saves follow Aleph's
// pattern (P13): the package's validator runs here, then the admin client saves through engagement_commit, which
// only the service role may call, passing the verified user.

type Row = Record<string, unknown>
type Version = { global: number; tables: Record<string, number> }
type Dataset = { version: Version; data: Record<string, Row[]> }

export const AGENTS = Object.keys(SCHEMA.agents) as string[]
export const TABLES = Object.keys(SCHEMA.tables) as string[]

const NO_PROJECT =
  'No project selected. Select a project first: call list with entity "projects", then select_project with one label.'
const EMPTY =
  'This project has no engagement data yet. Call engagement_reset with confirm true to load the Big Pharma AG demo, ' +
  'or select the project that holds the engagement.'
const WRITE_CRASH =
  'The write may or may not have been saved. Call engagement_log with limit 1 to see the last change, then decide.'

/** A result whose records keep their package ids (tk-08 …); the database's own ids never reach this module. */
function done(data: Row, lead?: string): ToolResult {
  const text = JSON.stringify(data)
  if (/"(profile_id|project_id)"/.test(text)) throw new Error('internal column in an engagement result')
  return { content: [{ type: 'text', text: lead ? `${lead}\n${text}` : text }], structuredContent: data }
}

async function projectId(db: SupabaseClient): Promise<string> {
  const res = await db.rpc('current_project_id')
  if (res.error) throw res.error
  if (!res.data) throw new ToolError(NO_PROJECT)
  return res.data as string
}

async function load(db: SupabaseClient, project: string, tables: string[] | null = null): Promise<Dataset> {
  const res = await db.rpc('engagement_read', { p_project: project, p_tables: tables })
  if (res.error) throw res.error
  const out = res.data as Row
  if (out.status !== 'ok') throw new ToolError(EMPTY)
  return { version: out.version as Version, data: out.tables as Record<string, Row[]> }
}

function parseAgent(value: unknown): string {
  const agent = String(value ?? '').trim().toLowerCase()
  if (!AGENTS.includes(agent)) throw new ToolError(`invalid_parameter: "agent" must be one of: ${AGENTS.join(', ')}.`)
  return agent
}

function parseTable(value: unknown): string {
  const table = String(value ?? '').trim().toLowerCase()
  if (!TABLES.includes(table)) throw new ToolError(`invalid_parameter: "table" must be one of: ${TABLES.join(', ')}.`)
  return table
}

/** contract: what exists, what each view shows and what this agent may change (spec §4.1). */
export function contract(agent: string, version: Version, asOf: string | null): Row {
  return {
    contract_version: SCHEMA.contract_version,
    as_of: asOf,
    version: { global: version.global },
    tables: SCHEMA.tables,
    writes: SCHEMA.agents[agent].writes,
    views: SCHEMA.views,
    invariants: SCHEMA.invariants,
  }
}

/** query: records of one table, filtered, projected and expanded one level (spec §4.2). Pure, so it is unit-tested. */
export function query(data: Record<string, Row[]>, args: Row): Row[] {
  const table = parseTable(args.table)
  const def = SCHEMA.tables[table]
  const where = (args.where ?? {}) as Row
  if (typeof where !== 'object' || Array.isArray(where)) throw new ToolError('invalid_parameter: "where" must be an object.')
  for (const f of Object.keys(where)) {
    if (!(f in def.fields)) throw new ToolError(`invalid_parameter: ${table} has no field "${f}".`)
  }
  const fields = args.fields as string[] | undefined
  const expand = (args.expand ?? []) as string[]
  for (const f of [...(fields ?? []), ...expand]) {
    if (!(f in def.fields)) throw new ToolError(`invalid_parameter: ${table} has no field "${f}".`)
  }
  for (const f of expand) {
    if (def.fields[f].type !== 'ref') throw new ToolError(`invalid_parameter: "${f}" is not a reference field.`)
  }
  const limit = args.limit === undefined ? 500 : Number(args.limit)
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new ToolError('invalid_parameter: "limit" must be 1 to 500.')

  const match = (r: Row) =>
    Object.entries(where).every(([f, v]) => (Array.isArray(v) ? v.includes(r[f]) : r[f] === v))
  return (data[table] ?? []).filter(match).slice(0, limit).map((r) => {
    const out: Row = fields ? { id: r.id, ...Object.fromEntries(fields.map((f) => [f, r[f]])) } : { ...r }
    if (expand.length) {
      const ex: Row = {}
      for (const f of expand) {
        const target = (data[def.fields[f].table] ?? []).find((x) => x.id === r[f])
        if (target) ex[f] = target
      }
      out._expanded = ex
    }
    return out
  })
}

type Commit = (p: Row) => Promise<Row>

/** write: validate with the package's applyWrite, then save the touched tables (spec §4.3). */
export async function write(
  dataset: () => Promise<Dataset>,
  commit: Commit,
  request: Row,
  now = () => new Date().toISOString(),
): Promise<Row> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { version, data } = await dataset()
    const res = applyWrite(SCHEMA, data, request, { version, now: now() }) as Row
    if (!res.committed) {
      const { data: _d, log_entry: _l, ...rest } = res
      return rest
    }
    const v = res.version as Version
    const touched = Object.keys(v.tables).filter((t) => v.tables[t] === v.global && version.tables[t] !== v.global)
    const tables = Object.fromEntries(touched.map((t) => [t, (res.data as Record<string, Row[]>)[t]]))
    const saved = await commit({
      p_expected_version: version.global, p_version: v, p_tables: tables, p_log: res.log_entry,
    })
    if (saved.status === 'ok') {
      return { committed: true, written: res.written, version: v, warnings: res.warnings, affected_views: res.affected_views }
    }
    if (saved.status !== 'conflict' || request.if_version !== undefined) {
      return { committed: false, errors: [{ rule: 'version_conflict', message: 'the data changed while writing; read again and retry' }], warnings: [] }
    }
  }
  return { committed: false, errors: [{ rule: 'version_conflict', message: 'the data kept changing; read again and retry' }], warnings: [] }
}

export function registerEngagementTools(
  server: McpServer, db: SupabaseClient, admin: SupabaseClient, userId: string | null,
): void {
  const guard = async (fn: () => Promise<ToolResult>, crash: string): Promise<ToolResult> => {
    try {
      return await fn()
    } catch (e) {
      if (e instanceof ToolError) return failure(e.message)
      console.error(e)
      return failure(crash)
    }
  }
  const user = (): string => {
    if (!userId) throw new ToolError('not signed in')
    return userId
  }
  const READ_CRASH = 'The engagement data could not be read. Try again once; if it fails again, tell the user.'
  const ro = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }

  server.registerTool('engagement_contract', {
    title: 'Engagement contract',
    description:
      'Orientation for one of the ten engagement agents in the selected project: the tables and their limits, what ' +
      'each view shows, the rules (invariants), and what this agent may change. Call it first, before ' +
      'engagement_query or engagement_write, as the agent you act as. Agents: ' + AGENTS.join(', ') + '.',
    inputSchema: z.object({ agent: z.string().describe(`The agent you act as: ${AGENTS.join(', ')}.`) }),
    annotations: ro,
  }, (args) => guard(async () => {
    const agent = parseAgent(args.agent)
    const { version, data } = await load(db, await projectId(db), ['engagement'])
    return done(contract(agent, version, (data.engagement?.[0]?.as_of as string) ?? null))
  }, READ_CRASH))

  server.registerTool('engagement_query', {
    title: 'Read engagement data',
    description:
      'Read records from one table of the selected project\'s engagement. Optional: where (field equality; a list ' +
      'means "in"), fields (projection; id always comes back), expand (reference fields resolved one level, under ' +
      '_expanded), limit (default 500).',
    inputSchema: z.object({
      table: z.string().describe(`One of: ${TABLES.join(', ')}.`),
      where: z.record(z.string(), z.unknown()).describe('Field equality; a list value means "in".').optional(),
      fields: z.array(z.string()).describe('Fields to return; id is always returned.').optional(),
      expand: z.array(z.string()).describe('Reference fields to resolve one level.').optional(),
      limit: z.number().describe('1 to 500; default 500.').optional(),
    }),
    annotations: ro,
  }, (args) => guard(async () => {
    const table = parseTable(args.table)
    const project = await projectId(db)
    const refs = Object.values(SCHEMA.tables[table].fields as Record<string, Row>)
      .filter((f) => f.type === 'ref').map((f) => f.table as string)
    const { version, data } = await load(db, project, [...new Set([table, ...refs])])
    return done({ table, version: version.global, records: query(data, args as Row) })
  }, READ_CRASH))

  server.registerTool('engagement_write', {
    title: 'Change engagement data',
    description:
      'Apply one batch of operations to the selected project\'s engagement, as one agent and within its write scope ' +
      '(see engagement_contract). The whole batch is checked against every rule and saved together, or not at all; a ' +
      'refusal lists each error with the rule and what is allowed, so fix the request and retry. Ops: {op "update", ' +
      'table, id, set}, {op "create", table, record, tmp?}, {op "delete", table, id}. A create never has id or ' +
      '_meta; "$<tmp>" refers to a record created earlier in the batch. reason is one line, shown to viewers next to ' +
      'the change. dry_run checks without saving. Example: {agent "project_manager", reason "CRM extract received; ' +
      'task back on track", ops [{op "update", table "tasks", id "tk-08", set {end "2026-10-23", status ' +
      '"in_progress"}}]}.',
    inputSchema: z.object({
      agent: z.string().describe(`The agent you act as: ${AGENTS.join(', ')}.`),
      reason: z.string().describe('One line, shown to viewers next to the change.'),
      ops: z.array(z.record(z.string(), z.unknown())).describe('The operations, applied in order.'),
      dry_run: z.boolean().describe('Check without saving.').optional(),
      if_version: z.number().describe('Refuse if the data has moved past this version.').optional(),
    }),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  }, (args) => guard(async () => {
    const request = { ...(args as Row), agent: parseAgent(args.agent) }
    const profile = user()
    const project = await projectId(db)
    const out = await write(() => load(db, project), async (p) => {
      const res = await admin.rpc('engagement_commit', { p_profile: profile, p_project: project, ...p })
      if (res.error) throw res.error
      return res.data as Row
    }, request)
    return done(out, out.committed ? undefined : (out.dry_run ? 'Dry run: nothing saved.' : 'Refused: nothing saved.'))
  }, WRITE_CRASH))

  server.registerTool('engagement_log', {
    title: 'Engagement change log',
    description: 'The latest changes to the selected project\'s engagement, newest last: since_version, or the last limit entries.',
    inputSchema: z.object({
      since_version: z.number().describe('Entries after this version.').optional(),
      limit: z.number().describe('The last N entries; default 20.').optional(),
    }),
    annotations: ro,
  }, (args) => guard(async () => {
    const project = await projectId(db)
    const res = await db.rpc('engagement_log_read', {
      p_project: project, p_since: args.since_version ?? null, p_limit: args.since_version === undefined ? (args.limit ?? 20) : null,
    })
    if (res.error) throw res.error
    return done({ entries: res.data as Row[] })
  }, READ_CRASH))

  server.registerTool('engagement_reset', {
    title: 'Reset engagement demo',
    description:
      'Replace the selected project\'s engagement with the Big Pharma AG demo seed (version 6), or load it into a ' +
      'project that has none. Erases every change made since. Only when the user asks; needs confirm true.',
    inputSchema: z.object({ confirm: z.boolean().describe('Must be true.') }),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  }, (args) => guard(async () => {
    if (args.confirm !== true) throw new ToolError('invalid_parameter: "confirm" must be true.')
    const res = await admin.rpc('engagement_replace', {
      p_profile: user(), p_project: await projectId(db), p_contract: SCHEMA.contract_version,
      p_version: SEED.version, p_tables: SEED.tables, p_log: SEED.log,
    })
    if (res.error) throw res.error
    return done({ version: { global: SEED.version.global } }, 'The engagement is reset to the demo seed.')
  }, 'The reset may or may not have happened. Call engagement_log with limit 1 to check.'))
}
