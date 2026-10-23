// The project data migration (docs/archive/project-engagement-status.md) in an in-memory Postgres (PGlite), on minimal
// stand-ins for the Supabase pieces it needs: the two engagement migrations first, with data in them, then the renames.
// Run from the repo root:
//   deno test -A --config supabase/functions/mcp/deno.json supabase/tests/project_data_test.ts
import { PGlite } from 'npm:@electric-sql/pglite@0.3.14'
import { assert, assertEquals } from 'jsr:@std/assert@1'
import { write } from '../functions/mcp/project_data.ts'
import { DEMO, SCHEMA, SEED } from '../functions/mcp/package.ts'

const root = new URL('../..', import.meta.url)
const migration = (name: string) => Deno.readTextFileSync(new URL(`supabase/migrations/${name}`, root))
const NEW = '20261023100000_project_data.sql'

const A = '00000000-0000-0000-0000-00000000000a'
const B = '00000000-0000-0000-0000-00000000000b'
const PA = '00000000-0000-0000-0000-0000000000a1'
const PA2 = '00000000-0000-0000-0000-0000000000a2'
const PB = '00000000-0000-0000-0000-0000000000b1'

const STUBS = `
create role anon; create role authenticated; create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
create table public.profiles (id uuid primary key);
create table public.projects (id uuid primary key, profile_id uuid not null references public.profiles (id),
  name text not null);
create function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table public.ui_views (id bigint, template text constraint ui_views_template_check check (template is not null),
  state jsonb not null default '{}');
grant usage on schema public to anon, authenticated, service_role;
insert into public.profiles values ('${A}'), ('${B}');
insert into public.projects values ('${PA}', '${A}', 'Dummy - Big Pharma AG'), ('${PA2}', '${A}', 'Dummy - Project Atlas'),
  ('${PB}', '${B}', 'Dummy - Birch');
`

type Row = Record<string, unknown>
const j = (v: unknown) => JSON.stringify(v)

async function rpc(db: PGlite, fn: string, args: unknown[]): Promise<Row> {
  const ph = args.map((_, i) => `$${i + 1}`).join(', ')
  const res = await db.query<{ r: Row }>(`select public.${fn}(${ph}) as r`,
    args.map((a) => (a !== null && typeof a === 'object' && !Array.isArray(a) ? j(a) : a)))
  return res.rows[0].r
}

/** The functions by their name before (engagement_*) and after (project_*) the migration. */
const api = (p: 'engagement' | 'project') => ({
  read: (db: PGlite, project: string, tables: string[] | null = null) => rpc(db, `${p}_read`, [project, tables]),
  reset: (db: PGlite, profile: string, project: string) =>
    rpc(db, `${p}_replace`, [profile, project, SCHEMA.contract_version, SEED.version, SEED.tables, j(SEED.log)]),
  demo: async (db: PGlite, profile: string, project: string, steps = DEMO) => {
    const out: Row[] = []
    for (const { request } of steps) {
      out.push(await write(async () => {
        const r = await rpc(db, `${p}_read`, [project, null])
        return { version: r.version as never, data: r.tables as never }
      }, (x) => rpc(db, `${p}_commit`, [profile, project, x.p_expected_version, x.p_version, x.p_tables, x.p_log]),
      request))
    }
    return out
  },
})
const before = api('engagement')
const after = api('project')

/** Same JSON with keys sorted, so key order (which jsonb does not keep) does not count. */
const canon = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(canon)
  : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon((v as Row)[k])]))
  : v

/** A read with the engagement record's name replaced, to compare with data read before the name rule. */
function named(read: Row, name: string): Row {
  const out = structuredClone(read)
  const en = ((out.tables as Record<string, Row[]>).engagement ?? [])[0]
  if (en) en.name = name
  return out
}

async function asUser(db: PGlite, user: string, sql: string, params: unknown[] = []) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);`)
  try {
    return await db.query<Row>(sql, params)
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`)
  }
}

const one = async (db: PGlite, sql: string, params: unknown[] = []) => (await db.query<Row>(sql, params)).rows[0]
const denied = async (fn: () => Promise<unknown>) => {
  try { await fn() } catch (e) { return String(e) }
  return ''
}

Deno.test('project data: renames in place, one name, row security, delete, empty', async (t) => {
  const db = await PGlite.create()
  await db.exec(STUBS)
  await db.exec(migration('20261022150000_engagement.sql'))
  await db.exec(migration('20261022160000_engagement_tables.sql'))

  // Before: A's Big Pharma project has the seed plus demo steps 1–9; B has the seed; A's Atlas has nothing.
  await before.reset(db, A, PA)
  await before.demo(db, A, PA, DEMO.slice(0, 9))
  await before.reset(db, B, PB)
  const oldA = await before.read(db, PA)
  const oldB = await before.read(db, PB)
  const oldLog = await one(db, `select count(*)::int as n from public.engagement_log`)
  assertEquals((oldA.version as Row).global, 15)

  await db.exec(migration(NEW))

  await t.step('every record and log entry stays; the old names are gone', async () => {
    assertEquals(j(canon(await after.read(db, PA))), j(canon(named(oldA, 'Dummy - Big Pharma AG'))))
    assertEquals(j(canon(await after.read(db, PB))), j(canon(named(oldB, 'Dummy - Birch'))))
    assertEquals((await one(db, `select count(*)::int as n from public.project_log`)).n, oldLog.n)
    assertEquals((await one(db, `select count(*)::int as n from project.time_entries`)).n, 216)
    const gone = await one(db, `select to_regnamespace('engagement') as s, to_regclass('public.engagement_datasets') as d,
      to_regclass('public.engagement_log') as l, to_regclass('project.versions') is not null as v,
      (select count(*)::int from pg_proc where proname like 'engagement\\_%') as f`)
    assertEquals([gone.s, gone.d, gone.l, gone.v, gone.f], [null, null, null, true, 0])
  })

  await t.step('the page and the tools see no change in shape: a table list, the version poll', async () => {
    const got = await after.read(db, PA, ['people', 'tasks'])
    assertEquals(Object.keys(got.tables as Row).sort(), ['people', 'tasks'])
    const v = await rpc(db, 'project_version', [PA])
    assertEquals([v.status, (v.version as Row).global], ['ok', 15])
  })

  await t.step('reset: the seed read back exactly, the engagement record named after the project', async () => {
    await after.reset(db, A, PA)
    const got = await after.read(db, PA)
    for (const tbl of Object.keys(SCHEMA.tables)) {
      const want = tbl === 'engagement' ? [{ ...SEED.tables.engagement[0], name: 'Dummy - Big Pharma AG' }] : SEED.tables[tbl]
      assertEquals(j(canon((got.tables as Row)[tbl])), j(canon(want)), tbl)
    }
  })

  await t.step('the package\'s demo: steps 1–9 commit at 7–15, step 10 refused', async () => {
    const out = await after.demo(db, A, PA)
    for (let i = 0; i < 9; i++) {
      assert(out[i].committed, `step ${i + 1}: ${j(out[i])}`)
      assertEquals((out[i].version as Row).global, 7 + i)
    }
    assertEquals(out[9].committed, false)
    assert(j(out[9].errors).includes('122 characters'))
    assertEquals((await one(db, `select count(*)::int as n from public.project_log where project_id = $1`, [PA])).n, 14)
  })

  await t.step('one name: the engagement starter renames the project, and a project rename reaches the record', async () => {
    const [w] = await after.demo(db, A, PA, [{ file: 'rename', request: {
      agent: 'engagement_starter', reason: 'Renamed for the scale-up', ops: [
        { op: 'update', table: 'engagement', id: 'en-01', set: { name: 'Big Pharma AG scale-up' } },
      ],
    } }])
    assert(w.committed, j(w))
    assertEquals((await one(db, `select name from public.projects where id = $1`, [PA])).name, 'Big Pharma AG scale-up')

    await db.query(`update public.projects set name = 'Big Pharma AG' where id = $1`, [PA])
    const en = ((await after.read(db, PA, ['engagement'])).tables as Record<string, Row[]>).engagement[0]
    assertEquals(en.name, 'Big Pharma AG')

    await db.query(`update public.projects set name = 'Atlas renamed' where id = $1`, [PA2])
    assertEquals((await one(db, `select name from public.projects where id = $1`, [PA2])).name, 'Atlas renamed')
  })

  await t.step('a project name the package would refuse is refused by the database', async () => {
    for (const name of ['x'.repeat(71), 'two\nlines', 'a <b>tag</b>', 'a {bridge.target}', '']) {
      const e = await denied(() => db.query(`update public.projects set name = $1 where id = $2`, [name, PA]))
      assert(e.includes('projects_name_package'), `${j(name)}: ${e}`)
    }
  })

  await t.step('a project without data is empty, and reset loads it', async () => {
    assertEquals((await after.read(db, PA2)).status, 'empty')
    assertEquals((await rpc(db, 'project_version', [PA2])).status, 'empty')
    const c = await rpc(db, 'project_commit', [A, PA2, 6, '{}', '{}', '{}'])
    assertEquals(c.status, 'empty')
    await after.reset(db, A, PA2)
    const en = ((await after.read(db, PA2, ['engagement'])).tables as Record<string, Row[]>).engagement[0]
    assertEquals(en.name, 'Atlas renamed')
  })

  await t.step('row security: own rows only; saves and the name trigger refused to the browser', async () => {
    const mine = await asUser(db, A, `select count(*)::int as n from project.people`)
    assertEquals(mine.rows[0].n, 22)
    const theirs = await asUser(db, B, `select count(*)::int as n from project.people where project_id = $1`, [PA])
    assertEquals(theirs.rows[0].n, 0)
    const versions = await asUser(db, B, `select count(*)::int as n from project.versions`)
    assertEquals(versions.rows[0].n, 1)
    const other = await asUser(db, B, `select public.project_read($1) as r`, [PA])
    assertEquals((other.rows[0].r as Row).status, 'empty')
    for (const sql of [
      `select project.put('${A}', '${PA}', 'people', '[]')`,
      `select public.project_commit('${A}', '${PA}', 16, '{}', '{}', '{}')`,
      `select public.project_replace('${A}', '${PA}', '2.0', '{}', '{}', '[]')`,
      `select public.project_owns('${A}', '${PA}')`,
      `insert into project.people (project_id, profile_id, pos, id) values ('${PA}', '${A}', 1, 'pe-99')`,
      `update project.engagement set name = 'x'`,
      `update project.versions set global_version = 1`,
      `delete from public.project_log`,
    ]) {
      const e = await denied(() => asUser(db, A, sql))
      assert(/permission denied/.test(e), `${sql}: ${e}`)
    }
  })

  await t.step('deleting a project takes its data with it', async () => {
    await db.query(`delete from public.projects where id = $1`, [PA2])
    const left = await one(db, `select (select count(*)::int from project.versions where project_id = $1) as v,
      (select count(*)::int from project.people where project_id = $1) as p,
      (select count(*)::int from public.project_log where project_id = $1) as l`, [PA2])
    assertEquals([left.v, left.p, left.l], [0, 0, 0])
  })

  await db.close()
})

Deno.test('project data: the generator without --rename builds the same thing on an empty database', async () => {
  const out = await Deno.makeTempFile({ suffix: '.sql' })
  const gen = new URL('scripts/gen-project-tables.mjs', root).pathname.replace(/^\/([A-Za-z]:)/, '$1')
  const rel = out.replace(/\\/g, '/')
  const res = await new Deno.Command('node', { args: [gen, rel] }).output()
  assert(res.success, new TextDecoder().decode(res.stderr))
  const db = await PGlite.create()
  await db.exec(STUBS)
  await db.exec(Deno.readTextFileSync(out))
  await after.reset(db, A, PA)
  const got = await after.read(db, PA)
  assertEquals((got.version as Row).global, 6)
  assertEquals(((got.tables as Record<string, Row[]>).engagement[0]).name, 'Dummy - Big Pharma AG')
  const [step] = await after.demo(db, A, PA, DEMO.slice(0, 1))
  assert(step.committed, j(step))
  await db.close()
  await Deno.remove(out)
})

Deno.test('project data: scripts/demo-project.mjs creates the demo project, loads the seed, and reloads it', async () => {
  const db = await PGlite.create()
  await db.exec(STUBS)
  await db.exec(`alter table public.profiles add column email text, add column selected_project_id uuid;
    update public.profiles set email = 'b@test.com' where id = '${B}';
    alter table public.projects add column icon text, add column created_at timestamptz not null default now(),
      add column label text, alter column id set default gen_random_uuid();`)
  await db.exec(migration('20261022150000_engagement.sql'))
  await db.exec(migration('20261022160000_engagement_tables.sql'))
  await db.exec(migration(NEW))
  const out = await Deno.makeTempFile({ suffix: '.sql' })
  const script = new URL('scripts/demo-project.mjs', root).pathname.replace(/^\/([A-Za-z]:)/, '$1')
  const res = await new Deno.Command('node', { args: [script, 'b@test.com', '--select', '--sql', out] }).output()
  assert(res.success, new TextDecoder().decode(res.stderr))
  const sql = Deno.readTextFileSync(out)
  const count = () => one(db, `select count(*)::int as n from public.projects where profile_id = $1 and name = 'Big Pharma AG'`, [B])

  await db.exec(sql)
  assertEquals((await count()).n, 1)
  const p = (await one(db, `select id from public.projects where profile_id = $1 and name = 'Big Pharma AG'`, [B])).id as string
  assertEquals((await one(db, `select selected_project_id from public.profiles where id = $1`, [B])).selected_project_id, p)
  const got = await after.read(db, p, ['engagement', 'people'])
  assertEquals((got.version as Row).global, 6)
  assertEquals(((got.tables as Record<string, Row[]>).engagement[0]).name, 'Big Pharma AG')

  const [w] = await after.demo(db, B, p, DEMO.slice(0, 1))
  assert(w.committed)
  await db.exec(sql)
  assertEquals((await count()).n, 1)
  assertEquals(((await after.read(db, p)).version as Row).global, 6)

  let e = ''
  try { await db.exec(sql.replaceAll('b@test.com', 'nobody@test.com')) } catch (x) { e = String(x) }
  assert(e.includes('no user with the email'), e)
  await db.close()
  await Deno.remove(out)
})
