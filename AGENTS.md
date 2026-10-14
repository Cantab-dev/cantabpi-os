# Agent instructions — cantabpi-os

Only Claude Code writes to this repo. Lovable builds the OAuth consent app in its own project and repo,
and never writes here or changes the Supabase project. The ownership split and the channel between the
two are in [docs/COMMS.md](docs/COMMS.md). Nela carries messages across.

## Git

- `main` only; commits go straight to it.
- **Never rewrite published history** (force-push, rebase, amend or squash pushed commits) — anything
  that syncs from this branch has its history rewritten too.

## Plan and spec documents

Applies to `docs/*.md`: plans, specs and living reference docs. Not logs or trackers
(`DECISIONS.md`, `test_tracker.md`) — those have no header table.

**Status header, required** — first block under the title:

```markdown
| Status | Version | Owner | Last updated |
| --- | --- | --- | --- |
| In progress | v1.3 | <owner> | <YYYY-MM-DD> |
```

- **`Status` comes from the vocabulary in `docs/Documentation_Rulebook.md` Part C §3.** It is two
  ladders picked by the doc's type; read it there, don't infer it.
- **That vocabulary is for the document's header only.** Status words on rows and sections inside a
  doc (`planned`, `built`, `changed`, `open`) are that doc's own lifecycle and stay as they are.
- **Update `Status` / `Version` / `Last updated` and append the changelog line in the same change as
  the work.** Not optional, not requested each time. Changing `Approved` to `In progress` when work
  starts is part of the change that starts it.
- **The body describes the design as it stands now**, not how it got there. No inline dated
  subheadings, no "revised on …" preambles.
- **Changelog** — one line per version, newest first, each pointing at the detail rather than
  restating it:
  ```markdown
  **Changelog** (rationale in DECISIONS.md; file history in git)
  - v1.3 (<DATE>) — <one line>. → DECISIONS.md <DATE>
  ```
- **A retired doc moves to `docs/archive/` in the same change that sets its status**, and live links
  to it are fixed in that change.

## Ownership of this file

Nela.
