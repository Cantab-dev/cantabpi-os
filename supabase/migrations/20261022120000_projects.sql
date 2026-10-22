-- Projects, v2 phase 1 (docs/projects-status.md §2): a projects table, a per-user selection of one,
-- several or no projects (none = all), project_id on todos, sheets, docs and slides, and RLS that
-- shows only the selected projects' rows plus rows without a project. Lands with function v0.7.0.
-- Applied 2026-10-22, then changed to one selected project by 20261022130000_single_project.sql.

-- Labels: project:N, from its own sequence. Restated whole; security definer as set on 2026-10-14.
create sequence public.project_label_seq;

create or replace function public.next_label(entity text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if entity not in ('skill', 'todo', 'lead', 'sheet', 'doc', 'slide', 'project') then
    raise exception 'Unknown entity: %', entity;
  end if;
  return entity || ':' || nextval(format('public.%I', entity || '_label_seq')::regclass);
end;
$$;

-- 2.1 The projects table. One owner (D2); the selection is a flag on the row (D3).
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  label text not null unique default public.next_label('project'),
  label_no integer generated always as (split_part(label, ':', 2)::integer) stored,
  name text not null,
  icon text,
  context text,
  selected boolean not null default false,
  profile_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_profile_id_idx on public.projects (profile_id);
create index projects_label_no_idx on public.projects (label_no);
create index projects_selected_idx on public.projects (profile_id) where selected;

create trigger set_updated_at before update on public.projects for each row execute function public.set_updated_at();

alter table public.projects enable row level security;
revoke all on table public.projects from anon;
revoke truncate, references, trigger on table public.projects from authenticated;
create policy "Own rows" on public.projects for all to authenticated
  using ((select auth.uid()) = profile_id) with check ((select auth.uid()) = profile_id);

-- 2.3 Functions. All act on the signed-in user only.

-- The selected project ids, or null when none is selected (D4: none means all).
create function public.project_scope()
returns uuid[]
language sql
stable
security invoker
set search_path = ''
as $$
  select array_agg(id) from public.projects where profile_id = (select auth.uid()) and selected
$$;

-- The one selected project, or null when none or several are selected (D3a). Default of project_id.
create function public.current_project_id()
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select case when count(*) = 1 then (array_agg(id))[1] end
  from public.projects where profile_id = (select auth.uid()) and selected
$$;

-- True when p is null or one of the user's own projects (any, not only selected ones).
create function public.owns_project(p uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select p is null or exists (select 1 from public.projects where id = p and profile_id = (select auth.uid()))
$$;

-- Selects exactly the given projects; an empty list selects none, so all. Unknown labels change nothing.
create function public.select_projects(p_labels text[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_labels text[] := array(select distinct lower(trim(l)) from unnest(coalesce(p_labels, '{}')) l);
  v_missing text;
begin
  select string_agg(l, ', ') into v_missing
  from unnest(v_labels) l
  where not exists (select 1 from public.projects p where p.label = l and p.profile_id = (select auth.uid()));
  if v_missing is not null then
    raise exception 'Project not found: %', v_missing;
  end if;

  update public.projects
  set selected = (label = any(v_labels))
  where profile_id = (select auth.uid()) and selected is distinct from (label = any(v_labels));
end;
$$;

-- 2.2 project_id on the four project-scoped tables (D1). Column first, default after, so existing rows
-- are not filled from the migration's (empty) session.
do $$
declare
  t text;
begin
  foreach t in array array['todos', 'sheets', 'docs', 'slides'] loop
    execute format(
      'alter table public.%I add column project_id uuid references public.projects (id) on delete set null', t
    );
    execute format('alter table public.%I alter column project_id set default public.current_project_id()', t);
    execute format('create index %I on public.%I (project_id)', t || '_project_id_idx', t);
  end loop;
end;
$$;

-- Item counts per project for the signed-in user, ignoring the selection, plus a row for items without
-- a project. Definer so the counts are not cut by the selection; every count is filtered by auth.uid().
create function public.project_summary()
returns table (label text, name text, icon text, selected boolean, todos bigint, sheets bigint, docs bigint, slides bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select label, name, icon, selected, todos, sheets, docs, slides from (
    select p.label_no as sort, p.label, p.name, p.icon, p.selected,
      (select count(*) from public.todos x where x.project_id = p.id),
      (select count(*) from public.sheets x where x.project_id = p.id),
      (select count(*) from public.docs x where x.project_id = p.id),
      (select count(*) from public.slides x where x.project_id = p.id)
    from public.projects p
    where p.profile_id = (select auth.uid())
    union all
    select null, null, 'No project', null, null,
      (select count(*) from public.todos x where x.project_id is null and x.profile_id = (select auth.uid())),
      (select count(*) from public.sheets x where x.project_id is null and x.profile_id = (select auth.uid())),
      (select count(*) from public.docs x where x.project_id is null and x.profile_id = (select auth.uid())),
      (select count(*) from public.slides x where x.project_id is null and x.profile_id = (select auth.uid()))
  ) s(sort, label, name, icon, selected, todos, sheets, docs, slides)
  order by sort nulls last
$$;

revoke execute on function public.project_scope() from public, anon;
revoke execute on function public.current_project_id() from public, anon;
revoke execute on function public.owns_project(uuid) from public, anon;
revoke execute on function public.select_projects(text[]) from public, anon;
revoke execute on function public.project_summary() from public, anon;
grant execute on function public.project_scope() to authenticated;
grant execute on function public.current_project_id() to authenticated;
grant execute on function public.owns_project(uuid) to authenticated;
grant execute on function public.select_projects(text[]) to authenticated;
grant execute on function public.project_summary() to authenticated;

-- 2.4 RLS on the four tables: own rows, in the selection or without a project; writes may point only at
-- the user's own projects. Replaces the one "Own rows" policy of 2026-10-14.
do $$
declare
  t text;
  v_see text := '(select auth.uid()) = profile_id and (project_id is null '
    'or (select public.project_scope()) is null or project_id = any ((select public.project_scope())::uuid[]))';
  v_write text := '(select auth.uid()) = profile_id and public.owns_project(project_id)';
begin
  foreach t in array array['todos', 'sheets', 'docs', 'slides'] loop
    execute format('drop policy "Own rows" on public.%I', t);
    execute format('create policy "Own rows: read" on public.%I for select to authenticated using (%s)', t, v_see);
    execute format('create policy "Own rows: insert" on public.%I for insert to authenticated with check (%s)', t, v_write);
    execute format(
      'create policy "Own rows: update" on public.%I for update to authenticated using (%s) with check (%s)',
      t, v_see, v_write
    );
    execute format('create policy "Own rows: delete" on public.%I for delete to authenticated using (%s)', t, v_see);
  end loop;
end;
$$;

-- note on a project label. Restated whole from 2026-10-14 with one line added.
create or replace function public.append_context(p_label text, p_text text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_table text;
  v_count integer;
begin
  v_table := case split_part(p_label, ':', 1)
    when 'todo' then 'todos'
    when 'lead' then 'leads'
    when 'sheet' then 'sheets'
    when 'doc' then 'docs'
    when 'slide' then 'slides'
    when 'project' then 'projects'
  end;

  if v_table is null then
    raise exception 'Notes are not supported for label %', p_label;
  end if;

  execute format(
    'update public.%I set context = concat_ws(E''\n'', nullif(context, ''''), $1) where label = $2',
    v_table
  ) using to_char(now() at time zone 'utc', 'YYYY-MM-DD') || ': ' || p_text, p_label;

  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'Label % not found', p_label;
  end if;
end;
$$;

-- 2.5 Dummy data: two projects per user; the user's Dummy rows split between them, the newest of each
-- kind to Birch. Other rows stay without a project. A missing user is skipped.
do $$
declare
  u record;
  t text;
  v_atlas uuid;
  v_birch uuid;
begin
  for u in
    select id from public.profiles
    where email in ('claude@test.com', 'nela@cantabpi.com', 'sinisa@cantabpi.com') order by email
  loop
    insert into public.projects (name, icon, context, profile_id)
      values ('Dummy - Project Atlas', '🧭', 'Dummy mockup project for testing projects.', u.id)
      returning id into v_atlas;
    insert into public.projects (name, icon, context, profile_id)
      values ('Dummy - Project Birch', '🌲', 'Second dummy project, for testing the selection.', u.id)
      returning id into v_birch;

    foreach t in array array['todos', 'sheets', 'docs', 'slides'] loop
      execute format(
        'update public.%I x set project_id = case when x.label_no = '
          '(select max(y.label_no) from public.%I y where y.profile_id = $1 and y.name like ''Dummy - %%'') '
          'then $3 else $2 end '
          'where x.profile_id = $1 and x.name like ''Dummy - %%''',
        t, t
      ) using u.id, v_atlas, v_birch;
    end loop;
  end loop;
end;
$$;
