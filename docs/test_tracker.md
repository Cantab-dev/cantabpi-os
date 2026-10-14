# Test tracker — Cantab OS MCP tools

Findings from **live testing**. Distinct from the queue of tests still to run — this tracks what was
*found*, not what to try next.

## How to update

- **Add the row in the same session you find something.** Deferring it is how a tracker goes stale.
- **A row is one issue's lifecycle, edited in place:** `Open` → `Root-caused` → `Fixed` → `Verified`.
  Not append-only — a row should read as current state, not a stack of edits.
- **`#` is a stable sequential id.** Next new row takes the next integer (currently `5`). Never
  reused, never renumbered, kept after the row is archived. It is a handle for discussion, not a way
  to locate the evidence.
- **Cells stay short — one or two sentences, current state only.** `Notes` is not a log: no dated
  stack of "re-verified…", no investigation trail. If a fix needs the full narrative, it goes in
  `DECISIONS.md`; fill in `Decision ref` rather than duplicating it.
- **`Session/Msg ID` is the product's own session or message id** — the conversation being
  diagnosed — plus one representative timestamp. Not the id of the working session that found it. For
  a finding from reading code, write `N/A — static investigation`.
- **Re-tested on a different model or architecture?** Record both dates and both results **in the
  same row**; don't open a second row for the same mechanism.
- **Verified means the specific new value was checked live**, not an adjacent structural field.
- **Round discipline:** in a focused round, fix real code bugs only. Log behaviour findings and
  improvements and defer them — **unless a finding invalidates the round's own premise, which
  escalates immediately.**
- Once `Verified`, move the row to **Resolved** at the foot on the next sweep.

**Adding a row:** put it on the line **directly after the last row**, with no blank line between —
a blank line ends a markdown table and the row silently renders as loose text.

## Open

| # | Found | Finding | Session/Msg ID | Stack version | Status | Fix | Decision ref | Notes |
|---|---|---|---|---|---|---|---|---|
| 3 | 2026-10-14 | Claude Code showed `cantabpi-os` as "Failed to connect": the key in the registration did not match `CANTAB_DEV_KEY` in `supabase\functions\.env`. | N/A — `claude.cmd mcp list` and a direct `initialize` call, 2026-10-14 | Function v0.2.0; Claude Code CLI, user scope | Verified | Re-added at user scope with the key read straight from the file. | — | `mcp list` shows Connected, and a fresh session's `list` call returned the 4 dummy todos. |
| 4 | 2026-10-14 | "What's on my todo list?" could not call `list`: `mcp list` showed `cantabpi-os` Connected, but none of its tools were loaded in the open VS Code session. | N/A — VS Code extension session, 2026-10-14 | Function v0.2.0; Claude Code VS Code extension, Opus 5.5 | Verified | Restart VS Code after adding or changing an MCP server. | — | The session had started before the re-add in #3. After a restart all 9 tools loaded and the question called `list` with entity `todos`. |

## Resolved (verified)

| # | Found | Finding | Session/Msg ID | Stack version | Status | Fix | Decision ref | Notes |
|---|---|---|---|---|---|---|---|---|
| 1 | 2026-10-13 | A missing required argument (`write_todo` with no `name`) returned a generic validation message with no next step. | N/A — `scripts/smoke.sh` run, 2026-10-13 | MCP server SDK 2.3.1, function v0.1.0; no model involved | Verified | Required arguments now carry a message that names the field and says to call again with it filled in. | — | Re-run of the same call returned the new message. |
| 2 | 2026-10-13 | The side-window instruction appeared in results for todos, leads and skills, where it does not apply. | N/A — `scripts/smoke.sh` run, 2026-10-13 | MCP server SDK 2.3.1, function v0.1.0; no model involved | Verified | `write_*` adds the side-window line for sheets, docs and slides only. | — | Checked on `write_todo` (absent) and `write_doc` (present). |
