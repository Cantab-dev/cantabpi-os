# Testing the Cantab OS MCP server

| Status | Version | Owner | Last updated |
| --- | --- | --- | --- |
| Current | v2.4 | Nela | 2026-10-23 |

How to connect Claude to Cantab OS as yourself and try the tools. About 10 minutes.

## Before you start

- **The data is dummy.** Nothing real is stored. You have your own copy of the dummy data, and nobody
  else sees your rows. Anything you create is saved for real, so start names with `Test -` to make it
  easy to remove afterwards.
- **You sign in as yourself** with your Cantab OS (Supabase) email and password. Nela has these. There
  is no sign-up page.

## Connect in claude.ai or the Claude desktop app

1. Settings → Connectors → **Add custom connector**.
2. Name: `Cantab OS`. URL: `https://etofljbxzllkucmearwl.supabase.co/functions/v1/mcp`. Leave the
   advanced settings empty.
3. Click **Connect**. A Cantab OS sign-in page opens (`os.cantabpi.com`). Sign in, then click
   **Approve**. You land back in Claude.
4. In a new chat, turn on the Cantab OS connector (the tools menu under the message box).

The page at https://os.cantabpi.com also shows the URL and these steps once you're signed in.

## Connect in Claude Code (optional)

1. Run this once (in Windows PowerShell 5.1, type `claude.cmd` instead of `claude`):

   ```
   claude mcp add --transport http --scope user cantabpi-os https://etofljbxzllkucmearwl.supabase.co/functions/v1/mcp
   ```

2. **Fully restart Claude Code or VS Code.**
3. Type `/mcp`, choose `cantabpi-os` and **Authenticate**. Sign in and approve in the browser.
4. `/mcp` should list 18 tools.

## The agent demo (live views)

1. Ask Nela for a demo project: she has Claude Code run `node scripts/demo-project.mjs <your email> --select`, which
   creates "Big Pharma AG" with Siniša's demo data and selects it. The same command puts the demo back to the start;
   there is no reset in the chat.
2. Open https://os.cantabpi.com/v/1 next to the chat and sign in with the same account.
3. Ask Claude: "Show the Engagement home view." Then follow the steps in `vendor/bpag/spec/03-demo-script.md`: before
   each step, ask Claude to show the view named in it, then ask for the change as the named agent.
4. After an update of the connector's tools, Disconnect and Connect it once in claude.ai.

## Try it

Ask in plain words; Claude should pick the tool itself. For example:

| Ask | Expected tool |
|---|---|
| What's on my todo list? | `list`; an interactive view of your todos |
| Do we have any leads? | `list` |
| Show me the Acme proposal todo | `list` (every row already carries its notes, so no `get`) |
| Show my leads / Show my docs and sheets | `list`; an interactive view appears |
| Add a todo "Test - call Ada", due Friday, sales | `write_todo` |
| Add a lead "Test - Ada Lovelace" | `write_lead` |
| Add a note to the Acme proposal todo saying "chased by email" | `list`, then `note` |
| Which skills are there? | `list`, then `get` |
| Mark the Acme proposal todo as done | `list`, then `edit` |
| Move the dentist todo to next Friday | `list`, then `edit` |
| Delete the "Test - call Ada" todo | `list`, then `delete` (Claude asks you to confirm) |
| Which projects do I have? | `list` with projects |
| Switch to Birch | `list` with projects, then `select_project` |
| Start a project "Test - Acme engagement" | `write_project` (does not switch to it) |

**Projects (since v0.7.0).** You always work in one project; every reply names it. Todos, sheets, docs and
slides belong to one project each, and you see only the selected project's; leads and skills are shared. Each
user starts in *Dummy - Project Atlas*. Rows from before projects are in *Unsorted (from v1)*. With no project
selected, Claude gets "No project selected. Select a project first" and should offer your projects. A project
can be deleted only when it is empty.

**In-chat views.** In claude.ai and the desktop app, every `list` shows an interactive view: todos grouped
by due date (tick, then **Save**), leads and files grouped by category (click a row for details). Claude should
write at most one sentence under it. claude.ai asks before each tool call until you choose **Always allow**.

**After an update to Cantab OS,** if the view looks old or does not appear: Customize → Connectors →
Cantab OS → **Disconnect**, then **Connect**. claude.ai reads the tool list only when it connects; the
toggle in the chat's + menu is not enough.

The other write tools are `write_sheet`, `write_doc`, `write_slide` and `write_skill`. These save
pointers and text only. Claude does any Google work itself.

Labels like `todo:47` are shared across all users, so your numbers have gaps. That's expected.

## Report what you find

Send Nela what you asked, what happened and roughly when. Note anything where Claude picked the wrong
tool, a message was unclear, or the sign-in didn't work. She logs each finding in
[test_tracker.md](test_tracker.md).

**Changelog** (file history in git)
- v2.4 (2026-10-23) — Swept: 18 tools (function v0.11.0); the agent demo, set up from Claude Code.
- v2.3 (2026-10-22) — Projects (function v0.7.0): three prompts and how the selection behaves.
- v2.2 (2026-10-16) — Expected tools updated for the views; scripted round in test-script-chat-views.md.
- v2.1 (2026-10-15) — In-chat views; reconnect after an update.
- v2.0 (2026-10-14) — Rewritten for sign-in: each tester connects as themselves through claude.ai or Claude Code; the shared key is gone.
- v1.1 (2026-10-14) — `edit` and `delete` added (11 tools).
- v1.0 (2026-10-14) — First version.
