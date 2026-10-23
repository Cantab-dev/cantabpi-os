// Creates the demo project for one user and loads Siniša's Big Pharma AG seed into it, or reloads it: the demo is set
// up from Claude Code, not from the chat (docs/archive/project-engagement-status.md). The seed is the one the MCP function
// uses (supabase/functions/mcp/package.ts, built by scripts/build-package.mjs). Runs through the Supabase CLI's linked
// login (`npx supabase db query --linked`), so no key is read. Safe to rerun: the project is found by user and name.
//   node scripts/demo-project.mjs <email> [--name "Big Pharma AG"] [--select] [--sql <file>]
// --select also makes it the user's selected project. --sql writes the SQL to <file> and runs nothing.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(name)
  return i < 0 ? undefined : args.splice(i, 2)[1]
}
const name = flag('--name') ?? 'Big Pharma AG'
const sqlOut = flag('--sql')
const select = args.includes('--select')
const email = args.find((a) => !a.startsWith('--'))
if (!email || !/^[^@\s']+@[^@\s']+$/.test(email)) {
  throw new Error('usage: node scripts/demo-project.mjs <email> [--name "..."] [--select] [--sql <file>]')
}
if (name.length > 70 || /[\u0000-\u001F\u007F]/.test(name)) throw new Error('--name: at most 70 characters, one line')

const { SCHEMA, SEED } = await import(new URL('supabase/functions/mcp/package.ts', `file:///${root}/`).href)
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`
const json = (v) => {
  const s = JSON.stringify(v)
  if (s.includes('$seed$')) throw new Error('the seed contains the quote tag $seed$')
  return `$seed$${s}$seed$::jsonb`
}

const sql = `do $demo$
declare
  u uuid := (select id from public.profiles where email = ${lit(email)});
  p uuid;
begin
  if u is null then
    raise exception 'demo-project: no user with the email %', ${lit(email)};
  end if;
  select id into p from public.projects where profile_id = u and name = ${lit(name)} order by created_at limit 1;
  if p is null then
    insert into public.projects (profile_id, name, icon) values (u, ${lit(name)}, '💊') returning id into p;
  end if;
  perform public.project_replace(u, p, ${lit(SCHEMA.contract_version)}, ${json(SEED.version)}, ${json(SEED.tables)},
    ${json(SEED.log)});${select ? `
  update public.profiles set selected_project_id = p where id = u;` : ''}
end
$demo$;

select p.label, p.name, v.global_version as version, (u.selected_project_id = p.id) as selected
from public.projects p
join public.profiles u on u.id = p.profile_id
join project.versions v on v.project_id = p.id
where u.email = ${lit(email)} and p.name = ${lit(name)};
`

if (sqlOut) {
  writeFileSync(sqlOut, sql)
  console.log(`wrote ${sqlOut}`)
} else {
  const file = join(mkdtempSync(join(tmpdir(), 'demo-project-')), 'demo.sql')
  writeFileSync(file, sql)
  const res = spawnSync(`npx supabase db query --linked -f "${file}"`, { cwd: root, shell: true, encoding: 'utf8' })
  const out = `${res.stdout ?? ''}${res.stderr ?? ''}`
  const rows = out.match(/"rows":\s*(\[[\s\S]*?\])/)
  if (res.status !== 0 || !rows) {
    console.error(out.split('\n').filter((l) => !l.includes('Initialising')).join('\n').slice(0, 2000))
    process.exit(1)
  }
  console.log(`demo project for ${email}: ${rows[1].replace(/\s+/g, ' ')}`)
}
