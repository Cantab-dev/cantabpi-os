create function public.append_context(p_label text, p_text text)
returns void
language plpgsql
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

revoke execute on function public.append_context(text, text) from public, anon, authenticated;
