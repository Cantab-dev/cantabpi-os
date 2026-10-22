# Cantab OS — Live views POC: plan and status

| Status | Version | Owner | Last updated |
| --- | --- | --- | --- |
| Current | v0.4 | Nela | 2026-10-22 |

Plan for a proof of concept of Siniša's memo *Server-driven UI for agent-operated apps* (received
2026-10-21): the agent points a live browser page at a PDF or a fixed dashboard, and the open page
follows within a second or two. Approved by Nela on 2026-10-21; build in progress (§6 Progress). Read whole.

**Since 2026-10-22 (projects, function v0.7.0):** `slides` follow the user's selected project
([projects-status.md](projects-status.md)). The `view` tool finds only the selected project's slides, and the page,
reading `slides` as the user, shows a PDF view of a slide from another project as not found after a switch.
`ui_views` and `demo_sales` are not project-scoped. Accepted for the POC; v2 phase 2 (the views) builds on this
POC and decides how views relate to projects ([Diagram_input.md](Diagram_input.md) §2.1).

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

## Comments for Nela (proposals, not in the build)

- A "Show in view" button on slide rows in the in-chat files view would call `view` directly. It is
  natural after the POC.
- A second dashboard over the real `todos` table (open, overdue, by category) would show realtime
  following agent edits made with existing tools. It is left out because Siniša asked for a dummy table.

**Changelog** (rationale in DECISIONS.md; file history in git)
- v0.4 (2026-10-22) — Note on projects (v0.7.0): slides follow the selected project. Phase 2 of v2 builds on this POC.
- v0.3 (2026-10-21) — Approved; steps 1–3 written, step 4 requested; three build differences recorded in §6.
- v0.2 (2026-10-21) — §1 answered by Nela: spec change, Lovable for the POC, both side-window approaches stand, POC first, demo in the desktop app. → DECISIONS.md 2026-10-21
- v0.1 (2026-10-21) — First draft from Siniša's memo and his two answers.
