# Cantab OS — In-chat views: plan and status

| Status | Version | Owner | Last updated |
| --- | --- | --- | --- |
| Current | v0.10 | Nela | 2026-10-23 |

Plan and record for the in-chat views (MVP 1.x, before MVP 2.0), from Siniša's memo of 2026-10-15. Steps 0–4 are built and live (function v0.5.5). Open: the POC timing comparison (§4) and the optional "+" (§3.5); the improvements to plan are under "Learnings from testing". The tool contract as deployed is in [tools-status.md](tools-status.md) and the structure in [data-structure-status.md](data-structure-status.md); §1 and §2 record what changed. Read whole.

**Swept 2026-10-23:** this record predates projects (function v0.7.0). Since then the todos and files views show the
selected project's rows only, and the projects list is drawn as a plain list; see [projects-status.md](projects-status.md).
The rest below is unchanged.

Status values: `planned` (agreed, not built) · `built` (deployed and tested) · `changed` (built, then
altered; note what changed) · `open` (needs a decision).

## Goal and scope

**Goal:** a fast user experience in the claude.ai chat window. Todos, leads, docs, sheets and slides
show as interactive in-chat views whenever they are listed. The host renders them from a template
the server serves; the model calls `list` and writes no HTML.

**Basis:** Siniša's memo *Cantab OS: next version* (2026-10-15), from POC testing in claude.ai on
2026-10-14. The POC had the model copy 3–4 KB of HTML from Project instructions into every reply,
which is slow and once rendered blank.

**In scope:** minor data changes (§1), tool changes (§2), in-chat views (§3), and the bug fixes from
POC testing (§2.6).

**Out of scope:** side panel behaviour (opening files in the desktop app's browser pane), Claude
Code, skills, ChatGPT, real data.

**Mechanism:** MCP Apps, the MCP extension for interactive views. claude.ai on the web and the
Claude desktop app support it. In outline:
- A tool declares a `ui://` resource in `_meta.ui.resourceUri`.
- The server serves that resource as HTML with MIME type `text/html;profile=mcp-app`.
- The host renders it in a sandboxed iframe and pushes the tool result to it. `structuredContent`
  feeds the view and is not added to the model's context.
- The view calls server tools (`tools/call`) through the host. Ticking a todo needs no chat
  message, which removes the POC's confirmation prompt and its out-of-order tick and untick.

This reverses, for this phase, the 2026-10-14 decision "tool results carry data only". See
[DECISIONS.md](DECISIONS.md) 2026-10-15.

## Decisions taken (Nela, 2026-10-15)

1. **The view always comes with `list`.** No new tool. Whether to draw a view depending on context
   (for example a `layout` argument, default yes) is for MVP 2.0.
2. **Icons: maximum performance.** Emoji or equivalent Unicode characters; no icon font and no
   external fetch.
3. **Hosts without MCP Apps:** the plain data result only. Claude Code is out of scope for now.
4. **Action history:** an overwritten action goes into `context` as
   `YYYY-MM-DD: Previous action: <old value>`. Context size: return all of it for now (current
   limits stay). Making context more compact is for after MVP 2.0; no issue is expected for the
   first release and limited testing.

## Build order

| Step | What | Who | Status |
|---|---|---|---|
| 0 | Spike: prove the mechanism in claude.ai (§3.1) | Claude builds and deploys; Nela clicks | `built` — passed 2026-10-15 (v0.4.2) |
| 1 | Migration: `categories`, three new columns, todo category moved (§1) | Claude writes; Nela runs `db push` | `built` 2026-10-15 |
| 2 | Tool changes and fixes (§2), function v0.5.0 | Claude builds and deploys | `built` 2026-10-15 |
| 3 | The view on `list`: todos, leads, files (§3) | Claude builds and deploys | `built` 2026-10-15 (v0.5.2; v0.5.3 adds read-only hints and a wider name column) |
| 4 | Tests, `smoke.sh`, live check and timing in claude.ai (§4); docs updated | Claude, then Nela in claude.ai | `built` except the POC timing comparison |
| 5 | Optional: "+" on todos (§3.5) | Only if time allows and Nela says so | `planned` |

Step 0 is the gate. If the spike fails (no render, or the view cannot call tools), building stops
and the plan is redone before any migration runs.

## 1. Data structure

The structure as deployed is in [data-structure-status.md](data-structure-status.md); this section records what changed.

### 1.1 Table `categories` — `built`
- Columns: `id` integer primary key; `label` text unique (slug, such as `sales`); `name` text;
  `icon` text, an emoji (decision 2; the memo's Tabler names are not used).
- Seeded with the memo's ten categories:

| label | name | icon |
|---|---|---|
| `sales` | Sales | 📈 |
| `finance` | Finance | 💰 |
| `product` | Product | 💡 |
| `legal` | Legal | ⚖️ |
| `admin` | Admin | ⚙️ |
| `personal` | Personal | 👤 |
| `investor` | Investor | 🏦 |
| `client` | Client | 💼 |
| `partner` | Partner | 🤝 |
| `advisor` | Advisor | 🎓 |

- Shared reference data, with no `profile_id`. RLS: signed-in users can read; nobody writes through
  the API. Changes go through a migration.
- No `category:N` label. The slug is the identifier tools use, as the memo specifies.

### 1.2 New columns on `todos`, `leads`, `sheets`, `docs`, `slides` — `built`
- `category_id` integer, nullable, foreign key to `categories.id`, indexed.
- `importance` smallint, nullable, check 1–3. Todos already have it, so only the check is added
  where missing.
- `action` text, nullable: the single current next action.

### 1.3 Todo category moved to `category_id` — `built`
- Set `category_id` by matching the free-text `category` to `categories.label`, case-insensitive,
  then drop `category`.
- The dummy data uses `sales`, `personal`, `finance` and `admin`, which all match. Other values
  (from POC testing) become null. The migration first lists any it would drop so they can be
  checked.

### 1.4 An overwritten action is kept in `context` — `built`
A database trigger on update: when `action` changes and the old value is not empty, it appends
`YYYY-MM-DD: Previous action: <old value>` to `context`, dated the day of the change. Because it is
a trigger, it applies on every path, not only through the tools.

## 2. Tools

The contract as deployed is in [tools-status.md](tools-status.md); this section records what changed.

### 2.1 `list` — `built` (the view itself is step 3)
- **Carries the view** (§3): `_meta.ui.resourceUri` = `ui://cantab-os/list`. Every call returns:
  - `content`: the rows as data for the model, as now. It also carries the line "The user sees
    these rows in a view. Do not restate them; reply in at most one sentence, and only if
    something needs attention."
  - `structuredContent`: the same rows, for the view.
- **Fields.** Every row returns `label`, `name`, `category` (`{label, name, icon}` or null),
  `importance`, `action` and `context` (full, as stored; decision 4). Per entity it also returns:
  - todos: `due`, `status`
  - leads: `full_name`, `email`, `url_linkedin`
  - sheets and docs: `url`
  - slides: `url`, `storage_url`
- **Files together.** `entity` also accepts a list of `docs`, `sheets` and `slides`, so one call and
  one view can cover any combination, as the memo's files view needs. Each kind is paged on its own.
- New entity `categories`, which returns `{label, name, icon}`.
- **Optional filters:**
  - todos: `status`, `due_before`, `due_after`
  - all five entities: `category`, `importance_min`
- **Paging** stays at 25 rows. When more rows exist, the view says so in its footer, and the next
  page comes from `list` as now.
- **Skills and categories** get a plain view (name and description, or icon and name).

### 2.2 `get` — `built`
Returns the same fields as `list`, with `context` up to 4,000 characters as now.

### 2.3 `write_todo`, `write_lead`, `write_sheet`, `write_doc`, `write_slide` — `built`
- New optional arguments: `category` (a category label), `importance` (1–3) and `action` (up to 500
  characters).
- An unknown category is rejected, and the error lists the valid labels.
- On `write_todo`, `category` changes from free text to a label.

### 2.4 `edit` — `built`
- Accepts `category`, `importance` and `action` on all five entities. An empty string clears them.
- Overwriting `action` keeps the old value in `context` through the trigger (§1.4).

### 2.5 `note` — unchanged

### 2.6 Fixes from POC testing
| # | Item | Plan |
|---|---|---|
| 1 | `edit` rejects importance 1, 2 and 3 | `built`. The schema `z.union([z.number(), z.literal('')])` (`tools.ts`) gets a string from the client. It will accept a number, a numeric string or `""`, with a unit test for each |
| 2 | Notes go in with `note` but come back as `context` | `built`: the `get`, `list` and `note` descriptions say so. Renaming the field is not planned |
| 3 | Skills have no `name` | Not in this phase (skills are out of scope). Comment for later |
| 4 | Descriptions say "starting with https://" but `http://` is also accepted | `built`: the descriptions say "http:// or https://" |
| 5 | No server-side deduplication | Not in this phase. Comment: a later `write_*` could return close name or URL matches |

**Checked 2026-10-15 (steps 1–2):** dry run of the migration in a rolled-back transaction (10 categories, 22 todos
mapped, 1 without a category); applied by Nela; function v0.5.0 deployed. Live as `claude@test.com`: categories list,
todos with the category object, `["docs","sheets"]` in one call, filters, the two error messages, `edit` with importance
`"2"`, and two action overwrites leaving `Previous action` lines in `context`. 25 unit tests pass.

## 3. In-chat views

### 3.1 Spike (step 0) — `built`
A throwaway view on `list` that renders "hello + row count" in claude.ai. It must prove five
things; the result is recorded here before step 1:
1. `@modelcontextprotocol/server` v2, which this function uses, can register a tool with
   `_meta.ui.resourceUri` and a resource with the MCP Apps MIME type. The official helpers in
   `@modelcontextprotocol/ext-apps/server` target the older `@modelcontextprotocol/sdk`, so
   registering by hand may be needed.
2. The view receives `structuredContent`.
3. The view can call `edit` through the host, and we learn whether the host asks the user to
   approve each call.
4. The edge function can serve the HTML. It will be kept as a TypeScript string module so no
   static-file config is needed.
5. The host's theme variables reach the view in light and dark mode.

**Result, 2026-10-15 (function v0.4.2, Claude desktop app 2.37, as Nela):** all five proven.
- The view rendered from `structuredContent`: initialized 5 ms after load, data at 16 ms.
- `edit` called from the view through the host succeeded in about 1.2 s.
- Host context: theme light, 76 style variables, `serverTools` capability on.
- The function serves the HTML from a string module. The view uses a hand-written bridge (about 3 KB) instead of the 418 KB ext-apps bundle.
- `list` sets both `_meta.ui.resourceUri` and the legacy `_meta["ui/resourceUri"]`, as ext-apps' own helper does.
- claude.ai picked up the view only after the connector was disconnected and reconnected; toggling it in the chat's + menu was not enough.
- Seen in the test, handled in step 3: the model still replied in two sentences restating the todos, and did not know about the edit made in the view.

### 3.2 One resource, several views — `built`
- A tool points to one UI resource, so `list` uses a single resource, `ui://cantab-os/list/<hash>`. It holds
  the todos, leads and files views (plus the plain view) and picks one from the entity in the data.
  This departs from the memo's three URIs; the views themselves stay separate.
- The resource is one self-contained HTML file: inline CSS and script, no external fetch, so it
  renders as soon as the result arrives. The host can preload it before the first call.
- **The address carries a hash of the HTML** (`scripts/build-ui.mjs`), because claude.ai caches a view by
  its address: v0.5.1 changed the HTML under the same address and claude.ai kept drawing the spike. A changed
  view needs one disconnect and reconnect of the connector, since claude.ai reads the tool list only then.
- Source: `supabase/functions/mcp/ui/list.html`, built into `ui_html.ts`; a unit test keeps them in step.

### 3.3 The three views — `built`
Built from the memo's Appendix A templates, with the memo's §3.2 rules: real category and
importance fields, the `action` line, expanded history newest first, the todo groups and the
hiding of done todos. These changes are needed for the MCP Apps setting:
- **Data:** read from the tool result instead of the `__DATA__` placeholder, which removes the
  POC's blank-render failure.
- **Ticks on todos:** the Save button calls `edit` once per changed row through the host, as the
  memo says, all at once, and shows "Saved" or the error per row. After saving, the view tells the model what
  changed through `ui/update-model-context`, so the chat stays in step.
- **Icons:** emoji and Unicode characters only (decision 2). Category icons come from
  `categories.icon`. View icons: docs 📄, sheets 📊, slides 🖥️, next action ✨, note 📝, email ✉️,
  tick ✓, expand ›. The importance dots stay CSS circles.
- **Colours and fonts:** the POC's `--border` and `--text-secondary` are mapped to the host's MCP
  Apps variables (`--color-border-primary`, `--color-text-secondary` and so on), with fallbacks.
  Cantab red `#A32D2D` stays a placeholder.
- **Height:** the view reports its size to the host, so expanding a row grows the frame.
- **Leads:** double-click shows the LinkedIn URL with an "Open" link through the host's open-link
  request.
- **Files:** click expands the row. Double-click to the side panel is out of scope, so for now
  double-click does nothing.

### 3.4 Hosts without MCP Apps — `built`
They get the `content` data only (decision 3). The memo's fallback (render instruction plus template
ID, with the model generating the HTML) is the slow path this phase removes; it is kept on file and
not built.

### 3.5 "+" on todos (optional) — `planned`
As in the memo §3.3: an inline row with name, due date, category, importance and action. It calls
`write_todo` through the host and re-renders from the returned record. Built only if Nela says so
after step 4.

## 4. Testing and acceptance

- **Unit tests:** new checks (category label, importance as number or string, `action` length,
  filters, `entity` as a list).
- **`smoke.sh`:**
  - `categories` list
  - new fields on write and edit
  - filters
  - action overwrite appends to `context`
  - `list` returns `structuredContent` and the resource can be read
- **Live check in claude.ai** (as Nela, with dummy data), on the prompts "show my todos", "show my
  leads" and "show my docs and sheets":
  - One tool call per display: `list`, with no `get` after it.
  - No HTML written by the model; text after the view is at most one sentence.
  - Ticking and saving a todo updates the database with no chat message and no out-of-order
    result.
  - Light and dark mode both readable.
- **Timing:** time from sending the prompt to the view being visible, measured against the POC on
  the same prompt (Siniša's Project set-up). Both numbers are recorded here. Target: the view
  appears as soon as the single tool call returns.
- Findings go in [test_tracker.md](test_tracker.md).

**Result, 2026-10-15 (v0.5.2, Claude desktop app, as Nela):**
- All three views rendered from one `list` call each: todos grouped by due date, leads with the LinkedIn
  field on double-click, docs and sheets in one view.
- Ticking a todo and pressing Save showed "Saved".
- Claude wrote one sentence under each view.
- claude.ai asked to approve each `list` call. v0.5.3 marks `list` and `get` read-only, so they can be set
  to **Always allow**.
- Checked locally before the deploy: headless Chrome with a stand-in host, light and dark, scripted tick and Save
  (one `edit` per change, in order, then the update to the model).
- `smoke.sh` on v0.5.3, 2026-10-15, as `claude@test.com`: all checks as expected, including the view address and HTML, categories, filters, docs and sheets together, importance as text, the action history and the new error messages. The Test rows it created were deleted; its note on `todo:1` stays (notes are append-only).
- Small gap seen: an unknown entity error lists the six entities but not `categories`.
- **Open — timing against the POC.** Needs Siniša's POC Project set-up to time the same prompt both ways.
- **Retest 2026-10-15 (v0.5.3):** Save worked ("Saved", count updated; Nela did not notice an approval prompt for `edit`). Asked "what's still open?" straight after, Claude answered from memory without a new `list` and was wrong. v0.5.4: the footer shows whether Claude was told (the view only sends `ui/update-model-context` when the host announces support), and the `list` result tells Claude to list again for the current state. Deployed 2026-10-15.
- **Retest 2026-10-15 (v0.5.4):** the footer read "Saved · Claude told", so claude.ai accepts `ui/update-model-context`. On every "what's still open?" Claude called `list` again and answered correctly. Saving several ticks was slow (about 1.2 s per todo, one after another). v0.5.5 saves them in parallel: each row sends one final state, so the calls never touch the same todo.
- **Round 2026-10-16 (v0.5.5, test script; no timings taken):**
  - Passed: test 12 (slide title changed and restored exactly, text, format and tagline); tests 9–10
    (VACATIONTRACKER.IO amount 22.39 to 25.00 and back, total back to €1,692.55); test 14 (one files view with
    two sections); long file names now fit (tracker #10).
  - Not as expected: tests 13 and 14, Claude restated the rows in tables under the view (#18); test 8, opening
    the sheet was slow and opened in the browser, not the side panel, which is out of scope (#19).
  - Test 11: the deck was found and shown, then Claude read and summarised all nine slides, more than "show it".
  - Tests 1 to 6 validated by Nela on 2026-10-16 (the findings from 2, 5 and 6 are tracker #15–#17). Not reported yet: test 7, the email to yourself.

## Learnings from testing, and improvements to plan

What the rounds of 2026-10-15 and 2026-10-16 taught, with the tracker rows as evidence. Candidates for the
next planning session; none is built or decided.

- **Hosts cache.** claude.ai reads the tool list only when the connector connects, and caches a view by its
  address (#6, #8). The address hash fixes the cache; after any change to the tools or the view, reconnect
  once.
- **A rule in the result is a soft signal.** Claude mostly obeys "do not restate; one sentence", but not
  always (#18). Also state it in the `list` description and the server instructions.
- **Save and sync work.** claude.ai accepts the update to the model after a Save, Claude lists again for the
  current state, and parallel saves are fast (#11, #12).
- **Google files are the slow part (#19).** With the Drive, Sheets and Slides connectors off in the chat,
  Claude falls back to driving the browser (17 actions for one cell). With them on it is quicker. Ideas: turn
  the connectors on before the round; make the `list` description say how to reach a file from its row; the
  side panel stays with Siniša's questions ([open-questions.md](open-questions.md)). Also seen: Claude named
  the wrong cell (E6) before reading the sheet and correcting itself (E5), so ask it to state the cell.
- **Behaviour to decide, each overriding or extending the memo:** done todos hidden unless asked (#15);
  "what I need to do today" from dated lead actions (#16); the lead view's no-LinkedIn message and the
  ✉️ emoji that renders as a pale box (#17).
- **With Lovable:** sign-out and who is signed in (#14, [COMMS.md](COMMS.md)): implemented per Nela on 2026-10-16; still to check, including that it signs out locally only.
- **Still open from the plan:** timing against the POC (needs Siniša's POC set-up), and the optional "+" on
  todos (§3.5).

## Later — MVP 2.0 and after

- **Draw the view by context** (MVP 2.0): for example a `layout` argument on `list`, default yes, so
  a lookup before an edit does not draw a view.
- **Compact context** (after MVP 2.0): `list` returns full `context` on every row for now. Once
  histories grow, cap or summarise it in `list` and keep the full text in `get`.
- **Memo items not in this phase:** a `name` for skills; server-side deduplication; side panel
  behaviour.
- **Memo Appendix B, POC test data to remove:** housekeeping, done separately. Those rows are in the
  account Siniša tested with, so they are removed with his OK.
- **Before real data:** the confidentiality and residency questions, and how OAuth clients are
  registered ([open-questions.md](open-questions.md)), still apply.

## Where it lives

- `supabase/migrations/20261015120000_categories_and_action.sql`
- `supabase/functions/mcp/`: `tools.ts` and `lib.ts` (tools and checks), `ui.ts` (registers the view), `ui/list.html` (the
  view, the source), `ui_html.ts` (generated from it; do not edit)
- `scripts/build-ui.mjs` (rebuilds `ui_html.ts` and the view address hash; run it after editing `ui/list.html`)
- `scripts/smoke.sh` (live checks); `docs/test-script-chat-views.md` (the scripted round)

**Changelog** (rationale in DECISIONS.md; file history in git)
- v0.10 (2026-10-23) — Swept: a note that this record predates projects; pointer to projects-status.
- v0.9 (2026-10-16) — Swept: status Current, orientation fixed, tests 1–6 validated, sign-out implemented, contract pointers to tools-status and data-structure-status.
- v0.8 (2026-10-16) — Round of 2026-10-16 recorded; learnings and improvement candidates added.
- v0.7 (2026-10-15) — v0.5.4 retest passed; v0.5.5 saves ticks in parallel.
- v0.6 (2026-10-15) — Save retest recorded; v0.5.4 deployed (save trace in the footer, list again for current state).
- v0.5 (2026-10-15) — Step 3 built and checked in claude.ai; view address carries an HTML hash; step 4 except the POC timing.
- v0.4 (2026-10-15) — Steps 1 and 2 built and checked live (migration applied; function v0.5.0).
- v0.3 (2026-10-15) — Step 0 spike passed in claude.ai; results in §3.1.
- v0.2 (2026-10-15) — Nela's decisions: view always on `list` (no `show` tool), emoji icons, data-only fallback, history format and full context. → DECISIONS.md 2026-10-15
- v0.1 (2026-10-15) — Plan drafted from Siniša's memo of 2026-10-15.
