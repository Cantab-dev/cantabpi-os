# Open questions

| Status | Version | Owner | Last updated |
| --- | --- | --- | --- |
| Current | v1.1 | Nela | 2026-10-13 |

Questions still waiting for a decision, all for step 3 (connecting a host). Read whole; it is short.
Answered questions are in [DECISIONS.md](DECISIONS.md). Remaining design work goes to the Opus pass
(`/model opus`).

## Terms
- **Host**: Claude.ai or equivalent chat host that connects to Cantab OS via MCP.

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
- v1.1 (2026-10-13) — Answered questions moved to DECISIONS.md; status header added.
- v1.0 (2026-10-13) — First version.
