export const PAGE_SIZE = 25
export const MAX_LABELS = 10
export const MAX_CONTEXT_CHARS = 4000
export const MAX_GUIDELINE_CHARS = 8000
export const MAX_NOTE_CHARS = 1000
export const MAX_RESULT_CHARS = 40000

export type EntityKey = 'skills' | 'todos' | 'leads' | 'sheets' | 'docs' | 'slides'

type FieldSpec =
  | { kind: 'text'; max: number; required?: boolean }
  | { kind: 'date' }
  | { kind: 'importance' }
  | { kind: 'bool' }
  | { kind: 'url' }
  | { kind: 'email' }

export interface EntityDef {
  key: EntityKey
  prefix: string
  listCols: string[]
  getCols: string[]
  hasContext: boolean
  fields: Record<string, FieldSpec>
}

const fileFields: Record<string, FieldSpec> = {
  name: { kind: 'text', max: 200, required: true },
  url: { kind: 'url' },
}

export const ENTITIES: Record<EntityKey, EntityDef> = {
  skills: {
    key: 'skills',
    prefix: 'skill',
    listCols: ['label', 'description'],
    getCols: ['label', 'description', 'guideline'],
    hasContext: false,
    fields: {
      description: { kind: 'text', max: 500, required: true },
      guideline: { kind: 'text', max: MAX_GUIDELINE_CHARS },
    },
  },
  todos: {
    key: 'todos',
    prefix: 'todo',
    listCols: ['label', 'name', 'category', 'due', 'importance', 'status'],
    getCols: ['label', 'name', 'category', 'due', 'importance', 'status', 'context'],
    hasContext: true,
    fields: {
      name: { kind: 'text', max: 200, required: true },
      category: { kind: 'text', max: 200 },
      due: { kind: 'date' },
      importance: { kind: 'importance' },
      status: { kind: 'bool' },
    },
  },
  leads: {
    key: 'leads',
    prefix: 'lead',
    listCols: ['label', 'name', 'full_name', 'email', 'url_linkedin'],
    getCols: ['label', 'name', 'full_name', 'email', 'url_linkedin', 'context'],
    hasContext: true,
    fields: {
      name: { kind: 'text', max: 200, required: true },
      full_name: { kind: 'text', max: 200 },
      email: { kind: 'email' },
      url_linkedin: { kind: 'url' },
    },
  },
  sheets: {
    key: 'sheets',
    prefix: 'sheet',
    listCols: ['label', 'name', 'url'],
    getCols: ['label', 'name', 'url', 'context'],
    hasContext: true,
    fields: fileFields,
  },
  docs: {
    key: 'docs',
    prefix: 'doc',
    listCols: ['label', 'name', 'url'],
    getCols: ['label', 'name', 'url', 'context'],
    hasContext: true,
    fields: fileFields,
  },
  slides: {
    key: 'slides',
    prefix: 'slide',
    listCols: ['label', 'name', 'url', 'storage_url'],
    getCols: ['label', 'name', 'url', 'storage_url', 'context'],
    hasContext: true,
    fields: { ...fileFields, storage_url: { kind: 'url' } },
  },
}

export const ENTITY_KEYS = Object.keys(ENTITIES) as EntityKey[]
const BY_PREFIX = new Map(Object.values(ENTITIES).map((e) => [e.prefix, e]))
const PREFIXES = [...BY_PREFIX.keys()].join(', ')

/** A failure the model can act on: the message says what was wrong and what to call next. */
export class ToolError extends Error {}

export function parseEntity(value: unknown): EntityDef {
  const key = String(value ?? '').trim().toLowerCase()
  const def = (ENTITIES as Record<string, EntityDef>)[key]
  if (!def) {
    throw new ToolError(`Unknown entity "${value}". Use one of: ${ENTITY_KEYS.join(', ')}.`)
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
  return `No record with label ${label}. Call list with entity "${def.key}" to see which labels exist.`
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

/** Checks one non-empty field value against its spec; throws a ToolError naming the field. */
function checkField(def: EntityDef, field: string, spec: FieldSpec, value: unknown): void {
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
    case 'importance':
      if (value !== 1 && value !== 2 && value !== 3) {
        throw new ToolError(`"${field}" must be 1 (low), 2 (medium) or 3 (high).`)
      }
      break
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
    checkField(def, field, spec, value)
    row[field] = value
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
    checkField(def, field, spec, value)
    changes[field] = value
  }
  return changes
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

const FORBIDDEN_KEYS = new Set(['id', 'owner_id', 'created_at', 'updated_at', 'label_no'])

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

export function finish(data: Record<string, unknown>): ToolResult {
  assertSafe(data)
  return { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data }
}

export function failure(message: string): ToolResult {
  return { content: [{ type: 'text', text: message }], isError: true }
}

export function authorised(header: string | null, key: string): boolean {
  if (!key || !header) return false
  const expected = `Bearer ${key}`
  if (header.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= header.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0
}
