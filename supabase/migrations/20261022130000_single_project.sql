-- Projects: one selected project per user (Siniša, 2026-10-22; docs/projects-status.md §1). Changes
-- 20261022120000_projects.sql: the selection moves from projects.selected to profiles.selected_project_id;
-- every todo, sheet, doc and slide must belong to a project; no selection shows no rows; a project with
-- items cannot be deleted. Lands with function v0.7.0.

-- 1. The old policies use the old functions: drop them first.
do $$
declare
  t text;
begin
  foreach t in array array['todos', 'sheets', 'docs', 'slides'] loop
    execute format('drop policy "Own rows: read" on public.%I', t);
    execute format('drop policy "Own rows: insert" on public.%I', t);
    execute format('drop policy "Own rows: update" on public.%I', t);
    execute format('drop policy "Own rows: delete" on public.%I', t);
  end loop;
end;
$$;

drop function public.project_scope();
drop function public.select_projects(text[]);
drop function public.project_summary();

-- 2. The selection: one project per user, on the profile. Deleting it clears the selection.
alter table public.profiles
  add column selected_project_id uuid references public.projects (id) on delete set null;

-- Atlas starts selected (before the old flag goes, though nothing was selected live).
update public.profiles u set selected_project_id = p.id
from public.projects p
where p.profile_id = u.id and p.name = 'Dummy - Project Atlas';

alter table public.projects drop column selected;

-- 3. Functions. All act on the signed-in user only.

-- The selected project's id, or null. Default of project_id and the RLS filter.
create or replace function public.current_project_id()
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select selected_project_id from public.profiles where id = (select auth.uid())
$$;

-- The selected project, for the tools: no row when none is selected.
create function public.current_project()
returns table (label text, name text, icon text)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.label, p.name, p.icon
  from public.profiles u join public.projects p on p.id = u.selected_project_id
  where u.id = (select auth.uid())
$$;

-- True when p is one of the user's own projects (null is not).
create or replace function public.owns_project(p uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (select 1 from public.projects where id = p and profile_id = (select auth.uid()))
$$;

-- Selects one project by label. An unknown label changes nothing.
create function public.select_project(p_label text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.projects
  where label = lower(trim(p_label)) and profile_id = (select auth.uid());
  if v_id is null then
    raise exception 'Project not found: %', p_label;
  end if;
  update public.profiles set selected_project_id = v_id where id = (select auth.uid());
end;
$$;

-- Item counts per project for the signed-in user, whatever is selected. Definer so the counts are not cut
-- by the selection; every row is filtered by auth.uid().
create function public.project_summary()
returns table (label text, name text, icon text, selected boolean, todos bigint, sheets bigint, docs bigint, slides bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select p.label, p.name, p.icon, p.id is not distinct from u.selected_project_id,
    (select count(*) from public.todos x where x.project_id = p.id),
    (select count(*) from public.sheets x where x.project_id = p.id),
    (select count(*) from public.docs x where x.project_id = p.id),
    (select count(*) from public.slides x where x.project_id = p.id)
  from public.projects p join public.profiles u on u.id = p.profile_id
  where p.profile_id = (select auth.uid())
  order by p.label_no
$$;

revoke execute on function public.current_project() from public, anon;
revoke execute on function public.select_project(text) from public, anon;
revoke execute on function public.project_summary() from public, anon;
grant execute on function public.current_project() to authenticated;
grant execute on function public.select_project(text) to authenticated;
grant execute on function public.project_summary() to authenticated;

-- The selection must be one of the user's own projects, also through the Data API.
drop policy "Own profile: update" on public.profiles;
create policy "Own profile: update" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id and (selected_project_id is null or public.owns_project(selected_project_id)));

-- 4. Items always belong to a project: a project with items cannot be deleted.
do $$
declare
  t text;
begin
  foreach t in array array['todos', 'sheets', 'docs', 'slides'] loop
    execute format('alter table public.%I drop constraint %I', t, t || '_project_id_fkey');
    execute format(
      'alter table public.%I add constraint %I foreign key (project_id) references public.projects (id) on delete restrict',
      t, t || '_project_id_fkey'
    );
  end loop;
end;
$$;

-- 5. Rows without a project go to a per-user "Unsorted (from v1)" project, made only where needed.
do $$
declare
  u record;
  t text;
  v_unsorted uuid;
  v_rest integer;
begin
  for u in select id from public.profiles order by email loop
    select (select count(*) from public.todos where profile_id = u.id and project_id is null)
      + (select count(*) from public.sheets where profile_id = u.id and project_id is null)
      + (select count(*) from public.docs where profile_id = u.id and project_id is null)
      + (select count(*) from public.slides where profile_id = u.id and project_id is null)
      into v_rest;
    continue when v_rest = 0;
    insert into public.projects (name, icon, context, profile_id)
      values ('Unsorted (from v1)', '📥', 'Items from before projects existed.', u.id)
      returning id into v_unsorted;
    foreach t in array array['todos', 'sheets', 'docs', 'slides'] loop
      execute format('update public.%I set project_id = $2 where profile_id = $1 and project_id is null', t)
        using u.id, v_unsorted;
    end loop;
  end loop;
end;
$$;

-- 6. Required from here; the default (the selected project) stays from 20261022120000.
-- RLS: own rows in the selected project only; writes go to one of the user's own projects.
do $$
declare
  t text;
  v_see text := '(select auth.uid()) = profile_id and project_id = (select public.current_project_id())';
  v_write text := '(select auth.uid()) = profile_id and public.owns_project(project_id)';
begin
  foreach t in array array['todos', 'sheets', 'docs', 'slides'] loop
    execute format('alter table public.%I alter column project_id set not null', t);
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
