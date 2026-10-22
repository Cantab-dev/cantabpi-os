# Open questions

| Status | Version | Owner | Last updated |
| --- | --- | --- | --- |
| Current | v1.6 | Nela | 2026-10-22 |

Questions still waiting for a decision. Read whole; it is short.
Answered questions are in [DECISIONS.md](DECISIONS.md). Remaining design work goes to the Opus pass
(`/model opus`).

## Terms
- **Host**: Claude.ai or equivalent chat host that connects to Cantab OS via MCP.

## Side window — scope from Siniša, clarifications pending
Siniša (project lead): the MCP tool sends a url in its result; the host's only job is to display it with its browser tool (browser pane). The host never creates HTML pages in the side window. Example: for a Google Sheet the tool sends the sheet's url, and the host displays it.

Effect, once confirmed: the built tools already return the url, so only the wording ("open in the browser pane") and a clearly named url field change. The one test left: does the host open a url from a tool result in its browser pane?

Questions for Siniša:
1. Which hosts have a browser tool? The Claude desktop app has a browser pane and Claude in Chrome is an extension; not verified for claude.ai in a plain web browser or on mobile.
2. The browser pane must be signed in to Google with access to the file; who sets that up?
3. Slides: open the Google Slides `url` or the PDF `storage_url`?
4. `get` returning several files: open none, the first, or ask?
5. Leads: should `url_linkedin` open in the browser pane too?

Answered by Siniša's memo of 2026-10-15: the in-chat views stay, and only opening a Google file goes to the side panel (see [DECISIONS.md](DECISIONS.md), 2026-10-15).
Still open after the live views POC was planned (2026-10-21): Google files keep this approach; PDFs and dashboards go to live views ([live-views-status.md](live-views-status.md)).

## Projects (v2 phase 1, built 2026-10-22)
Detail: [projects-status.md](projects-status.md) §1 and Open.
- Confirm Claude's three choices: only an empty project can be deleted; older rows in `Unsorted (from v1)`;
  Atlas selected at the start. (Nela, Siniša)
- Moving an item to another project: not possible today. Needed?
- Do the live views and the v2 view slots belong to a project? (Phase 2)
- Oria connector: what it is and who calls it ([Diagram_input.md](Diagram_input.md) §1). (Nela)

## Questions raised by multi-user (for Opus design pass)
Partly answered by projects: a project has one owner; todos, sheets, docs and slides are per project; leads and
skills are shared by all of a user's projects. Sharing a project with a team is still open.
- Tenancy model: organisation/workspace with shared + private data, or strictly per-user data? Which entities are personal (todos?) vs shared (leads, docs)?
- Roles/permissions: who can read/write what? Who manages users?
- Label uniqueness scope: global, per-workspace or per-user? (Per-entity counters must be concurrency-safe and never reused.)
- Skills: global, per-workspace or per-user? (Trust model deferred, but scope affects the schema.)
- OAuth clients before real data: keep dynamic client registration (any MCP client can register, and a user must still approve it), or register clients such as claude.ai by hand? It is on and kept on for now: with it off, claude.ai could not reconnect (DECISIONS 2026-10-15).

**Changelog** (rationale in DECISIONS.md; file history in git)
- v1.6 (2026-10-22) — Projects section: open points after the build; multi-user partly answered. → DECISIONS.md 2026-10-22
- v1.5 (2026-10-21) — Side window: both approaches stand alongside live views. → DECISIONS.md 2026-10-21
- v1.4 (2026-10-16) — Answered items removed (layout mechanism, feasibility spike, host authentication, side-window question 1); registration kept on. → DECISIONS.md 2026-10-15
- v1.3 (2026-10-14) — Question added on OAuth client registration before real data.
- v1.2 (2026-10-14) — Siniša's side-window scope recorded with six clarifying questions.
- v1.1 (2026-10-13) — Answered questions moved to DECISIONS.md; status header added.
- v1.0 (2026-10-13) — First version.
