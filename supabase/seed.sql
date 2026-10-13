-- Dummy data. Every row is marked with the prefix 'Dummy - ' in name (description for skills).
-- Remove with: delete from <table> where name like 'Dummy - %';  (skills: description like 'Dummy - %')

insert into public.skills (description, guideline) values
  ('Dummy - Weekly review', 'List open todos, flag overdue ones, ask which to reschedule.'),
  ('Dummy - New lead intake', 'Create the lead, add a note on where it came from, create a follow-up todo.');

insert into public.todos (name, category, due, importance, status) values
  ('Dummy - Send proposal to Acme', 'sales', current_date + 2, 3, false),
  ('Dummy - Book dentist', 'personal', current_date + 10, 1, false),
  ('Dummy - Review Q3 budget sheet', 'finance', current_date - 1, 2, false),
  ('Dummy - Renew domain', 'admin', current_date - 5, 2, true);

insert into public.leads (name, full_name, email, url_linkedin) values
  ('Dummy - Ada', 'Ada Example', 'ada@example.com', 'https://www.linkedin.com/in/example-ada'),
  ('Dummy - Ben', 'Ben Placeholder', 'ben@example.com', 'https://www.linkedin.com/in/example-ben'),
  ('Dummy - Cleo', 'Cleo Sample', 'cleo@example.com', null);

insert into public.sheets (name, url) values
  ('Dummy - Q3 budget', 'https://docs.google.com/spreadsheets/d/EXAMPLE_SHEET_1'),
  ('Dummy - Pipeline tracker', 'https://docs.google.com/spreadsheets/d/EXAMPLE_SHEET_2');

insert into public.docs (name, url) values
  ('Dummy - Acme proposal', 'https://docs.google.com/document/d/EXAMPLE_DOC_1'),
  ('Dummy - Meeting notes', 'https://docs.google.com/document/d/EXAMPLE_DOC_2');

insert into public.slides (name, url, storage_url) values
  ('Dummy - Company intro deck', 'https://docs.google.com/presentation/d/EXAMPLE_SLIDE_1', null),
  ('Dummy - Acme pitch', 'https://docs.google.com/presentation/d/EXAMPLE_SLIDE_2', null);

select public.append_context('todo:1', 'Dummy note: client asked for a revised price.');
select public.append_context('lead:1', 'Dummy note: met at a conference.');
