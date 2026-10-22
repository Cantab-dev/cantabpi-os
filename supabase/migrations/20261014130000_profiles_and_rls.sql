-- Sign-in and access (docs/sign-in-status.md): profiles, owner column renamed profile_id, RLS per user.
-- Lands together with function v0.4.0: v0.3.0 stops working once owner_id is renamed.

-- Profiles: one row per Supabase Auth user.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.profiles for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
revoke all on table public.profiles from anon;
revoke truncate, references, trigger, insert, delete on table public.profiles from authenticated;
create policy "Own profile: read" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "Own profile: update" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

insert into public.profiles (id, email) select id, email from auth.users on conflict (id) do nothing;

-- Owner column: owner_id -> profile_id, required, defaults to the signed-in user, one policy per table.
do $$
declare
  t text;
begin
  foreach t in array array['skills', 'todos', 'leads', 'sheets', 'docs', 'slides'] loop
    execute format('alter table public.%I rename column owner_id to profile_id', t);
    execute format('alter table public.%I drop constraint %I', t, t || '_owner_id_fkey');
    execute format(
      'alter table public.%I add constraint %I foreign key (profile_id) references public.profiles (id) on delete cascade',
      t, t || '_profile_id_fkey'
    );
    execute format('alter table public.%I alter column profile_id set default auth.uid(), alter column profile_id set not null', t);
    execute format('create index %I on public.%I (profile_id)', t || '_profile_id_idx', t);
    execute format('revoke all on table public.%I from anon', t);
    -- TRUNCATE ignores RLS; signed-in users get rows through policies only.
    execute format('revoke truncate, references, trigger on table public.%I from authenticated', t);
    execute format(
      'create policy "Own rows" on public.%I for all to authenticated '
        'using ((select auth.uid()) = profile_id) with check ((select auth.uid()) = profile_id)',
      t
    );
  end loop;
end;
$$;

-- Labels: a signed-in user's insert takes the next label without direct access to the sequences.
alter function public.next_label(text) security definer;
grant execute on function public.next_label(text) to authenticated;

-- Notes run as the caller, so RLS decides which rows note can touch.
drop function public.append_context(text, text, uuid);

create function public.append_context(p_label text, p_text text)
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

revoke execute on function public.append_context(text, text) from public, anon;
grant execute on function public.append_context(text, text) to authenticated;
