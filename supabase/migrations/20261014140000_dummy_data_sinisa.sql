-- Dummy data for Siniša, so he can test claude.ai as himself: a copy of claude@test.com's dummy rows,
-- notes included, owned by sinisa@cantabpi.com. Skipped if either user doesn't exist.
do $$
declare
  v_claude uuid := (select id from public.profiles where email = 'claude@test.com');
  v_sinisa uuid := (select id from public.profiles where email = 'sinisa@cantabpi.com');
begin
  if v_claude is null or v_sinisa is null then
    return;
  end if;

  insert into public.skills (description, guideline, profile_id)
    select description, guideline, v_sinisa from public.skills
    where profile_id = v_claude and description like 'Dummy - %' order by label_no;
  insert into public.todos (name, category, due, importance, status, context, profile_id)
    select name, category, due, importance, status, context, v_sinisa from public.todos
    where profile_id = v_claude and name like 'Dummy - %' order by label_no;
  insert into public.leads (name, full_name, email, url_linkedin, context, profile_id)
    select name, full_name, email, url_linkedin, context, v_sinisa from public.leads
    where profile_id = v_claude and name like 'Dummy - %' order by label_no;
  insert into public.sheets (name, url, context, profile_id)
    select name, url, context, v_sinisa from public.sheets
    where profile_id = v_claude and name like 'Dummy - %' order by label_no;
  insert into public.docs (name, url, context, profile_id)
    select name, url, context, v_sinisa from public.docs
    where profile_id = v_claude and name like 'Dummy - %' order by label_no;
  insert into public.slides (name, url, storage_url, context, profile_id)
    select name, url, storage_url, context, v_sinisa from public.slides
    where profile_id = v_claude and name like 'Dummy - %' order by label_no;
end;
$$;
