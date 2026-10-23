# Cantab OS — A project is the engagement: plan and status

| Status | Version | Owner | Last updated |
| --- | --- | --- | --- |
| Current — built and live | v0.6 | Nela | 2026-10-23 |

**What this is:** the record of removing "engagement" from Cantab OS where the name and the structure are ours, and
using "project" instead. Asked by Nela on 2026-10-23: "remove engagement and completely replace it with project".
Answers: Nela, 2026-10-23 (§4). **Live since 2026-10-23** (function v0.11.0, tag `v0.11.0`, migration
`20261023100000` pushed by Nela, pages uploaded by Nela); checked live (§5).

**Fixed by the package (build the spec as written; answer 3):** Siniša's package keeps its own words. The table
`engagement` in `_schema.json`, the agent `engagement_starter`, the view "Engagement home", the verbs `contract`,
`query`, `write`, `log`, `vendor/bpag/` and the validator do not change. The pages say "engagement" because the package
does. **One departure, by Nela (answer 4):** the package's `reset` verb is not a tool in the chat; the demo is set up
from Claude Code.

## 1. Why

- **Two names for one thing.** `projects.name` and the package's `engagement.name` could differ.
- **Our code said "engagement"** for what is the project's data: the schema `engagement`, `engagement_datasets`,
  `engagement_log`, the database functions, our files and the tool texts.
- **The empty page named a tool that no longer existed** (`engagement_reset`), which helped block Siniša.

## 2. Design (as built)

| Before | Now |
|---|---|
| `public.engagement_datasets` (0 or 1 per project): `contract_version`, `global_version`, `table_versions` | **`project.versions`**, in the closed schema, pointing at `projects (id)`. Still 0 or 1 per project: `scripts/demo-project.mjs` creates it (answers 1, 4) |
| Schema `engagement` with 27 tables, each pointing at `engagement_datasets` | **Schema `project`** with the same 27 tables (`project.engagement`, `project.people`, `project.tasks`, …), each pointing at `project.versions (project_id)` |
| `engagement.engagement` (one record `en-01`) with its own `name` | `project.engagement`; its `name` is kept equal to `projects.name`, both ways (one name; max 70, as the package) |
| `public.engagement_log` | `public.project_log` |
| Database functions `engagement_read`, `engagement_version`, `engagement_log_read`, `engagement_commit`, `engagement_replace`, `engagement_owns` | `project_read`, `project_version`, `project_log_read`, `project_commit`, `project_replace`, `project_owns` |
| A project without data: `status: 'empty'`; the page's message named `engagement_reset` | **Kept** (answer 1). The page says "This project has no data yet."; the tools tell Claude to select the project that holds the data and that the demo is set up outside the chat |
| The tool `reset` in the chat | **Removed** (answer 4): 18 tools. `scripts/demo-project.mjs <email> [--name …] [--select]`, run from Claude Code, creates "Dummy - Big Pharma AG" for a user if missing and loads the seed, or reloads it; through the Supabase CLI login, so no key |
| Our code: `engagement.ts`, `engagement_pkg.ts`, `engagement_test.ts`, `build-engagement.mjs`, `gen-engagement-tables.mjs`, names and texts in `tools.ts`, `views.ts`, `index.ts`, `templates/bpag/runtime.js`, `templates/bpag/test/*` | `project_data.ts`, `package.ts`, `project_data_test.ts`, `build-package.mjs`, `gen-project-tables.mjs`; tool descriptions say "the selected project's data" |

**Rules:**

- **The package's data stays out of `public`.** The schema `project` is not exposed to the Data API, so the 27 tables and
  the versions change only through the functions, after the validator. Nothing moved onto `public.projects`: its "Own
  rows" policy lets a signed-in user update it from a browser, which would bypass the validator.
- **Projects start without data** (answer 1): `write_project` loads none. The demo is loaded by `scripts/demo-project.mjs`
  (answer 4), which calls `project_replace`; that names `en-01` after the project, not the seed.
- **One name.** A save that changes `en-01.name` (the `engagement_starter` agent's scope) renames the project; trigger
  `sync_engagement_name` on `projects` passes a project rename on to `en-01`. So a project name follows the package's
  rule: 1–70 characters, one line, plain text, no placeholders, in `lib.ts` (`write_project`, `edit`) and in the check
  `projects_name_package`.
- **Delete.** "Only empty projects can be deleted" counts todos, sheets, docs and slides only; the project's data goes
  with it (cascade).
- Migrations already applied are not edited. The generator writes future migrations against the new names; without
  `--rename` it builds the schema from nothing.

## 3. Plan

| # | Step | Status |
|---|---|---|
| 1 | **Generator and migration**: renames in place (the two projects with data, `project:10` and `project:11`, kept); `en-01.name` set to the project's name; new functions; old ones dropped | Done: `supabase/migrations/20261023100000_project_data.sql`, from `node scripts/gen-project-tables.mjs <file> --rename` |
| 2 | **Function**: files and names; the name rule; the delete rule; tool texts; `reset` removed (answer 4) | Done: function v0.11.0, 18 tools |
| 3 | **Pages**: `runtime.js` calls the new names; the empty-state text; `scripts/templates.mjs` rebuilds the pages | Done; uploaded by Nela |
| 4 | **Demo script** `scripts/demo-project.mjs` (answer 4) | Done; run for Nela, Siniša and `claude@test.com` |
| 5 | **Tests** | Done (§5) |
| 6 | **Cut-over**: Nela pushed; Claude deployed, committed (`05dd02a`), pushed and tagged `v0.11.0`; Nela uploaded the pages; live checks | Done 2026-10-23 |
| 7 | **Docs** | Done |

## 4. Answers (Nela, 2026-10-23)

1. **Data for every project:** no; keep as is. A project starts without data.
2. **Cut-over:** a gap of minutes between push, deploy and upload accepted.
3. **The package's own words:** kept (option A); not renamed in the package and not in our copy.
4. **The demo is set up from Claude Code, not from claude.ai** (a change of heart after the build): the `reset` tool is
   removed; `scripts/demo-project.mjs` creates and resets the demo project.

## 5. Results

| Where | Result |
|---|---|
| Unit tests (`deno test -A` in `supabase/functions/mcp`) | 53/53, including the package demo through `write`, the project-name rule and the tool list (18, no `reset`) |
| PGlite, `supabase/tests/project_data_test.ts` | 3 tests, 9 steps. On the two engagement migrations with data, then the new one: every record and log entry kept, the record named after the project, old schema, tables and functions gone; table list and version poll; the seed reads back exactly; demo steps 1–9 at 7–15, step 10 refused; the name rule both ways; bad names refused; a project without data is empty; RLS (own rows only; every save, the versions and the record refused to the browser); delete takes the data. The generator without `--rename` on an empty database. The demo script's SQL: creates and selects the project, a rerun makes no second project and restores the seed, an unknown email refused |
| PGlite, the old `engagement_tables_test.ts` | 5/5 (imports only) |
| Pages offline (`templates/bpag/test/check.mjs`) | 25/25, with the empty-state text "This project has no data yet." |
| Dry run on live before the push, rolled back | Before and after equal: 2 version rows (both at version 6), 216 time entries, 10 log entries; names equal; old objects gone; a save ok; a rename reaches the record; owner sees the data, Siniša none; a browser save denied. Live unchanged afterwards |
| Live after the push | Schema `project` present, `engagement` gone; 2 version rows, 216 time entries; engagement names equal project names |
| `scripts/demo-project.mjs … --select` | Nela `project:11` (reloaded), Siniša `project:13` (created), `claude@test.com` `project:10` (reloaded): each at version 6 and selected |
| `scripts/smoke.sh` on v0.11.0 | 85 calls; every refusal is an intended bad-input or other-user case; tools/list shows the 18 tools with the new titles. Its `Test - …` rows removed afterwards |
| `templates/bpag/test/live.mjs` on `os.cantabpi.com` | 23/23: the eleven views at 1280 and 400 px; a write with Home open marked after about 1.5 s without reloading the frame; reset before and after through the demo script |

**Afterwards:** `claude@test.com` has "Dummy - Big Pharma AG" selected and slot 1 on Home. Everyone must Disconnect and
Connect the connector in claude.ai once: the tool list changed (no `reset`).

Not renamed: the public storage bucket `engagement-assets`. The deck's address is stored in each project's `deck` record
and in the seed; renaming means a new bucket, a re-upload and an update of those records. Left as is unless Nela asks.

**Changelog** (rationale in DECISIONS.md; file history in git)
- v0.6 (2026-10-23) — Live: Nela pushed and uploaded; function v0.11.0 deployed. The `reset` tool removed and
  `scripts/demo-project.mjs` added (Nela, answer 4). Live checks passed. → DECISIONS.md 2026-10-23
- v0.5 (2026-10-23) — Built and tested on Nela's go: migration, function v0.11.0, pages, tests; dry run on live passed.
- v0.4 (2026-10-23) — Nela's answers: projects start without data (empty state kept, message fixed), cut-over gap
  accepted, package words kept. Estimate 4–5 h.
- v0.3 (2026-10-23) — Corrected: the engagement record and the versions stay in the closed schema `project`, not on
  `public.projects` (its "Own rows" policy would let a browser bypass the validator). Asked by Nela.
- v0.2 (2026-10-23) — Rewritten for "completely replace with project": schema, log, functions and our code renamed; the
  package's own words kept. Three questions.
- v0.1 (2026-10-23) — Plan drafted after the live check of Siniša's projects; three questions for Nela.
