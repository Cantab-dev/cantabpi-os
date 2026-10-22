-- Phase 2: Siniša's views package ported onto Supabase (docs/live-views-status.md §8, interface §8.5).
-- One row per package table and project (P1); the package's validator runs in the MCP function (P2), which saves
-- with the service role only (P13, Aleph's pattern). Pages are self-contained HTML in view_templates (P6b); the deck
-- is in a public bucket. New view keys: the package's eleven (P9).

-- 1. The engagement data, one dataset per project.
create table public.engagement_datasets (
  project_id uuid primary key references public.projects (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  contract_version text not null,
  global_version integer not null default 0,
  table_versions jsonb not null default '{}' check (jsonb_typeof(table_versions) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on public.engagement_datasets
  for each row execute function public.set_updated_at();

-- One row per package table: records is the array the package keeps in data/<tbl>.json.
create table public.engagement_tables (
  project_id uuid not null references public.engagement_datasets (project_id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  tbl text not null check (tbl ~ '^[a-z_]+$'),
  records jsonb not null default '[]' check (jsonb_typeof(records) = 'array'),
  version integer not null default 0,
  primary key (project_id, tbl)
);

-- The package's _log.json: the last 200 entries per project.
create table public.engagement_log (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.engagement_datasets (project_id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  version integer not null,
  at timestamptz not null,
  agent text not null,
  reason text not null,
  changes jsonb not null default '[]'
);
create index engagement_log_project on public.engagement_log (project_id, version);

alter table public.engagement_datasets enable row level security;
alter table public.engagement_tables enable row level security;
alter table public.engagement_log enable row level security;
revoke all on table public.engagement_datasets, public.engagement_tables, public.engagement_log from anon, authenticated;
grant select on table public.engagement_datasets, public.engagement_tables, public.engagement_log to authenticated;
create policy "Own engagement: read" on public.engagement_datasets
  for select to authenticated using ((select auth.uid()) = profile_id);
create policy "Own engagement tables: read" on public.engagement_tables
  for select to authenticated using ((select auth.uid()) = profile_id);
create policy "Own engagement log: read" on public.engagement_log
  for select to authenticated using ((select auth.uid()) = profile_id);

-- 2. The pages: one self-contained HTML page per view, written only with the service key (scripts/templates.mjs).
create table public.view_templates (
  key text primary key,
  html text not null,
  contract_version text not null,
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on public.view_templates
  for each row execute function public.set_updated_at();
alter table public.view_templates enable row level security;
revoke all on table public.view_templates from anon, authenticated;
grant select on table public.view_templates to authenticated;
create policy "Templates: read" on public.view_templates for select to authenticated using (true);

-- 3. The deck and other engagement files: public, dummy content only (P8, P6b).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('engagement-assets', 'engagement-assets', true, 20971520, array['application/pdf']);

-- 4. Reads, as the signed-in user (RLS). The page's runtime and the MCP tools use them.
create function public.engagement_read(p_project uuid, p_tables text[] default null)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select case when d.project_id is null then jsonb_build_object('status', 'empty')
  else jsonb_build_object(
    'status', 'ok',
    'version', jsonb_build_object('global', d.global_version, 'tables', d.table_versions),
    'tables', coalesce((
      select jsonb_object_agg(t.tbl, t.records) from public.engagement_tables t
      where t.project_id = d.project_id and (p_tables is null or t.tbl = any (p_tables))
    ), '{}')
  ) end
  from (select 1) one
  left join public.engagement_datasets d on d.project_id = p_project
$$;

-- The package's _version.json, for the page's 2-second poll.
create function public.engagement_version(p_project uuid)
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
  left join public.engagement_datasets d on d.project_id = p_project
$$;

-- The MCP function's log reads, newest last.
create function public.engagement_log_read(p_project uuid, p_since integer default null, p_limit integer default null)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('version', l.version, 'at', l.at, 'agent', l.agent, 'reason', l.reason,
    'changes', l.changes) order by l.version), '[]')
  from (
    select * from public.engagement_log
    where project_id = p_project and (p_since is null or version > p_since)
    order by version desc limit coalesce(p_limit, 200)
  ) l
$$;

-- 5. Saves: service role only (P13). The MCP function has verified the user, run the validator and passes the user.
create function public.engagement_owns(p_profile uuid, p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.projects where id = p_project and profile_id = p_profile)
$$;

-- A validated write: the touched tables, the new versions and one log entry. Refused if the version moved.
create function public.engagement_commit(
  p_profile uuid, p_project uuid, p_expected_version integer, p_version jsonb, p_tables jsonb, p_log jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.engagement_datasets;
  k text;
begin
  if not public.engagement_owns(p_profile, p_project) then
    raise exception 'not_found: project';
  end if;
  select * into d from public.engagement_datasets where project_id = p_project for update;
  if not found then
    return jsonb_build_object('status', 'empty');
  end if;
  if d.global_version <> p_expected_version then
    return jsonb_build_object('status', 'conflict',
      'version', jsonb_build_object('global', d.global_version, 'tables', d.table_versions));
  end if;
  for k in select jsonb_object_keys(p_tables) loop
    insert into public.engagement_tables (project_id, profile_id, tbl, records, version)
    values (p_project, p_profile, k, p_tables -> k, (p_version ->> 'global')::integer)
    on conflict (project_id, tbl) do update set records = excluded.records, version = excluded.version;
  end loop;
  update public.engagement_datasets
  set global_version = (p_version ->> 'global')::integer, table_versions = p_version -> 'tables'
  where project_id = p_project;
  insert into public.engagement_log (project_id, profile_id, version, at, agent, reason, changes)
  values (p_project, p_profile, (p_log ->> 'version')::integer, (p_log ->> 'at')::timestamptz, p_log ->> 'agent',
    p_log ->> 'reason', coalesce(p_log -> 'changes', '[]'));
  delete from public.engagement_log
  where project_id = p_project and id not in (
    select id from public.engagement_log where project_id = p_project order by version desc, id desc limit 200
  );
  return jsonb_build_object('status', 'ok');
end;
$$;

-- Reset: replace the whole dataset with the seed (creates it if missing).
create function public.engagement_replace(
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
  if not public.engagement_owns(p_profile, p_project) then
    raise exception 'not_found: project';
  end if;
  insert into public.engagement_datasets (project_id, profile_id, contract_version, global_version, table_versions)
  values (p_project, p_profile, p_contract, (p_version ->> 'global')::integer, p_version -> 'tables')
  on conflict (project_id) do update set contract_version = excluded.contract_version,
    global_version = excluded.global_version, table_versions = excluded.table_versions;
  delete from public.engagement_tables where project_id = p_project;
  delete from public.engagement_log where project_id = p_project;
  for k in select jsonb_object_keys(p_tables) loop
    insert into public.engagement_tables (project_id, profile_id, tbl, records, version)
    values (p_project, p_profile, k, p_tables -> k, coalesce((p_version -> 'tables' ->> k)::integer, 0));
  end loop;
  for e in select jsonb_array_elements(p_log) loop
    insert into public.engagement_log (project_id, profile_id, version, at, agent, reason, changes)
    values (p_project, p_profile, (e ->> 'version')::integer, (e ->> 'at')::timestamptz, e ->> 'agent', e ->> 'reason',
      coalesce(e -> 'changes', '[]'));
  end loop;
  return jsonb_build_object('status', 'ok', 'version', p_version);
end;
$$;

revoke execute on function public.engagement_read(uuid, text[]) from public, anon;
revoke execute on function public.engagement_version(uuid) from public, anon;
revoke execute on function public.engagement_log_read(uuid, integer, integer) from public, anon;
revoke execute on function public.engagement_owns(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.engagement_commit(uuid, uuid, integer, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.engagement_replace(uuid, uuid, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.engagement_read(uuid, text[]) to authenticated;
grant execute on function public.engagement_version(uuid) to authenticated;
grant execute on function public.engagement_log_read(uuid, integer, integer) to authenticated;
grant execute on function public.engagement_owns(uuid, uuid) to service_role;
grant execute on function public.engagement_commit(uuid, uuid, integer, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.engagement_replace(uuid, uuid, text, jsonb, jsonb, jsonb) to service_role;

-- 6. View keys (P9): the package's eleven replace the ten of §7; pdf and dashboard stay for Claude.
delete from public.ui_views where template in ('workflow_mapper', 'research_analyst', 'value_case_calculator',
  'gxp_ai_act_checker', 'red_team_reviewer', 'engagement_memory', 'dummy_9', 'dummy_10');
update public.ui_views set state = state - array['workflow_mapper', 'research_analyst', 'value_case_calculator',
  'gxp_ai_act_checker', 'red_team_reviewer', 'engagement_memory', 'dummy_9', 'dummy_10'];
alter table public.ui_views drop constraint ui_views_template_check;
alter table public.ui_views add constraint ui_views_template_check check (template in (
  'home', 'engagement_starter', 'analyst', 'value_estimator', 'presentation_builder', 'project_manager', 'team_manager',
  'story_builder', 'agent_builder', 'proposal_builder', 'model_builder', 'pdf', 'dashboard'
));

create or replace function public.view_header_templates()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['home', 'engagement_starter', 'analyst', 'value_estimator', 'presentation_builder', 'project_manager',
    'team_manager', 'story_builder', 'agent_builder', 'proposal_builder', 'model_builder']
$$;
