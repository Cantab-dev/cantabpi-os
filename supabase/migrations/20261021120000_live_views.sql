-- Live views POC (docs/live-views-status.md §2): view slots, the dummy sales table and its dashboard query,
-- the private bucket for slide PDFs, and realtime. Additive only.

-- 2.1 Slots: one row per view in use; deleting the row clears the slot. Writes only through the functions below.
create table public.ui_views (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  slot_no smallint not null check (slot_no between 1 and 10),
  template text not null check (template in ('pdf', 'dashboard')),
  agent_params jsonb not null default '{}' check (jsonb_typeof(agent_params) = 'object'),
  ui_params jsonb not null default '{}' check (jsonb_typeof(ui_params) = 'object'),
  version integer not null default 1,
  last_writer text not null default 'user' check (last_writer in ('user', 'agent')),
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, slot_no)
);

create trigger set_updated_at before update on public.ui_views for each row execute function public.set_updated_at();

alter table public.ui_views enable row level security;
revoke all on table public.ui_views from anon, authenticated;
grant select on table public.ui_views to authenticated;
create policy "Own views: read" on public.ui_views
  for select to authenticated using ((select auth.uid()) = profile_id);

-- Checks a slot's parameters against its template; raises 'invalid_parameter: …'. Runs as definer, so it
-- checks the slide's owner itself.
create function public.view_check(p_template text, p_agent jsonb, p_ui jsonb)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_filters jsonb;
begin
  if p_template = 'pdf' then
    if exists (select 1 from jsonb_object_keys(p_agent) k where k <> 'slide_id')
       or exists (select 1 from jsonb_object_keys(p_ui) k where k <> 'page') then
      raise exception 'invalid_parameter: pdf takes slide_id, and page as UI state';
    end if;
    -- case, not or: SQL does not promise to stop early, and a bad value must not reach the cast.
    if not (case
      when jsonb_typeof(p_agent -> 'slide_id') = 'string'
           and (p_agent ->> 'slide_id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then exists (
          select 1 from public.slides s
          where s.id = (p_agent ->> 'slide_id')::uuid and s.profile_id = auth.uid() and s.storage_url is not null
        )
      else false
    end) then
      raise exception 'invalid_parameter: slide_id is not one of your slides with a PDF';
    end if;
    if p_ui ? 'page' and not (case
      when jsonb_typeof(p_ui -> 'page') = 'number'
        then (p_ui ->> 'page')::numeric % 1 = 0 and (p_ui ->> 'page')::numeric between 1 and 10000
      else false
    end) then
      raise exception 'invalid_parameter: page must be a whole number from 1';
    end if;
  elsif p_template = 'dashboard' then
    if exists (select 1 from jsonb_object_keys(p_agent) k where k not in ('dashboard', 'filters'))
       or exists (select 1 from jsonb_object_keys(p_ui) k where k <> 'expanded_panels') then
      raise exception 'invalid_parameter: dashboard takes dashboard and filters, and expanded_panels as UI state';
    end if;
    if (p_agent ->> 'dashboard') is distinct from 'sales_overview' then
      raise exception 'invalid_parameter: dashboard must be sales_overview';
    end if;
    v_filters := coalesce(p_agent -> 'filters', '{}');
    if jsonb_typeof(v_filters) <> 'object'
       or exists (select 1 from jsonb_object_keys(v_filters) k where k not in ('period', 'region'))
       or (v_filters ? 'period' and (v_filters ->> 'period') not in ('7d', '30d', 'qtd', 'ytd'))
       or (v_filters ? 'region' and (v_filters ->> 'region') not in ('emea', 'amer', 'apac')) then
      raise exception 'invalid_parameter: filters take period (7d, 30d, qtd, ytd) and region (emea, amer, apac)';
    end if;
    if p_ui ? 'expanded_panels' and jsonb_typeof(p_ui -> 'expanded_panels') <> 'array' then
      raise exception 'invalid_parameter: expanded_panels must be a list';
    end if;
  else
    raise exception 'invalid_parameter: template must be pdf or dashboard';
  end if;
end;
$$;

-- The fields a slot is returned with, for the page and the tool.
create function public.view_json(v public.ui_views)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'slot', v.slot_no, 'template', v.template, 'agent_params', v.agent_params, 'ui_params', v.ui_params,
    'version', v.version, 'last_writer', v.last_writer, 'last_active_at', v.last_active_at
  )
$$;

create function public.views_list()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(public.view_json(v) order by v.slot_no), '[]')
  from public.ui_views v where v.profile_id = auth.uid()
$$;

-- Page load: the slot, or 'empty'. Marks it active, which steers the agent's slot choice.
create function public.view_open(p_slot integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.ui_views;
begin
  update public.ui_views set last_active_at = now()
  where profile_id = auth.uid() and slot_no = p_slot
  returning * into v;
  if not found then
    return jsonb_build_object('status', 'empty', 'slot', p_slot);
  end if;
  return jsonb_build_object('status', 'ok', 'view', public.view_json(v));
end;
$$;

-- Page writes: shallow merge with compare-and-set on version. A null value removes the key.
create function public.view_update(
  p_slot integer, p_expected_version integer, p_agent_patch jsonb default null, p_ui_patch jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.ui_views;
  v_agent jsonb;
  v_ui jsonb;
begin
  select * into v from public.ui_views where profile_id = auth.uid() and slot_no = p_slot for update;
  if not found then
    return jsonb_build_object('status', 'gone', 'slot', p_slot);
  end if;
  if v.version <> p_expected_version then
    return jsonb_build_object('status', 'conflict', 'view', public.view_json(v));
  end if;
  v_agent := jsonb_strip_nulls(v.agent_params || coalesce(p_agent_patch, '{}'));
  v_ui := jsonb_strip_nulls(v.ui_params || coalesce(p_ui_patch, '{}'));
  perform public.view_check(v.template, v_agent, v_ui);
  update public.ui_views
  set agent_params = v_agent, ui_params = v_ui, version = version + 1, last_writer = 'user', last_active_at = now()
  where id = v.id
  returning * into v;
  return jsonb_build_object('status', 'ok', 'view', public.view_json(v));
end;
$$;

-- Agent writes, called by the MCP function as the signed-in user. Slot: the one given; else the most recently
-- active slot with the same template; else the lowest free one; else 'slot_limit' with the list.
-- The agent sets what is shown (agent_params replaced). p_focus is UI state to open at (pdf page): merged when the
-- slot already shows the same thing, otherwise it replaces the UI state.
create function public.view_agent_apply(
  p_template text, p_agent_params jsonb, p_focus jsonb default '{}', p_slot integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_slot integer := p_slot;
  v public.ui_views;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  perform public.view_check(p_template, p_agent_params, coalesce(p_focus, '{}'));

  if v_slot is not null and v_slot not between 1 and 10 then
    raise exception 'invalid_parameter: slot must be from 1 to 10';
  end if;
  if v_slot is null then
    select slot_no into v_slot from public.ui_views
    where profile_id = v_uid and template = p_template
    order by last_active_at desc limit 1;
  end if;
  if v_slot is null then
    select min(n) into v_slot from generate_series(1, 10) n
    where not exists (select 1 from public.ui_views where profile_id = v_uid and slot_no = n);
  end if;
  if v_slot is null then
    return jsonb_build_object('status', 'slot_limit', 'views', public.views_list());
  end if;

  insert into public.ui_views as u (profile_id, slot_no, template, agent_params, ui_params, last_writer)
  values (v_uid, v_slot, p_template, p_agent_params, coalesce(p_focus, '{}'), 'agent')
  on conflict (profile_id, slot_no) do update set
    template = excluded.template,
    agent_params = excluded.agent_params,
    ui_params = case
      when u.template = excluded.template and u.agent_params -> 'slide_id' is not distinct from excluded.agent_params -> 'slide_id'
        then u.ui_params || excluded.ui_params
      else excluded.ui_params
    end,
    version = u.version + 1,
    last_writer = 'agent',
    last_active_at = now()
  returning * into v;
  return jsonb_build_object('status', 'ok', 'view', public.view_json(v));
end;
$$;

create function public.view_close(p_slot integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.ui_views where profile_id = auth.uid() and slot_no = p_slot;
  return jsonb_build_object('status', case when found then 'ok' else 'gone' end, 'slot', p_slot);
end;
$$;

revoke execute on function public.view_check(text, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.view_json(public.ui_views) from public, anon;
revoke execute on function public.views_list() from public, anon;
revoke execute on function public.view_open(integer) from public, anon;
revoke execute on function public.view_update(integer, integer, jsonb, jsonb) from public, anon;
revoke execute on function public.view_agent_apply(text, jsonb, jsonb, integer) from public, anon;
revoke execute on function public.view_close(integer) from public, anon;
grant execute on function public.views_list() to authenticated;
grant execute on function public.view_open(integer) to authenticated;
grant execute on function public.view_update(integer, integer, jsonb, jsonb) to authenticated;
grant execute on function public.view_agent_apply(text, jsonb, jsonb, integer) to authenticated;
grant execute on function public.view_close(integer) to authenticated;

-- 2.3 Dummy sales for the sales_overview dashboard. Not an OS entity: no labels, no list or get.
create table public.demo_sales (
  id bigint generated always as identity primary key,
  profile_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  sold_on date not null,
  region text not null check (region in ('emea', 'amer', 'apac')),
  product text not null check (product in ('Atlas', 'Beacon', 'Compass', 'Delta')),
  amount numeric(12, 2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

create index demo_sales_profile_sold_on_idx on public.demo_sales (profile_id, sold_on);

alter table public.demo_sales enable row level security;
revoke all on table public.demo_sales from anon;
revoke truncate, references, trigger on table public.demo_sales from authenticated;
create policy "Own rows" on public.demo_sales for all to authenticated
  using ((select auth.uid()) = profile_id) with check ((select auth.uid()) = profile_id);

-- Seed: for every user, 0–2 sales a day over the 200 days up to today, chosen by a hash so reruns match.
insert into public.demo_sales (profile_id, sold_on, region, product, amount)
select p.id,
       current_date - d,
       (array['emea', 'amer', 'apac'])[1 + abs(hashtext(p.id::text || d || n || 'r')) % 3],
       (array['Atlas', 'Beacon', 'Compass', 'Delta'])[1 + abs(hashtext(p.id::text || d || n || 'p')) % 4],
       500 + abs(hashtext(p.id::text || d || n || 'a')) % 9500
from public.profiles p
cross join generate_series(0, 199) d
cross join generate_series(1, 2) n
where abs(hashtext(p.id::text || d || n)) % 3 <> 0;

-- The dashboard's one named query. Runs as the caller, so RLS limits it to their sales.
create function public.dashboard_sales_overview(p_period text default '30d', p_region text default null)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_from date;
  v_result jsonb;
begin
  v_from := case p_period
    when '7d' then current_date - 6
    when '30d' then current_date - 29
    when 'qtd' then date_trunc('quarter', current_date)::date
    when 'ytd' then date_trunc('year', current_date)::date
  end;
  if v_from is null then
    raise exception 'invalid_parameter: period must be 7d, 30d, qtd or ytd';
  end if;
  if p_region is not null and p_region not in ('emea', 'amer', 'apac') then
    raise exception 'invalid_parameter: region must be emea, amer or apac';
  end if;

  with s as (
    select * from public.demo_sales
    where sold_on between v_from and current_date and (p_region is null or region = p_region)
  )
  select jsonb_build_object(
    'period', p_period,
    'region', p_region,
    'from', v_from,
    'to', current_date,
    'tiles', (select jsonb_build_object(
      'revenue', coalesce(sum(amount), 0),
      'deals', count(*),
      'avg_deal', coalesce(round(avg(amount), 2), 0)
    ) from s),
    'by_week', (select coalesce(jsonb_agg(jsonb_build_object('week', w, 'revenue', r) order by w), '[]') from (
      select date_trunc('week', sold_on)::date w, sum(amount) r from s group by 1
    ) x),
    'breakdown', jsonb_build_object(
      'by', case when p_region is null then 'region' else 'product' end,
      'rows', (select coalesce(jsonb_agg(jsonb_build_object('key', k, 'revenue', r) order by r desc), '[]') from (
        select case when p_region is null then region else product end k, sum(amount) r from s group by 1
      ) y)
    )
  ) into v_result;
  return v_result;
end;
$$;

revoke execute on function public.dashboard_sales_overview(text, text) from public, anon;
grant execute on function public.dashboard_sales_overview(text, text) to authenticated;

-- 2.4 Private bucket for slide PDFs: <user id>/<slide label>.pdf; each user reads only their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('slide-pdfs', 'slide-pdfs', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

create policy "Slide PDFs: read own folder" on storage.objects
  for select to authenticated
  using (bucket_id = 'slide-pdfs' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 2.5 Realtime: a page follows its slot, the sales behind the dashboard, and the slide behind a PDF.
-- Postgres changes apply RLS to inserts and updates; deletes carry only the primary key.
alter publication supabase_realtime add table public.ui_views, public.demo_sales, public.slides;
