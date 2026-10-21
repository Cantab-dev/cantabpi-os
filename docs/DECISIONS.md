# Decisions log — cantabpi-os

Implementation-level decisions for this project: what actually got built and why. All decisions below
were made by Nela unless the row says otherwise.

**How to use:** **newest first** — add each new row at the **top** of the table, in the same session
the decision is made or changed. Don't batch it into a sweep.

**Never edit a row in place.** A changed decision gets a **new row**. Set the old row's Status to
`Superseded by <date>`, and on the next sweep move it to the collapsed block at the foot
(newest-first there too).

Every row cites what it affects in `Reference`, so the affected doc links here instead of restating
the reasoning.

| Date | Decision and why | Reference | Status |
|---|---|---|---|
| 2026-10-21 | **Take kit 0.10.0–0.12.0: the Rulebook copy is refreshed to 0.12.0, and the hook scans the SharePoint root too.** The local Rulebook was an unedited 0.9.1 copy that had gone stale. It stays a copy rather than a pointer to the kit because Nela and Siniša both write here (kit README §1: copy when teammates without a kit clone write the docs); it is replaced whole on each upgrade, and departures go in `Kit_Exceptions.md`, never into it. If Siniša clones the kit, the copy can go. Kit 0.11.0 lifted the split-tree limitation, so the hook now also checks the SharePoint root's `01_analysis/`, `03_documentation/` and `HANDOFF.md`, and `kitPath`/`kitVersion` turn on the version nudge. No exceptions to record: `docs/` instead of `.docs/` is a choice the kit allows. Replaces the "hook does not scan the SharePoint root" part of 2026-10-13 (Nela). | `CLAUDE.md`; `docs/Documentation_Rulebook.md`; `.claude/hooks/` | Current |
| 2026-10-14 | **Sign-in plan approved: per-user RLS replaces the development key and the acting user (function v0.4.0).** `profiles` table; `owner_id` renamed `profile_id`, required, default `auth.uid()`, cascading on user delete; one policy per table for `authenticated`. TRUNCATE revoked from `authenticated` because it ignores RLS. Dynamic registration goes off once Claude Code and claude.ai have connected. A rule against label changes is noted as a known gap, not built (Nela). | `sign-in-status.md`; `data-structure-status.md` — Labels | Current |
| 2026-10-14 | **claude.ai connects over Supabase Auth's OAuth 2.1 server; the sign-in, consent and connect page is a small Lovable app (Siniša).** Lovable works in its own project and repo, without Lovable Cloud or its Supabase integration, and never writes to this repo. claude.ai is an individual account, so Nela adds the connector herself. The users table is `public.profiles` (1:1 with `auth.users`), primary keys are `id`, and foreign keys are `<table>_id`, so `owner_id` becomes `profile_id` (Siniša, Nela). Not built yet. | `COMMS.md`; `AGENTS.md`; `open-questions.md` | Current |
| 2026-10-15 | **Categories are a fixed list of ten in a `categories` table (emoji icons); todos, leads, sheets, docs and slides carry `category_id`, `importance` and `action`.** From Siniša's memo. Replaces the free-text todo category (the category part of the 2026-10-13 importance row). An overwritten `action` is kept in `context` by a trigger as `YYYY-MM-DD: Previous action: …`. | `data-structure-status.md`; `chat-ux-status.md` §1 | Current |
| 2026-10-15 | **Dynamic client registration stays on.** With it off, claude.ai could not reconnect an existing connector ("Automatic client registration isn't supported"). Revisit with a pre-registered OAuth client before real data. | `sign-in-status.md` — Rollout order; `test_tracker.md` #7 | Current |
| 2026-10-15 | **The view's address carries a hash of its HTML, and a changed view needs a reconnect.** claude.ai caches a view by its address and reads the tool list only when the connector connects. `scripts/build-ui.mjs` writes the hash. | `chat-ux-status.md` §3.2; `test_tracker.md` #6, #8 | Current |
| 2026-10-15 | **Ticked todos are saved in parallel**, one `edit` per row. Each row sends one final state, so no two calls touch the same todo; one after another took about 1.2 s per todo. | `chat-ux-status.md` §3.3; `test_tracker.md` #12 | Current |
| 2026-10-15 | **In-chat views through MCP Apps, always on `list`.** From Siniša's memo of 2026-10-15. `list` declares one UI resource that claude.ai renders from `structuredContent`; the model writes no HTML. No separate `show` tool; drawing by context (a `layout` argument) is for MVP 2.0. Icons are emoji for speed. Hosts without MCP Apps get data only; Claude Code is out of scope for now. An overwritten `action` goes into `context` as `YYYY-MM-DD: Previous action: …`. `list` returns full `context`; compacting it is for after MVP 2.0. This sets aside "tool results carry data only" (2026-10-14) once built. | `chat-ux-status.md` — Decisions taken | Current |
| 2026-10-14 | **Add `edit` and `delete` tools; test as `claude@test.com` until sign-in is ready; copy the dummy data for Nela.** Requested by Siniša, approved by Nela. Edit takes a label and the fields to overwrite (never id, label or context). Delete takes a label and removes the row. This supersedes "no update and no delete" (2026-10-13) once built. The connection to claude.ai over OAuth and the ID naming rules (users table, `id`, `<table>_id`) are still open. | `tools-status.md` — Next build; `data-structure-status.md` — Per-user dummy data | Current |
| 2026-10-13 | **Tools built and deployed; two things differ from plan v0.2.** (1) Every table gained an internal `label_no` column, because ordering and paging by label number is not possible on the text label. (2) On `get`, a guideline keeps its first 8,000 characters, not its last 4,000: the start of a workflow is the part that matters and 8,000 is the write limit. Decided by Claude during the build, reported to Nela. | `tools-status.md`; `data-structure-status.md` — Labels | Current |
| 2026-10-13 | **After the agent design guide check: tools stay create-only; six `write_*` tools stay; `list` gets paging.** The guide prefers an upsert and one generic `write`; both are kept as suggestions and may be revisited. Paging was chosen over filters to bound `list`. | `tools-status.md` — Not in this deployment; Suggestions to consider later; list | Current |
| 2026-10-13 | **The repo docs folder stays `docs/`.** Renaming to the kit's `.docs/` was allowed but not done: it would mean fixing every link for no gain, and the hook is configured for `docs`. | `.claude/hooks/hygiene.config.json` | Current |
| 2026-10-13 | **Adopt the Cantab Pi Project Kit 0.9.1 (pre-release), profile M; sessions open from the repo.** Close between M and L, so the smaller: one agent writes here. `.claude/` lives in the repo; the SharePoint root stays a plain folder the hook does not scan. | `CLAUDE.md` | Partly superseded by 2026-10-21 (hook scan) |
| 2026-10-13 | **Row-level status words stay as they are.** `planned` / `built` / `changed` / `open` are a table's own lifecycle; only a document's header takes the Rulebook vocabulary. | `AGENTS.md`; `Documentation_Rulebook.md` Part C §3 | Current |
| 2026-10-13 | **Importance is 1–3; category is free text; `created_at` / `updated_at` kept.** Everything in this phase is subject to change later. | `data-structure-status.md` | Superseded by 2026-10-15 (category part only; importance and timestamps stand) |
| 2026-10-13 | **Steps 1 and 2 are built from the spec as written, without defining integrations or connectors.** The broader architecture proposal is parked as input for step 3. | `architecture.md`; `spec.md` | Current |
| 2026-10-13 | **The repo lives only in `C:\dev\cantabpi-os`; the SharePoint folder holds handoff, analysis and other documentation.** A synced folder mirrors git internals. | `CLAUDE.md` — Folder map | Current |
| 2026-10-13 | **Labels are `<entity>:<number>`, generated by the backend, never reused after a delete.** | `data-structure-status.md` — Labels | Current |
| 2026-10-13 | **Skills trust model deferred.** Who may write `skills.guideline`, and whether it is trusted, is decided later. | `open-questions.md` | Current |
| 2026-10-13 | **Cantab OS is multi-user.** | `open-questions.md` | Current |
| 2026-10-13 | **All Google integrations are out of scope for Cantab OS** (sheets, docs, slides, email, calendar, drive); the host does them. Cantab OS only stores context and url for sheets, docs and slides, and holds workflows for the host as skills. This also makes the "Oria" integration question moot. "Host" = Claude.ai or an equivalent chat host connecting over MCP. | `spec.md`; `open-questions.md` | Current |
| 2026-10-13 | **Architecture decisions are reserved for Opus or higher.** Claude hints when a switch is needed. | `CLAUDE.md` — Working rules | Current |

<details>
<summary>Superseded decisions</summary>

| Date | Decision and why | Reference | Status |
|---|---|---|---|
| 2026-10-14 | **Tool results carry data only; the `render` instruction is removed.** Siniša set the MVP for today: tools receive and send data according to the spec, no app design instructions in this phase. This sets aside, for now, the spec line "every tool also returns instructions how to render in-chat elements". Approved by Nela. | `tools-status.md` — Render instructions; `spec.md` — important | Superseded by 2026-10-15 |
| 2026-10-13 | **No update and no delete tool in this deployment.** `write_*` only creates. Accepted consequence: a todo cannot be marked done through the tools. Ideas kept on file. | `tools-status.md` — Not in this deployment | Superseded by 2026-10-14 |
| 2026-10-13 | **Every table gets `owner_id` now; who may see what is decided in step 3.** Multi-user is certain, so the column is added before data exists; access rules wait for sign-in. Row security is on with no policies meanwhile. | `data-structure-status.md` — Ownership, Access | Superseded by 2026-10-14 |

</details>
