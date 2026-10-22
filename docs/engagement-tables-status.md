# Cantab OS — Engagement data as real tables: plan and status

| Status | Version | Owner | Last updated |
| --- | --- | --- | --- |
| Current — built and live | v0.3 | Nela | 2026-10-22 |

**What this is:** the plan for [live-views-status.md](live-views-status.md) §7.1: one Postgres table per package table in
place of one JSON row per table, so the engagement data can be queried with SQL. Go and answers: Nela, 2026-10-22 (§3).
**Live since 2026-10-22** (Nela pushed migration `20261022160000`); checked live (§4).

**Fixed by the scope (§7.1):** the validator, the five tools, the eleven pages and the function's calls do not change;
reads and saves still hand over the package's arrays; the validator stays the real check (the tables carry types and keys
only, so the two cannot disagree).

## 1. Plan

| # | Step | Status |
|---|---|---|
| 1 | **Generator** `scripts/gen-engagement-tables.mjs`: reads `vendor/bpag/data/_schema.json`, writes one migration | Done |
| 2 | **Migration**: the 27 tables, row security, new bodies for the three database functions, the move of existing data, drop of `engagement_tables` (`supabase/migrations/20261022160000_engagement_tables.sql`) | Done |
| 3 | **Tests** in an in-memory Postgres (PGlite): round trip of the seed, the ten demo steps, RLS; then a dry run on live in a rolled-back transaction | Done: PGlite 5/5 (`supabase/tests/engagement_tables_test.ts`); unit tests 51/51; dry run on live passed (§4) |
| 4 | Nela: `npx supabase db push`. Claude: the engagement checks live as `claude@test.com` (21/21 as before), pages headless | Done (§4) |
| 5 | Docs: this file, live-views-status §4, data-structure-status, Diagram_input §2, DECISIONS, HANDOFF | Done |

Estimate 4–5 h. No function deploy and no page upload are needed.

## 2. Design

**Tables** (generated; one per package table, e.g. `people`, `tasks`, `model_cells`):

| Column | From |
|---|---|
| `project_id` uuid, `profile_id` uuid | Owner; foreign key to `engagement_datasets` (cascade) |
| `id` text | The package id; primary key (`project_id`, `id`) |
| `pos` integer | The record's place in the array, so reads return the same order |
| one column per field, same name | `string`, `text`, `enum`, `ref` → `text`; `date` → `date`; `integer` → `integer`; `number` → `numeric` (no fixed scale, so `1.5` stays `1.5`); `boolean` → `boolean`; `ref_list` → `text[]` |
| `meta_version` integer, `meta_updated_at` timestamptz, `meta_updated_by` text, `meta_reason` text | `_meta`. `updated_at` reads back as JavaScript writes it: UTC, `Z`, milliseconds only when not zero (so a rare `.000Z` reads back as `Z`: same instant) |

Checks: `not null` on the key columns only; enums as `check (x in (…))`. No `required`, length, range or reference
checks: those stay in the validator. Field names such as `end`, `order`, `start` are quoted. Empty values (`""` or `null`) are not stored and so read back
left out; the validator treats empty and missing alike.

**Reads.** `engagement_read` keeps its signature and output. Per table: each row turned back into a record with
`to_jsonb`, the owner and `pos` columns removed, the four `meta_*` folded into `_meta`, empty (null) fields left out,
ordered by `pos`. Generic helpers `engagement.get` (as the caller, RLS) and `engagement.put` (service role only) over
the table list `engagement.tables()`, with quoted names, so no per-table code beyond the generated tables.

**Saves and reset.** `engagement_commit` and `engagement_replace` keep their signatures. Per touched table: delete the
project's rows, insert the new array with `jsonb_populate_recordset` (fields map by name), in the same transaction as
today. Per-table versions stay in `engagement_datasets.table_versions`, so `engagement_tables.version` goes with the table.

**Data move.** In the same migration: copy every existing dataset from `engagement_tables` into the new tables with the
same insert, check the counts match, then drop `engagement_tables`.

**Later changes to the package's data format:** rerun the generator and add a new migration (an applied one is never edited).

## 3. Questions for Nela — answered 2026-10-22

1. **Where the tables live.** (a) **A separate schema `engagement`, names as in the package** (`engagement.people`) —
   recommended: `skills` and `slides` would clash with our own tables in `public`, and the schema is not exposed to the
   Data API, so the browser keeps reading only through `engagement_read`. (b) `public` with a prefix (`eng_people`). **Nela: (a).**
2. **The old table.** (a) **Dropped in the same migration after the move** — recommended; the dry run on live checks the
   move first. (b) Kept for one release, then dropped. **Nela: (a).**
3. **`_meta.updated_at`.** (a) **Stored as text** — recommended: it reads back exactly as written (`…T08:00:00Z` or with
   milliseconds), and ISO text still sorts and filters correctly. (b) `timestamptz`, formatted back on read (risk: a
   round trip that differs in the last characters). **Nela: (b)**; formatted as JavaScript writes it (§2).

## 4. Tests

- Round trip: the seed saved with `engagement_replace` and read back equals the package's arrays exactly (deep equal,
  order kept), for all 27 tables.
- The package's demo through `engagement_write` (unit tests, unchanged): steps 1–9 commit at 7–15, step 10 refused.
- In PGlite and in the live dry run: existing data moved with equal counts and equal content; a browser save refused;
  another user sees none of the rows; `engagement_read` with a table list returns only those tables.

| Where | Result |
|---|---|
| PGlite, on the old migration with A's seed plus demo steps 1–9 and B's seed | 5/5: move equal for both; old table gone; seed round trip exact for all 27 tables; demo 1–9 at 7–15, 10 refused; table list; RLS (own 11 people, other 0, other user's read `empty`; `put`, `engagement_commit`, insert and delete refused to `authenticated`) |
| Unit tests (`deno test` in `supabase/functions/mcp`) | 51/51, unchanged |
| Dry run on live, rolled back (both existing datasets) | The move's record-by-record check passed; as the owner: 27 tables, version 6, 108 time entries, a table list honoured, `put` and delete denied; as another user: `empty`, 0 rows; old table gone. Afterwards live unchanged |
| Live after the push, database | Old table gone; 27 tables in `engagement`; 216 time entries (108 in each of the two datasets); both at version 6 |
| Live tools as `claude@test.com` (`project:10`) | Reset to version 6; contract; query with `expand` and a `text[]` field (`skill_ids`); demo steps 1–9 saved (version 15; `tk-08` reads back with step 1's values; the new agent line renumbered to order 3); step 10 refused ("text is 122 characters", ≤ 110); log; a browser save of `engagement_commit` refused (403); the schema `engagement` refused by the Data API (PGRST106); the page's reads (`engagement_version`, `engagement_read` with a table list) as the user |
| Live pages, headless on `os.cantabpi.com/v/1` | All eleven views at 1280 and 400 px: Big Pharma data, no notice, no script error, no horizontal scroll (22/22). A `phase_raci` write (demo step 8) with Home open: the two records marked about 0.6 s after the save, frame not reloaded. (The project manager view marks only actions and the engagement starter view shows `raci`, so a check there shows no marker: the package's design.) |

The test user is left with the demo at the seed and Atlas selected.

**Changelog**
- v0.3 (2026-10-22) — Live: Nela pushed the migration; database, tools and pages checked live.
- v0.2 (2026-10-22) — Built: generator, migration, PGlite test; dry run on live passed. Answers: own schema, drop after
  the move, `timestamptz`. → DECISIONS.md 2026-10-22
- v0.1 (2026-10-22) — Plan drafted from live-views-status §7.1; three questions for Nela.
