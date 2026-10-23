// The engagement tables migration (docs/engagement-tables-status.md) in an in-memory Postgres (PGlite), on minimal
// stand-ins for the Supabase pieces it needs. Run from the repo root:
//   deno test -A --config supabase/functions/mcp/deno.json supabase/tests/engagement_tables_test.ts
import { PGlite } from 'npm:@electric-sql/pglite@0.3.14'
import { assert, assertEquals } from 'jsr:@std/assert@1'
import { write } from '../functions/mcp/project_data.ts'
import { DEMO, SEED, SCHEMA } from '../functions/mcp/package.ts'

const root = new URL('../..', import.meta.url)
const migration = (name: string) => Deno.readTextFileSync(new URL(`supabase/migrations/${name}`, root))

const A = '00000000-0000-0000-0000-00000000000a'
const B = '00000000-0000-0000-0000-00000000000b'
const PA = '00000000-0000-0000-0000-0000000000a1'
const PB = '00000000-0000-0000-0000-0000000000b1'

const STUBS = `
create role anon; create role authenticated; create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
create table public.profiles (id uuid primary key);
create table public.projects (id uuid primary key, profile_id uuid not null references public.profiles (id));
create function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table public.ui_views (id bigint, template text constraint ui_views_template_check check (template is not null),
  state jsonb not null default '{}');
grant usage on schema public to anon, authenticated, service_role;
insert into public.profiles values ('${A}'), ('${B}');
insert into public.projects values ('${PA}', '${A}'), ('${PB}', '${B}');
`

type Row = Record<string, unknown>
const j = (v: unknown) => JSON.stringify(v)

async function rpc(db: PGlite, fn: string, args: unknown[]): Promise<Row> {
  const ph = args.map((_, i) => `$${i + 1}`).join(', ')
  const res = await db.query<{ r: Row }>(`select public.${fn}(${ph}) as r`,
    args.map((a) => (a !== null && typeof a === 'object' && !Array.isArray(a) ? j(a) : a)))
  return res.rows[0].r
}

const read = (db: PGlite, project: string) => rpc(db, 'engagement_read', [project, null])
const reset = (db: PGlite, profile: string, project: string) =>
  rpc(db, 'engagement_replace', [profile, project, SCHEMA.contract_version, SEED.version, SEED.tables, j(SEED.log)])

async function demo(db: PGlite, profile: string, project: string, steps = DEMO) {
  const out: Row[] = []
  for (const { request } of steps) {
    out.push(await write(async () => {
      const r = await read(db, project)
      return { version: r.version as never, data: r.tables as never }
    }, (p) => rpc(db, 'engagement_commit', [profile, project, p.p_expected_version, p.p_version, p.p_tables, p.p_log]),
    request))
  }
  return out
}

/** Same JSON with keys sorted, so key order (which jsonb does not keep) does not count. */
const canon = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(canon)
  : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon((v as Row)[k])]))
  : v

async function asUser(db: PGlite, user: string, sql: string, params: unknown[] = []) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);`)
  try {
    return await db.query<Row>(sql, params)
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`)
  }
}

Deno.test('engagement tables: move, round trip, demo, row security', async (t) => {
  const db = await PGlite.create()
  await db.exec(STUBS)
  await db.exec(migration('20261022150000_engagement.sql'))

  // Before: A has the seed plus demo steps 1–9 (real _meta times with milliseconds), B has the seed.
  await reset(db, A, PA)
  await demo(db, A, PA, DEMO.slice(0, 9))
  await reset(db, B, PB)
  const beforeA = await read(db, PA)
  const beforeB = await read(db, PB)
  assertEquals((beforeA.version as Row).global, 15)

  await db.exec(migration('20261022160000_engagement_tables.sql'))

  await t.step('the move keeps every record, and the old table is gone', async () => {
    assertEquals(j(canon(await read(db, PA))), j(canon(beforeA)))
    assertEquals(j(canon(await read(db, PB))), j(canon(beforeB)))
    const old = await db.query(`select to_regclass('public.engagement_tables') as t`)
    assertEquals((old.rows[0] as Row).t, null)
    const n = await db.query<Row>(`select count(*)::int as n from engagement.time_entries`)
    assertEquals(n.rows[0].n, 216)
  })

  await t.step('the seed saved and read back is exactly the package\'s arrays, in order', async () => {
    await reset(db, A, PA)
    const got = await read(db, PA)
    assertEquals(got.status, 'ok')
    assertEquals(Object.keys(got.tables as Row).sort(), Object.keys(SCHEMA.tables).sort())
    for (const tbl of Object.keys(SCHEMA.tables)) {
      assertEquals(j(canon((got.tables as Row)[tbl])), j(canon(SEED.tables[tbl])), tbl)
    }
  })

  await t.step('the package\'s demo: steps 1–9 commit at 7–15, step 10 refused', async () => {
    const out = await demo(db, A, PA)
    for (let i = 0; i < 9; i++) {
      assert(out[i].committed, `step ${i + 1}: ${j(out[i])}`)
      assertEquals((out[i].version as Row).global, 7 + i)
    }
    assertEquals(out[9].committed, false)
    assert(j(out[9].errors).includes('122 characters'))
    const after = await read(db, PA)
    assertEquals((after.version as Row).global, 15)
    const people = (after.tables as Record<string, Row[]>).agent_lines.find((r) => r.name === 'Expert network transcripts')
    assert(people && /\.\d{3}Z$|:\d{2}Z$/.test((people._meta as Row).updated_at as string))
  })

  await t.step('a table list returns only those tables', async () => {
    const got = await rpc(db, 'engagement_read', [PA, ['people', 'tasks']])
    assertEquals(Object.keys(got.tables as Row).sort(), ['people', 'tasks'])
  })

  await t.step('row security: own rows only; saves refused to the browser', async () => {
    const mine = await asUser(db, A, `select count(*)::int as n from engagement.people`)
    assertEquals(mine.rows[0].n, 11)
    const theirs = await asUser(db, B, `select count(*)::int as n from engagement.people where project_id = $1`, [PA])
    assertEquals(theirs.rows[0].n, 0)
    const other = await asUser(db, B, `select public.engagement_read($1) as r`, [PA])
    assertEquals((other.rows[0].r as Row).status, 'empty')
    const own = await asUser(db, A, `select public.engagement_read($1, array['people']) as r`, [PA])
    assertEquals(((own.rows[0].r as Row).tables as Record<string, Row[]>).people.length, 11)
    for (const sql of [
      `select engagement.put('${A}', '${PA}', 'people', '[]')`,
      `select public.engagement_commit('${A}', '${PA}', 15, '{}', '{}', '{}')`,
      `insert into engagement.people (project_id, profile_id, pos, id) values ('${PA}', '${A}', 1, 'pe-99')`,
      `delete from engagement.people`,
    ]) {
      let denied = false
      try { await asUser(db, A, sql) } catch (e) { denied = /permission denied/.test(String(e)) }
      assert(denied, sql)
    }
  })

  await db.close()
})
