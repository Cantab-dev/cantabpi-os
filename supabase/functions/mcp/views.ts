import type { McpServer } from '@modelcontextprotocol/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { ENTITIES, failure, finish, notFoundMessage, parseLabel, ToolError, type ToolResult } from './lib.ts'

// Live views (docs/live-views-status.md §3). The page /v/<slot> lives in the Lovable app and follows its slot
// row in ui_views through realtime. These keys and enums must match that page and view_check in the
// 20261021120000_live_views migration: they are kept in step by hand (live-views-status.md §1.2).
export const VIEW_BASE_URL = 'https://os.cantabpi.com/v/'
export const TEMPLATES = ['pdf', 'dashboard'] as const
export const DASHBOARDS = ['sales_overview'] as const
export const PERIODS = ['7d', '30d', 'qtd', 'ytd'] as const
export const REGIONS = ['emea', 'amer', 'apac'] as const
export const MAX_SLOT = 10

type Row = Record<string, unknown>

export type ViewRequest =
  | { kind: 'list' }
  | { kind: 'pdf'; label: string; page?: number; slot?: number }
  | { kind: 'dashboard'; params: { dashboard: string; filters: Row }; slot?: number }

const oneOf = (list: readonly string[]) => list.join(', ')

function wholeNumber(field: string, value: unknown, min: number, max: number): number | undefined {
  if (value === undefined || value === null) return undefined
  const n = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value
  if (typeof n !== 'number' || !Number.isInteger(n) || n < min || n > max) {
    throw new ToolError(`invalid_parameter: "${field}" must be a whole number from ${min} to ${max}.`)
  }
  return n
}

/** Checks the view tool's arguments against the template; pure, so it is unit-tested. */
export function parseViewArgs(args: Row): ViewRequest {
  const template = args.template === undefined || args.template === null ? undefined : String(args.template).trim().toLowerCase()
  const given = (keys: string[]) => keys.filter((k) => args[k] !== undefined && args[k] !== null)
  if (template === undefined) {
    const extra = given(['document', 'page', 'dashboard', 'filters', 'slot'])
    if (extra.length) {
      throw new ToolError(`invalid_parameter: without "template" the tool lists views and takes nothing else (got ${extra.join(', ')}).`)
    }
    return { kind: 'list' }
  }
  const slot = wholeNumber('slot', args.slot, 1, MAX_SLOT)

  if (template === 'pdf') {
    const wrong = given(['dashboard', 'filters'])
    if (wrong.length) throw new ToolError(`invalid_parameter: pdf does not use ${wrong.join(' or ')}; leave it out.`)
    if (args.document === undefined || args.document === null || args.document === '') {
      throw new ToolError('invalid_parameter: pdf needs "document", a slide label such as "slide:5". Call list with entity "slides" to find it.')
    }
    const p = parseLabel(args.document)
    if (!p.ok) throw new ToolError(`invalid_parameter: ${p.message}`)
    if (p.def.key !== 'slides') {
      throw new ToolError(`invalid_parameter: ${p.label} is not a slide. Only slides with a PDF can be shown; call list with entity "slides".`)
    }
    return { kind: 'pdf', label: p.label, page: wholeNumber('page', args.page, 1, 10000), slot }
  }

  if (template === 'dashboard') {
    const wrong = given(['document', 'page'])
    if (wrong.length) throw new ToolError(`invalid_parameter: dashboard does not use ${wrong.join(' or ')}; leave it out.`)
    const dashboard = String(args.dashboard ?? '').trim().toLowerCase()
    if (!(DASHBOARDS as readonly string[]).includes(dashboard)) {
      throw new ToolError(`invalid_parameter: "dashboard" must be one of: ${oneOf(DASHBOARDS)}.`)
    }
    const raw = args.filters ?? {}
    if (typeof raw !== 'object' || Array.isArray(raw)) {
      throw new ToolError('invalid_parameter: "filters" must be an object with period and/or region.')
    }
    const filters: Row = {}
    for (const [k, v] of Object.entries(raw as Row)) {
      if (v === undefined || v === null || v === '') continue
      const value = String(v).trim().toLowerCase()
      if (k === 'period' && (PERIODS as readonly string[]).includes(value)) filters.period = value
      else if (k === 'region' && (REGIONS as readonly string[]).includes(value)) filters.region = value
      else if (k === 'period') throw new ToolError(`invalid_parameter: period must be one of: ${oneOf(PERIODS)}.`)
      else if (k === 'region') throw new ToolError(`invalid_parameter: region must be one of: ${oneOf(REGIONS)}; leave it out for all regions.`)
      else throw new ToolError(`invalid_parameter: unknown filter "${k}". Filters are period and region.`)
    }
    return { kind: 'dashboard', params: { dashboard, filters }, slot }
  }

  throw new ToolError(`invalid_parameter: "template" must be one of: ${oneOf(TEMPLATES)}, or left out to list views.`)
}

const viewUrl = (slot: number) => VIEW_BASE_URL + slot

/** A short description of what a slot shows, for the model; never the content. */
function describe(template: string, agent: Row, ui: Row, slideLabels: Map<string, string>): string {
  if (template === 'pdf') {
    const label = slideLabels.get(String(agent.slide_id)) ?? 'a slide no longer available'
    return ui.page ? `${label} at page ${ui.page}` : label
  }
  const f = (agent.filters ?? {}) as Row
  return `${agent.dashboard} (${f.period ?? '30d'}, ${f.region ?? 'all regions'})`
}

async function listViews(db: SupabaseClient): Promise<Row[]> {
  const res = await db.rpc('views_list')
  if (res.error) throw res.error
  const views = (res.data ?? []) as Row[]
  const ids = views.map((v) => (v.agent_params as Row)?.slide_id).filter(Boolean) as string[]
  const labels = new Map<string, string>()
  if (ids.length) {
    const s = await db.from('slides').select('id,label').in('id', ids)
    if (s.error) throw s.error
    for (const r of s.data as Row[]) labels.set(String(r.id), String(r.label))
  }
  return views.map((v) => ({
    slot: v.slot as number,
    shows: describe(String(v.template), v.agent_params as Row, v.ui_params as Row, labels),
    url: viewUrl(v.slot as number),
    last_writer: v.last_writer as string,
  }))
}

async function viewTool(db: SupabaseClient, args: Row): Promise<ToolResult> {
  const req = parseViewArgs(args)
  if (req.kind === 'list') {
    const views = await listViews(db)
    return finish({
      views,
      message: views.length ? `The user has ${views.length} view(s).` : 'The user has no views yet. Call view with a template to open one.',
    })
  }

  let template: string, params: Row, focus: Row, shows: string
  if (req.kind === 'pdf') {
    const s = await db.from('slides').select('id,label,storage_url').eq('label', req.label).maybeSingle()
    if (s.error) throw s.error
    if (!s.data) throw new ToolError(`not_found: ${notFoundMessage(req.label, ENTITIES.slides)}`)
    if (!s.data.storage_url) {
      const withPdf = await db.from('slides').select('label').not('storage_url', 'is', null).order('label_no')
      const list = (withPdf.data ?? []).map((r) => r.label).join(', ') || 'none'
      throw new ToolError(`not_found: ${req.label} has no PDF, so it cannot be shown. Slides with a PDF: ${list}.`)
    }
    template = 'pdf'
    params = { slide_id: s.data.id }
    focus = req.page ? { page: req.page } : {}
    shows = req.page ? `${req.label} at page ${req.page}` : req.label
  } else {
    template = 'dashboard'
    params = req.params
    focus = {}
    shows = describe('dashboard', req.params, {}, new Map())
  }

  const res = await db.rpc('view_agent_apply', { p_template: template, p_agent_params: params, p_focus: focus, p_slot: req.slot ?? null })
  if (res.error) {
    if (/^invalid_parameter:/.test(res.error.message)) throw new ToolError(res.error.message)
    throw res.error
  }
  const out = res.data as Row
  if (out.status === 'slot_limit') {
    const views = await listViews(db)
    return failure(
      `slot_limit: all ${MAX_SLOT} views are in use. Call view again with "slot" set to the one to replace. Views: ` +
        JSON.stringify(views),
    )
  }
  const slot = (out.view as Row).slot as number
  return finish({
    status: 'ok',
    slot,
    url: viewUrl(slot),
    message:
      `View ${slot} shows ${shows}. If the user has view ${slot} open it has updated; otherwise give them the url once ` +
      '(in the Claude desktop app it opens in the browser pane). Do not describe the content: you have not seen it.',
  })
}

const VIEW_CRASH =
  'The view may or may not have changed. Call view without arguments to see what each view shows, then decide.'

export function registerViewTool(server: McpServer, db: SupabaseClient): void {
  server.registerTool(
    'view',
    {
      title: 'Show in live view',
      description:
        'Show something to the user in a live view: a browser page next to the chat that follows this tool. Showing is a ' +
        'deliberate act: call it when the user asks to see something or would clearly benefit, never just because you ' +
        'changed data. Call it without "template" to list the user\'s views. Templates: "pdf" (the PDF of a slide deck, ' +
        'optionally at a page; find the label with list entity "slides") and "dashboard" (a predefined dashboard, with ' +
        'optional filters). Examples: "Show me the company intro deck at page 3" -> view with template "pdf", document ' +
        '"slide:5", page 3. "Sales dashboard for EMEA this quarter" -> view with template "dashboard", dashboard ' +
        '"sales_overview", filters {period "qtd", region "emea"}. Nothing comes back except a confirmation and the url.',
      inputSchema: z.object({
        template: z.string({ error: `"template" must be one of: ${oneOf(TEMPLATES)}.` })
          .describe(`What to show: ${oneOf(TEMPLATES)}. Leave out to list the user's views.`).optional(),
        document: z.string({ error: '"document" must be a slide label such as "slide:5".' })
          .describe('pdf: the slide\'s label, such as "slide:5". Only slides with a PDF can be shown.').optional(),
        page: z.union([z.number(), z.string()], { error: '"page" must be a whole number from 1.' })
          .describe('pdf: page to open at, from 1.').optional(),
        dashboard: z.string({ error: `"dashboard" must be one of: ${oneOf(DASHBOARDS)}.` })
          .describe(`dashboard: one of ${oneOf(DASHBOARDS)} (revenue, deals and average deal; by week and by region).`).optional(),
        filters: z.object({
          period: z.string().describe(`One of ${oneOf(PERIODS)}. Default 30d.`).optional(),
          region: z.string().describe(`One of ${oneOf(REGIONS)}. Leave out for all regions.`).optional(),
        }, { error: '"filters" must be an object with period and/or region.' })
          .describe('dashboard: filter values; leave out for the defaults.').optional(),
        slot: z.union([z.number(), z.string()], { error: `"slot" must be a whole number from 1 to ${MAX_SLOT}.` })
          .describe('View number from the list. Leave out to reuse the view of the same template, or else open a new one.')
          .optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => {
      try {
        return await viewTool(db, args as Row)
      } catch (e) {
        if (e instanceof ToolError) return failure(e.message)
        console.error(e)
        return failure(VIEW_CRASH)
      }
    },
  )
}
