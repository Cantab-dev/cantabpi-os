-- Live views (docs/live-views-status.md): the returned view carries its row id, so a page that loaded a view with
-- view_open can match a later delete event, which carries only the old id (COMMS 2026-10-21).
-- The MCP view tool never passes this id to the model: it returns slot, url and a message only.
create or replace function public.view_json(v public.ui_views)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', v.id, 'slot', v.slot_no, 'template', v.template, 'agent_params', v.agent_params, 'ui_params', v.ui_params,
    'version', v.version, 'last_writer', v.last_writer, 'last_active_at', v.last_active_at
  )
$$;
