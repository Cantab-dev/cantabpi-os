# Cantab OS — Data structure: plan and status

This document is both the plan and the record of what exists. Each item has a status; update the status in the same change that builds the item.

Status values: `planned` (agreed, not built) · `built` (exists in the Supabase project) · `changed` (built, then altered; note what changed) · `open` (needs a decision).

Last updated: 2026-10-13 · Supabase project `etofljbxzllkucmearwl` (cantabpi-os, Postgres 17, eu-west-1) · Database contents: six tables, label and context functions, dummy data (built 2026-10-13).

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
| owner_id ＋ | uuid | see Ownership |
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
| owner_id ＋ | uuid | see Ownership |
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
| owner_id ＋ | uuid | see Ownership |
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
| owner_id ＋ | uuid | see Ownership |
| created_at ＋, updated_at ＋ | timestamptz | set automatically |

## Labels — `built`

- Format `<entity>:<number>`, with entity one of `skill`, `todo`, `lead`, `sheet`, `doc`, `slide`.
- One Postgres sequence per entity. Function `next_label(entity)` returns the next label and is the default value of each `label` column, so the backend generates labels and callers never supply them.
- Sequences never hand out the same number twice, so a label is never reused after a delete. Numbers can have gaps.
- Labels are unique across the whole database (not per user).
- The prefix tells `get` and `note` which table a label belongs to.

## Context — `built`

- Function `append_context(label, text)` adds a dated line to the `context` of the record with that label, in a single update, and fails if the label does not exist.
- `skills` has no context column, so `note` on a skill label returns an error.

## Ownership — `built`

- Every table has `owner_id`, a reference to the Supabase Auth user who created the row.
- It is nullable for now. Until sign-in exists (step 3) rows are created without an owner or with a test user.
- Who may see or change which rows is decided in step 3.

## Access — `built`

- Row Level Security is switched on for every table, with no policies. This closes the tables to Supabase's public Data API; only the backend (service role) can read or write.
- Step 3 replaces this with per-user rules.

## Dummy data — `built`

15 rows across the six tables plus two notes, clearly fake. Every dummy row carries the prefix `Dummy - ` in `name` (`description` for skills). Remove with `delete from <table> where name like 'Dummy - %'`.

## Decisions (2026-10-13)

Everything in this phase is subject to change later.

1. **Importance scale** — 1 to 3.
2. **Category** — free text for now.
3. **Timestamps** — `created_at` and `updated_at` kept.

## Where it lives

- `supabase/migrations/20261013120000_tables_and_labels.sql`
- `supabase/migrations/20261013120100_append_context.sql`
- `supabase/seed.sql`

## Next

Step 2 tools (`list`, `get`, `write_*`, `note`) as an MCP edge function. Not started.
