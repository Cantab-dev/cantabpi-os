-- In-chat views, step 1 (docs/chat-ux-status.md §1): categories, importance, action.

-- Categories: shared reference data, read-only for signed-in users; changed only by migration.
create table public.categories (
  id integer primary key,
  label text not null unique,
  name text not null,
  icon text not null
);

insert into public.categories (id, label, name, icon) values
  (1, 'sales', 'Sales', '📈'),
  (2, 'finance', 'Finance', '💰'),
  (3, 'product', 'Product', '💡'),
  (4, 'legal', 'Legal', '⚖️'),
  (5, 'admin', 'Admin', '⚙️'),
  (6, 'personal', 'Personal', '👤'),
  (7, 'investor', 'Investor', '🏦'),
  (8, 'client', 'Client', '💼'),
  (9, 'partner', 'Partner', '🤝'),
  (10, 'advisor', 'Advisor', '🎓');

alter table public.categories enable row level security;
revoke all on table public.categories from anon, authenticated;
grant select on table public.categories to authenticated;
create policy "Read categories" on public.categories for select to authenticated using (true);

-- category_id, importance and action on the five record tables. Todos already have importance.
do $$
declare
  t text;
begin
  foreach t in array array['todos', 'leads', 'sheets', 'docs', 'slides'] loop
    execute format('alter table public.%I add column category_id integer references public.categories(id)', t);
    execute format('create index %I on public.%I (category_id)', t || '_category_id_idx', t);
    execute format('alter table public.%I add column action text', t);
    if t <> 'todos' then
      execute format('alter table public.%I add column importance smallint check (importance between 1 and 3)', t);
    end if;
  end loop;
end;
$$;

-- Todos: free-text category -> category_id by label, then drop the text column.
-- Checked live on 2026-10-15: every non-empty value matches a label, so nothing is lost.
update public.todos t
set category_id = c.id
from public.categories c
where lower(trim(t.category)) = c.label;

do $$
declare
  v_lost integer;
begin
  select count(*) into v_lost from public.todos
  where nullif(trim(category), '') is not null and category_id is null;
  if v_lost > 0 then
    raise exception '% todo(s) have a category that matches no label; map them before dropping the column', v_lost;
  end if;
end;
$$;

alter table public.todos drop column category;

-- An overwritten action is kept: the old value goes into context as a dated line.
create function public.keep_previous_action()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if nullif(old.action, '') is not null and new.action is distinct from old.action then
    new.context := concat_ws(
      E'\n',
      nullif(new.context, ''),
      to_char(now() at time zone 'utc', 'YYYY-MM-DD') || ': Previous action: ' || old.action
    );
  end if;
  return new;
end;
$$;

revoke execute on function public.keep_previous_action() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['todos', 'leads', 'sheets', 'docs', 'slides'] loop
    execute format(
      'create trigger keep_previous_action before update of action on public.%I '
        'for each row execute function public.keep_previous_action()',
      t
    );
  end loop;
end;
$$;
