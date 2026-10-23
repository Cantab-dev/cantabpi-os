# Cantab OS — Live views: design and status

| Status | Version | Owner | Last updated |
| --- | --- | --- | --- |
| Current | v1.5 | Nela | 2026-10-23 |

**What is live (function v0.11.0, 2026-10-23):** a browser page at `https://os.cantabpi.com/v/1…10` that Claude
steers from claude.ai. Each of the ten views (slots) shows one thing; Claude changes it with the `view` tool and the
open page follows within about a second. The page has a header with ten agent icons and shows Siniša's engagement
views (Big Pharma AG demo), the POC's slide PDF, or the POC's sales dashboard.

**How to read:** §1–§5 describe what is built, by layer. §6 lists what is open. §7 is the next session's work and is
**not built**. Reference doc: jump by heading. Why things are as they are: [DECISIONS.md](DECISIONS.md). Every message to
and from Lovable: [COMMS.md](COMMS.md). Split trigger: if one section outgrows a single read, move it to its own doc.
Section numbers cited in COMMS, DECISIONS and the applied migrations before 2026-10-22 v1.0 refer to v0.23 (in git).

## 1. How it fits together

```
claude.ai ──MCP──▶ mcp function (18 tools, acts as the signed-in user)
   │                 ├─ view ───────────────▶ ui_views (slot → template, project)          ◀── Realtime ──┐
   │                 └─ contract/query/write/log ─ validator ─▶ project_commit (service role) ─▶ project.<27 tables>
   │                                                                                                     │
os.cantabpi.com/v/N (Lovable): header + centre pane                                                       │
   ├─ agent views: view_templates.html in <iframe srcdoc>, runtime polls project_version ────────────────┘ (every 2 s)
   └─ pdf / dashboard (POC): rendered by the Lovable page itself
```

- **Lovable** hosts the page in its own project (not connected to GitHub). It reads tables, calls database functions,
  signs Storage URLs and subscribes to Realtime, always as the signed-in user with the publishable key; it never
  writes a table directly. Ownership and channel: [COMMS.md](COMMS.md).
- **The address** is `os.cantabpi.com`; `cantabpios.lovable.app` redirects there, keeping path and query. Supabase Auth
  Site URL is `https://os.cantabpi.com`; the redirect URLs allow both.
- **The page holds no state of its own**: each view is a `ui_views` row, and the page renders that row.

## 2. Views (slots) — `ui_views`

One row per view in use, per user; an empty slot has no row. Writes only through the functions below.

| Column | Meaning |
|---|---|
| `slot_no` | 1–10; unique per user |
| `template` | `home`, `engagement_starter`, `analyst`, `value_estimator`, `presentation_builder`, `project_manager`, `team_manager`, `story_builder`, `agent_builder`, `proposal_builder`, `model_builder` (the engagement views, no parameters), and `pdf`, `dashboard` (POC, Claude only) |
| `agent_params`, `ui_params` | The current view's settings: what Claude set, and what the user set on the page |
| `state` | Settings of the views switched away from, `{template: {agent, ui}}`; they come back when the user switches back |
| `project_id` | The project the view shows: the selected project at the last Claude write or icon click. Each slot has a project (Siniša, 2026-10-22) |
| `version`, `last_writer` | Compare-and-set counter; `user` or `agent` |
| `last_active_at` | Bumped when the page opens the slot |

`profiles.current_slot` and `current_slot_at` hold the slot in front of the user.

| Function | Caller | Does |
|---|---|---|
| `view_open(slot)` | page | The row (with `id` and `project_id`) or `empty`; bumps `last_active_at` |
| `views_list()` | page, tool | All the user's slots |
| `view_update(slot, expected_version, agent_patch?, ui_patch?)` | page | Shallow merge with compare-and-set: `ok`, `conflict` or `gone` |
| `view_set_template(slot, expected_version, template)` | page (icon click, wordmark) | Switches to one of the eleven engagement views; keeps the old view's settings in `state`; `null` version on an empty slot |
| `view_seen(slot)` | page (load, tab visible, window focus; at most every 5 s) | Records the slot in front of the user |
| `view_agent_apply(template, params, focus, slot?)` | `view` tool | Writes as `agent`. Slot: the one given, else the slot in view, else 1. Replacing a view keeps its settings in `state` |
| `view_close(slot)` | page, tool | Deletes the row |

**Realtime:** `ui_views`, `demo_sales` and `slides` are in the publication. Postgres changes apply RLS for inserts and
updates. Delete events cannot be filtered, so the page listens to them unfiltered and acts only on its own row's id; it
receives other users' row ids (ids only). Acceptable with dummy data.

## 3. The page `/v/:slot` (Lovable)

**Header, left to right:** Cantab OS wordmark (opens Engagement home) · view name and a small "View N" · ten icons, one per
agent: Client-facing (Value estimator, Presentation builder, Proposal builder) and Team (Engagement starter, Analyst,
Project manager, Team manager, Story builder, Agent builder, Model builder); tooltip "group · name"; the current view's
icon is active. No project chip, no account menu, no sidebar (Nela, 2026-10-22).

- **Click:** `view_set_template` on this slot. The icon lights at once; the content follows from the returned view. On
  `conflict` Claude's view stays and the note "Claude changed this view; your click was not applied" shows next to the
  icons, or as a line under the bar below 720 px.
- **"Updated by Claude"** badge by the view name, fading about 4 s after each Claude write.
- **Following Claude to another slot is off** (`FOLLOW_CLAUDE = false` in the page): Claude writes to the slot in view.
- **Below 720 px** the icons fold into a menu whose button shows the current view's icon; the view name gets the space,
  or is dropped if it does not fit.
- **States:** signed out (to sign-in and back), empty slot ("Pick a view above, or ask Claude"), unknown template ("This
  page needs updating" with Reload), reconnecting (red dot by the logo), "This view is not available yet" (no page in
  `view_templates`).
- **Engagement views:** the page loads `view_templates.html` for the template and shows it in an `<iframe srcdoc>` (same
  origin, no sandbox), and sets `window.CP_HOST = {supabaseUrl, publishableKey, projectId, getToken, openView}`. The
  frame reloads only when the template or the project changes; each page is fetched once per tab.
- **`pdf`** (`agent_params.slide_id`, `ui_params.page`): signs a 1-hour URL for the slide's PDF in the private bucket
  `slide-pdfs` and shows it at the page, with previous / next and an "Open PDF" link.
- **`dashboard`** (`sales_overview`, filters period and region): `dashboard_sales_overview(period, region)` over the dummy
  table `demo_sales`, refetched on Realtime changes, batched at 400 ms.
- **Not on the page:** sign-out (gone with the account menu).

## 4. Engagement views — Siniša's package on Supabase

**Source:** Siniša's package "Cantab Pi agentic consulting environment", contract 2.0, received 2026-10-22
(`03_documentation/input/bpag-final.zip`), kept unchanged in `vendor/bpag/` with its deck. Demo client Big Pharma AG
(fictional), engagement "Agentic AI for field sales: pilot to scale". Ten agent views plus Engagement home, 27 tables, a
validator that refuses any write that would break a view, a ten-step demo script.

**Names (v0.11.0, live 2026-10-23):** "engagement" is replaced by "project" wherever the name is ours
([archive/project-engagement-status.md](archive/project-engagement-status.md)); the package keeps its own words (the table
`engagement`, the agent `engagement_starter`, "Engagement home"). **The demo is set up from Claude Code** with
`node scripts/demo-project.mjs <email> [--select]` (creates "Dummy - Big Pharma AG" if missing and loads the seed, or
reloads it); there is no `reset` tool in the chat.

**Data.** The project's data (`project.versions`: global version, per-table versions; 0 or 1 per project, made by the
demo script), one Postgres table per package table in the closed schema `project` (`project.engagement`,
`project.people`, …; generated from `_schema.json` by `scripts/gen-project-tables.mjs`, design in
[archive/engagement-tables-status.md](archive/engagement-tables-status.md)), and `project_log` (last 200 changes). RLS: read own. The
schema `_schema.json` is the single source of truth. One name: the engagement record takes the project's name, both ways.

**Reads** (as the user): `project_read(project, tables?)`, `project_version(project)` (the package's
`_version.json`), `project_log_read(project, since?, limit?)`; `status: 'empty'` when the project has no data yet.

**Writes** (Aleph's pattern): `project_commit` and `project_replace` may be called by the **service role only**.
The MCP function verifies the user's token, runs the package's `applyWrite` unchanged, and saves the touched tables with
the admin client, passing the user; the function checks that the project is theirs and that the version has not moved
(on a conflict the tool retries once). A browser cannot save (HTTP 403).

**Tools** (on the selected project):

| Tool | Does |
|---|---|
| `contract {agent}` | Tables and limits, views, invariants, and that agent's write scope |
| `query {table, where?, fields?, expand?, limit?}` | Records of one table; `expand` resolves references one level |
| `write {agent, reason, ops, dry_run?, if_version?}` | One batch, checked against every rule and saved whole or not at all; refusals list each rule and what is allowed |
| `log {since_version? \| limit?}` | Recent changes, newest last |
| (no `reset` since v0.11.0) | The package's `reset` verb is `scripts/demo-project.mjs`, run from Claude Code (Nela, 2026-10-23) |

Claude plays each of the ten agents by naming it in `agent`; the validator enforces that agent's scope.

**Pages.** `scripts/templates.mjs` builds each view's HTML from `vendor/bpag` into one self-contained page (theme, the
ported runtime and the schema inlined) and, with `--upload` (Nela, `CANTAB_SERVICE_KEY`), upserts `view_templates` and
uploads the deck to the public bucket `engagement-assets` (`bpag/scale-up-proposal.pdf`). Rerun it after any change to
the pages. `templates/bpag/runtime.js` is the package's runtime with one change set, listed in its header: data from
`project_read` / `project_version` through `window.parent.CP_HOST`, the schema from `window.CP_SCHEMA`, embed mode
(no brand, no agent rail; the engagement line stays), and the empty-project message. The pages load IBM Plex from
Google Fonts and pdf.js from cdnjs.

**Built from the package:** `scripts/build-package.mjs` writes `supabase/functions/mcp/package.ts` (schema,
seed with the deck's public address, demo requests, validator). Rerun after any change to `vendor/bpag`.

## 5. Tests and checks

| What | Result |
|---|---|
| Unit tests (`deno test` in `supabase/functions/mcp`) | 51 pass, including the package's demo through `write`: steps 1–9 commit at versions 7–15, step 10 refused ("text is 122 characters, allowed ≤ 110"), the result still valid |
| Migrations, dry-run on live in a rolled-back transaction | View header 16/16; engagement 18/18 (saves refused to the browser and to another user, conflict, Siniša sees none of the test user's data, the new keys) |
| Engagement tools live as `claude@test.com` (project `project:10` "Dummy - Big Pharma AG") | 21/21: reset, contract, query, the ten demo steps in about 1 s each, log, page read, browser save refused |
| Pages offline (session 2's harness, `templates/bpag/test/`) | 25/25: each page at 1280 and 400 px, empty state, empty → data, redraw with marker |
| Pages live, headless on `os.cantabpi.com` | All eleven render with the Big Pharma data, no notice or script error, no rail, no horizontal scroll at 400 px; a write redraws and marks the change about 0.5 s after the save, without reloading the frame; view switches show the right page; the deck renders through pdf.js |
| Header live, headless | Slot in view, Claude writes there, click saves and shows, conflict line at 400 px, badge fades |
| After the tables migration (§7.1), live (`templates/bpag/test/live.mjs`) | Database, tools (demo 1–9 at 7–15, 10 refused, browser save 403) and the eleven pages at 1280 and 400 px rechecked; a write marks Home about 0.6 s after the save. Details: [archive/engagement-tables-status.md](archive/engagement-tables-status.md) §4 |
| POC loop (2026-10-21) | 9/9: PDF at a page, page follows in about 1 s, dashboard, a new sale moves it, closed view empties, another user's slide not found |

The test user is left with the demo at the seed and Atlas selected. Findings go in [test_tracker.md](test_tracker.md).

## 6. Open

| Item | Owner |
|---|---|
| The full demo in claude.ai on Nela's own "Dummy - Big Pharma AG" project; the desktop-app browser pane; the wordmark click (not checked headless) | Nela |
| Meaning of "view does not change" (Claude's reading: same slot and address, content switches) | Siniša to confirm |
| First-iteration choices to reconsider: Claude writes to the slot in view unless the user names one; the page shows no project; following off | Nela, later |
| Sign-out on the view page | Later |
| Fonts and colours: the pages use IBM Plex, the header Raleway and Lora; colours parked | Later |
| Until §7.4: `view_agent_apply` is callable from the browser (a write recorded as `agent`); the other tools act as the user (RLS only) | §7.4 |

## 7. Next session — NOT built

Scope agreed by Nela on 2026-10-22. Plan each item on Opus before building; order below.

### 7.1 The 27 package tables as real tables

**Built and live 2026-10-22:** [archive/engagement-tables-status.md](archive/engagement-tables-status.md).

Replace one JSON row per table with one Postgres table per package table, so the data can be queried with SQL.

- **Generator** (`scripts/gen-engagement-tables.mjs`): from `_schema.json`, one migration with a table per package table:
  `project_id`, `profile_id`, the package `id` (text) with primary key (`project_id`, `id`), typed columns (dates,
  numbers with their decimals, enums as checks, `ref_list` as `text[]`), the four `_meta` columns, and a position column
  so records keep their order. Row security generated. Loose rules only (types and keys): the validator stays the real
  check, so the two cannot disagree.
- **Reads:** `engagement_read` assembles each table back into the package's array (same field names, empty fields left
  out, same order), so the validator, the tools and the pages do not change.
- **Saves and reset:** per touched table, delete the project's rows and insert the new ones, in one transaction.
- **Data:** a one-off move of the existing datasets; a round-trip test (seed saved and read back must match exactly).
- **Cost:** a change to the package's data format means rerunning the generator and a new migration.
- Estimate about 4–5 h.

### 7.2 Tool names as in the package

**Built and live 2026-10-22 (function v0.10.0):** [archive/engagement-tools-status.md](archive/engagement-tools-status.md). Was:

Rename `engagement_contract`, `engagement_query`, `engagement_write`, `engagement_log`, `engagement_reset` to the
package's verbs `contract`, `query`, `write`, `log`, `reset` (none clashes with an existing tool). Tests, docs, a
claude.ai reconnect. About 30 min.

### 7.3 Pages served as files

Serve the package's pages and data the way the package expects, so `runtime.js` runs **unchanged** (only its base
address set):

- the pages as plain files, and `data/<table>.json` and `data/_version.json` served from the database for one project by
  the function, behind a short-lived signed address (the page sends no sign-in);
- the Lovable frame points at the page's address instead of `srcdoc`;
- `templates/bpag/runtime.js`, `scripts/templates.mjs` and `view_templates` are retired or kept as a fallback (to decide).

**Cost to weigh:** with the runtime unchanged there is no embed mode, so the package's own header and agent rail show
inside the frame under ours, unless Lovable hides them with CSS. Where the plain files are hosted is to decide in the
plan (Supabase serves no HTML from functions). About 2–3 h. **Since 2026-10-23** Nela wants one header only (no second
header, no in-page view title, done in our runtime's embed mode), so this plan must settle how the unchanged runtime
keeps to that before anything is built.

### 7.4 The other tools under Aleph's pattern (P14)

Decided by Nela on 2026-10-22: the remaining tools run their database work under the service role with explicit user and
project filters in code, as `write` does; RLS stays for browser paths; a test proves another user's rows stay
invisible. About 3–5 h.

### 7.5 The ten agents — Nela to decide

A) a Cantab OS skill per agent (role, scope, view, demo actions), about 1–2 h; B) one MCP address per agent with the
agent fixed, one claude.ai connector each, about 2–3 h; C) autonomous agents through the Claude API, a separate project.

## Comments for Nela (proposals, not in the build)

- A "Show in view" button on slide rows in the in-chat files view would call `view` directly.
- A dashboard over the real `todos` table would show the page following agent edits made with existing tools.

**Changelog** (rationale in DECISIONS.md; file history in git; Lovable rounds in COMMS.md)
- v1.5 (2026-10-23) — Swept: the home of the package port (§4) and the next-session scope (§7); links to the archived plans; §7.3 noted against the one-header decision.
- v1.4 (2026-10-23) — §4: the project's data under project names (schema `project`, `project_*` functions), one name for project and engagement record; the demo set up from Claude Code (`scripts/demo-project.mjs`), no `reset` tool; live in v0.11.0. → DECISIONS.md 2026-10-23
- v1.3 (2026-10-22) — §7.2 live: the five tools renamed (`contract`, `query`, `write`, `log`, `reset`), function v0.10.0. → DECISIONS.md 2026-10-22
- v1.2 (2026-10-22) — §7.1 live and rechecked (§5).
- v1.1 (2026-10-22) — §7.1 built (real tables in the schema `engagement`); §1 and §4 updated. → DECISIONS.md 2026-10-22
- v1.0 (2026-10-22) — Rewritten as a living reference: what is built by layer, tests, open items, the next session's
  scope (§7). The POC plan, the header plan and the port plan are carried out; their answers and briefs are compressed
  below and kept in DECISIONS.md and COMMS.md.

<details><summary>Earlier versions (v0.1–v0.23, 2026-10-21 to 2026-10-22)</summary>

- v0.15–v0.23 (2026-10-22) — Phase 2 port of Siniša's package planned (P1–P14: one JSON row per table; validator in the
  function; Aleph's pattern for saves; pages in a table, deck in public Storage; the package's views replace the header's
  agents), built in parallel sessions, checked live. → DECISIONS.md 2026-10-22
- v0.5–v0.14 (2026-10-22) — View header planned (questions Q1–Q9, assumptions A1–A8) and built with Lovable in four rounds:
  icons, the click (`view_set_template`), settings kept per view, slot in view (`view_seen`), project on each slot (Q3,
  Siniša), `os.cantabpi.com`; Nela then removed the chip, the account menu and following. → DECISIONS.md 2026-10-22
- v0.4 (2026-10-22) — Slides follow the selected project (projects, v0.7.0).
- v0.1–v0.3 (2026-10-21) — Live views POC from Siniša's memo "Server-driven UI for agent-operated apps" and his answers
  (dashboard from a fixed template over a dummy table; PDF our choice): `ui_views`, the `view` tool, the PDF and dashboard
  templates, Lovable page, two Realtime fixes, follow-Claude. → DECISIONS.md 2026-10-21

</details>
