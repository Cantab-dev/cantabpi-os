# Test tracker — Cantab OS MCP tools

Findings from **live testing**. Distinct from the queue of tests still to run — this tracks what was
*found*, not what to try next.

## How to update

- **Add the row in the same session you find something.** Deferring it is how a tracker goes stale.
- **A row is one issue's lifecycle, edited in place:** `Open` → `Root-caused` → `Fixed` → `Verified`.
  Not append-only — a row should read as current state, not a stack of edits.
- **`#` is a stable sequential id.** Next new row takes the next integer (currently `1`). Never
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

## Resolved (verified)

| # | Found | Finding | Session/Msg ID | Stack version | Status | Fix | Decision ref | Notes |
|---|---|---|---|---|---|---|---|---|
