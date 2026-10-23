# Cantab OS — Data structure

| Status | Version | Owner | Last updated |
| --- | --- | --- | --- |
| Current | v2.0 | Nela | 2026-10-23 |

**The source of truth for the database** (Nela, 2026-10-23): every table, column rule, function, trigger, policy and
storage item, as built. Update it in the same change as any migration. Taken from `supabase/migrations/`; the why of
each choice is in [DECISIONS.md](DECISIONS.md). The diagram source (`01_analysis/Diagram_input.md` in the SharePoint
folder) is updated only on request.

Supabase project `etofljbxzllkucmearwl` (cantabpi-os, Postgres 17, eu-west-1). State at function v0.11.0.

Markers: **[built]** exists and is deployed · **[POC]** built as a proof of concept, to be reworked · **[planned]**
agreed, not built · **[open]** not decided.

## 1. Conventions

- Schema `public` unless named. Primary key `id`, foreign key `<table>_id`, owner column `profile_id`.
- Every table has RLS on; `anon` has no table rights; `authenticated` has no TRUNCATE.
- Every labelled table has `label` (`<entity>:<N>`), `label_no` and dated `context` notes (§3, §4), except where noted.

## 2. Tables

**`profiles`** [built] — one row per Auth user, made by trigger `on_auth_user_created`.

| Column | Type | Rules |
|---|---|---|
| id | uuid | PK; FK → `auth.users.id` on delete cascade |
| email | text | |
| display_name | text | |
| selected_project_id | uuid | FK → `projects.id` on delete set null. The one selected project |
| current_slot, current_slot_at | smallint 1–10, timestamptz | The live view slot in front of the user, set by `view_seen` |
| created_at, updated_at | timestamptz | not null, default now(); `updated_at` by trigger |

**`projects`** [built]

| Column | Type | Rules |
|---|---|---|
| id | uuid | PK, default gen_random_uuid() |
| label | text | not null, unique, default `next_label('project')` → `project:N` |
| label_no | integer | generated from label, indexed |
| name | text | not null; check `projects_name_package`: 1–70 characters, one line, plain text, no `{placeholders}` (the package's rule for the engagement name, §2.1) |
| icon | text | emoji |
| context | text | dated notes, via `append_context` |
| profile_id | uuid | not null, default auth.uid(), FK → `profiles.id` on delete cascade, indexed |
| created_at, updated_at | timestamptz | as above |

**`todos`** [built]

| Column | Type | Rules |
|---|---|---|
| id | uuid | PK |
| label | text | not null, unique, default `next_label('todo')` |
| label_no | integer | generated, indexed |
| name | text | not null |
| due | date | |
| importance | smallint | check 1–3 (low, medium, high) |
| status | boolean | not null, default false (true = done) |
| action | text | current next action; the old value goes to `context` by trigger |
| context | text | |
| category_id | integer | FK → `categories.id`, indexed |
| project_id | uuid | **not null**, default `current_project_id()`, FK → `projects.id` on delete restrict, indexed |
| profile_id | uuid | not null, default auth.uid(), FK → `profiles.id` on delete cascade, indexed |
| created_at, updated_at | timestamptz | |

**`sheets`**, **`docs`** [built] — pointers to Google files: `id`, `label` (`sheet:N` / `doc:N`), `label_no`, `name`
(not null), `url`, `importance` (1–3), `action`, `context`, `category_id`, `project_id` (as todos), `profile_id`,
`created_at`, `updated_at`.

**`slides`** [built] — as sheets, plus `storage_url` (the PDF copy in bucket `slide-pdfs`). In the Realtime publication.

**`leads`** [built] — shared by all projects (no `project_id`). `id`, `label` (`lead:N`), `label_no`, `name` (not null,
short name), `full_name`, `email`, `url_linkedin`, `importance` (1–3), `action`, `context`, `category_id`,
`profile_id`, `created_at`, `updated_at`.

**`skills`** [built] — workflows for the host, shared by all projects. `id`, `label` (`skill:N`), `label_no`,
`description`, `guideline`, `profile_id`, `created_at`, `updated_at`. No context, category, importance or action.

**`categories`** [built] — fixed reference list, changed only by migration; read-only for signed-in users.

| Column | Type | Rules |
|---|---|---|
| id | integer | PK (1–10) |
| label | text | not null, unique (`sales`, `finance`, `product`, `legal`, `admin`, `personal`, `investor`, `client`, `partner`, `advisor`) |
| name | text | not null |
| icon | text | not null, emoji |

**`ui_views`** [POC] — one row per live view slot.

| Column | Type | Rules |
|---|---|---|
| id | uuid | PK |
| profile_id | uuid | not null, default auth.uid(), FK → `profiles.id` on delete cascade |
| slot_no | smallint | not null, check 1–10; **unique (`profile_id`, `slot_no`)** |
| template | text | not null, check in the package's eleven views (`home`, `engagement_starter`, `analyst`, `value_estimator`, `presentation_builder`, `project_manager`, `team_manager`, `story_builder`, `agent_builder`, `proposal_builder`, `model_builder`), `pdf`, `dashboard` |
| agent_params, ui_params | jsonb | not null, default `{}`, must be an object |
| state | jsonb | not null, default `{}`: settings of the views switched away from, `{template: {agent, ui}}` |
| project_id | uuid | FK → `projects.id` on delete set null; the selected project at the last agent write or click |
| version | integer | not null, default 1 (compare-and-set) |
| last_writer | text | not null, default `user`, check in (`user`, `agent`) |
| last_active_at | timestamptz | not null, default now() |
| created_at, updated_at | timestamptz | |

**`demo_sales`** [POC] — dummy data for the dashboard. `id` bigint identity PK; `profile_id` (FK → profiles,
cascade); `sold_on` date not null; `region` check in (`emea`, `amer`, `apac`); `product` check in (`Atlas`, `Beacon`,
`Compass`, `Delta`); `amount` numeric(12,2) > 0; `created_at`. Index (`profile_id`, `sold_on`). No labels.

**`view_templates`** [built] — `key` PK (the eleven view keys), `html` (one self-contained page), `contract_version`.
Read: any signed-in user. Written with the service key by `scripts/templates.mjs` (run by Nela).

### 2.1 The project's data (Siniša's views package) [built]

- **Schema `project`**, not exposed to the Data API: it changes only through the functions in §5, after the
  package's validator.
- **`project.versions`** — 0 or 1 per project (FK → `projects.id`, cascade; created by `scripts/demo-project.mjs`):
  `contract_version`, `global_version`, `table_versions` (the package's `_version.json`), `profile_id`, timestamps.
- **27 package tables** (`project.engagement`, `project.people`, `project.tasks`, …), each FK → `project.versions`
  (cascade), generated from `vendor/bpag/data/_schema.json` by `scripts/gen-project-tables.mjs`: `project_id`,
  `profile_id`, `pos` (array order), the package `id` (PK with `project_id`), one typed column per field (`date`,
  `integer`, `numeric`, `boolean`, `text`, `text[]` for ref lists; enums as checks), `meta_version`,
  `meta_updated_at` (timestamptz), `meta_updated_by`, `meta_reason`. Types and keys only: the validator is the check.
- **`public.project_log`** — the last 200 changes per project (FK → `project.versions`).
- **One name:** `project.engagement`'s single record takes its project's name; trigger `sync_engagement_name` on
  `projects` passes a rename on, and a save that changes the record's name renames the project.
- Plan and history: [live-views-status.md](live-views-status.md) §4; archived plans in `archive/`.

### 2.2 Planned and open

| Item | Purpose | State |
|---|---|---|
| `project_members` (project_id, profile_id, role) | Projects shared by a team | **[open]** (one owner for now) |
| Call log | Record of tool calls, before real data | **[planned]** |

## 3. Labels [built]

- Format `<entity>:<number>`, entity one of `skill`, `todo`, `lead`, `sheet`, `doc`, `slide`, `project`.
- One sequence per entity (`<entity>_label_seq`). `next_label(entity)` is the default of each `label` column, so
  the backend generates labels and callers never supply them. Numbers are never reused after a delete; gaps are normal.
- Labels are unique across the whole database (not per user). The prefix tells `get` and `note` which table it is.
- `label_no`: stored generated column `split_part(label, ':', 2)::integer`, indexed, for ordering and paging
  (`todo:2` before `todo:10`). Internal; never returned by the tools.
- **Known gap [open]:** nothing in the database stops a label change through the Data API. The tools never change one.

## 4. Context [built]

- `append_context(label, text)` adds a dated line to the `context` of the record with that label in one update, and
  fails if the label does not exist. Runs as the caller, so RLS applies.
- `skills` has no context, so `note` on a skill label returns an error.
- Trigger `keep_previous_action`: overwriting `action` appends `YYYY-MM-DD: Previous action: <old>` to `context`.

## 5. Functions

| Function | Returns | Security | Used by | State |
|---|---|---|---|---|
| `next_label(entity text)` | text | definer | label defaults | [built] |
| `set_updated_at()` | trigger | — | trigger on every table with `updated_at` | [built] |
| `handle_new_user()` | trigger | definer | trigger on `auth.users` | [built] |
| `keep_previous_action()` | trigger | — | trigger on todos, leads, sheets, docs, slides | [built] |
| `append_context(p_label text, p_text text)` | void | invoker | `note` | [built] |
| `current_project_id()` | uuid | invoker | `project_id` default, RLS | [built] |
| `current_project()` | table(label, name, icon) | invoker | every tool (gate and reply line) | [built] |
| `owns_project(p uuid)` | boolean | invoker | RLS write checks, profile update | [built] |
| `select_project(p_label text)` | void | invoker | `select_project` | [built] |
| `project_summary()` | table(label, name, icon, selected, todos, sheets, docs, slides) | definer, filtered by auth.uid() | `select_project`, `delete` on a project | [built] |
| `view_check`, `view_json`, `views_list`, `view_open`, `view_update`, `view_agent_apply`, `view_close`, `view_seen`, `view_set_template`, `view_header_templates` | jsonb / — | definer | `view`, live page | [POC] (detail: [live-views-status.md](live-views-status.md) §2) |
| `dashboard_sales_overview(p_period, p_region)` | jsonb | invoker | live page | [POC] |
| `project_read(p_project, p_tables)`, `project_version(p_project)`, `project_log_read(p_project, p_since, p_limit)` | jsonb | invoker | pages, `contract`, `query`, `log` | [built] |
| `project_commit(…)`, `project_replace(…)`, `project_owns(…)` | jsonb / boolean | definer, **service role only** | `write`; `scripts/demo-project.mjs` (replace) | [built] |
| `project.tables()`, `project.iso()`, `project.get()` (as the caller), `project.put()` (service role), `project.sync_name()` | — | — | the functions above, the name trigger | [built] |

## 6. Triggers

| Trigger | On | Does | State |
|---|---|---|---|
| `on_auth_user_created` | `auth.users` after insert | creates the `profiles` row (no project yet) | [built] |
| `set_updated_at` | before update on profiles, projects, skills, todos, leads, sheets, docs, slides, ui_views, view_templates, project.versions | sets `updated_at` | [built] |
| `keep_previous_action` | before update of `action` on todos, leads, sheets, docs, slides | appends the old action to `context` | [built] |
| `sync_engagement_name` | after update of `name` on projects | sets `project.engagement.name` | [built] |

## 7. Access (RLS) [built]

| Table | Rule |
|---|---|
| profiles | read own; update own, new `selected_project_id` must be null or an own project |
| projects, leads, skills, demo_sales | all: own rows (`profile_id = auth.uid()`) |
| todos, sheets, docs, slides | read / update / delete: own row **and** in the selected project; insert and updates: own row in an own project |
| categories, view_templates | read: any signed-in user |
| ui_views | read own; writes only through the `view_*` definer functions |
| schema `project`, `project_log` | read own; writes only through `project_commit` / `project_replace` (service role) |
| storage `slide-pdfs` | read own folder (`<user id>/…`) |

Detail and rollout of sign-in: [sign-in-status.md](sign-in-status.md).

## 8. Storage, Realtime, Auth

| Item | Detail | State |
|---|---|---|
| Bucket `slide-pdfs` | private, 10 MB, `application/pdf`, path `<user id>/<slide label>.pdf` | [POC] |
| Bucket `engagement-assets` | public; the package's deck `bpag/scale-up-proposal.pdf` (name kept, its address is stored in the data) | [built] |
| Realtime publication | `ui_views`, `demo_sales`, `slides` | [POC] |
| Cron, webhooks, `pg_net` | none | — |
| Edge Functions | `mcp` only (`verify_jwt = false`; the function checks the token itself) | [built] |
| Auth | OAuth 2.1 server on (consent at `os.cantabpi.com/oauth/consent`), dynamic client registration on, sign-ups off, ES256 keys | [built] |

## 9. Dummy data [built]

- Per user (`claude@test.com`, Nela, Siniša): todos, leads, sheets, docs, slides and skills named `Dummy - …`, in the
  projects Atlas and Birch; older rows in `Unsorted (from v1)`. Project names carry no prefix (2026-10-23).
- The demo project "Big Pharma AG" with the package's seed, made by `node scripts/demo-project.mjs <email> [--select]`.
- `demo_sales`: about 270 rows per user; bucket `slide-pdfs`: six dummy PDFs.

## 10. Where it lives

All migrations in `supabase/migrations/` (never edited once applied), in order: tables and labels (`20261013…`),
per-user data and profiles (`20261014…`), categories (`20261015…`), live views (`20261021…`), projects and the view
header (`20261022120000`–`140000`), the package (`20261022150000`, `20261022160000`), project names
(`20261023100000`). Dummy data also in `supabase/seed.sql`.

**Changelog** (rationale in DECISIONS.md; file history in git)
- v2.0 (2026-10-23) — Made the source of truth for the database (Nela): the full schema from Diagram_input §2 brought
  here and brought up to date; plan-era wording dropped. → DECISIONS.md 2026-10-23
- v1.9 (2026-10-23) — Pointer to the project data migration (engagement renamed to project; name rule on `projects`).
- v1.8 (2026-10-22) — Pointer to the engagement tables (schema `engagement`, 27 generated tables).
- v1.7 (2026-10-22) — Projects: `projects` table, one selected project per user, required `project_id`, RLS by project.
- v1.6 (2026-10-21) — Live views POC: `ui_views`, `demo_sales`, bucket `slide-pdfs`, Realtime.
- v1.5 (2026-10-15) — `categories`; `category_id`, `importance`, `action` on five tables; previous-action trigger.
- v1.4 (2026-10-14) — `profiles`, `owner_id` renamed `profile_id`, per-user RLS policies.
- v1.3 (2026-10-14) — Known gap noted: labels can be changed through the Data API once users sign in.
- v1.2 (2026-10-14) — Dummy data owned per user; `append_context` takes the owner.
- v1.1 (2026-10-13) — `label_no` column added to every table for ordering and paging.
- v1.0 (2026-10-13) — Six tables, label and context functions and dummy data built.
