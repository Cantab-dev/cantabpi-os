# Cantab OS — Engagement tools: plan and status

| Status | Version | Owner | Last updated |
| --- | --- | --- | --- |
| Current — §7.2 built and live; §7.4 not planned yet | v0.2 | Nela | 2026-10-22 |

**Since 2026-10-23 (v0.11.0):** the database names below (`engagement_read`, `engagement_commit`, …) are `project_*`;
see [project-engagement-status.md](project-engagement-status.md). The tool names are unchanged.

**What this is:** the plan for [live-views-status.md](live-views-status.md) §7.2 (tool names as in the package). §7.4
(the other tools under Aleph's pattern) will be planned here too. §7.2: go from Nela 2026-10-22; live in function v0.10.0.

## 1. §7.2 Tool names as in the package

Rename the five tools to the package's verbs (`vendor/bpag/spec/02-data-tool.md`). Arguments, results and behaviour do
not change.

| Now | New |
|---|---|
| `engagement_contract` | `contract` |
| `engagement_query` | `query` |
| `engagement_write` | `write` |
| `engagement_log` | `log` |
| `engagement_reset` | `reset` |

| # | Step | Status |
|---|---|---|
| 1 | `engagement.ts`: the five names, and every message and description that names a tool ("Call reset with confirm true…", "Call log with limit 1…", "see contract") | Done |
| 2 | `index.ts`: the server instructions ("The contract, query, write, log and reset tools read and change the selected project's engagement…"); version 0.10.0 | Done |
| 3 | Unit tests (51) pass; a check that the tool list has the five new names and none of the old | Done: 52/52 (new test: the five names in order, no duplicate across the 19, no `engagement_` left) |
| 4 | Deploy (after Nela's go), tag `v0.10.0`; live: tools/list and the demo steps as `claude@test.com` | Done: deployed, tag `v0.10.0`; live server 0.10.0, 19 tools with the new names, the instructions name them; reset, contract, query, demo 1–9 at 7–15, 10 refused ("122 characters"), log; `engagement_reset` now "not found". Test user left at the seed, Atlas selected |
| 5 | Nela: Disconnect and Connect the connector in claude.ai (it reads the tool list only when it connects) | **Open: Nela** |
| 6 | Docs: this file, tools-status, live-views-status §4, Diagram_input, DECISIONS, HANDOFF | Done |

About 30 min plus the reconnect. The database functions keep their names (`engagement_read`, `engagement_commit`, …).

**Question for Nela — the page's empty-project message** names the old tool: "Ask Claude to load the demo
(engagement_reset)". **Nela: (a).** (a) **Leave it until §7.3** — recommended: §7.3 replaces the pages and this runtime, so the text goes
then, and a change now needs you to rerun `node scripts/templates.mjs --upload`. (b) Change it now to "(reset)" and you
rerun the upload.

## Comments for Nela (proposals, not in the build)

- **Short names sit next to our own tools** (`write_todo`, `list`, `get`, `note`). With the descriptions unchanged, the
  model could reach for `write` when the user means a todo, or `query` for a lead. The descriptions already start from
  "the selected project's engagement"; if it shows up in testing, a first word "Engagement:" in each title and
  description is the cheap fix.

**Changelog**
- v0.2 (2026-10-22) — §7.2 built and live (function v0.10.0); page text left until §7.3 (Nela). → DECISIONS.md 2026-10-22
- v0.1 (2026-10-22) — §7.2 planned; one question for Nela.
