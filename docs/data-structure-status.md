# Cantab OS — Data structure: plan and status

| Status | Version | Owner | Last updated |
| --- | --- | --- | --- |
| Current | v1.9 | Nela | 2026-10-23 |

This document is both the plan and the record of what exists. Each item has a status; update the status in the same change that builds the item.

Status values: `planned` (agreed, not built) · `built` (exists in the Supabase project) · `changed` (built, then altered; note what changed) · `open` (needs a decision).

Supabase project `etofljbxzllkucmearwl` (cantabpi-os, Postgres 17, eu-west-1) · Database contents: six tables, label and context functions, dummy data (built 2026-10-13).

## Scope

Steps 1 and 2 of the deployment plan: tables, the auto-label function and dummy data. Sign-in, access rules, connectors and in-host views belong to step 3 and are not defined here.

## Tables

All tables live in the `public` schema. Columns marked ＋ are not in the original spec.

### skills — `built`
Workflows for the host.

| Column | Type | Rules |
|---|---|---|
| id | uuid | primary key, generated |
| label | text | unique, generated (`skill:1`) |
| description | text | |
| guideline | text | |
| profile_id ＋ | uuid | see Ownership |
| created_at ＋, updated_at ＋ | timestamptz | set automatically |

### todos — `built`
Personal todos.

| Column | Type | Rules |
|---|---|---|
| id | uuid | primary key, generated |
| label | text | unique, generated (`todo:1`) |
| name | text | required |
| category | text | free text |
| due | date | |
| importance | smallint | 1 low · 2 medium · 3 high |
| status | boolean | true = done; default false |
| context | text | maintained by the LLM through `note` |
| profile_id ＋ | uuid | see Ownership |
| created_at ＋, updated_at ＋ | timestamptz | set automatically |

### leads — `built`
Contacts and leads.

| Column | Type | Rules |
|---|---|---|
| id | uuid | primary key, generated |
| label | text | unique, generated (`lead:1`) |
| name | text | required; short name |
| full_name | text | |
| email | text | |
| url_linkedin | text | |
| context | text | maintained by the LLM through `note` |
| profile_id ＋ | uuid | see Ownership |
| created_at ＋, updated_at ＋ | timestamptz | set automatically |

### sheets, docs, slides — `built`
Three tables with the same shape; each row points to a Google file. Cantab OS stores the url and context only.

| Column | Type | Rules |
|---|---|---|
| id | uuid | primary key, generated |
| label | text | unique, generated (`sheet:1`, `doc:1`, `slide:1`) |
| name | text | required |
| url | text | Google file url |
| storage_url | text | **slides only**: pdf copy in Supabase Storage |
| context | text | maintained by the LLM through `note` |
| profile_id ＋ | uuid | see Ownership |
| created_at ＋, updated_at ＋ | timestamptz | set automatically |

### categories, and category / importance / action on five tables — `built`
Added 2026-10-15 for the in-chat views. Detail, seed values and the checks: [chat-ux-status.md](chat-ux-status.md) §1.
- `categories` (`id`, `label` unique, `name`, `icon` as an emoji): ten fixed rows, shared, read-only for signed-in users.
- `todos`, `leads`, `sheets`, `docs`, `slides` each have `category_id` (to `categories.id`), `importance` (1–3) and
  `action` (the current next action). The todos' free-text `category` column was moved into `category_id` and dropped.
- Trigger `keep_previous_action`: overwriting `action` appends `YYYY-MM-DD: Previous action: <old>` to `context`.
- Migration: `supabase/migrations/20261015120000_categories_and_action.sql`.

### ui_views, demo_sales, bucket slide-pdfs — `built` (live views POC, 2026-10-21)

`ui_views`: one row per live view slot (1–10 per user), read-only to its owner, written only through the `view_*` functions. `demo_sales`: dummy sales for the dashboard, per-user RLS, about 270 rows per user; no labels. Bucket `slide-pdfs` (private, `<user id>/<label>.pdf`): six dummy PDFs, and the matching slides' `storage_url` points at them. Realtime is on for `ui_views`, `demo_sales` and `slides`. Detail: [live-views-status.md](live-views-status.md) §2.

### projects, the selection, and project_id on four tables — `built` (v2 phase 1, 2026-10-22)

`projects` (`id`, `label` `project:N`, `label_no`, `name`, `icon`, `context`, `profile_id`, timestamps), own rows only. `profiles.selected_project_id`: the user's one selected project, on delete set null. `todos`, `sheets`, `docs`, `slides` carry `project_id`: required, default the selected project, on delete restrict. RLS on those four shows only the selected project's rows (none selected: none) and accepts writes only into the user's own projects. Functions `current_project_id`, `current_project`, `owns_project`, `select_project`, `project_summary`. Data: Atlas and Birch per user, older rows in `Unsorted (from v1)`, Atlas selected. Leads and skills stay outside projects. Detail: [projects-status.md](projects-status.md) §2. Migrations `20261022120000_projects.sql`, `20261022130000_single_project.sql`.

## Labels — `built`

- Format `<entity>:<number>`, with entity one of `skill`, `todo`, `lead`, `sheet`, `doc`, `slide`.
- One Postgres sequence per entity. Function `next_label(entity)` returns the next label and is the default value of each `label` column, so the backend generates labels and callers never supply them.
- Sequences never hand out the same number twice, so a label is never reused after a delete. Numbers can have gaps.
- Labels are unique across the whole database (not per user).
- The prefix tells `get` and `note` which table a label belongs to.
- **Known gap (noted 2026-10-14, not built):** nothing in the database stops a label from being
  changed. The tools never change one. But once signed-in users can reach Supabase's Data API (see
  [sign-in-status.md](sign-in-status.md)), a user could change the label of their own row. A rule that
  refuses label changes would close this (suggestion 7 in [tools-status.md](tools-status.md)).
- `changed` (2026-10-13): every table also has `label_no`, the number part of the label, filled by the database and indexed. It exists so lists can be ordered and paged by label number (`todo:2` before `todo:10`). It is internal and never returned by the tools.

## Context — `built`

- Function `append_context(label, text)` adds a dated line to the `context` of the record with that label, in a single update, and fails if the label does not exist.
- `skills` has no context column, so `note` on a skill label returns an error.

## Ownership — `built`

- Table `public.profiles`: one row per Supabase Auth user (`id` = the auth user id, `email`,
  `display_name`). A trigger creates it when a user is created.
- Every table has `profile_id`, a reference to `profiles.id`: required, defaults to the signed-in user,
  and cascades when the user is deleted. Naming follows the agreed rule (primary key `id`, foreign key
  `<table>_id`).

## Access — `built`

- Row Level Security on every table, with one policy for signed-in users: a user reads, changes and
  deletes only rows whose `profile_id` is theirs. `anon` has no table rights; `authenticated` has no
  TRUNCATE.
- `next_label` runs with its owner's rights so a signed-in insert gets a label; `append_context` runs as
  the caller, so RLS applies to notes.
- Detail and rollout: [sign-in-status.md](sign-in-status.md).

## Dummy data — `built`

15 rows across the six tables plus two notes, clearly fake. Every dummy row carries the prefix `Dummy - ` in `name` (`description` for skills). Remove with `delete from <table> where name like 'Dummy - %'`.

### Per-user dummy data — `built`
- The original 15 dummy rows belong to `claude@test.com`. Nela has a copy of all 15, with the two notes; the copies have their own labels (for example `todo:39`).
- Built by one data migration that looks the users up by email. It skips a user that doesn't exist, so a local reset without those users still runs.
- Checked live 2026-10-14: 15 rows per user; the tools, acting as Claude, don't see Nela's rows.
- A third copy for `sinisa@cantabpi.com`, so he can test as himself (migration
  `20261014140000_dummy_data_sinisa.sql`). Checked live 2026-10-14: 15 rows each for all three users.
- **Why:** testing continues as Claude until sign-in is ready. Nela's set is then ready for the claude.ai test as Nela.

## Where it lives

- `supabase/migrations/20261013120000_tables_and_labels.sql`
- `supabase/migrations/20261013120100_append_context.sql`
- `supabase/migrations/20261013150000_label_no.sql`
- `supabase/migrations/20261014120000_append_context_owner.sql`
- `supabase/migrations/20261014120100_dummy_data_per_user.sql`
- `supabase/migrations/20261014130000_profiles_and_rls.sql`
- `supabase/migrations/20261014140000_dummy_data_sinisa.sql`
- `supabase/migrations/20261015120000_categories_and_action.sql`
- `supabase/seed.sql`
- Engagement data (Siniša's package): `20261022150000_engagement.sql` and the generated `20261022160000_engagement_tables.sql`; described in [live-views-status.md](live-views-status.md) §4 and [engagement-tables-status.md](engagement-tables-status.md)
- The project's data under project names: the generated `20261023100000_project_data.sql` (schema `project`, `project.versions`, `project_log`, functions `project_*`; check `projects_name_package` and trigger `sync_engagement_name` on `projects`); **built, not pushed**; described in [project-engagement-status.md](project-engagement-status.md)

## Next

Step 2 tools (`list`, `get`, `write_*`, `note`) as an MCP edge function: see [tools-status.md](tools-status.md).

**Changelog** (rationale in DECISIONS.md; file history in git)
- v1.9 (2026-10-23) — Pointer to the project data migration (engagement renamed to project; name rule on `projects`). → DECISIONS.md 2026-10-23
- v1.8 (2026-10-22) — Pointer to the engagement tables (schema `engagement`, 27 generated tables). → DECISIONS.md 2026-10-22
- v1.7 (2026-10-22) — Projects: `projects` table, one selected project per user, required `project_id` on todos, sheets, docs, slides, RLS by project. → DECISIONS.md 2026-10-22
- v1.6 (2026-10-21) — Live views POC: `ui_views`, `demo_sales`, bucket `slide-pdfs`, Realtime. → DECISIONS.md 2026-10-21
- v1.5 (2026-10-15) — `categories` table; `category_id`, `importance`, `action` on five tables; todo `category` moved; previous-action trigger. → DECISIONS.md 2026-10-15
- v1.4 (2026-10-14) — `profiles` table, `owner_id` renamed `profile_id`, per-user RLS policies. → DECISIONS.md 2026-10-14
- v1.3 (2026-10-14) — Known gap noted: labels can be changed through the Data API once users sign in. → DECISIONS.md 2026-10-14
- v1.2 (2026-10-14) — Dummy data owned per user (Claude, plus a copy for Nela); `append_context` takes the owner. → DECISIONS.md 2026-10-14
- v1.1 (2026-10-13) — `label_no` column added to every table for ordering and paging. → DECISIONS.md 2026-10-13
- v1.0 (2026-10-13) — Six tables, label and context functions and dummy data built. → DECISIONS.md 2026-10-13
