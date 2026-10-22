# Cantab OS — Live views POC: plan and status

| Status | Version | Owner | Last updated |
| --- | --- | --- | --- |
| Current | v0.17 | Nela | 2026-10-22 |

Plan for a proof of concept of Siniša's memo *Server-driven UI for agent-operated apps* (received
2026-10-21): the agent points a live browser page at a PDF or a fixed dashboard, and the open page
follows within a second or two. Approved by Nela on 2026-10-21; build in progress (§6 Progress). Read whole.

**Since 2026-10-22 (projects, function v0.7.0):** `slides` follow the user's selected project
([projects-status.md](projects-status.md)). The `view` tool finds only the selected project's slides, and the page,
reading `slides` as the user, shows a PDF view of a slide from another project as not found after a switch.
`ui_views` and `demo_sales` are not project-scoped. Accepted for the POC; v2 phase 2 (the views) builds on this
POC and decides how views relate to projects ([Diagram_input.md](Diagram_input.md) §2.1).

**Phase 2 has started (2026-10-22):** §7 plans the view header. Sections 1–6 are background for it, not
constraints: the POC may be rebuilt.

Status values: `planned` (agreed, not built) · `built` (deployed and tested) · `changed` (built, then
altered; note what changed) · `open` (needs a decision).

## Goal and scope

**Goal:** show that one MCP tool call can change what an already-open browser page shows, with no
reload and nothing but a confirmation going back to the model.

**Siniša's answers (2026-10-21):** dashboard: any dashboard from a fixed template, reading a dummy
table (may be new). PDF: our choice. Both "figure it out, for POC".

**Demo:** in the Claude desktop app, the user opens `…/v/1` once, signed in, in the browser pane.
In the chat: *"Show me the company intro deck at page 3"* opens the PDF there.
*"Now the sales dashboard, EMEA, last 30 days"* switches the same page to the dashboard. A new row in
the dummy table moves the dashboard numbers without a reload.

**In scope:** a slot table and its functions (§2), the `view` tool (§3), a PDF view and one dashboard (§4),
dummy data for both (§2.3, §2.4), and the loop test (§6).

**Out of scope:** everything the memo lists that the POC does not need to prove the loop (§5), editing
content, Google files, real data.

## 1. Decisions taken (Nela, 2026-10-21)

1. **Spec change: Cantab OS gets a front end** for live views. The spec's "backend only" no longer
   holds for this. See [DECISIONS.md](DECISIONS.md) 2026-10-21.
2. **Lovable hosts the page for the POC**, as a new route `/v/:slot` in the existing app
   (`cantabpios.lovable.app`); reconsider after the POC. The alternative, our own page in this repo,
   would need a new host (Supabase probably serves HTML from functions as `text/plain`; not verified).
   Accepted costs:
   - The page code lives outside this repo, so the memo's shared registry (memo §5) cannot hold. The
     template keys and enums are kept in step by hand: §3, §4 and the COMMS request.
   - Lovable's boundary widens from "only calls Supabase Auth" to reading tables, calling functions and
     signing Storage URLs, always as the signed-in user. COMMS ownership is updated with the request.
3. **Both side-window approaches stand.** Google files open by their url in the host's browser pane
   (questions in [open-questions.md](open-questions.md)); our own content (PDFs, dashboards) shows in
   live views.
4. **The POC comes first**, before planning the improvements from the test rounds.
5. **The demo runs in the Claude desktop app**, with the view in its browser pane. Step 0 checks that
   the pane keeps the Lovable sign-in and follows the page live.

## 2. Database — `planned`

All changes are additive, in one new migration. Nela runs `db push`.

### 2.1 Table `ui_views` (the slots)
The memo's table, cut to the POC and renamed to our conventions:
`id`, `profile_id` (not `user_id`), `slot_no` 1–10, `template` (`pdf` | `dashboard`), `agent_params`
jsonb, `ui_params` jsonb, `version` int, `last_writer` (`user` | `agent`), `last_active_at`,
unique (`profile_id`, `slot_no`).
Dropped from the memo: `scope_id` (we have no workspaces), `locked`, the chat singleton index.
RLS: select own rows only. Insert, update and delete revoked; writes go through the functions in §2.2.

### 2.2 Functions (security definer, acting on `auth.uid()`)
| Function | Caller | Does |
|---|---|---|
| `views_list()` | page, tool | the user's slots |
| `view_open(slot)` | page | bumps `last_active_at`; returns the row or `empty` |
| `view_update(slot, expected_version, agent_patch?, ui_patch?)` | page | shallow merge with compare-and-set; `ok`, `conflict` or `gone` |
| `view_agent_apply(template, params, focus, slot?)` | tool | picks the slot (below), validates, writes with `last_writer = 'agent'` |
| `view_close(slot)` | page, tool | deletes the row |

Slot choice for the agent: the slot given; else the most recently active slot with the same template; else the lowest free
slot; else `slot_limit` with the list.

**Deviation from the memo:** the memo calls the agent functions with the service role. Our MCP function
has no service-role key and acts as the signed-in user, so `view_agent_apply` runs as the user too.
The access model stays one path (RLS), and no new secret is needed. Side effect: a user could call it
from the browser and be recorded as `agent`. That is harmless for the POC.

### 2.3 Dummy table `demo_sales` (for the dashboard)
`id`, `profile_id`, `sold_on` date, `region` (`emea` | `amer` | `apac`), `product` (four dummy
products), `amount` numeric. Per-user RLS like the other tables. Seeded by a deterministic generator:
about 200 rows per user (Nela, Siniša, `claude@test.com`) over the 200 days up to the seed date, so
all four periods have data. It is not an OS entity, so it gets no labels and no `list` or `get` support.

### 2.4 PDFs
No bucket exists, and none of the 11 slides has a `storage_url`. The plan:
- A private bucket `slide-pdfs` with path `<user id>/<slide label>.pdf`. A Storage policy lets a user
  read only their own folder.
- Two multi-page dummy PDFs (a 6-page "Company intro deck" and a 4-page "Acme pitch"), generated with a
  Node script (`scripts/slide-pdfs.mjs`). Each page carries a large page number, so "page 3" is visible at a glance.
- Upload for each of the three users, and set `slides.storage_url` to the object's Storage address,
  `https://…/storage/v1/object/slide-pdfs/<user id>/<label>.pdf`. That address needs a token, so the page
  signs a short-lived URL from the path in it. The upload needs the service-role key, so Nela runs the
  script with `CANTAB_SERVICE_KEY` in `.env.local`.

### 2.5 Realtime
Add `ui_views`, `demo_sales` and `slides` to the `supabase_realtime` publication. Postgres changes apply
RLS, so a tab receives only its own user's rows.

## 3. Tool `view` — `planned`

The twelfth tool, in the MCP function (v0.6.0). Contract from memo §3, cut to the POC:

| Argument | Type | Meaning |
|---|---|---|
| `template` | `pdf` \| `dashboard` | omit to list the user's views |
| `document` | string | pdf: a slide label, e.g. `slide:5` (from `list slides`) |
| `page` | integer | pdf: page to open at, 1-based; written into `ui_params` as the memo's agent focus |
| `dashboard` | `sales_overview` | dashboard: the only key in the POC |
| `filters` | `{period: 7d\|30d\|qtd\|ytd, region: emea\|amer\|apac}` | dashboard: omit for defaults (30d, all regions) |
| `slot` | integer | view number; omit to reuse or open one |

- **Resolver:** label → id at the tool boundary. An unknown label, or a slide without a PDF, is
  `not_found`. Every parameter is validated before the write (`invalid_parameter`).
- **Return:** `{status, slot, url, message}`, e.g. *"View 1 shows slide:5 at page 3. If the user has view
  1 open it has updated; if not, give them the url once."* Never the content.
- **Description:** the memo's wording: showing is deliberate; never call it just because data changed.
- Errors are normal tool output: `slot_limit`, `not_found`, `invalid_parameter`, `conflict`.

## 4. The page `/v/:slot` — `planned` (Lovable, if §1.2 is A)

One route, signed in with the existing session. On load it calls `view_open(slot)` and subscribes to its
own `ui_views` row. On each change it re-renders the template. An empty slot says "Ask Claude to show
something here."

**`pdf` template.** Agent tier `{slide_id}`; UI tier `{page}`.
- The page signs a 1-hour URL for the slide's Storage path, and re-signs it when the slide changes or
  the URL nears expiry.
- It shows the file in an `<iframe>` at `#page=N` (Chrome and Edge viewers honour it), with an
  always-visible "Open PDF" link for Safari and iOS.
- The user's own page changes go through `view_update` (ui tier).

**`dashboard` template, key `sales_overview`.** Agent tier `{dashboard, filters}`; the user may change
filters too (same tier, via `view_update`).
- Fixed layout: three tiles (revenue, deals, average deal), revenue by week (line), and revenue by
  region (bar, or by product when a region is set).
- One named query in our repo: SQL function `dashboard_sales_overview(period, region)`, security
  invoker, returns JSON. The layout is in the page; the agent sends only the key and the enums.
- Refreshes on realtime changes to `demo_sales`, batched at 400 ms.

**Conflicts:** if `view_update` returns `conflict`, the page reloads the row and, for a UI-only patch,
retries once. Status shows inline next to the control, not as a toast.

## 5. Memo items left out of the POC

| Memo item | Why it is left out |
|---|---|
| Locks (§1.2, `locked`) | Nothing to protect yet; add when users keep views they care about |
| Presence and the leader tab's "Assistant opened view N — Open" (§1.7–8) | For the POC the user opens the url once. Changed 2026-10-21: the open page follows Claude to another view itself (DECISIONS 2026-10-21); presence is still left out |
| Idle pruning, home view, `/` → home (§1.11) | Slots are few and dummy; add with the full rollout |
| `chat` template, workspace scope | The chat is the host's; we have no workspaces (open multi-user question) |
| `ui_v2` / `dev_mode` flags, side-by-side rollout (§1.14) | There is no old UI to run alongside |
| Content editors and "Reload theirs / Keep mine" (§1.12) | The POC edits no content |
| PDF build status (§4) | We do not generate PDFs |
| Cross-view "open new view" (§1.10) | One view is enough to prove the loop |

## 6. Build order and testing

| Step | What | Who runs it |
|---|---|---|
| 0 | Spike in the desktop app's browser pane: the Lovable page keeps the sign-in, subscribes to an RLS table with the user's session, and opens a PDF at `#page=N`. Folded into step 4's request as its first check | Claude writes the request; Lovable builds; Nela checks |
| 1 | Migration §2.1–2.5 and the seed | Claude writes; Nela runs `db push` |
| 2 | Dummy PDFs: generate, upload, set `storage_url` | Claude writes the script; Nela runs it (service key) |
| 3 | `view` tool, unit tests, v0.6.0 | Claude; deploy on Nela's go; reconnect in claude.ai |
| 4 | Page `/v/:slot` | COMMS request by Claude; Lovable builds |
| 5 | Loop test, then the claude.ai demo | Claude (headless), Nela (claude.ai) |
| 6 | Docs: tools-status, data-structure-status, DECISIONS, HANDOFF, Document Log, COMMS | Claude, in the same change |

**Progress (2026-10-21):**

| Step | Status | Note |
|---|---|---|
| 1 Migration | `built` | `supabase/migrations/20261021120000_live_views.sql`. Dry-run on the live database inside a rolled-back transaction: 19 checks passed (slot choice, conflict, refusals, RLS for Siniša, dashboard query, no direct insert). Applied by Nela on 2026-10-21. Checked live: private bucket, Realtime on the three tables, 252–281 sales rows per user |
| 2 PDFs | `built` | `scripts/slide-pdfs.mjs`, run by Nela on 2026-10-21: six slides (each user's intro deck and Acme pitch). Checked as `claude@test.com`: own PDF signs and downloads (6 pages); Nela's is refused |
| 3 Tool | `built` | `views.ts`, function v0.6.0; 35 unit tests pass, including a check that the enums match the migration. Deployed on Nela's go on 2026-10-21 and checked live as `claude@test.com` (list, pdf at a page, dashboard, view reuse, another user's slide, unknown dashboard); test views removed. Reconnect in claude.ai to see it |
| 4 Page | `built` | Published by Lovable at `/v/1` on 2026-10-21 (COMMS). Realtime test by Claude found two gaps: deletes never reach a filtered subscription, and a change right after subscribing can be missed. Fixes requested (COMMS 2026-10-21, two Realtime fixes) Both fixed; `id` on the returned view (migration `20261021130000`); follow-Claude added (DECISIONS 2026-10-21) |
| 5 Loop test | `built` | Headless Chromium as `claude@test.com` against the live page, 2026-10-21: 9/9 pass. Covered: PDF at a page on open; an agent page change reaches the open page (1.2 s); the page follows Claude to a new view (1.0 s) with the banner and no reload; the dashboard renders; a new sale moves it (0.7 s); a closed view shows empty (0.4 s); another user's slide is not found. Not covered here: the conflict race (checked in SQL on 2026-10-21). Nela's desktop-app check is next |

**Realtime, as tested on 2026-10-21:** inserts and updates arrive in 0.3–0.7 s. Delete events cannot be filtered, so the page needs an unfiltered delete listener, which also receives other users' row ids (the id only, no data). That is acceptable with dummy data; revisit before real data (for example, mark a slot cleared with an update instead of deleting it).

**Differences from v0.2, decided during the build:**
- `storage_url` holds the object's Storage address, not a bare path. The write and edit tools only accept a web
  address in that field.
- The second PDF is "Acme pitch", not "Board update": every user has an Acme pitch, but only Siniša has a
  Board update.
- The spike (step 0) is folded into the Lovable request: it needs the database anyway.

**Loop test (memo §5, first lesson):** a headless browser (Playwright through `npx`) signs in as
`claude@test.com`, opens `/v/1`, and the script calls `view` over MCP as the same user. It checks that the page shows
the PDF at the page asked for, then the dashboard, within 2 s and without a reload. Then a UI page change
races an agent write: one wins and the other gets `conflict`, never a silent overwrite. Then a
`demo_sales` insert moves the tiles.

**Acceptance:**
1. Both templates update an open page in under 2 s.
2. The tool returns no content.
3. Unknown labels and bad enums are refused.
4. Conflicts are reported, never silently overwritten.
5. Siniša sees none of Nela's slots, sales or PDFs (negative check).

Findings go in [test_tracker.md](test_tracker.md).

## 7. Phase 2, step 1: the view header — `open`

The shell every v2 view sits in (Siniša's v2 doc, "UX/UI for view"). Design split agreed by Nela on 2026-10-22:
Claude settles what the header is and does (this section) and drafts every Lovable message; Lovable does the
look, where it can be seen live. Claude and Lovable cannot talk to each other: Nela carries each message, and
every sent message is also logged in [COMMS.md](COMMS.md).

**Ground rules (Nela, 2026-10-22):** sections 1–6 are background, not constraints. Anything built for the POC
may be rebuilt from scratch. Every answer below is provisional.

**In scope:** the header bar, what each of its controls writes or reads, the page states around it, and the
backend change the icons need. **Out of scope:** what each of the nine views shows (Siniša's views package),
the domain move (A8).

### 7.1 Open questions and working assumptions

**Open questions** — each needs an answer before the backend change (7.2). Claude's suggestion stands until then.

| # | Question | Who answers | Claude's suggestion |
|---|---|---|---|
| Q1 | Which view icons? | Nela | **Answered 2026-10-22:** the agents in Nela's picture, in four phases, the same for every project (A6). Two follow-ups: Q7 |
| Q2 | Which slot does a change go to? | Nela | **Answered 2026-10-22:** the slot the user has in view, unless the user names another. Not covered by the POC rule; designed in 7.6 |
| Q3 | Are slots per user or per project? | Siniša | **Answered 2026-10-22 (Siniša):** per user; each slot has a project foreign key. Claude's reading: ten slots per user; a slot shows the project set on it, which is the selected project when Claude or the user last wrote it (7.2 item 7) |
| Q9 | With a project on each slot: does the header chip show the slot's project or the selected one? | Nela | **Answered 2026-10-22, first iteration (simplest):** the chip shows the selected project and picking one only changes the selection (`select_project`), as in message 7.7. Slots are not moved. **To reconsider later:** a slot can then show a different project from the chip |
| Q4 | Does switching view keep the old view's settings (PDF page, filters)? | Nela | **Answered 2026-10-22:** yes, as suggested (built, 7.2) |
| Q5 | Keep the POC views `pdf` and `dashboard` for Claude only, with no icon, until the v2 views replace them? | Nela | **Answered 2026-10-22:** yes, as suggested (built, 7.2) |
| Q7 | The ninth and tenth icons? | Nela | **Answered 2026-10-22:** the eight agents plus two dummy views (A6) |
| Q8 | Colour: the picture's blues or round 1's Cantab red? | Nela | **Parked 2026-10-22:** ignore for now; round 1's colours stay |
| Q6 | Accept Lovable's round-1 proposals: (b) a "Reload" link on "This page needs updating"; (c) at 400 px hide "View N" and the "Follow Claude" text | Nela, after the review | Accept both |

**Working assumptions** — what the design and the plan use now; any of them can change.

| # | Assumption | Source |
|---|---|---|
| A1 | Bar, left to right: Cantab OS wordmark · view name and a small "View N" · the ten view icons to the right edge. **Changed 2026-10-22 (Nela):** no project chip, no account menu (so no sign-out on the view page), no Follow Claude toggle. No sidebar | v2 doc; rounds 1–4 |
| A2 | **Removed 2026-10-22 (Nela):** the page shows no project and cannot switch it; the project is picked in the chat. Q9 is moot for now | Nela |
| A3 | "Updated by Claude" badge fades about 4 s after each Claude write. **Following Claude to another slot is off** (`FOLLOW_CLAUDE = false` in the page, Nela 2026-10-22): with the slot-in-view rule Claude writes to the open view anyway; a view named by the user in chat does not pull the page there | Nela; round 4 |
| A4 | Page states: signed out, loading, empty slot, view not built yet, page needs updating, reconnecting, no project selected | Brief 7.4 |
| A5 | Below about 720 px: chart mark, one "Views" menu, emoji-only project button | Round 1 |
| A6 | **Superseded 2026-10-22 by §8 P9 (Siniša's ten views).** Was: icons in phase order, no dividers and no phase in the tooltips (Nela, 2026-10-22): the tooltip is the name only. **Diagnose** (`Search`): Workflow Mapper `Workflow`, Research Analyst `FileSearch`. **Design** (`Lightbulb`): Value Case Calculator `Calculator`, GxP and AI Act Checker `ShieldCheck`. **Deliver** (`Settings`): Presentation Builder `Presentation`, Project Manager `CalendarCheck`. **Govern and learn** (`Shield`): Engagement Memory `Brain`, Red-Team Reviewer `SearchCheck`. Then two dummy views: **Dummy view 9** `Box` and **Dummy view 10** `Boxes` (keys `dummy_9`, `dummy_10`). Names from Nela's picture (2026-10-22); Lucide names are Claude's reading of it. A view not built yet is dimmed ("Coming soon") but can be picked | Nela's picture, replacing the v2 doc's nine |
| A7 | Brand from cantabpi.com: logo, red, Raleway and Lora; red only for the current view, Claude's signals and the toggle; light and dark | Lovable round 1 |
| A8 | Address `os.cantabpi.com`, live 2026-10-22; `cantabpios.lovable.app` redirects there. Routes `/1…10` come with the wire-up (step 5) | Nela; 7.5 |

### 7.2 Backend change — `built`

Migration `supabase/migrations/20261022140000_view_header.sql`, applied by Nela on 2026-10-22; function v0.8.0
deployed the same day. Checked live as `claude@test.com`: `view` writes to the slot in view and says so, a named slot
is used, an unknown key is refused; a click on an empty and a full slot works, a stale click gets `conflict`; test
views closed. Dry-run on the live database in a rolled-back transaction on 2026-10-22, as `claude@test.com`: 16 checks
passed (slot in view, slot given, slot 1 with none seen; icon click on a full and an empty slot; conflict; settings kept
in `state` and the switched-to view's removed; refusals of a non-header click, parameters on a header view and slot 11;
`view_open` and `view_update` unchanged; no direct write). 42 unit tests pass.

**As built:** the page needs no change to keep working. `agent_params` and `ui_params` stay the current view's
settings; `state` holds only the views switched away from (so Q4 is answered as suggested). Q5 as suggested: the icon
click (`view_set_template`) accepts only the ten header views. `project_id` is set on agent writes and clicks, not on the
page's own filter changes. Not done: `profiles` in the Realtime publication (the chip refreshes on focus, 7.7), and
the page reading a slide through the slot's project (later, with Q9).

As planned:

1. **Template keys.** `ui_views.template` accepts the agent keys `workflow_mapper`, `research_analyst`,
   `value_case_calculator`, `gxp_ai_act_checker`, `presentation_builder`, `project_manager`, `engagement_memory`,
   `red_team_reviewer`, `dummy_9`, `dummy_10`, plus `pdf` and `dashboard` (Q5). Views not built yet take no parameters.
2. **Settings per template (Q4).** Replace `agent_params` / `ui_params` with one `state` map:
   `{ "<template>": { "agent": {…}, "ui": {…} } }`. The page reads `state[template]`; a missing entry means the
   template's defaults.
3. **The click.** A new function `view_set_template(slot, expected_version, template)`: the page's only new
   write. Compare-and-set like `view_update`, `last_writer = 'user'`, version up. On an empty slot it creates the row.
4. **Project on the page (A2).** Add `profiles` to the Realtime publication so a project picked in chat reaches
   the chip; the page reads the selected project with the existing functions.
5. **The `view` tool** accepts the new keys, writes into `state`, and its description lists which views exist.
6. **The slot in view (7.6):** `profiles.current_slot` and `current_slot_at`, a page function `view_seen(slot)`,
   and the agent's new slot rule.
7. **Project on each slot (Q3):** `ui_views.project_id` (FK → `projects`, not null), set to the selected project on
   every write. The page reads that project's items, so a slide from another project no longer shows as not found:
   the read goes through a function that checks the slot's project, not the selection (RLS on `slides` follows the
   selection).
8. The function versions, unit tests, [Diagram_input.md](Diagram_input.md) and the tool docs change in the same build.

### 7.3 Steps

**Fast path (Nela, 2026-10-22), done:** published by Lovable on 2026-10-22 (COMMS); dividers removed in a follow-up.
 the new header goes onto the live page `/v/:slot` now, before the backend
change (message 7.7). Icons show but do not switch views yet; everything else in the bar uses functions that
already exist.

| Step | What | Who | Status |
|---|---|---|---|
| 1 | Answer the open questions Q1–Q6 in 7.1 | Nela, Siniša | `open` |
| 2 | **Design round 1:** Lovable builds the header on a separate route with made-up data, no backend calls (message 7.4) | Nela sends; Lovable builds; Nela reviews | `built` 2026-10-22, in the Lovable preview at `/design/header` (COMMS 2026-10-22); Nela's review next |
| 3 | Rounds 2+: Nela's feedback to Lovable directly; Claude drafts a message only when a change touches behaviour or data | Nela, Lovable | `planned` |
| 4 | Plan the backend change (7.2) against the chosen design; migration and tool | Claude writes; Nela runs `db push`; deploy on Nela's go | `built` 2026-10-22: applied, deployed, checked live |
| 5 | **Wire-up message:** Lovable connects the header on `/v/:slot` to the backend (7.8) | Claude drafts; Nela sends after the deploy | `built` 2026-10-22, published by Lovable (COMMS) |
| 6 | Test the live page headless, then Nela in the desktop app | Claude, Nela | Headless 5/5 pass (2026-10-22, COMMS); Nela's desktop-app check open |

### 7.4 Draft message for Lovable: design round 1 (not sent)

Nela: paste everything between the lines into Lovable. Fill in or delete the brand line first (A7). Tell
Claude when it is sent, so it is logged in COMMS.

---

**Design the header for the Cantab OS view page. Design only: no backend, made-up data.**

**Context.** `/v/:slot` shows one "view" of Cantab OS, a consulting OS that an AI assistant (Claude) also drives:
Claude can switch the view and change what it shows, and the page follows live. We are replacing the page's
header with a proper one. It will sit above nine different views, so it should be calm, compact and polished,
and leave the space below to the view.

**Where.** A new route **`/design/header`**. Do not change `/v/:slot`, `/login` or `/oauth/consent`, and make no
calls to Supabase on the new route. All data is made up in the component.

**The bar, left to right:**
1. **"Cantab OS"** wordmark.
2. **The name of the current view**, with a small muted "View 3" next to it.
3. **Nine view icons**, Lucide, each with a tooltip giving its name: Engagement starter `Rocket`, Analyst
   `Sheet`, Value calculator `Calculator`, Presentation builder `Presentation`, Project Manager `GanttChart`,
   Team manager `Users`, Story builder `BookOpen`, Agent builder `Bot`, Proposal builder `FileSignature`. The
   current one is clearly active. Views not built yet are dimmed, with the tooltip "<Name> · Coming soon", and
   can still be clicked. Propose better icons if you see them.
4. **On the right:** a **project chip** (emoji icon and name, e.g. "🧭 Dummy - Project Atlas"; a click opens a
   list of two or three projects with the current one ticked), a small **"Follow Claude"** toggle, and an
   account menu with "Sign out".

**Under the bar,** when needed, a thin line: "Claude switched to view 2 · Back to view 1". Next to the view
name, a short-lived badge "Updated by Claude" that fades after a few seconds.

**Below:** a centre pane with a placeholder for the view: its icon, its name and "Coming soon".

**States to show.** Put a small control panel at the bottom of the route (not part of the design) to switch
between: normal · view not built yet · empty view ("Pick a view above, or ask Claude") · Claude just switched
views (the line appears) · Claude just updated this view (the badge) · reconnecting (a small dot on the bar) ·
no project selected (chip says "Pick a project") · the page needs updating ("This page needs updating").

**Behaviour to fake:** clicking an icon makes it active at once, and the centre pane changes after about 400 ms
(the real page will wait for the backend). Picking a project changes the chip.

**Widths.** It must work from 1440 px down to about 400 px: the Claude desktop app shows this page in a narrow
side pane. Below about 720 px, fold the nine icons into a single "Views" menu and shorten the wordmark.

**Brand.** <Nela: add colours, logo and font here, or delete this line and let Lovable propose a restrained
palette.> Light and dark mode both.

**Please send back:** the route's URL, a sentence on the design choices, and anything in this brief you would
change. Two variants side by side are welcome if you are unsure.

---

Sent by Nela on 2026-10-22 without the brand line; Lovable's answer is in COMMS.

### 7.5 The address `os.cantabpi.com` (added 2026-10-22)

Checked by Claude on 2026-10-22, once live: `os.cantabpi.com` serves the app over HTTPS (`/`, `/login`, `/v/1`).
`cantabpios.lovable.app` now **redirects** every path to it, keeping the path and query
(`/oauth/consent?authorization_id=…` included), so the OAuth consent step still works through the redirect.
A user signed in on the old address has to sign in again on the new one (the session is stored per address).
This brings the address switch forward from step 5 (A8); only the routes wait:

| # | What | Who | Status |
|---|---|---|---|
| 1 | Supabase dashboard, Authentication → URL Configuration: Site URL `https://os.cantabpi.com`; add `https://os.cantabpi.com/**` to the Redirect URLs, keeping the Lovable one. `supabase/config.toml` already matches | Nela | `built` 2026-10-22 (Nela) |
| 2 | The `view` tool's link (`VIEW_BASE_URL`) to `https://os.cantabpi.com/v/`; function v0.7.1; 39 unit tests pass | Claude; deploy on Nela's go | `built`: deployed 2026-10-22; checked live as `claude@test.com` (`view` returns `https://os.cantabpi.com/v/1`; test view closed) |
| 3 | Routes `/1…10`, with `/v/N` redirecting there | Lovable, in the wire-up message | `planned` |
| 4 | Check: sign in on `os.cantabpi.com`; Disconnect and Connect in claude.ai (consent on the new address); `view` returns the new link; loop test | Nela, Claude | `planned` |

### 7.6 The slot in view (Q2)

**Rule (Nela, 2026-10-22):** a change goes to the slot the user has in view. Claude uses another slot only when
the user names one ("show it in view 3").

**Not covered today.** The POC rule (§2.2) picks the given slot, else the most recently active slot with the
same template, else the lowest free slot. So "show the Acme pitch" while the user looks at a dashboard in view 1
opens view 2, and the page jumps there (Follow Claude). The header design assumed the same.

**Design (accepted by Nela 2026-10-22, as written; to reconsider after the first views are in use):**
1. **The page says which slot is in view.** It calls `view_seen(slot)` on load, when the tab becomes visible,
   and when the window gets focus. That writes `profiles.current_slot` and `current_slot_at`. On `profiles`,
   not on the slot row, because an empty slot has no row.
2. **Claude writes there.** `view` without `slot` uses `current_slot`; if the user has never opened a view,
   slot 1. With `slot`, that slot. The "same template" and "lowest free" rules and `slot_limit` go.
3. **Two screens** (the desktop app's pane and Chrome): the one used last wins. The server sees both, so this
   works across browsers, where the POC's `BroadcastChannel` does not.
4. **Follow Claude** is then needed only when the user names another slot. It stays, unchanged.
5. **What Claude is told.** The tool returns "View N, the one the user has open". If `current_slot_at` is older
   than 30 minutes, it adds "the user may not have it open: give them the url once".
6. **Tool description:** "Omit slot unless the user names a view number."
7. **Overwriting.** Replacing what is in view is intended. With Q4, the replaced view's settings stay in the
   slot, so the user can switch back with its icon.

### 7.7 Draft message for Lovable: header on the live page (round 2)

Nela: paste everything between the lines into Lovable. Tell Claude when it is sent.

---

**Put the new header on the live page `/v/:slot` now. Two changes to the design first.**

**1. Icons.** Replace the nine with these ten, in four phase groups plus one, with a thin divider between groups
and the phase name in each tooltip ("Diagnose · Workflow Mapper"):
- **Diagnose:** Workflow Mapper `Workflow`, Research Analyst `FileSearch`
- **Design:** Value Case Calculator `Calculator`, GxP and AI Act Checker `ShieldCheck`
- **Deliver:** Presentation Builder `Presentation`, Project Manager `CalendarCheck`
- **Govern and learn:** Engagement Memory `Brain`, Red-Team Reviewer `SearchCheck`
- **Other:** Dummy view 9 `Box`, Dummy view 10 `Boxes`

Keep your colours. Keep (a), (b) and (c) from your round-1 answer.

**2. On `/v/:slot`, replace the old header with the new one.** Keep `/design/header` as it is. The centre pane
(PDF, dashboard, empty state) and all Realtime, follow and conflict logic stay exactly as they are; only the bar
changes.
- **View name:** from the current view: `pdf` shows "Slides" plus the slide's name; `dashboard` shows
  "Sales overview"; empty shows "Empty". With the small "View N".
- **Icons:** shown, none active, all dimmed with the tooltip "<Name> · Coming soon". **A click does nothing yet**
  and writes nothing (the backend for it comes later).
- **Project chip:** real data. `rpc('project_summary')` returns `[{label, name, icon, selected, …}]`; show the
  selected one. Picking another calls `rpc('select_project', { p_label: label })`, then reloads the list and
  the view (`view_open`). Reload the list also when the tab becomes visible or gets focus (a project picked in
  the chat has no live event yet). No project selected: "Pick a project".
- **Follow Claude toggle, "Updated by Claude" badge, the "Claude switched to view M · Back to view N" line:**
  wire them to the existing behaviour (`last_writer`, the follow logic, `localStorage`).
- **Reconnecting dot:** when the Realtime channel is not `SUBSCRIBED`.
- **Account menu:** "Sign out" signs out and goes to `/login`.
- **Unchanged:** no direct table writes; only `view_update` and now `select_project` write.

**Please send back:** published, and anything that did not work as written.

---

### 7.8 Draft message for Lovable: wire up the icons and the slot in view (round 3)

Nela: v0.8.0 is deployed (2026-10-22), so this can be sent now. Paste everything between the lines.

---

**Make the header icons work on `/v/:slot`, and tell the backend which view is in front of the user.** The
backend is live. Nothing else on the page changes.

1. **View keys.** The ten icons map to these `template` values, in header order: `workflow_mapper`,
   `research_analyst`, `value_case_calculator`, `gxp_ai_act_checker`, `presentation_builder`, `project_manager`,
   `engagement_memory`, `red_team_reviewer`, `dummy_9`, `dummy_10`. `pdf` and `dashboard` stay as they are and have
   no icon.
2. **Active icon.** The icon whose key is the view's `template` is active; none for `pdf`, `dashboard` or empty.
   Icons are no longer dimmed; tooltip is the name only.
3. **Click.** `rpc('view_set_template', { p_slot, p_expected_version: view.version, p_template: key })`. On an empty
   slot pass `p_expected_version: null`. It returns `{status: 'ok', view}`, `{status: 'conflict', view}` (Claude
   changed it first: show the returned view, and the note "Claude changed this view; your click was not applied" next
   to the icons) or `{status: 'gone'}` (show empty). Highlight the clicked icon at once; render from the returned view
   and from Realtime as now. Clicking the active icon does nothing.
4. **Centre pane for the ten views.** Their parameters are empty for now: show the placeholder from the design
   (icon, name, "Coming soon"). Not "This page needs updating"; that stays for keys the page does not know.
5. **View name** in the bar: the view's name for the ten (e.g. "Workflow Mapper").
6. **Slot in view.** Call `rpc('view_seen', { p_slot })` on load (after `SUBSCRIBED`, next to `view_open`), when the
   tab becomes visible, and when the window gets focus; at most once every 5 seconds. Claude now changes the view the
   user has in front of them, so this decides where Claude's next change goes.
7. **Unchanged:** Follow Claude, the badge and the back line, the project chip, `view_update` for page and filters,
   the delete handling, no direct table writes.

**Please send back:** published, and anything that did not work as written.

---

## 8. Phase 2: Siniša's views package, ported onto Supabase — `open`

**Input (received 2026-10-22):** `03_documentation/input/bpag-final.zip` in the SharePoint root (contract 2.0, "Cantab Pi
agentic consulting environment: mock-up package") and the deck PDF next to it
(`Scaling-field-sales-AI-agents-across-the-EU.pdf`, the package's missing `deck/scale-up-proposal.pdf`). Demo client
Big Pharma AG (fictional), engagement "Agentic AI for field sales: pilot to scale". Ten agent views plus a home page,
27 tables of dummy data, a validator that refuses any write that would break a view, and a ten-step demo script.

**Decided by Nela, 2026-10-22:**
1. **Port it onto Supabase and our `view` tool**, instead of running the package's own file-based data tool.
2. **Siniša's list of views is the one.** The eight agents and two dummies in §7 (A6) are dropped.

### 8.1 What the package is

| Part | In the package | Fixed or data |
|---|---|---|
| Schema `data/_schema.json` | 27 tables, field limits, invariants (I01–I27, W01–W04), views and what each reads, placeholders, each agent's write scope | Fixed per contract version |
| Data `data/*.json` | One array of records per table; every record has `_meta {version, updated_at, updated_by, reason}`; `_version.json` `{global, tables}`; `_log.json` | Data, changed only by `write` |
| Validator `validator/validate.js` | `applyWrite(schema, data, request, {version, now})`: authorise by agent scope, apply, renumber, stamp, validate the whole dataset, all or nothing. Pure functions; only `loadDataset`/`saveDataset` touch files | Fixed: wrap, do not rewrite |
| Data tool | Five MCP verbs: `contract`, `query`, `write`, `log`, `reset` | To build |
| Templates `index.html`, `views/*.html`, `assets/runtime.js`, `assets/theme.css` | Finished HTML. Every page calls `CP.boot`; the runtime fetches `data/<table>.json`, polls `_version.json` every 2 s, redraws and marks changed records | Fixed |
| Demo `demo/*.json`, `spec/03-demo-script.md` | Ten write requests: steps 1–9 commit at versions 7–15, step 10 is refused (text too long) | Acceptance test |

The ten agents and views: Engagement starter, Analyst, Value estimator, Presentation builder, Project manager, Team
manager, Story builder, Agent builder, Proposal builder, Model builder; plus Engagement home.

The runtime reads data in **one place** (`getJSON`, about ten lines). That is what makes the port small: the
templates stay as they are, and only the runtime's data source changes from files to Supabase.

### 8.2 The port, in one picture

```
claude.ai ──MCP──▶ mcp function ── engagement_* tools ── validate.js (unchanged) ──▶ engagement_commit()
          └─ view ─▶ ui_views (slot → template, project)                                      │
os.cantabpi.com/v/N (Lovable): header + <iframe src="/bpag/views/<view>.html?project=…">     ▼
   template + runtime.js (data source swapped) ── supabase-js as the user ──▶ engagement tables
```

### 8.3 Questions and Claude's recommendations

Each recommendation stands until Nela (or Siniša, where marked) answers.

| # | Question | Recommendation | Why |
|---|---|---|---|
| P1 | How is the data stored? | **One row per package table:** `engagement_tables (project_id, tbl, records jsonb, version)`, 27 rows per project, plus `engagement_datasets (project_id, global_version, contract_version)` and `engagement_log`. Not 27 relational tables | Mirrors the files 1:1, so the validator and the runtime work unchanged and the schema stays the single source of truth. Cost: the data is not queryable table by table through the Data API, and `list`/`get` do not see it (not needed for the mock-up) |
| P2 | Where does the validator run? | **In the MCP function.** A build script turns `validate.js` into a module the function imports, unchanged (like `build-ui.mjs`). A write loads the dataset, runs `applyWrite`, and commits the touched tables through `engagement_commit(project, expected_version, tables, log)`, which refuses if the version moved; the tool then retries once | The package says wrap, not reimplement. The version check gives the "one write at a time" the spec asks for |
| P3 | Which project holds the engagement? | **The selected one**, like every other tool. A project with no engagement data says so; `engagement_reset` loads the Big Pharma AG seed into it. Claude suggests a new project "Dummy - Big Pharma AG" per user | Fits v2 (project implicit) and Siniša's Q3 (each slot has a project): a view reads its slot's project |
| P4 | The tools | **Five tools named after the verbs:** `engagement_contract`, `engagement_query`, `engagement_write` (`agent`, `reason`, `ops`, `dry_run`, `if_version`), `engagement_log`, `engagement_reset` (needs `confirm`). Inputs and outputs as in `spec/02-data-tool.md`. 14 tools become 19 | Keeps the package's contract word for word; the prefix keeps them apart from `list` and `get` |
| P5 | Who are the ten agents? | **Claude in claude.ai plays each one**, naming it in `agent`; the validator enforces that agent's write scope. The log also records the signed-in user | No agent framework exists yet; the scopes still hold |
| P6 | Where do the templates live? | **In the Lovable app, as static files** under `public/bpag/` (templates, assets, `_schema.json`, the deck), shown in an iframe below our header. Same address, so the iframe shares the sign-in. **Needs the Lovable project connected to GitHub** (parked on 2026-10-21) so Claude can add the 30 files and the runtime change; pasting them through Lovable's chat is not workable | Templates stay fixed and in one place, and the page code is no longer out of our reach |
| P7 | What changes in `runtime.js`? | Only the data source: `getJSON('data/<t>.json')` reads the iframe's project from Supabase; `_version.json` reads the dataset's versions; polling every 2 s stays. With `?embed=1` it skips its own brand and agent rail (our header has them) and keeps the engagement line (client, engagement, phase, week, as-of) | The smallest change that keeps every template as it is |
| P8 | The deck PDF | **A static file next to the templates** (`public/bpag/deck/scale-up-proposal.pdf`), so the seed's relative `pdf_url` works unchanged. No Google Drive, no Storage for now; a later deck can be any https URL | No change to data or template. Dummy content, so public is acceptable; revisit before real decks |
| P9 | Header icons and template keys | **Siniša's ten**, grouped as the package does (Client-facing · Team), keys as in the schema (`engagement_starter` … `model_builder`). The wordmark and an empty slot show Engagement home (`home`). A migration swaps the keys and clears views on the old ones | One list everywhere: schema, header, `view` tool |
| P10 | Data per user? | **Yes, per user and project:** each user's demo is their own copy, reset on its own | Demos do not trip over each other |
| P11 | Fonts | The package uses IBM Plex; our header uses Raleway and Lora. **Parked** with colour (Q8) | Not needed to prove the port |
| P12 | Left out | The package's HTTP server (Lovable serves the files) and its `tools/*.js` scripts (used only to check our seed matches). As in the package: no undo beyond reset, no formula engine | |
| P13 | Who may save engagement data? | **Decided by Nela, 2026-10-22: Aleph's pattern.** `engagement_commit` is callable by the service role only; the MCP function verifies the user's token, runs the validator, then commits with the service role, passing the user's id; the function checks that the project is that user's. The browser can read but never write. The key is already in the function's environment (`SUPABASE_SECRET_KEYS`, provided by Supabase), so nothing for Nela to set | Closes the gap where a browser could save data the validator never saw |
| P14 | The other tools | **Decided by Nela, 2026-10-22: move them to the same pattern on 2026-10-23** (separate plan: tool code under the service role filters by user and project, RLS stays for browser paths, as in Aleph). Today only `engagement_commit` | One access model for all tools |
| P6b | Templates in a table instead of Lovable static files | **Chosen by Nela, 2026-10-22 (replaces P6).** a build script inlines `runtime.js` and `theme.css` into each page and stores it in a `view_templates` table (key, html, contract version); the Lovable page loads it into the iframe with `srcdoc`. No GitHub connection needed. `scripts/templates.mjs` (run by Nela with `CANTAB_SERVICE_KEY`, like `slide-pdfs.mjs`) inlines and upserts the pages and uploads the deck to a public Storage bucket; the seed's `pdf_url` becomes that https address (replaces P8) | Avoids the Lovable–GitHub connection; costs a build step and a Storage file for the deck |

### 8.4 Steps

| Step | What | Who | Status |
|---|---|---|---|
| 0 | Answer P1–P12; connect the Lovable project to GitHub (P6) | Nela | `open` |
| 1 | Migration: `engagement_*` tables, RLS, `engagement_commit`, read functions for the runtime, new template keys (P9). Dry-run on live in a rolled-back transaction | Claude; Nela runs `db push` | `planned` |
| 2 | Function v0.9.0: the five tools, the validator module, the seed bundled; unit tests; the package's demo run through `engagement_write` | Claude; deploy on Nela's go | `planned` |
| 3 | Templates into the Lovable repo under `public/bpag/`; `runtime.js` data source and embed mode | Claude, in the GitHub repo | `planned` |
| 4 | Lovable message: header icons to the ten, the iframe in the centre pane, home in an empty slot | Claude drafts; Nela sends | `planned` |
| 5 | Check headless: each template against the seed and after its demo write (redraw under 2 s, change marker); then the full demo in claude.ai | Claude, Nela | `planned` |
| 6 | Docs: tools-status, Diagram_input, DECISIONS, HANDOFF, Document Log | Claude, with each step | `planned` |

**Acceptance (from the package):** the seed validates with 0 errors; steps 1–9 commit at versions 7–15 and step 10 is
refused with "text is 122 characters, allowed ≤ 110"; every view redraws within 2 s of a commit and marks the changed
records; `engagement_reset` restores the seed exactly; Siniša sees none of Nela's engagement data.

## Comments for Nela (proposals, not in the build)

- A "Show in view" button on slide rows in the in-chat files view would call `view` directly. It is
  natural after the POC.
- A second dashboard over the real `todos` table (open, overdue, by category) would show realtime
  following agent edits made with existing tools. It is left out because Siniša asked for a dummy table.

**Changelog** (rationale in DECISIONS.md; file history in git)
- v0.17 (2026-10-22) — P6b chosen (templates in a table, deck in public Storage), replacing P6 and P8.
- v0.16 (2026-10-22) — P13 (Aleph pattern for `engagement_commit`), P14 (other tools tomorrow), P6b (templates in a table) added.
- v0.15 (2026-10-22) — §8 added: phase 2 plan, Siniša's views package ported onto Supabase (P1–P12). The §7 icon list (A6) is replaced by Siniša's ten.
- v0.14 (2026-10-22) — Round 4 (Nela with Lovable): chip, account menu and Follow Claude removed, badge fades; narrow-pane fixes; headless check at 400 px (conflict line shown).
- v0.13 (2026-10-22) — Steps 5 and 6: icons wired up by Lovable, headless check 5/5; narrow-pane follow-up in COMMS.
- v0.12 (2026-10-22) — §7.2 built (migration and v0.8.0, dry-run 16/16, 42 unit tests); Q4, Q5 as suggested; 7.8 wire-up draft for Lovable.
- v0.11 (2026-10-22) — Round 2 published (header on the live page); dividers and phase prefixes dropped (A6).
- v0.10 (2026-10-22) — Q9 answered: simplest first iteration, to reconsider.
- v0.9 (2026-10-22) — Q3 answered by Siniša (per user, project FK on the slot): 7.2 item 7; Q9 added.
- v0.8 (2026-10-22) — Q7 answered (eight agents and two dummies), Q8 parked, 7.6 accepted with a note to reconsider; fast path: header onto the live page now (7.7 draft for Lovable).
- v0.7 (2026-10-22) — Q1, Q2 answered by Nela: the agent views from her picture (A6, keys in 7.2); new §7.6 the slot in view; Q7, Q8 added.
- v0.6 (2026-10-22) — §7.1 split into open questions (Q1–Q6) and working assumptions (A1–A8); H numbers retired.
- v0.5 (2026-10-22) — Round 1 back from Lovable: H10 (domain added), H11, H12 updated, H14 added, §7.5 the new address (live; old one redirects; switch steps). §7 added: view header plan (phase 2, step 1), provisional answers H1–H13, draft Lovable message for design round 1. POC sections become background.
- v0.4 (2026-10-22) — Note on projects (v0.7.0): slides follow the selected project. Phase 2 of v2 builds on this POC.
- v0.3 (2026-10-21) — Approved; steps 1–3 written, step 4 requested; three build differences recorded in §6.
- v0.2 (2026-10-21) — §1 answered by Nela: spec change, Lovable for the POC, both side-window approaches stand, POC first, demo in the desktop app. → DECISIONS.md 2026-10-21
- v0.1 (2026-10-21) — First draft from Siniša's memo and his two answers.
