-- Dummy data per user: the unowned dummy rows go to claude@test.com (the acting user while testing),
-- and a copy of every one, notes included, is made for nela@cantabpi.com. A user that doesn't exist
-- is skipped, so this runs on a fresh local database too (where seed.sql runs afterwards).
do $$
declare
  v_claude uuid := (select id from auth.users where email = 'claude@test.com');
  v_nela uuid := (select id from auth.users where email = 'nela@cantabpi.com');
begin
  if v_claude is not null then
    update public.skills set owner_id = v_claude where owner_id is null and description like 'Dummy - %';
    update public.todos set owner_id = v_claude where owner_id is null and name like 'Dummy - %';
    update public.leads set owner_id = v_claude where owner_id is null and name like 'Dummy - %';
    update public.sheets set owner_id = v_claude where owner_id is null and name like 'Dummy - %';
    update public.docs set owner_id = v_claude where owner_id is null and name like 'Dummy - %';
    update public.slides set owner_id = v_claude where owner_id is null and name like 'Dummy - %';
  end if;

  if v_nela is not null then
    insert into public.skills (description, guideline, owner_id)
      select description, guideline, v_nela from public.skills
      where owner_id is not distinct from v_claude and description like 'Dummy - %' order by label_no;
    insert into public.todos (name, category, due, importance, status, context, owner_id)
      select name, category, due, importance, status, context, v_nela from public.todos
      where owner_id is not distinct from v_claude and name like 'Dummy - %' order by label_no;
    insert into public.leads (name, full_name, email, url_linkedin, context, owner_id)
      select name, full_name, email, url_linkedin, context, v_nela from public.leads
      where owner_id is not distinct from v_claude and name like 'Dummy - %' order by label_no;
    insert into public.sheets (name, url, context, owner_id)
      select name, url, context, v_nela from public.sheets
      where owner_id is not distinct from v_claude and name like 'Dummy - %' order by label_no;
    insert into public.docs (name, url, context, owner_id)
      select name, url, context, v_nela from public.docs
      where owner_id is not distinct from v_claude and name like 'Dummy - %' order by label_no;
    insert into public.slides (name, url, storage_url, context, owner_id)
      select name, url, storage_url, context, v_nela from public.slides
      where owner_id is not distinct from v_claude and name like 'Dummy - %' order by label_no;
  end if;
end;
$$;
