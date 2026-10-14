# Open questions

| Status | Version | Owner | Last updated |
| --- | --- | --- | --- |
| Current | v1.2 | Nela | 2026-10-14 |

Questions still waiting for a decision, all for step 3 (connecting a host). Read whole; it is short.
Answered questions are in [DECISIONS.md](DECISIONS.md). Remaining design work goes to the Opus pass
(`/model opus`).

## Terms
- **Host**: Claude.ai or equivalent chat host that connects to Cantab OS via MCP.

## Side window — scope from Siniša, clarifications pending
Siniša (project lead): the MCP tool sends a url in its result; the host's only job is to display it with its browser tool (browser pane). The host never creates HTML pages in the side window. Example: for a Google Sheet the tool sends the sheet's url, and the host displays it.

Effect, once confirmed: the built tools already return the url and a plain-text instruction, so only the wording ("open in the browser pane") and a clearly named url field change. Parts of [architecture.md](architecture.md) (no side window; files open in a new tab; HTML views for slides) are superseded. The layout spike below shrinks to one test: does the host open a url from a tool result in its browser pane?

Questions for Siniša:
1. Does "nothing else" also drop the in-chat render instructions (table for `list`, card for `get`), or does it apply to the side window only?
2. Which hosts have a browser tool? The Claude desktop app has a browser pane and Claude in Chrome is an extension; not verified for claude.ai in a plain web browser or on mobile.
3. The browser pane must be signed in to Google with access to the file; who sets that up?
4. Slides: open the Google Slides `url` or the PDF `storage_url`?
5. `get` returning several files: open none, the first, or ask?
6. Leads: should `url_linkedin` open in the browser pane too?

## In-host layout (design still open)
Each tool returns, in addition to its result, host-view instructions following MCP best practices: simplified layout suggestions interpreted by the host. Layout suggestions are part of each tool's design. Mechanism (MCP Apps `ui://` resource vs structured result / annotations) to be decided on Opus after the feasibility spike.

## Questions raised by multi-user (for Opus design pass)
- Tenancy model: organisation/workspace with shared + private data, or strictly per-user data? Which entities are personal (todos?) vs shared (leads, docs)?
- Roles/permissions: who can read/write what? Who manages users?
- Host authentication: claude.ai custom connectors use MCP OAuth — Supabase Auth as OAuth provider vs external IdP.
- Label uniqueness scope: global, per-workspace or per-user? (Per-entity counters must be concurrency-safe and never reused.)
- Skills: global, per-workspace or per-user? (Trust model deferred, but scope affects the schema.)

## Feasibility spike (cheap, de-risks layout)
Before the full schema: deploy one trivial MCP edge function with a single tool + `ui://` resource, connect it as a custom connector in claude.ai, confirm what renders on desktop and mobile.

**Changelog** (rationale in DECISIONS.md; file history in git)
- v1.2 (2026-10-14) — Siniša's side-window scope recorded with six clarifying questions.
- v1.1 (2026-10-13) — Answered questions moved to DECISIONS.md; status header added.
- v1.0 (2026-10-13) — First version.
