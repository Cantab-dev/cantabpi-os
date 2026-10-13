-- Numeric part of the label, so lists can be ordered and paged by label number (todo:2 before todo:10).
alter table public.skills add column label_no integer generated always as (split_part(label, ':', 2)::integer) stored;
alter table public.todos add column label_no integer generated always as (split_part(label, ':', 2)::integer) stored;
alter table public.leads add column label_no integer generated always as (split_part(label, ':', 2)::integer) stored;
alter table public.sheets add column label_no integer generated always as (split_part(label, ':', 2)::integer) stored;
alter table public.docs add column label_no integer generated always as (split_part(label, ':', 2)::integer) stored;
alter table public.slides add column label_no integer generated always as (split_part(label, ':', 2)::integer) stored;

create index skills_label_no_idx on public.skills (label_no);
create index todos_label_no_idx on public.todos (label_no);
create index leads_label_no_idx on public.leads (label_no);
create index sheets_label_no_idx on public.sheets (label_no);
create index docs_label_no_idx on public.docs (label_no);
create index slides_label_no_idx on public.slides (label_no);
