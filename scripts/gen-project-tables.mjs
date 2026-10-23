// Generates the migration that stores Siniša's package as one Postgres table per package table, in the schema
// `project` (docs/archive/project-engagement-status.md; first built as the schema `engagement`, docs/archive/engagement-tables-status.md).
// Reads and saves hand over the package's arrays, so the validator and the pages do not change. The tables carry types
// and keys only; the validator stays the check. Run after a change to vendor/bpag/data/_schema.json, with a new
// migration name (an applied one is never edited):
//   node scripts/gen-project-tables.mjs supabase/migrations/<timestamp>_<name>.sql [--rename]
// Without a flag it creates the schema and its tables. --rename instead renames the schema `engagement`, its
// engagement_datasets and engagement_log in place (the one-off of 2026-10-23); both then write the same functions.
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const schema = JSON.parse(readFileSync(join(root, 'vendor', 'bpag', 'data', '_schema.json'), 'utf8'))
const [outPath, ...flags] = process.argv.slice(2)
if (!outPath) throw new Error('usage: node scripts/gen-project-tables.mjs <migration.sql> [--rename]')
const rename = flags.includes('--rename')

const OWN = ['project_id', 'profile_id', 'pos', 'meta_version', 'meta_updated_at', 'meta_updated_by', 'meta_reason']
const TYPE = {
  string: 'text', text: 'text', enum: 'text', ref: 'text', date: 'date', integer: 'integer', number: 'numeric',
  boolean: 'boolean', ref_list: 'text[]',
}
const q = (name) => `"${name.replace(/"/g, '""')}"`
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`
const names = Object.keys(schema.tables)
if (!names.includes('engagement')) throw new Error('the package has no table "engagement": the name rule needs it')
const nameMax = schema.tables.engagement.fields.name.max_len

function table(name, def) {
  const cols = [
    'project_id uuid not null references project.versions (project_id) on delete cascade',
    'profile_id uuid not null references public.profiles (id) on delete cascade',
    'pos integer not null',
    'id text not null',
  ]
  for (const [f, fd] of Object.entries(def.fields)) {
    if (fd.type === 'id') continue
    if (!TYPE[fd.type]) throw new Error(`${name}.${f}: no column type for ${fd.type}`)
    if (OWN.includes(f)) throw new Error(`${name}.${f}: clashes with an owner or meta column`)
    let col = `${q(f)} ${TYPE[fd.type]}`
    if (fd.type === 'enum') col += ` check (${q(f)} in (${fd.values.map(lit).join(', ')}))`
    cols.push(col)
  }
  cols.push('meta_version integer', 'meta_updated_at timestamptz', 'meta_updated_by text', 'meta_reason text',
    'primary key (project_id, id)')
  return `-- ${def.description.split('\n')[0]}
create table project.${q(name)} (
  ${cols.join(',\n  ')}
);
alter table project.${q(name)} enable row level security;
create policy "Own project rows: read" on project.${q(name)}
  for select to authenticated using ((select auth.uid()) = profile_id);
`
}

const create = `create schema project;
revoke all on schema project from public, anon;
grant usage on schema project to authenticated, service_role;

-- 1. The versions (the package's _version.json): one row per project that has data; the first reset creates it.
create table project.versions (
  project_id uuid primary key references public.projects (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  contract_version text not null,
  global_version integer not null default 0,
  table_versions jsonb not null default '{}' check (jsonb_typeof(table_versions) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on project.versions for each row execute function public.set_updated_at();
alter table project.versions enable row level security;
create policy "Own versions: read" on project.versions for select to authenticated using ((select auth.uid()) = profile_id);

-- The package's _log.json: the last 200 entries per project.
create table public.project_log (
  id bigint generated always as identity primary key,
  project_id uuid not null references project.versions (project_id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  version integer not null,
  at timestamptz not null,
  agent text not null,
  reason text not null,
  changes jsonb not null default '[]'
);
create index project_log_project on public.project_log (project_id, version);
alter table public.project_log enable row level security;
revoke all on table public.project_log from anon, authenticated;
grant select on table public.project_log to authenticated;
create policy "Own project log: read" on public.project_log for select to authenticated using ((select auth.uid()) = profile_id);

-- 2. The ${names.length} tables. Types and keys only: required fields, lengths, ranges and references stay in the validator.
${names.map((n) => table(n, schema.tables[n])).join('\n')}
revoke all on all tables in schema project from public, anon, authenticated;
grant select on all tables in schema project to authenticated;
`

// The one-off: everything keeps its rows; only names move. The old functions go (their bodies name the old schema).
const renames = `-- 1. Renames in place: no row is copied.
alter schema engagement rename to project;

alter table public.engagement_datasets set schema project;
alter table project.engagement_datasets rename to versions;
alter table project.versions rename constraint engagement_datasets_pkey to versions_pkey;
alter table project.versions rename constraint engagement_datasets_project_id_fkey to versions_project_id_fkey;
alter table project.versions rename constraint engagement_datasets_profile_id_fkey to versions_profile_id_fkey;
alter table project.versions rename constraint engagement_datasets_table_versions_check to versions_table_versions_check;
alter policy "Own engagement: read" on project.versions rename to "Own versions: read";

alter table public.engagement_log rename to project_log;
alter sequence public.engagement_log_id_seq rename to project_log_id_seq;
alter table public.project_log rename constraint engagement_log_pkey to project_log_pkey;
alter table public.project_log rename constraint engagement_log_project_id_fkey to project_log_project_id_fkey;
alter table public.project_log rename constraint engagement_log_profile_id_fkey to project_log_profile_id_fkey;
alter index public.engagement_log_project rename to project_log_project;
alter policy "Own engagement log: read" on public.project_log rename to "Own project log: read";

do $$
declare
  t text;
begin
  foreach t in array array[${names.map(lit).join(', ')}] loop
    execute format('alter policy %I on project.%I rename to %I', 'Own engagement rows: read', t, 'Own project rows: read');
  end loop;
end;
$$;

drop function public.engagement_read(uuid, text[]);
drop function public.engagement_version(uuid);
drop function public.engagement_log_read(uuid, integer, integer);
drop function public.engagement_commit(uuid, uuid, integer, jsonb, jsonb, jsonb);
drop function public.engagement_replace(uuid, uuid, text, jsonb, jsonb, jsonb);
drop function public.engagement_owns(uuid, uuid);
`

const sql = `-- Generated by scripts/gen-project-tables.mjs from vendor/bpag/data/_schema.json (contract ${schema.contract_version}).
-- Do not edit: change the schema or the script, then generate a new migration.
-- docs/archive/project-engagement-status.md: the project's data from Siniša's package, one table per package table in the
-- schema project, closed to the Data API: it changes only through the functions below, after the validator.

${rename ? renames : create}
-- ${rename ? '2' : '3'}. Helpers.
create or replace function project.tables()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[${names.map(lit).join(', ')}]
$$;

-- The package's _meta.updated_at as JavaScript writes it: UTC, milliseconds only when not zero.
create or replace function project.iso(p timestamptz)
returns text
language sql
immutable
set search_path = ''
as $$
  select to_char(p at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS')
    || case when extract(microseconds from p)::bigint % 1000000 = 0 then ''
       else '.' || to_char(p at time zone 'UTC', 'MS') end || 'Z'
$$;

-- One table back as the package's array: same field names, empty fields left out, in order. As the caller (RLS).
create or replace function project.get(p_project uuid, p_tbl text)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  out jsonb;
begin
  if not p_tbl = any (project.tables()) then
    raise exception 'invalid_parameter: unknown table %', p_tbl;
  end if;
  execute format($q$
    select coalesce(jsonb_agg(
      jsonb_strip_nulls(to_jsonb(t) - array[${OWN.map(lit).join(', ')}]::text[])
        || jsonb_build_object('_meta', jsonb_strip_nulls(jsonb_build_object('version', t.meta_version,
          'updated_at', project.iso(t.meta_updated_at), 'updated_by', t.meta_updated_by, 'reason', t.meta_reason)))
      order by t.pos), '[]')
    from project.%I t where t.project_id = $1
  $q$, p_tbl) into out using p_project;
  return out;
end;
$$;

-- Replace one table's rows for a project with the package's array. Empty values ('' or null) are not stored; the
-- validator treats them alike. Called only from the save functions below.
create or replace function project.put(p_profile uuid, p_project uuid, p_tbl text, p_records jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  n integer;
begin
  if not p_tbl = any (project.tables()) then
    raise exception 'invalid_parameter: unknown table %', p_tbl;
  end if;
  if jsonb_typeof(p_records) <> 'array' then
    raise exception 'invalid_parameter: % is not an array', p_tbl;
  end if;
  execute format('delete from project.%I where project_id = $1', p_tbl) using p_project;
  execute format($q$
    insert into project.%1$I
    select (jsonb_populate_record(null::project.%1$I,
      (select coalesce(jsonb_object_agg(k, v), '{}') from jsonb_each(e.rec - '_meta') f(k, v)
        where v <> 'null'::jsonb and v <> '""'::jsonb)
      || jsonb_build_object('project_id', $2, 'profile_id', $1, 'pos', e.ord,
        'meta_version', e.rec -> '_meta' -> 'version', 'meta_updated_at', e.rec -> '_meta' -> 'updated_at',
        'meta_updated_by', e.rec -> '_meta' -> 'updated_by', 'meta_reason', e.rec -> '_meta' -> 'reason'))).*
    from jsonb_array_elements($3) with ordinality e(rec, ord)
  $q$, p_tbl) using p_profile, p_project, p_records;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function project.tables(), project.iso(timestamptz) from public, anon;
revoke execute on function project.get(uuid, text) from public, anon;
revoke execute on function project.put(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function project.tables(), project.iso(timestamptz) to authenticated, service_role;
grant execute on function project.get(uuid, text) to authenticated, service_role;
grant execute on function project.put(uuid, uuid, text, jsonb) to service_role;

-- ${rename ? '3' : '4'}. Reads, as the signed-in user (RLS). The page's runtime and the MCP tools use them.
-- The project's data, or status 'empty' when it has none yet (reset loads the demo).
create function public.project_read(p_project uuid, p_tables text[] default null)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  d project.versions;
  k text;
  tabs jsonb := '{}';
begin
  select * into d from project.versions where project_id = p_project;
  if not found then
    return jsonb_build_object('status', 'empty');
  end if;
  for k in select unnest(project.tables()) loop
    if p_tables is null or k = any (p_tables) then
      tabs := tabs || jsonb_build_object(k, project.get(p_project, k));
    end if;
  end loop;
  return jsonb_build_object('status', 'ok',
    'version', jsonb_build_object('global', d.global_version, 'tables', d.table_versions), 'tables', tabs);
end;
$$;

-- The package's _version.json, for the page's 2-second poll.
create function public.project_version(p_project uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select case when d.project_id is null then jsonb_build_object('status', 'empty')
  else jsonb_build_object('status', 'ok', 'version', jsonb_build_object('global', d.global_version, 'tables', d.table_versions))
  end
  from (select 1) one
  left join project.versions d on d.project_id = p_project
$$;

-- The MCP function's log reads, newest last.
create function public.project_log_read(p_project uuid, p_since integer default null, p_limit integer default null)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('version', l.version, 'at', l.at, 'agent', l.agent, 'reason', l.reason,
    'changes', l.changes) order by l.version), '[]')
  from (
    select * from public.project_log
    where project_id = p_project and (p_since is null or version > p_since)
    order by version desc limit coalesce(p_limit, 200)
  ) l
$$;

-- ${rename ? '4' : '5'}. Saves: service role only (Aleph's pattern). The MCP function has verified the user, run the
-- validator and passes the user.
create function public.project_owns(p_profile uuid, p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.projects where id = p_project and profile_id = p_profile)
$$;

-- A validated write: the touched tables, the new versions and one log entry. Refused if the version moved.
-- A new engagement name renames the project (one name; the trigger below keeps the other direction).
create function public.project_commit(
  p_profile uuid, p_project uuid, p_expected_version integer, p_version jsonb, p_tables jsonb, p_log jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d project.versions;
  k text;
begin
  if not public.project_owns(p_profile, p_project) then
    raise exception 'not_found: project';
  end if;
  select * into d from project.versions where project_id = p_project for update;
  if not found then
    return jsonb_build_object('status', 'empty');
  end if;
  if d.global_version <> p_expected_version then
    return jsonb_build_object('status', 'conflict',
      'version', jsonb_build_object('global', d.global_version, 'tables', d.table_versions));
  end if;
  for k in select jsonb_object_keys(p_tables) loop
    perform project.put(p_profile, p_project, k, p_tables -> k);
  end loop;
  if p_tables ? 'engagement' then
    update public.projects set name = p_tables -> 'engagement' -> 0 ->> 'name'
    where id = p_project and name is distinct from p_tables -> 'engagement' -> 0 ->> 'name';
  end if;
  update project.versions
  set global_version = (p_version ->> 'global')::integer, table_versions = p_version -> 'tables'
  where project_id = p_project;
  insert into public.project_log (project_id, profile_id, version, at, agent, reason, changes)
  values (p_project, p_profile, (p_log ->> 'version')::integer, (p_log ->> 'at')::timestamptz, p_log ->> 'agent',
    p_log ->> 'reason', coalesce(p_log -> 'changes', '[]'));
  delete from public.project_log
  where project_id = p_project and id not in (
    select id from public.project_log where project_id = p_project order by version desc, id desc limit 200
  );
  return jsonb_build_object('status', 'ok');
end;
$$;

-- Reset: replace the project's data with the seed (creates it if missing). The engagement record takes the
-- project's name, not the seed's.
create function public.project_replace(
  p_profile uuid, p_project uuid, p_contract text, p_version jsonb, p_tables jsonb, p_log jsonb default '[]'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  k text;
  e jsonb;
begin
  if not public.project_owns(p_profile, p_project) then
    raise exception 'not_found: project';
  end if;
  insert into project.versions (project_id, profile_id, contract_version, global_version, table_versions)
  values (p_project, p_profile, p_contract, (p_version ->> 'global')::integer, p_version -> 'tables')
  on conflict (project_id) do update set contract_version = excluded.contract_version,
    global_version = excluded.global_version, table_versions = excluded.table_versions;
  for k in select unnest(project.tables()) loop
    perform project.put(p_profile, p_project, k, coalesce(p_tables -> k, '[]'));
  end loop;
  update project.engagement x set name = p.name
  from public.projects p where p.id = p_project and x.project_id = p_project;
  delete from public.project_log where project_id = p_project;
  for e in select jsonb_array_elements(p_log) loop
    insert into public.project_log (project_id, profile_id, version, at, agent, reason, changes)
    values (p_project, p_profile, (e ->> 'version')::integer, (e ->> 'at')::timestamptz, e ->> 'agent', e ->> 'reason',
      coalesce(e -> 'changes', '[]'));
  end loop;
  return jsonb_build_object('status', 'ok', 'version', p_version);
end;
$$;

revoke execute on function public.project_read(uuid, text[]) from public, anon;
revoke execute on function public.project_version(uuid) from public, anon;
revoke execute on function public.project_log_read(uuid, integer, integer) from public, anon;
revoke execute on function public.project_owns(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.project_commit(uuid, uuid, integer, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.project_replace(uuid, uuid, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.project_read(uuid, text[]) to authenticated;
grant execute on function public.project_version(uuid) to authenticated;
grant execute on function public.project_log_read(uuid, integer, integer) to authenticated;
grant execute on function public.project_owns(uuid, uuid) to service_role;
grant execute on function public.project_commit(uuid, uuid, integer, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.project_replace(uuid, uuid, text, jsonb, jsonb, jsonb) to service_role;

-- ${rename ? '5' : '6'}. One name. A project's name follows the package's rule for engagement.name (at most ${nameMax}
-- characters, one line, plain text, no placeholders), so a rename can never make the data invalid; a rename, from the
-- edit tool or the Data API, reaches the engagement record.
alter table public.projects add constraint projects_name_package check (
  char_length(name) between 1 and ${nameMax}
  and name !~ '[\\x01-\\x1f\\x7f]'
  and name !~ '</?[a-zA-Z][^>]*>'
  and name !~ '\\{[a-z_]+\\.[a-z_]+\\}'
);

create function project.sync_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update project.engagement set name = new.name where project_id = new.id and name is distinct from new.name;
  return null;
end;
$$;
revoke execute on function project.sync_name() from public, anon, authenticated;

create trigger sync_engagement_name after update of name on public.projects
  for each row when (old.name is distinct from new.name) execute function project.sync_name();
${rename ? `
-- 6. One name for the data already there: the engagement record takes the project's name.
update project.engagement x set name = p.name from public.projects p where p.id = x.project_id;
` : ''}`

writeFileSync(resolve(root, outPath), sql)
console.log(`wrote ${outPath}: ${names.length} tables${rename ? ', renamed in place' : ', created'}`)
