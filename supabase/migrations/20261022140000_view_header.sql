-- View header (docs/live-views-status.md §7.2, §7.6): the ten header views, settings kept per view inside a slot,
-- the icon click, the project on each slot, and the slot in view. The page keeps working unchanged: agent_params and
-- ui_params stay the current view's settings; state holds the settings of the views switched away from.

-- 1. Template keys: the eight agent views, two dummies, and the POC's pdf and dashboard (Claude only, Q5).
alter table public.ui_views drop constraint ui_views_template_check;
alter table public.ui_views add constraint ui_views_template_check check (template in (
  'workflow_mapper', 'research_analyst', 'value_case_calculator', 'gxp_ai_act_checker', 'presentation_builder',
  'project_manager', 'engagement_memory', 'red_team_reviewer', 'dummy_9', 'dummy_10', 'pdf', 'dashboard'
));

-- 2. Settings per view (Q4): { "<template>": { "agent": {…}, "ui": {…} } } for the views not shown now.
alter table public.ui_views
  add column state jsonb not null default '{}' check (jsonb_typeof(state) = 'object'),
-- 4. The project on each slot (Q3): the selected project when Claude or the user last changed the view.
  add column project_id uuid references public.projects (id) on delete set null;

update public.ui_views v set project_id = p.selected_project_id
from public.profiles p where p.id = v.profile_id;

-- 5. The slot in view (§7.6): on profiles, because an empty slot has no row.
alter table public.profiles
  add column current_slot smallint check (current_slot between 1 and 10),
  add column current_slot_at timestamptz;

-- The header views; none takes parameters yet.
create function public.view_header_templates()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['workflow_mapper', 'research_analyst', 'value_case_calculator', 'gxp_ai_act_checker',
    'presentation_builder', 'project_manager', 'engagement_memory', 'red_team_reviewer', 'dummy_9', 'dummy_10']
$$;

create or replace function public.view_check(p_template text, p_agent jsonb, p_ui jsonb)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_filters jsonb;
begin
  if p_template = any (public.view_header_templates()) then
    if p_agent <> '{}' or p_ui <> '{}' then
      raise exception 'invalid_parameter: % takes no parameters yet', p_template;
    end if;
  elsif p_template = 'pdf' then
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
    raise exception 'invalid_parameter: template must be one of %, pdf or dashboard',
      array_to_string(public.view_header_templates(), ', ');
  end if;
end;
$$;

-- Same fields as before, plus the slot's project.
create or replace function public.view_json(v public.ui_views)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', v.id, 'slot', v.slot_no, 'template', v.template, 'agent_params', v.agent_params, 'ui_params', v.ui_params,
    'version', v.version, 'last_writer', v.last_writer, 'last_active_at', v.last_active_at, 'project_id', v.project_id
  )
$$;

-- The page reports the slot in front of the user: on load, when the tab becomes visible, on window focus.
create function public.view_seen(p_slot integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_slot is null or p_slot not between 1 and 10 then
    raise exception 'invalid_parameter: slot must be from 1 to 10';
  end if;
  update public.profiles set current_slot = p_slot, current_slot_at = now() where id = auth.uid();
  return jsonb_build_object('status', 'ok', 'slot', p_slot);
end;
$$;

-- The icon click: switch this slot to a header view. The settings of the view left are kept in state, and the
-- new view's saved settings come back. Compare-and-set on version like view_update; on an empty slot pass null.
create function public.view_set_template(p_slot integer, p_expected_version integer, p_template text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v public.ui_views;
  v_state jsonb;
  v_agent jsonb;
  v_ui jsonb;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  if p_slot is null or p_slot not between 1 and 10 then
    raise exception 'invalid_parameter: slot must be from 1 to 10';
  end if;
  if p_template is null or not (p_template = any (public.view_header_templates())) then
    raise exception 'invalid_parameter: template must be one of %', array_to_string(public.view_header_templates(), ', ');
  end if;

  select * into v from public.ui_views where profile_id = v_uid and slot_no = p_slot for update;
  if not found then
    if p_expected_version is not null then
      return jsonb_build_object('status', 'gone', 'slot', p_slot);
    end if;
    insert into public.ui_views (profile_id, slot_no, template, last_writer, project_id)
    values (v_uid, p_slot, p_template, 'user', public.current_project_id())
    on conflict (profile_id, slot_no) do nothing
    returning * into v;
    if not found then
      select * into v from public.ui_views where profile_id = v_uid and slot_no = p_slot;
      return jsonb_build_object('status', 'conflict', 'view', public.view_json(v));
    end if;
    return jsonb_build_object('status', 'ok', 'view', public.view_json(v));
  end if;

  if p_expected_version is null or v.version <> p_expected_version then
    return jsonb_build_object('status', 'conflict', 'view', public.view_json(v));
  end if;
  if v.template = p_template then
    return jsonb_build_object('status', 'ok', 'view', public.view_json(v));
  end if;

  v_state := v.state || jsonb_build_object(v.template, jsonb_build_object('agent', v.agent_params, 'ui', v.ui_params));
  v_agent := coalesce(v_state -> p_template -> 'agent', '{}');
  v_ui := coalesce(v_state -> p_template -> 'ui', '{}');
  update public.ui_views
  set template = p_template, agent_params = v_agent, ui_params = v_ui, state = v_state - p_template,
    version = version + 1, last_writer = 'user', last_active_at = now(), project_id = public.current_project_id()
  where id = v.id
  returning * into v;
  return jsonb_build_object('status', 'ok', 'view', public.view_json(v));
end;
$$;

-- Agent writes. Slot (§7.6): the one given; else the slot in view; else 1. A different view replaces what is shown
-- and keeps its settings in state. p_focus is UI state to open at (pdf page): merged when the slot already shows the
-- same thing, otherwise it replaces the UI state. Returns whether the slot was the one in view and seen lately.
create or replace function public.view_agent_apply(
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
  v_seen_at timestamptz;
  v public.ui_views;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  perform public.view_check(p_template, p_agent_params, coalesce(p_focus, '{}'));

  if v_slot is not null and v_slot not between 1 and 10 then
    raise exception 'invalid_parameter: slot must be from 1 to 10';
  end if;
  select current_slot, current_slot_at into v_slot, v_seen_at from public.profiles where id = v_uid
    and p_slot is null;
  v_slot := coalesce(p_slot, v_slot, 1);

  insert into public.ui_views as u (profile_id, slot_no, template, agent_params, ui_params, last_writer, project_id)
  values (v_uid, v_slot, p_template, p_agent_params, coalesce(p_focus, '{}'), 'agent', public.current_project_id())
  on conflict (profile_id, slot_no) do update set
    template = excluded.template,
    agent_params = excluded.agent_params,
    ui_params = case
      when u.template = excluded.template and u.agent_params -> 'slide_id' is not distinct from excluded.agent_params -> 'slide_id'
        then u.ui_params || excluded.ui_params
      else excluded.ui_params
    end,
    state = case
      when u.template = excluded.template then u.state
      else (u.state || jsonb_build_object(u.template, jsonb_build_object('agent', u.agent_params, 'ui', u.ui_params)))
        - excluded.template
    end,
    version = u.version + 1,
    last_writer = 'agent',
    last_active_at = now(),
    project_id = excluded.project_id
  returning * into v;
  return jsonb_build_object(
    'status', 'ok', 'view', public.view_json(v),
    'in_view', p_slot is null and v_seen_at is not null,
    'seen_lately', coalesce(v_seen_at > now() - interval '30 minutes', false)
  );
end;
$$;

revoke execute on function public.view_header_templates() from public, anon;
revoke execute on function public.view_seen(integer) from public, anon;
revoke execute on function public.view_set_template(integer, integer, text) from public, anon;
grant execute on function public.view_header_templates() to authenticated;
grant execute on function public.view_seen(integer) to authenticated;
grant execute on function public.view_set_template(integer, integer, text) to authenticated;
