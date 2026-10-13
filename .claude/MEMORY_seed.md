# Memory seed — Cantab OS

Which convention-memories this project seeds into the agent's memory, so they are not rediscovered
the hard way. Each is its own memory file with a **Why:** and a **How to apply:** line, and a one-line
pointer in `MEMORY.md` (index stays ≤ 40 lines).

## Seeded

| Memory | The rule |
|---|---|
| **What the agent runs vs. what a human runs** | Agent runs local edits, tests, read-only queries, and migrations after the plan is approved. Pushes and deploys need Nela's go each time. Logins and anything involving a secret: prepare the command; Nela runs it. |
| **Plan before building new capability** | Plan-and-status doc first, explicit go, then build, test and verify without re-asking. |
| **Higher model for architecture** | Hint Nela to switch to Opus before any architecture decision. |
| **Debug from the live trace** | Read the actual messages and tool calls before guessing a fix from code. |
| **Verify the new value itself** | Check the specific column or field a change exists to produce, not adjacent ones. |
| **Tag the stack version per finding** | Note the model and tool version a test ran on. |
| **The user's tooling familiarity** | Nela is new to PowerShell: name the window, give copy-paste blocks, warn before login / logout / reset. |
| **Clone location and why** | Repo lives in `C:\dev\cantabpi-os`, outside the synced folder, because sync mirrors git internals. |
| **Standing evaluation assumptions** | The database holds dummy data only; test results are not evidence about real use. |
| **Doc-hygiene sweep day and owner** | Friday. Claude reminds Nela in the first session on or after a Friday; the sweep runs on her go. |

## Do not seed

Anything the repo already records — code structure, past fixes, git history, `CLAUDE.md`. Anything
that only matters to one conversation. A rule with no stated why. Dated state phrased as a rule.
