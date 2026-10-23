# Cantab OS — A project is the engagement: plan and status

| Status | Version | Owner | Last updated |
| --- | --- | --- | --- |
| Current — built and tested; waiting for Nela's push | v0.5 | Nela | 2026-10-23 |

**What this is:** the plan to remove "engagement" from Cantab OS where the name and the structure are ours, and use
"project" instead. Asked by Nela on 2026-10-23: "remove engagement and completely replace it with project". Answers:
Nela, 2026-10-23 (§4); go the same day. **Built and tested (§5); not live** until the cut-over (step 5).

**Fixed by the package (build the spec as written; answer 3):** Siniša's package keeps its own words. The table
`engagement` in `_schema.json`, the agent `engagement_starter`, the view "Engagement home", the tool verbs (`contract`,
`query`, `write`, `log`, `reset`), `vendor/bpag/` and the validator do not change. The pages say "engagement" because the
package does.

## 1. Why

- **Two names for one thing.** `projects.name` and the package's `engagement.name` can differ.
- **Our code says "engagement"** for what is the project's data: the schema `engagement`, `engagement_datasets`,
  `engagement_log`, the database functions, our files and the tool texts.
- **The empty page names a tool that no longer exists** (`engagement_reset`), which helped block Siniša.

## 2. Design

| Now | After |
|---|---|
| `public.engagement_datasets` (0 or 1 per project): `contract_version`, `global_version`, `table_versions` | **`project.versions`**, in the closed schema, pointing at `projects (id)`. Still 0 or 1 per project: the first `reset` creates it (answer 1) |
| Schema `engagement` with 27 tables, each pointing at `engagement_datasets` | **Schema `project`** with the same 27 tables (`project.engagement`, `project.people`, `project.tasks`, …), each pointing at `project.versions (project_id)` |
| `engagement.engagement` (one record `en-01`) with its own `name` | `project.engagement`; its `name` is kept equal to `projects.name` by the functions, both ways (one name; max 70, as the package) |
| `public.engagement_log` | `public.project_log` |
| Database functions `engagement_read`, `engagement_version`, `engagement_log_read`, `engagement_commit`, `engagement_replace`, `engagement_owns` | `project_read`, `project_version`, `project_log_read`, `project_commit`, `project_replace`, `project_owns` |
| A project without data: `status: 'empty'`; the page's message names `engagement_reset` | **Kept** (answer 1); the message names `reset` |
| Our code: `engagement.ts`, `engagement_pkg.ts`, `engagement_test.ts`, `build-engagement.mjs`, `gen-engagement-tables.mjs`, `engagement_tables_test.ts`, names and texts in `tools.ts`, `views.ts`, `index.ts`, `templates/bpag/runtime.js`, `templates/bpag/test/*` | Renamed to "project" (for example `project_data.ts`, `package.ts`, `gen-project-tables.mjs`); tool descriptions say "the selected project's data" |

**Rules that follow:**

- **The package's data stays out of `public`.** The schema `project` is not exposed to the Data API (as `engagement` is
  now: PGRST106), so the 27 tables and the versions change only through the functions, after the validator. Nothing
  moves onto `public.projects`: its "Own rows" policy lets a signed-in user update it from a browser, which would bypass
  the validator.
- **Projects start without data** (answer 1): `write_project` does not load any; `reset` loads the demo seed into the
  selected project or restores it. On `reset`, `en-01.name` is set to the project's name, not the seed's.
- **One name.** When `engagement_starter` changes `name` (package scope), the project is renamed. `edit` on a project's
  name changes `en-01.name` when the project has data.
- **Delete.** "Only empty projects can be deleted" counts todos, sheets, docs and slides only; the project's data goes
  with it.
- Migrations already applied are not edited: one new migration does the renames, the move and the drops. The generator
  writes future migrations against the new names.

## 3. Plan

| # | Step | Status |
|---|---|---|
| 1 | **Generator and migration**: schema `engagement` renamed to `project`, `engagement_datasets` to `project.versions`, `engagement_log` to `project_log` (data kept in place: the two projects with data, `project:10` and `project:11`); `en-01.name` set to the project's name; new functions; old functions dropped | Done: `supabase/migrations/20261023100000_project_data.sql`, from `node scripts/gen-project-tables.mjs <file> --rename` |
| 2 | **Function**: rename files and names; the name rule both ways; the `delete` rule; tool texts | Done: `project_data.ts`, `package.ts` (from `scripts/build-package.mjs`), server version 0.11.0. Name rule: a project name is at most 70 characters of one-line plain text in `lib.ts` and in the check `projects_name_package`; the record follows through the database (§2). Delete: already counted todos and files only; the data goes with the project (cascade) |
| 3 | **Pages**: `templates/bpag/runtime.js` calls the new names; the empty-state message names `reset`; `scripts/templates.mjs` rebuilds the eleven pages | Done: built into `templates/bpag/dist/`; not uploaded |
| 4 | **Tests**: PGlite (renames with equal counts and content, RLS, the closed schema, the name rule both ways, delete); unit tests; the package demo through `write` (steps 1–9 at 7–15, step 10 refused); dry run on live in a rolled-back transaction | Done (§5) |
| 5 | **Cut-over** (answer 2: a gap of minutes accepted). Nela: `npx supabase db push`. Claude, after Nela's go: deploy the function. Nela: `node scripts/templates.mjs --upload` (service key). Claude: `templates/bpag/test/live.mjs`, `smoke.sh`, the engagement checks as `claude@test.com`. Tool names do not change, so no reconnect | **Next: Nela's push** (§6) |
| 6 | **Docs**: this file, live-views-status, engagement-tables-status and engagement-tools-status (superseded line), data-structure-status, tools-status, Diagram_input §2, DECISIONS, HANDOFF, Document_Log | Done for the build; the live results after the cut-over |

Estimate about 4–5 h. Lovable is not touched: the page gets its calls from `runtime.js` inside the frame.

## 4. Answers (Nela, 2026-10-23)

1. **Data for every project:** no; keep as is. A project starts without data; `reset` loads the demo.
2. **Cut-over:** a gap of minutes between push, deploy and upload is accepted.
3. **The package's own words:** kept (option A); not renamed in the package and not in our copy.

## 5. Results

| Where | Result |
|---|---|
| Unit tests (`deno test -A` in `supabase/functions/mcp`) | 53/53, including the package demo through `write` and the new project-name rule |
| PGlite, `supabase/tests/project_data_test.ts` (the two engagement migrations with A's seed plus demo steps 1–9 and B's seed, then the new one) | 2 tests, 9 steps: every record and log entry kept, the engagement record named after the project, old schema, tables and functions gone; table list and version poll; reset reads back the seed exactly; demo steps 1–9 at 7–15, step 10 refused; the engagement starter renames the project and a project rename reaches the record; long, multi-line, markup and placeholder names refused; a project without data is empty and `reset` loads it; RLS (own rows only; every save, the versions and the record refused to the browser); deleting a project takes its data. The generator without `--rename` builds the same thing on an empty database |
| PGlite, the old `engagement_tables_test.ts` | 5/5 (unchanged; imports only) |
| Pages offline (`templates/bpag/test/check.mjs`) | 25/25, with the new empty-state text "This project has no data yet. Ask Claude to load the demo (reset)." |
| Dry run on live, rolled back (`npx supabase db query --linked -f`, the migration inside a block that raises at the end) | Before and after equal: 2 version rows (`project:10`, `project:11`, both at version 6), 216 time entries, 10 log entries; engagement names equal project names; old schema, tables and functions gone; a save through `project_commit` ok; a project rename reaches the record; as `claude@test.com` its data, as Siniša none; a browser save denied. Live checked unchanged afterwards |

Not renamed: the public storage bucket `engagement-assets`. The deck's address is stored in each project's `deck` record
and in the seed; renaming means a new bucket, a re-upload and an update of those records. Left as is unless Nela asks.

## 6. Cut-over (Nela's steps, in this order)

1. Nela: `npx supabase db push` (applies `20261023100000_project_data.sql`). From here the deployed function and the
   uploaded pages fail until steps 2 and 3.
2. Claude, on Nela's go: deploy the function (v0.11.0), push git, tag `v0.11.0`.
3. Nela: `node scripts/templates.mjs --upload` (needs `CANTAB_SERVICE_KEY` in `.env.local`).
4. Claude: `templates/bpag/test/live.mjs`, `scripts/smoke.sh`, the tools as `claude@test.com`; results here.

**Changelog** (rationale in DECISIONS.md; file history in git)
- v0.5 (2026-10-23) — Built and tested on Nela's go: migration, function v0.11.0, pages, tests; dry run on live passed.
  Waiting for Nela's push. → DECISIONS.md 2026-10-23
- v0.4 (2026-10-23) — Nela's answers: projects start without data (empty state kept, message fixed), cut-over gap
  accepted, package words kept. Estimate 4–5 h.
- v0.3 (2026-10-23) — Corrected: the engagement record and the versions stay in the closed schema `project`, not on
  `public.projects` (its "Own rows" policy would let a browser bypass the validator). Asked by Nela.
- v0.2 (2026-10-23) — Rewritten for "completely replace with project": schema, log, functions and our code renamed; the
  package's own words kept. Three questions.
- v0.1 (2026-10-23) — Plan drafted after the live check of Siniša's projects; three questions for Nela.
