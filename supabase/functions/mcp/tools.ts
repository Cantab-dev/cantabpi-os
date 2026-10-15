import type { McpServer } from '@modelcontextprotocol/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import {
  clipRecord,
  ENTITIES,
  type EntityDef,
  type EntityKey,
  failure,
  FILE_KEYS,
  finish,
  fitRows,
  LIST_KEYS,
  MAX_ACTION_CHARS,
  MAX_LABELS,
  MAX_RESULT_CHARS,
  notFoundMessage,
  PAGE_SIZE,
  parseEntity,
  parseFilters,
  parseLabel,
  parsePage,
  ToolError,
  type ToolResult,
  validateEdit,
  validateNoteText,
  validateWrite,
} from './lib.ts'
import { LIST_VIEW_URI } from './ui.ts'

type Row = Record<string, unknown>

const READ_CRASH =
  'The request could not be completed because of an internal error. Try the same call once more; ' +
  'if it fails again, tell the user Cantab OS is unavailable.'
const WRITE_CRASH =
  'The record may or may not have been saved. Do not retry blindly: call list for this entity to check ' +
  'whether it was created, then decide.'
const EDIT_CRASH =
  'The change may or may not have been saved. Do not retry blindly: call get with this label to check, then decide.'
const DELETE_CRASH =
  'The record may or may not have been deleted. Do not retry blindly: call get with this label to check, then decide.'

async function run(fn: () => Promise<ToolResult>, onCrash: string): Promise<ToolResult> {
  try {
    return await fn()
  } catch (e) {
    if (e instanceof ToolError) return failure(e.message)
    console.error(e)
    return failure(onCrash)
  }
}

const writeToolName = (def: EntityDef) => `write_${def.prefix}`

// Every list result is drawn as a view in hosts with MCP Apps, so the model is told not to repeat it.
const VIEW_LEAD =
  'The user sees these records in an interactive view. Do not restate or tabulate them; reply in at most one ' +
  'sentence, and only if something needs attention. Notes on a record come back as "context".'

/** Category label -> id, from the shared categories table. Unknown labels fail with the valid list. */
async function categoryId(db: SupabaseClient, label: string): Promise<number> {
  const res = await db.from('categories').select('id,label').order('id')
  if (res.error) throw res.error
  const all = res.data as { id: number; label: string }[]
  const hit = all.find((c) => c.label === label)
  if (!hit) {
    throw new ToolError(`Unknown category "${label}". Use one of: ${all.map((c) => c.label).join(', ')}.`)
  }
  return hit.id
}

/** Swaps a checked `category` label (or null to clear) for the stored category_id. */
async function resolveCategory(db: SupabaseClient, row: Row): Promise<Row> {
  if (!('category' in row)) return row
  const { category, ...rest } = row
  return { ...rest, category_id: category === null ? null : await categoryId(db, String(category)) }
}

/** One entity's page of rows, with the filters applied to both the count and the rows. */
async function listOne(db: SupabaseClient, def: EntityDef, args: Row, maxChars?: number): Promise<Row> {
  const page = parsePage(args.page)
  const f = parseFilters(def, args)
  const catId = f.category ? await categoryId(db, f.category) : undefined
  const filtered = Object.keys(f).length > 0

  // deno-lint-ignore no-explicit-any
  const apply = (q: any) => {
    if (f.status !== undefined) q = q.eq('status', f.status)
    if (f.due_before) q = q.lte('due', f.due_before)
    if (f.due_after) q = q.gte('due', f.due_after)
    if (catId !== undefined) q = q.eq('category_id', catId)
    if (f.importance_min) q = q.gte('importance', f.importance_min)
    return q
  }

  const head = await apply(db.from(def.key).select('label', { count: 'exact', head: true }))
  if (head.error) throw head.error
  const total = head.count ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  if (total === 0) {
    const next = filtered
      ? 'No records match these filters. Call list without filters to see all.'
      : `Nothing here yet. Use ${writeToolName(def)} to add one.`
    return { entity: def.key, page: 1, pages: 1, total: 0, rows: [], truncated: false, next }
  }
  if (page > pages) {
    throw new ToolError(
      `Page ${page} does not exist: "${def.key}" has ${total} record(s) on ${pages} page(s). ` +
        `Call list with a page from 1 to ${pages}.`,
    )
  }

  const from = (page - 1) * PAGE_SIZE
  const res = await apply(db.from(def.key).select(def.listCols.join(','))).order('label_no').range(from, from + PAGE_SIZE - 1)
  if (res.error) throw res.error
  const { rows, cut } = fitRows(res.data as unknown as Row[], maxChars)

  const data: Row = { entity: def.key, page, pages, total, rows, truncated: page < pages || cut }
  if (cut) {
    data.next = `This page was cut to ${rows.length} rows to keep the result small. Use get with the labels you need for full records.`
  } else if (page < pages) {
    data.next = `More records exist. Call list with entity "${def.key}" and page ${page + 1}.`
  }
  return data
}

async function listTool(db: SupabaseClient, args: Row): Promise<ToolResult> {
  if (Array.isArray(args.entity)) {
    const keys = [...new Set(args.entity.map((e) => String(e).trim().toLowerCase()))]
    if (keys.length === 0 || keys.some((k) => !FILE_KEYS.includes(k as EntityKey))) {
      throw new ToolError(`A list of entities can only combine ${FILE_KEYS.join(', ')}. For anything else pass one entity.`)
    }
    const parts: Row[] = []
    for (const k of keys) parts.push(await listOne(db, ENTITIES[k as EntityKey], args, MAX_RESULT_CHARS / keys.length))
    return finish({ entities: keys, parts }, VIEW_LEAD)
  }
  if (String(args.entity ?? '').trim().toLowerCase() === 'categories') {
    const res = await db.from('categories').select('label,name,icon').order('id')
    if (res.error) throw res.error
    return finish({ entity: 'categories', rows: res.data as unknown as Row[] }, VIEW_LEAD)
  }
  return finish(await listOne(db, parseEntity(args.entity), args), VIEW_LEAD)
}

async function getTool(db: SupabaseClient, labelsArg: unknown): Promise<ToolResult> {
  const requested = Array.isArray(labelsArg) ? labelsArg : []
  if (requested.length === 0) {
    throw new ToolError(`"labels" needs at least one label, for example ["todo:1"]. Call list to find labels.`)
  }
  if (requested.length > MAX_LABELS) {
    throw new ToolError(
      `"labels" has ${requested.length} labels; the limit is ${MAX_LABELS} per call. Split them into calls of ${MAX_LABELS} or fewer.`,
    )
  }

  const parsed = requested.map(parseLabel)
  const byEntity = new Map<EntityDef, string[]>()
  for (const p of parsed) {
    if (p.ok) byEntity.set(p.def, [...(byEntity.get(p.def) ?? []), p.label])
  }

  const found = new Map<string, Row>()
  for (const [def, labels] of byEntity) {
    const res = await db.from(def.key).select(def.getCols.join(',')).in('label', labels)
    if (res.error) throw res.error
    for (const row of res.data as unknown as Row[]) found.set(String(row.label), row)
  }

  const seen = new Set<string>()
  const records: Row[] = []
  for (const p of parsed) {
    if (seen.has(p.label)) continue
    seen.add(p.label)
    if (!p.ok) {
      records.push({ label: p.label, found: false, message: p.message })
      continue
    }
    const row = found.get(p.label)
    if (!row) {
      records.push({ label: p.label, found: false, message: notFoundMessage(p.label, p.def) })
      continue
    }
    const { record, truncated } = clipRecord(row)
    const entry: Row = { label: p.label, found: true, record }
    if (truncated) {
      entry.truncated = true
      entry.message = 'A long text field was cut to fit; the full text is not available through this tool.'
    }
    records.push(entry)
  }
  return finish({ records })
}

async function writeTool(db: SupabaseClient, def: EntityDef, args: Row): Promise<ToolResult> {
  const row = await resolveCategory(db, validateWrite(def, args))
  const res = await db.from(def.key).insert(row).select(def.getCols.join(',')).single()
  if (res.error) throw res.error
  const record = res.data as unknown as Row
  return finish({ label: record.label, created: true, record })
}

async function noteTool(db: SupabaseClient, labelArg: unknown, textArg: unknown): Promise<ToolResult> {
  const p = parseLabel(labelArg)
  if (!p.ok) throw new ToolError(p.message)
  if (!p.def.hasContext) {
    throw new ToolError(
      `${p.label} is a skill, and skills take no notes. Do not retry; notes work on todos, leads, sheets, docs and slides.`,
    )
  }
  const text = validateNoteText(textArg)
  const res = await db.rpc('append_context', { p_label: p.label, p_text: text })
  if (res.error) {
    if (/not found/i.test(res.error.message)) throw new ToolError(notFoundMessage(p.label, p.def))
    throw res.error
  }
  return finish({ label: p.label, noted: true, text })
}

async function editTool(db: SupabaseClient, args: Row): Promise<ToolResult> {
  const p = parseLabel(args.label)
  if (!p.ok) throw new ToolError(p.message)
  const changes = await resolveCategory(db, validateEdit(p.def, args))
  const res = await db.from(p.def.key).update(changes).eq('label', p.label)
    .select(p.def.getCols.join(','))
    .maybeSingle()
  if (res.error) throw res.error
  if (!res.data) throw new ToolError(notFoundMessage(p.label, p.def))
  const { record } = clipRecord(res.data as unknown as Row)
  return finish({ label: p.label, edited: true, record })
}

async function deleteTool(db: SupabaseClient, labelArg: unknown): Promise<ToolResult> {
  const p = parseLabel(labelArg)
  if (!p.ok) throw new ToolError(p.message)
  const nameCol = p.def.hasContext ? 'name' : 'description'
  const res = await db.from(p.def.key).delete().eq('label', p.label).select(`label,${nameCol}`).maybeSingle()
  if (res.error) throw res.error
  if (!res.data) throw new ToolError(notFoundMessage(p.label, p.def))
  return finish({ ...(res.data as unknown as Row), deleted: true })
}

const text = (field: string, what: string) => z.string({ error: `"${field}" must be text.` }).describe(what)
const required = (field: string, what: string) =>
  z.string({ error: `"${field}" is required and must be text. Call the tool again with "${field}" filled in.` }).describe(what)

const importance = (what: string) =>
  z.union([z.number(), z.string()], { error: '"importance" must be 1 (low), 2 (medium) or 3 (high).' }).describe(what)

// Optional on todos, leads, sheets, docs and slides; these drive the in-chat views.
const renderShape = {
  category: text('category', 'Category label, such as "sales" or "client". list with entity "categories" shows them all.').optional(),
  importance: importance('1 low, 2 medium, 3 high.').optional(),
  action: text('action', `The one current next action, up to ${MAX_ACTION_CHARS} characters. Replaces the previous one, which is kept in the notes.`).optional(),
}

const WRITE_TOOLS: { entity: keyof typeof ENTITIES; title: string; description: string; shape: z.ZodRawShape }[] = [
  {
    entity: 'todos',
    title: 'Add todo',
    description:
      'Call this when the user asks to add a new todo or to be reminded of something. It always creates a new record; ' +
      'call list with entity "todos" first if it might already exist. ' +
      'Examples: "Remind me to send the proposal by Friday" -> write_todo with name and due. ' +
      '"Add a high-priority todo to renew the domain" -> write_todo with name and importance 3. ' +
      'To record more about it afterwards, call note with the label this returns.',
    shape: {
      name: required('name', 'Required. What needs doing, in a few words.'),
      ...renderShape,
      due: text('due', 'Due date as YYYY-MM-DD.').optional(),
      status: z.boolean({ error: '"status" must be true (done) or false (open).' }).describe('true = done. Leave out for a new open todo.').optional(),
    },
  },
  {
    entity: 'leads',
    title: 'Add lead',
    description:
      'Call this when the user asks to add a new contact or lead. It always creates a new record; ' +
      'call list with entity "leads" first to check the person is not already there. ' +
      'Examples: "Add Ada Example from Acme as a lead" -> write_lead with name and full_name. ' +
      '"Save this LinkedIn profile as a lead" -> write_lead with name and url_linkedin. ' +
      'To record how you met or what was said, call note with the label this returns.',
    shape: {
      name: required('name', 'Required. Short name used to refer to the person.'),
      ...renderShape,
      full_name: text('full_name', 'Full name.').optional(),
      email: text('email', 'Email address.').optional(),
      url_linkedin: text('url_linkedin', 'LinkedIn profile address, starting with http:// or https://.').optional(),
    },
  },
  {
    entity: 'sheets',
    title: 'Add sheet',
    description:
      'Call this when a Google Sheet should be remembered by Cantab OS, usually right after it was created or found. ' +
      'It stores a pointer (name and url), not the sheet itself, and always creates a new record. ' +
      'Example: "Keep track of the Q3 budget sheet" -> write_sheet with name and url. ' +
      'To record what the sheet is for, call note with the label this returns.',
    shape: {
      name: required('name', 'Required. Name of the sheet.'),
      ...renderShape,
      url: text('url', 'Google Sheets address, starting with http:// or https://.').optional(),
    },
  },
  {
    entity: 'docs',
    title: 'Add doc',
    description:
      'Call this when a Google Doc should be remembered by Cantab OS, usually right after it was created or found. ' +
      'It stores a pointer (name and url), not the document itself, and always creates a new record. ' +
      'Example: "Save the Acme proposal doc" -> write_doc with name and url. ' +
      'To record what the doc is for, call note with the label this returns.',
    shape: {
      name: required('name', 'Required. Name of the document.'),
      ...renderShape,
      url: text('url', 'Google Docs address, starting with http:// or https://.').optional(),
    },
  },
  {
    entity: 'slides',
    title: 'Add slide',
    description:
      'Call this when a Google Slides deck should be remembered by Cantab OS, usually right after it was created or found. ' +
      'It stores a pointer (name and url), not the deck itself, and always creates a new record. ' +
      'Example: "Keep the company intro deck" -> write_slide with name and url. ' +
      'To record what the deck is for, call note with the label this returns.',
    shape: {
      name: required('name', 'Required. Name of the deck.'),
      ...renderShape,
      url: text('url', 'Google Slides address, starting with http:// or https://.').optional(),
      storage_url: text('storage_url', 'Address of a PDF copy of the deck, only if you were given one.').optional(),
    },
  },
  {
    entity: 'skills',
    title: 'Add skill',
    description:
      'Call this when the user asks to save a new workflow for later reuse. It always creates a new record; ' +
      'call list with entity "skills" first to check it does not already exist. ' +
      'Example: "Save this as our weekly review routine" -> write_skill with a short description and the steps as guideline.',
    shape: {
      description: required('description', 'Required. One or two sentences on what the workflow is for and when to use it.'),
      guideline: text('guideline', 'The steps to follow, as text.').optional(),
    },
  },
]

export function registerTools(server: McpServer, db: SupabaseClient): void {
  server.registerTool(
    'list',
    {
      title: 'List records',
      description:
        'Call this to see what exists before fetching or adding anything, or when the user asks what is on a list. ' +
        'Examples: "What\'s on my todo list?" -> list with entity "todos". ' +
        '"Do we have Ada as a lead?" -> list with entity "leads". ' +
        '"Which skills are there?" -> list with entity "skills", then get the one you need. ' +
        '"Show my docs and sheets" -> list with entity ["docs", "sheets"]. "Which todos are overdue?" -> list with entity ' +
        '"todos", status false and due_before yesterday. Every row comes with its category, importance, action and notes ' +
        '(as "context"), so no get is needed to show a list. The user sees the result as an interactive view.',
      inputSchema: z.object({
        entity: z.union([z.string(), z.array(z.string())], { error: `"entity" must be one of: ${LIST_KEYS.join(', ')}.` })
          .describe(`One of: ${LIST_KEYS.join(', ')}. Or a list combining ${FILE_KEYS.join(', ')}.`),
        page: z.number({ error: '"page" must be a whole number from 1.' }).describe('Page number, from 1. Leave out for the first page.').optional(),
        status: z.boolean({ error: '"status" must be true (done) or false (open).' }).describe('Todos only: true = done only, false = open only.').optional(),
        due_before: text('due_before', 'Todos only: due on or before this date, YYYY-MM-DD.').optional(),
        due_after: text('due_after', 'Todos only: due on or after this date, YYYY-MM-DD.').optional(),
        category: text('category', 'Only this category label, such as "sales". Not for skills.').optional(),
        importance_min: importance('Only importance at least this: 1, 2 or 3. Not for skills.').optional(),
      }),
      annotations: { readOnlyHint: true },
      // Both keys, as ext-apps' registerAppTool sets them: some hosts still read the flat legacy key.
      _meta: { ui: { resourceUri: LIST_VIEW_URI }, 'ui/resourceUri': LIST_VIEW_URI },
    },
    (args) => run(() => listTool(db, args as Row), READ_CRASH),
  )

  server.registerTool(
    'get',
    {
      title: 'Get records',
      description:
        'Call this when you have a label and need the full record, including its notes. Labels come from list; never invent one. ' +
        'Examples: "What do we know about Ada?" -> list with entity "leads" to find her label, then get with ["lead:1"]. ' +
        '"Run the weekly review skill" -> get with ["skill:1"] for its guideline. ' +
        'Several labels of different kinds can go in one call. Notes written with note come back in the "context" field.',
      inputSchema: z.object({
        labels: z.array(z.string(), { error: '"labels" must be a list of labels, for example ["todo:1", "lead:2"].' })
          .describe(`1 to ${MAX_LABELS} labels such as "todo:1" or "lead:2".`),
      }),
      annotations: { readOnlyHint: true },
    },
    ({ labels }) => run(() => getTool(db, labels), READ_CRASH),
  )

  for (const tool of WRITE_TOOLS) {
    const def = ENTITIES[tool.entity]
    server.registerTool(
      writeToolName(def),
      { title: tool.title, description: tool.description, inputSchema: z.object(tool.shape) },
      (args) => run(() => writeTool(db, def, args as Row), WRITE_CRASH),
    )
  }

  server.registerTool(
    'note',
    {
      title: 'Add note',
      description:
        'Call this to record something learned about an existing todo, lead, sheet, doc or slide. Not for skills. ' +
        'Examples: "Ada said she\'s back in March" -> list with entity "leads" to find her label, then note with that label and the text. ' +
        '"The client asked for a revised price" on a known todo -> note with its label. ' +
        'Notes come back from get and list in the "context" field, one dated line each.',
      inputSchema: z.object({
        label: required('label', 'Label of the record, such as "lead:1". Find it with list.'),
        text: required('text', 'What to record, up to 1000 characters.'),
      }),
    },
    ({ label, text }) => run(() => noteTool(db, label, text), WRITE_CRASH),
  )

  server.registerTool(
    'edit',
    {
      title: 'Edit record',
      description:
        'Call this to change fields of an existing todo, lead, sheet, doc, slide or skill. Give the label and only the fields ' +
        'to change; each one overwrites the stored value, and an empty string clears an optional field. Notes are added with ' +
        'note, not edit. Examples: "Mark the Acme proposal as done" -> list with entity "todos" to find its label, then edit ' +
        'with that label and status true. "Move the dentist to next Friday" -> edit with the label and due. ' +
        '"Ada\'s email is ada@new.com" -> edit with her lead label and email.',
      inputSchema: z.looseObject({
        label: required('label', 'Label of the record to change, such as "todo:1". Find it with list.'),
        name: text('name', 'Todos, leads, sheets, docs, slides: new name. Cannot be emptied.').optional(),
        category: text('category', 'Todos, leads, sheets, docs, slides: category label, such as "sales". list with entity "categories" shows them all.').optional(),
        importance: importance('Todos, leads, sheets, docs, slides: 1 low, 2 medium, 3 high.').optional(),
        action: text('action', `Todos, leads, sheets, docs, slides: the one current next action, up to ${MAX_ACTION_CHARS} characters. The previous action is kept in the notes.`).optional(),
        due: text('due', 'Todos: due date as YYYY-MM-DD.').optional(),
        status: z.boolean({ error: '"status" must be true (done) or false (open).' }).describe('Todos: true = done, false = open.').optional(),
        full_name: text('full_name', 'Leads: full name.').optional(),
        email: text('email', 'Leads: email address.').optional(),
        url_linkedin: text('url_linkedin', 'Leads: LinkedIn profile address, starting with http:// or https://.').optional(),
        url: text('url', 'Sheets, docs, slides: Google file address, starting with http:// or https://.').optional(),
        storage_url: text('storage_url', 'Slides: address of a PDF copy, starting with http:// or https://.').optional(),
        description: text('description', 'Skills: what the workflow is for. Cannot be emptied.').optional(),
        guideline: text('guideline', 'Skills: the steps to follow.').optional(),
      }),
      annotations: { destructiveHint: false, idempotentHint: true },
    },
    (args) => run(() => editTool(db, args as Row), EDIT_CRASH),
  )

  server.registerTool(
    'delete',
    {
      title: 'Delete record',
      description:
        'Call this only when the user asks to remove a record. It deletes the whole todo, lead, sheet, doc, slide or skill ' +
        'and cannot be undone; the label is never reused. Example: "Delete the dentist todo" -> list with entity "todos" ' +
        'to find its label, then delete with that label.',
      inputSchema: z.object({
        label: required('label', 'Label of the record to delete, such as "todo:1". Find it with list.'),
      }),
      annotations: { destructiveHint: true, idempotentHint: false },
    },
    ({ label }) => run(() => deleteTool(db, label), DELETE_CRASH),
  )
}
