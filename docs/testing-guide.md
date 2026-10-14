# Testing the Cantab OS MCP server

| Status | Version | Owner | Last updated |
| --- | --- | --- | --- |
| Current | v1.1 | Nela | 2026-10-14 |

How to connect Claude Code to the Cantab OS tools and try them. About 10 minutes.

## Before you start

- **The data is dummy.** Nothing real is stored. Anything you create is still saved for real, so start
  names with `Test -` to make them easy to remove afterwards.
- **One shared key.** Every tester uses the same development key and acts as the same test user. The
  server can't tell testers apart and keeps no call log. Per-person tokens come before any real data.
- **Claude Code only.** claude.ai can't connect yet.

## What you need

- Claude Code: the CLI, or the VS Code extension.
- The development key, from Nela. She shares it through a password manager or in person. Don't paste it
  into email, Teams, a Claude chat or a file in the repo.

## Connect

1. Run this once, with the key in place of `<KEY>`. It registers the server for every project
   (`--scope user`).

   ```
   claude mcp add --transport http --scope user cantabpi-os https://etofljbxzllkucmearwl.supabase.co/functions/v1/mcp --header "Authorization: Bearer <KEY>"
   ```

   In Windows PowerShell 5.1, type `claude.cmd` instead of `claude`, because the script policy blocks
   `claude`. PowerShell 7 (`pwsh`) works with either.

2. Run `claude mcp list`. `cantabpi-os` should show **Connected**. If it shows "Failed to connect",
   the key is probably wrong: run `claude mcp remove cantabpi-os --scope user` and add it again.

3. **Fully restart Claude Code or VS Code.** A session started before the add doesn't load the tools.

4. In a new session, type `/mcp`. `cantabpi-os` should list 11 tools.

## Try it

Ask in plain words; Claude should pick the tool itself. For example:

| Ask | Expected tool |
|---|---|
| What's on my todo list? | `list` (returns four dummy todos) |
| Do we have any leads? | `list` |
| Show me todo:1 | `get` |
| Add a todo "Test - call Ada", due Friday, sales | `write_todo` |
| Add a lead "Test - Ada Lovelace" | `write_lead` |
| Add a note to todo:1 saying "chased by email" | `note` |
| Which skills are there? | `list`, then `get` |
| Mark todo:1 as done | `edit` |
| Move the dentist todo to next Friday | `list`, then `edit` |
| Delete the "Test - call Ada" todo | `list`, then `delete` (Claude asks you to confirm) |

The other write tools are `write_sheet`, `write_doc`, `write_slide` and `write_skill`. These save
pointers and text only. Claude does any Google work itself.

You only see the test user's rows. Please delete the `Test -` rows you created when you're done.

## Report what you find

Send Nela what you asked, what happened and roughly when. Note anything where Claude picked the wrong
tool or a message was unclear. She logs each finding in [test_tracker.md](test_tracker.md).

**Changelog** (file history in git)
- v1.1 (2026-10-14) — `edit` and `delete` added (11 tools).
- v1.0 (2026-10-14) — First version.
