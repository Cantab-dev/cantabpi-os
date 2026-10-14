import { assert, assertEquals, assertThrows } from 'jsr:@std/assert@1'
import {
  assertSafe,
  authorised,
  clipRecord,
  ENTITIES,
  finish,
  fitRows,
  MAX_CONTEXT_CHARS,
  MAX_GUIDELINE_CHARS,
  notFoundMessage,
  parseEntity,
  parseLabel,
  parsePage,
  ToolError,
  validateNoteText,
  validateWrite,
} from './lib.ts'

const message = (fn: () => unknown): string => {
  try {
    fn()
  } catch (e) {
    assert(e instanceof ToolError, 'expected a ToolError')
    return e.message
  }
  throw new Error('expected a failure')
}

Deno.test('unknown entity lists the valid ones', () => {
  const m = message(() => parseEntity('contacts'))
  assert(m.includes('skills, todos, leads, sheets, docs, slides'))
})

Deno.test('entity is accepted in any case', () => {
  assertEquals(parseEntity(' Todos ').key, 'todos')
})

Deno.test('page defaults to 1 and rejects non-whole numbers', () => {
  assertEquals(parsePage(undefined), 1)
  assertEquals(parsePage(3), 3)
  for (const bad of [0, -1, 1.5, '2']) assert(message(() => parsePage(bad)).includes('whole number from 1'))
})

Deno.test('malformed labels explain the format and point to list', () => {
  for (const bad of ['todo', 'todo:abc', 'todo:0', 'task:1', '9e1dfe14-6766-4342-8e08-9e0c3f62fce0', '']) {
    const p = parseLabel(bad)
    assert(!p.ok)
    assert(p.message.includes('<entity>:<number>') && p.message.includes('Call list'))
  }
})

Deno.test('valid labels resolve to their entity', () => {
  const p = parseLabel(' Lead:12 ')
  assert(p.ok)
  assertEquals(p.label, 'lead:12')
  assertEquals(p.def.key, 'leads')
})

Deno.test('not-found message names the list call', () => {
  assertEquals(
    notFoundMessage('todo:999', ENTITIES.todos),
    'No record with label todo:999. Call list with entity "todos" to see which labels exist.',
  )
})

Deno.test('write: required field missing or empty', () => {
  assert(message(() => validateWrite(ENTITIES.todos, {})).includes('"name" is required'))
  assert(message(() => validateWrite(ENTITIES.todos, { name: '   ' })).includes('"name" is required'))
  assert(message(() => validateWrite(ENTITIES.skills, { guideline: 'x' })).includes('"description" is required'))
})

Deno.test('write: bad date', () => {
  for (const due of ['2026-02-30', '30/11/2026', 'tomorrow']) {
    assert(message(() => validateWrite(ENTITIES.todos, { name: 'x', due })).includes('YYYY-MM-DD'))
  }
})

Deno.test('write: importance outside 1 to 3', () => {
  for (const importance of [0, 4, 2.5, '2']) {
    assert(message(() => validateWrite(ENTITIES.todos, { name: 'x', importance })).includes('1 (low), 2 (medium) or 3 (high)'))
  }
})

Deno.test('write: text too long names the field, the limit and the note escape', () => {
  const m = message(() => validateWrite(ENTITIES.todos, { name: 'x'.repeat(201) }))
  assert(m.includes('"name"') && m.includes('200') && m.includes('note'))
})

Deno.test('write: bad url and email', () => {
  assert(message(() => validateWrite(ENTITIES.sheets, { name: 'x', url: 'docs.google.com/x' })).includes('http:// or https://'))
  assert(message(() => validateWrite(ENTITIES.sheets, { name: 'x', url: 'javascript:alert(1)' })).includes('http:// or https://'))
  assert(message(() => validateWrite(ENTITIES.leads, { name: 'x', email: 'ada at example' })).includes('name@example.com'))
})

Deno.test('write: clean row keeps only known fields and drops empty optionals', () => {
  const row = validateWrite(ENTITIES.todos, {
    name: ' Send proposal ',
    category: '',
    due: '2026-11-30',
    importance: 3,
    status: false,
    id: 'x',
    owner_id: 'y',
    label: 'todo:1',
  })
  assertEquals(row, { name: 'Send proposal', due: '2026-11-30', importance: 3, status: false })
})

Deno.test('note text: empty, too long, and newlines flattened', () => {
  assert(message(() => validateNoteText('  ')).includes('cannot be empty'))
  assert(message(() => validateNoteText('x'.repeat(1001))).includes('split it into several notes'))
  assertEquals(validateNoteText('one\ntwo'), 'one two')
})

Deno.test('clipRecord keeps the end of context and the start of a guideline', () => {
  const context = 'old ' + 'x'.repeat(MAX_CONTEXT_CHARS) + ' newest'
  const c = clipRecord({ label: 'todo:1', context })
  assert(c.truncated)
  assertEquals((c.record.context as string).length, MAX_CONTEXT_CHARS)
  assert((c.record.context as string).endsWith(' newest'))

  const g = clipRecord({ label: 'skill:1', guideline: 'first ' + 'x'.repeat(MAX_GUIDELINE_CHARS) })
  assert(g.truncated)
  assert((g.record.guideline as string).startsWith('first '))

  assertEquals(clipRecord({ label: 'todo:1', context: 'short' }).truncated, false)
})

Deno.test('fitRows cuts rows from the end when over the cap', () => {
  const rows = Array.from({ length: 10 }, (_, i) => ({ label: `todo:${i + 1}`, name: 'x'.repeat(100) }))
  const fitted = fitRows(rows, 500)
  assert(fitted.cut)
  assert(fitted.rows.length < 10 && fitted.rows.length >= 1)
  assertEquals(fitted.rows[0].label, 'todo:1')
  assertEquals(fitRows(rows).cut, false)
})

Deno.test('assertSafe refuses ids, internal columns and non-JSON values', () => {
  assertSafe({ data: { rows: [{ label: 'todo:1', due: '2026-11-30', importance: 2, status: false, context: null }] } })
  for (const key of ['id', 'owner_id', 'created_at', 'updated_at', 'label_no']) {
    assertThrows(() => assertSafe({ data: { rows: [{ label: 'todo:1', [key]: 'x' }] } }))
  }
  assertThrows(() => assertSafe({ when: new Date() }))
  assertThrows(() => assertSafe({ n: NaN }))
  assertThrows(() => assertSafe({ v: undefined }))
})

Deno.test('finish returns the data only, and runs the exit check', () => {
  const r = finish({ label: 'todo:1' })
  assertEquals(r.structuredContent, { label: 'todo:1' })
  assertEquals(JSON.parse(r.content[0].text), r.structuredContent)
  assertThrows(() => finish({ id: 'x' }))
})

Deno.test('authorised needs the exact bearer key', () => {
  assert(authorised('Bearer secret', 'secret'))
  assert(!authorised('Bearer wrong!', 'secret'))
  assert(!authorised('secret', 'secret'))
  assert(!authorised(null, 'secret'))
  assert(!authorised('Bearer ', ''))
})
