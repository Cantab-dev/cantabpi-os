-- Label sequences: one per entity, numbers are never reused.
create sequence public.skill_label_seq;
create sequence public.todo_label_seq;
create sequence public.lead_label_seq;
create sequence public.sheet_label_seq;
create sequence public.doc_label_seq;
create sequence public.slide_label_seq;

create function public.next_label(entity text)
returns text
language plpgsql
set search_path = ''
as $$
begin
  if entity not in ('skill', 'todo', 'lead', 'sheet', 'doc', 'slide') then
    raise exception 'Unknown entity: %', entity;
  end if;
  return entity || ':' || nextval(format('public.%I', entity || '_label_seq')::regclass);
end;
$$;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  label text not null unique default public.next_label('skill'),
  description text,
  guideline text,
  owner_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.todos (
  id uuid primary key default gen_random_uuid(),
  label text not null unique default public.next_label('todo'),
  name text not null,
  category text,
  due date,
  importance smallint check (importance between 1 and 3),
  status boolean not null default false,
  context text,
  owner_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  label text not null unique default public.next_label('lead'),
  name text not null,
  full_name text,
  email text,
  url_linkedin text,
  context text,
  owner_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sheets (
  id uuid primary key default gen_random_uuid(),
  label text not null unique default public.next_label('sheet'),
  name text not null,
  url text,
  context text,
  owner_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.docs (
  id uuid primary key default gen_random_uuid(),
  label text not null unique default public.next_label('doc'),
  name text not null,
  url text,
  context text,
  owner_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.slides (
  id uuid primary key default gen_random_uuid(),
  label text not null unique default public.next_label('slide'),
  name text not null,
  url text,
  storage_url text,
  context text,
  owner_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.skills for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.todos for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.leads for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.sheets for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.docs for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.slides for each row execute function public.set_updated_at();

-- RLS on with no policies: closed to the public Data API, backend (service role) only.
alter table public.skills enable row level security;
alter table public.todos enable row level security;
alter table public.leads enable row level security;
alter table public.sheets enable row level security;
alter table public.docs enable row level security;
alter table public.slides enable row level security;

revoke execute on function public.next_label(text) from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
