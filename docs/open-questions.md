# Open questions and decisions

Status as of 2026-10-13. Remaining design work goes to the Opus pass (`/model opus`).

## Terms
- **Host**: Claude.ai or equivalent chat host that connects to Cantab OS via MCP.

## Answered
1. **Google vs Microsoft 365** — RESOLVED by scope: ALL Google integrations (sheets, docs, slides, email, calendar, drive) are OUT OF SCOPE for Cantab OS. They are done by the host. Cantab OS only (a) stores context + url for sheets/docs/slides (url points to the Google artifact) and (b) holds workflows for the host as skills (specified later).
3. **Auth / tenancy** — multi-user.
4. **Skills trust model** — decide later.
5. **"Oria"** — moot: ppt/doc/sheet integrations are host-side, out of scope.
6. **Label scheme** — format per entity (`todo:12`, `lead:7`, ...); labels are stable after delete (never reused).

## Decision input (design still open)
2. **In-host layout.** Each tool returns, in addition to its result, host-view instructions following MCP best practices: simplified layout suggestions interpreted by the host. Layout suggestions are part of each tool's design. Mechanism (MCP Apps `ui://` resource vs structured result / annotations) to be decided on Opus after the feasibility spike.

## New questions raised by multi-user (for Opus design pass)
- Tenancy model: organisation/workspace with shared + private data, or strictly per-user data? Which entities are personal (todos?) vs shared (leads, docs)?
- Roles/permissions: who can read/write what? Who manages users?
- Host authentication: claude.ai custom connectors use MCP OAuth — Supabase Auth as OAuth provider vs external IdP.
- Label uniqueness scope: global, per-workspace or per-user? (Per-entity counters must be concurrency-safe and never reused.)
- Skills: global, per-workspace or per-user? (Trust model deferred, but scope affects the schema.)

## Feasibility spike (cheap, de-risks layout)
Before the full schema: deploy one trivial MCP edge function with a single tool + `ui://` resource, connect it as a custom connector in claude.ai, confirm what renders on desktop and mobile.
