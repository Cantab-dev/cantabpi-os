# Cantab OS — XOS

Backend-only operating system for a consulting / small business / biotech: Supabase DB + MCP edge
function. First host is claude.ai (MCP connector); ChatGPT later. Internal Cantab Pi project, no client
or contract. Siniša is project lead; Nela is the developer.

**Kit version:** 0.12.0 (cantabpi-project-kit). Profile: M.
Kit clone: `C:\dev\cantabpi-project-kit`. The kit's guides are this project's defaults, read from there.
**When you depart from the kit on purpose, add a row to `Kit_Exceptions.md` (repo root) in the same
session** (create it on the first one) — an unrecorded exception can't be told apart from drift.

Sessions open from this repo, so this is the always-loaded instruction file. At session start read
`HANDOFF.md` in the SharePoint root (path in the folder map) for current state and where things live.

@AGENTS.md

## Precedence — when two instructions conflict

1. Safety and legal constraints
2. Client-contractual commitments
3. Nela's explicit instruction in the current session
4. This project's rules (this file, then `AGENTS.md`)
5. Kit defaults

A lower layer stays silent on anything a higher layer already covers. If two instructions at the same
layer genuinely conflict, say so and ask — don't pick one silently.

## Folder map

| Folder | Contents | Intent |
|---|---|---|
| `docs/` | Spec, plan-and-status docs, `DECISIONS.md`, `test_tracker.md`, `Documentation_Rulebook.md` | Source of truth for what is planned and built |
| `supabase/migrations/` | SQL migrations | Never edit an applied migration; add a new one |
| `supabase/functions/` | MCP edge function(s) | |
| `supabase/seed.sql` | Dummy data | Fake rows only |
| `scripts/` | `smoke.sh` — live checks against the deployed function | Creates test rows; remove them afterwards |
| `.claude/` | `settings.json`, `hooks/` (doc-hygiene check), `MEMORY_seed.md` | |
| SharePoint root: `C:\Sharepoint\cantabpi.com\CantabPI - XCO001 - Consulting\Cantabpi-OS` | `HANDOFF.md`, `folder-skeleton.md`, a pointer `CLAUDE.md`, `01_analysis/`, `03_documentation/` (`Document_Log.md` and other SharePoint documents) | Never put the repo or `.git` there — sync mirrors git internals |

**Leave alone unless asked:** `.env.local` (secrets); any file in the SharePoint root this project did
not create.

## Document tracking

`03_documentation/Document_Log.md` in the SharePoint root is the single record of every tracked document. **Update it
in the same session a document is created, finalised, shared, or moved** — a periodic sweep is how it
goes stale. Document rules live in `docs/Documentation_Rulebook.md` — an **unedited** copy of the
kit's, kept because Nela and Siniša both write here (kit README §1); this project's departures go in
`Kit_Exceptions.md`, never into the copy. Read it before restructuring any doc that has grown hard to read.

## Decisions — one home each, by scope

1. **Status / scope / planning** — `HANDOFF.md` (SharePoint root) — what is true now and what is next
2. **Build level** — `docs/DECISIONS.md` — implementation decisions, newest first

A decision that seems to belong in two goes in the more specific one; the other links to it.

## Confidentiality

Not classified yet — parked by Nela on 2026-10-13, along with any residency requirement. The database
holds dummy data only. Raise it again before real lead data (names, emails, LinkedIn urls) goes in.

## Working rules

- **Architecture decisions need Opus or higher** — DB schema, MCP tool/resource contracts, auth/RLS
  model, rendering mechanism, anything costly to change later. Always tell Nela to switch
  (`/model opus`) before making or locking one in, and suggest other moments that warrant a switch;
  Claude cannot switch itself. Implementing an approved design is fine on Sonnet. *Why: these are the
  expensive mistakes.*
- **No push or deploy without Nela's explicit go** — outward-facing and hard to undo. Only Nela approves, for now.
- **Secrets never go in the repo or in chat** — use Supabase secrets or the git-ignored `.env.local`.
- **Plan before building.** Each build step gets a plan-and-status doc in `docs/`; present it, wait
  for the go, then build, test and verify without re-asking, and update statuses in the same change.
  *Why: one gate before the first irreversible step.*
- **Build the spec as written.** A change or addition to it is proposed as a comment in the plan doc,
  not built, unless Nela says so. *Why: an earlier proposal went well past what was asked.*

Enforcement: the session-start hook checks doc headers under `docs/` and the SharePoint root's
`01_analysis/` and `03_documentation/`, the handoff's and this file's length (≤ 120 lines), and nudges
when the kit moves past `kitVersion`. Every other rule here is unenforced — judgment.

## Known gotchas

Observed 2026-10-13 — verify before relying.

- No Python on this machine; use Node for scripts.
- Supabase CLI is run as `npx supabase` (not installed globally). `db query --linked` with several
  statements returns only the last result.
