export const PAGE_SIZE = 25
export const MAX_LABELS = 10
export const MAX_CONTEXT_CHARS = 4000
export const MAX_GUIDELINE_CHARS = 8000
export const MAX_NOTE_CHARS = 1000
export const MAX_RESULT_CHARS = 40000
export const MAX_ACTION_CHARS = 500

export type EntityKey = 'skills' | 'todos' | 'leads' | 'sheets' | 'docs' | 'slides' | 'projects'

type FieldSpec =
  | { kind: 'text'; max: number; required?: boolean }
  | { kind: 'date' }
  | { kind: 'importance' }
  | { kind: 'bool' }
  | { kind: 'url' }
  | { kind: 'email' }
  | { kind: 'category' }

export interface EntityDef {
  key: EntityKey
  prefix: string
  listCols: string[]
  getCols: string[]
  hasContext: boolean
  /** Rows belong to a project and follow the selection (docs/projects-status.md D1). */
  scoped: boolean
  fields: Record<string, FieldSpec>
}

// The category comes back as an object {label, name, icon} or null, through the category_id foreign key.
const CATEGORY = 'category:categories(label,name,icon)'
// The project the same way, through project_id; null when the row has no project.
const PROJECT = 'project:projects(label,name,icon)'

/** Columns every view needs, on todos, leads, sheets, docs and slides. */
const RENDER_COLS = ['label', 'name', CATEGORY, 'importance', 'action', 'context']
const SCOPED_COLS = [...RENDER_COLS, PROJECT]

const renderFields: Record<string, FieldSpec> = {
  name: { kind: 'text', max: 200, required: true },
  category: { kind: 'category' },
  importance: { kind: 'importance' },
  action: { kind: 'text', max: MAX_ACTION_CHARS },
}

const fileFields: Record<string, FieldSpec> = {
  ...renderFields,
  url: { kind: 'url' },
}

export const ENTITIES: Record<EntityKey, EntityDef> = {
  skills: {
    key: 'skills',
    prefix: 'skill',
    listCols: ['label', 'description'],
    getCols: ['label', 'description', 'guideline'],
    hasContext: false,
    scoped: false,
    fields: {
      description: { kind: 'text', max: 500, required: true },
      guideline: { kind: 'text', max: MAX_GUIDELINE_CHARS },
    },
  },
  todos: {
    key: 'todos',
    prefix: 'todo',
    listCols: [...SCOPED_COLS, 'due', 'status'],
    getCols: [...SCOPED_COLS, 'due', 'status'],
    hasContext: true,
    scoped: true,
    fields: {
      ...renderFields,
      due: { kind: 'date' },
      status: { kind: 'bool' },
    },
  },
  leads: {
    key: 'leads',
    prefix: 'lead',
    listCols: [...RENDER_COLS, 'full_name', 'email', 'url_linkedin'],
    getCols: [...RENDER_COLS, 'full_name', 'email', 'url_linkedin'],
    hasContext: true,
    scoped: false,
    fields: {
      ...renderFields,
      full_name: { kind: 'text', max: 200 },
      email: { kind: 'email' },
      url_linkedin: { kind: 'url' },
    },
  },
  sheets: {
    key: 'sheets',
    prefix: 'sheet',
    listCols: [...SCOPED_COLS, 'url'],
    getCols: [...SCOPED_COLS, 'url'],
    hasContext: true,
    scoped: true,
    fields: fileFields,
  },
  docs: {
    key: 'docs',
    prefix: 'doc',
    listCols: [...SCOPED_COLS, 'url'],
    getCols: [...SCOPED_COLS, 'url'],
    hasContext: true,
    scoped: true,
    fields: fileFields,
  },
  slides: {
    key: 'slides',
    prefix: 'slide',
    listCols: [...SCOPED_COLS, 'url', 'storage_url'],
    getCols: [...SCOPED_COLS, 'url', 'storage_url'],
    hasContext: true,
    scoped: true,
    fields: { ...fileFields, storage_url: { kind: 'url' } },
  },
  projects: {
    key: 'projects',
    prefix: 'project',
    listCols: ['label', 'name', 'icon', 'context'],
    getCols: ['label', 'name', 'icon', 'context'],
    hasContext: true,
    scoped: false,
    // The selection lives on the profile and changes only through select_project.
    fields: {
      name: { kind: 'text', max: 200, required: true },
      icon: { kind: 'text', max: 16 },
    },
  },
}

export const ENTITY_KEYS = Object.keys(ENTITIES) as EntityKey[]
/** list also takes the shared categories table, which has no labels and no write tool. */
export const LIST_KEYS = [...ENTITY_KEYS, 'categories']
/** Kinds that list can show together in one call and one view. */
export const FILE_KEYS: EntityKey[] = ['docs', 'sheets', 'slides']
const BY_PREFIX = new Map(Object.values(ENTITIES).map((e) => [e.prefix, e]))
const PREFIXES = [...BY_PREFIX.keys()].join(', ')

/** A failure the model can act on: the message says what was wrong and what to call next. */
export class ToolError extends Error {}

export function parseEntity(value: unknown): EntityDef {
  const key = String(value ?? '').trim().toLowerCase()
  const def = (ENTITIES as Record<string, EntityDef>)[key]
  if (!def) {
    throw new ToolError(`Unknown entity "${value}". Use one of: ${ENTITY_KEYS.join(', ')}, or categories with list.`)
  }
  return def
}

export function parsePage(value: unknown): number {
  if (value === undefined || value === null) return 1
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new ToolError(`"page" must be a whole number from 1. Call list again with page 1.`)
  }
  return value
}

export type ParsedLabel =
  | { ok: true; label: string; def: EntityDef }
  | { ok: false; label: string; message: string }

export function parseLabel(raw: unknown): ParsedLabel {
  const label = String(raw ?? '').trim().toLowerCase()
  const m = /^([a-z]+):([1-9]\d{0,8})$/.exec(label)
  const def = m ? BY_PREFIX.get(m[1]) : undefined
  if (!def) {
    return {
      ok: false,
      label: String(raw ?? ''),
      message:
        `"${raw}" is not a valid label. A label looks like <entity>:<number>, for example todo:12, ` +
        `with entity one of ${PREFIXES}. Call list to find the label you need.`,
    }
  }
  return { ok: true, label, def }
}

export function notFoundMessage(label: string, def: EntityDef): string {
  return `No record with label ${label}. Call list with entity "${def.key}" to see which labels exist.` +
    (def.scoped
      ? ' It may belong to another project: list with entity "projects" shows them, and ' +
        'select_project switches project.'
      : '')
}

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

const isEmpty = (value: unknown) => value === undefined || value === null || value === ''
const trimmed = (value: unknown) => (typeof value === 'string' ? value.trim() : value)

/**
 * Checks one non-empty field value against its spec and returns it in stored form; throws a ToolError
 * naming the field. Importance also accepts "1" to "3" as text, because some clients send numbers as strings.
 */
function checkField(def: EntityDef, field: string, spec: FieldSpec, value: unknown): unknown {
  switch (spec.kind) {
    case 'text':
      if (typeof value !== 'string') throw new ToolError(`"${field}" must be text.`)
      if (value.length > spec.max) {
        throw new ToolError(
          `"${field}" is ${value.length} characters; the limit is ${spec.max}. Shorten it` +
            (def.hasContext ? ', and put the extra detail in a note on the record afterwards.' : '.'),
        )
      }
      break
    case 'date':
      if (typeof value !== 'string' || !isRealDate(value)) {
        throw new ToolError(`"${field}" must be a real date written as YYYY-MM-DD, for example 2026-11-30.`)
      }
      break
    case 'importance': {
      const n = typeof value === 'string' && /^[123]$/.test(value) ? Number(value) : value
      if (n !== 1 && n !== 2 && n !== 3) {
        throw new ToolError(`"${field}" must be 1 (low), 2 (medium) or 3 (high).`)
      }
      return n
    }
    case 'category':
      if (typeof value !== 'string' || value.length > 50) {
        throw new ToolError(`"${field}" must be a category label such as "sales". Call list with entity "categories" to see them.`)
      }
      return value.toLowerCase()
    case 'bool':
      if (typeof value !== 'boolean') throw new ToolError(`"${field}" must be true (done) or false (open).`)
      break
    case 'url':
      if (typeof value !== 'string' || value.length > 2000 || !isHttpUrl(value)) {
        throw new ToolError(
          `"${field}" must be a full web address starting with http:// or https://, up to 2000 characters. ` +
            `Correct it or leave "${field}" out.`,
        )
      }
      break
    case 'email':
      if (typeof value !== 'string' || value.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        throw new ToolError(`"${field}" must be an email address like name@example.com. Correct it or leave "${field}" out.`)
      }
      break
  }
  return value
}

/** Checks the arguments of a write tool and returns the row to insert. */
export function validateWrite(def: EntityDef, args: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  for (const [field, spec] of Object.entries(def.fields)) {
    const value = trimmed(args[field])
    if (isEmpty(value)) {
      if (spec.kind === 'text' && spec.required) {
        throw new ToolError(`"${field}" is required and cannot be empty. Call the tool again with "${field}" filled in.`)
      }
      continue
    }
    row[field] = checkField(def, field, spec, value)
  }
  return row
}

/**
 * Checks the arguments of edit and returns the changes. Each field given overwrites the stored value;
 * an empty string clears an optional field. `label` itself is not a change.
 */
export function validateEdit(def: EntityDef, args: Record<string, unknown>): Record<string, unknown> {
  const editable = Object.keys(def.fields).join(', ')
  const given = Object.keys(args).filter((k) => k !== 'label' && args[k] !== undefined)
  if (given.length === 0) {
    throw new ToolError(`No fields to change. Call edit again with the label and at least one of: ${editable}.`)
  }

  const changes: Record<string, unknown> = {}
  for (const field of given) {
    const spec = def.fields[field]
    if (!spec) {
      throw new ToolError(
        `"${field}" cannot be changed on a ${def.prefix}.` +
          (field === 'context' && def.hasContext ? ' To add to its notes, call note.' : '') +
          ` Fields you can change: ${editable}. Call edit again with only those.`,
      )
    }
    const value = trimmed(args[field])
    if (isEmpty(value)) {
      if ((spec.kind === 'text' && spec.required) || spec.kind === 'bool') {
        throw new ToolError(`"${field}" cannot be emptied. Give it a new value, or leave it out.`)
      }
      changes[field] = null
      continue
    }
    changes[field] = checkField(def, field, spec, value)
  }
  return changes
}

export interface ListFilters {
  status?: boolean
  due_before?: string
  due_after?: string
  category?: string
  importance_min?: number
}

const TODO_FILTERS = ['status', 'due_before', 'due_after']
const ALL_FILTERS = [...TODO_FILTERS, 'category', 'importance_min']

/** Checks the optional filters of list for one entity. Both dates are inclusive. */
export function parseFilters(def: EntityDef, args: Record<string, unknown>): ListFilters {
  const out: ListFilters = {}
  for (const f of ALL_FILTERS.filter((f) => !isEmpty(args[f]))) {
    if (def.key === 'skills' || def.key === 'projects' || (TODO_FILTERS.includes(f) && def.key !== 'todos')) {
      throw new ToolError(`"${f}" does not work for ${def.key}. Call list again without it.`)
    }
    const v = trimmed(args[f])
    if (f === 'status') {
      if (typeof v !== 'boolean') throw new ToolError(`"status" must be true (done) or false (open).`)
      out.status = v
    } else if (f === 'due_before' || f === 'due_after') {
      out[f] = checkField(def, f, { kind: 'date' }, v) as string
    } else if (f === 'category') {
      out.category = checkField(def, f, { kind: 'category' }, v) as string
    } else {
      out.importance_min = checkField(def, f, { kind: 'importance' }, v) as number
    }
  }
  return out
}

export function validateNoteText(value: unknown): string {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (text === '') throw new ToolError(`"text" cannot be empty. Call note again with the text to record.`)
  if (text.length > MAX_NOTE_CHARS) {
    throw new ToolError(
      `"text" is ${text.length} characters; the limit is ${MAX_NOTE_CHARS}. Shorten it, or split it into several notes.`,
    )
  }
  return text
}

/** Cuts long text fields of a fetched record. Context keeps its most recent end; a guideline keeps its start. */
export function clipRecord(record: Record<string, unknown>): { record: Record<string, unknown>; truncated: boolean } {
  const out = { ...record }
  let truncated = false
  if (typeof out.context === 'string' && out.context.length > MAX_CONTEXT_CHARS) {
    out.context = out.context.slice(-MAX_CONTEXT_CHARS)
    truncated = true
  }
  if (typeof out.guideline === 'string' && out.guideline.length > MAX_GUIDELINE_CHARS) {
    out.guideline = out.guideline.slice(0, MAX_GUIDELINE_CHARS)
    truncated = true
  }
  return { record: out, truncated }
}

/** Drops rows from the end until the serialised rows fit the character cap. */
export function fitRows<T>(rows: T[], maxChars = MAX_RESULT_CHARS): { rows: T[]; cut: boolean } {
  let kept = rows
  while (kept.length > 1 && JSON.stringify(kept).length > maxChars) kept = kept.slice(0, -1)
  return { rows: kept, cut: kept.length < rows.length }
}

const FORBIDDEN_KEYS = new Set(['id', 'profile_id', 'project_id', 'created_at', 'updated_at', 'label_no'])

/** The single exit check: plain JSON values only, and no database id or internal column anywhere. */
export function assertSafe(value: unknown, path = 'result'): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`${path} is not a finite number`)
    return
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertSafe(v, `${path}[${i}]`))
    return
  }
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    for (const [k, v] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(k)) throw new Error(`${path}.${k} must not be returned`)
      assertSafe(v, `${path}.${k}`)
    }
    return
  }
  throw new Error(`${path} is not a plain JSON value`)
}

export interface ToolResult {
  [key: string]: unknown
  content: { type: 'text'; text: string }[]
  structuredContent?: Record<string, unknown>
  isError?: boolean
}

/** Builds a result. `lead` is a line for the model before the data; the view reads structuredContent only. */
export function finish(data: Record<string, unknown>, lead?: string): ToolResult {
  assertSafe(data)
  const json = JSON.stringify(data)
  return { content: [{ type: 'text', text: lead ? `${lead}\n${json}` : json }], structuredContent: data }
}

export function failure(message: string): ToolResult {
  return { content: [{ type: 'text', text: message }], isError: true }
}
