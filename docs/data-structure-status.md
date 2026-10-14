# Cantab OS — Data structure: plan and status

| Status | Version | Owner | Last updated |
| --- | --- | --- | --- |
| Current | v1.4 | Nela | 2026-10-14 |

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
- `planned`: a third copy for `sinisa@cantabpi.com`, so he can test as himself (migration
  `20261014140000_dummy_data_sinisa.sql`, waiting for `db push`).
- **Why:** testing continues as Claude until sign-in is ready. Nela's set is then ready for the claude.ai test as Nela.

## Where it lives

- `supabase/migrations/20261013120000_tables_and_labels.sql`
- `supabase/migrations/20261013120100_append_context.sql`
- `supabase/migrations/20261013150000_label_no.sql`
- `supabase/migrations/20261014120000_append_context_owner.sql`
- `supabase/migrations/20261014120100_dummy_data_per_user.sql`
- `supabase/migrations/20261014130000_profiles_and_rls.sql`
- `supabase/migrations/20261014140000_dummy_data_sinisa.sql`
- `supabase/seed.sql`

## Next

Step 2 tools (`list`, `get`, `write_*`, `note`) as an MCP edge function: see [tools-status.md](tools-status.md).

**Changelog** (rationale in DECISIONS.md; file history in git)
- v1.4 (2026-10-14) — `profiles` table, `owner_id` renamed `profile_id`, per-user RLS policies. → DECISIONS.md 2026-10-14
- v1.3 (2026-10-14) — Known gap noted: labels can be changed through the Data API once users sign in. → DECISIONS.md 2026-10-14
- v1.2 (2026-10-14) — Dummy data owned per user (Claude, plus a copy for Nela); `append_context` takes the owner. → DECISIONS.md 2026-10-14
- v1.1 (2026-10-13) — `label_no` column added to every table for ordering and paging. → DECISIONS.md 2026-10-13
- v1.0 (2026-10-13) — Six tables, label and context functions and dummy data built. → DECISIONS.md 2026-10-13
