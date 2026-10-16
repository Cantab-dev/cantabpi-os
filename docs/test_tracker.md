# Test tracker — Cantab OS MCP tools

Findings from **live testing**. Distinct from the queue of tests still to run — this tracks what was
*found*, not what to try next.

## How to update

- **Add the row in the same session you find something.** Deferring it is how a tracker goes stale.
- **A row is one issue's lifecycle, edited in place:** `Open` → `Root-caused` → `Fixed` → `Verified`.
  Not append-only — a row should read as current state, not a stack of edits.
- **`#` is a stable sequential id.** Next new row takes the next integer (currently `20`). Never
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
| 9 | 2026-10-15 | claude.ai asked for approval on every `list` call. | claude.ai desktop app 2.37, Nela, 2026-10-15 | Function v0.5.2; Opus | Fixed | v0.5.3 marks `list` and `get` read-only (`readOnlyHint`); Nela chose Always allow. | [chat-ux-status.md](chat-ux-status.md) §4 | Not yet seen whether claude.ai offers the read-only tools as one group. |
| 13 | 2026-10-15 | The unknown-entity error of `list` named six entities but not `categories`. | N/A — `scripts/smoke.sh` run, 2026-10-15 | Function v0.5.3; no model involved | Fixed | v0.5.4 adds "or categories with list". | — | Not re-run live yet. |
| 14 | 2026-10-15 | Sign-out exists only on the consent page, so connecting or reconnecting goes straight through as the last signed-in user. | claude.ai desktop app 2.37, Nela, 2026-10-15 | Consent app at cantabpios.lovable.app | Open | Requested from Lovable: signed-in header, "Not you? Sign out", local-scope sign-out. | [COMMS.md](COMMS.md) 2026-10-15 | Needed to switch between test accounts. |
| 15 | 2026-10-15 | "Could you show me my todo list" showed all 19 todos, 10 of them done and struck through. Nela expects open todos by default and done ones only on request. | claude.ai desktop app 2.37, Nela, 2026-10-15 | Function v0.5.5; Opus | Open | — | [chat-ux-status.md](chat-ux-status.md) §3.3 | Works as specified: `list` returns every status, and the view follows the memo rule (done todos due today or later stay, struck through). Changing it overrides the memo; decide when planning. |
| 16 | 2026-10-15 | "Show me the leads now, and remind me what I need to do today" drew the leads view plus a second `list` of todos (open, due today or earlier). Nela expected today's to-dos from the leads' next-action column. | claude.ai desktop app 2.37, Nela, 2026-10-15 | Function v0.5.5; Opus | Open | — | — | Lead actions have no date, and the four leads have no action set, so Claude read "today" as todos. Design question: dated actions, or guidance to Claude. |
| 17 | 2026-10-15 | In the leads view, a double-click showed no Open button (Ada Lovelace); a single click on Cleo Sample showed only the email. | claude.ai desktop app 2.37, Nela, 2026-10-15 | Function v0.5.5 | Root-caused | — | — | Works as built: Open appears only when the lead has a LinkedIn address, and these two have none ("No LinkedIn on file" shows on double-click). Improvements to plan: show "No LinkedIn" on a single click; the ✉️ emoji renders as a pale, empty-looking box. |
| 18 | 2026-10-16 | After the files and leads views drew correctly, Claude restated the rows in markdown tables and extra sentences under them (the rule is at most one sentence). | claude.ai desktop app 2.37, Nela, 2026-10-16 | Function v0.5.5; claude.ai model not recorded | Open | — | [chat-ux-status.md](chat-ux-status.md) §4 | Earlier rounds gave one sentence. The rule sits only in the `list` result text; plan to state it in the `list` description and the server instructions as well. |
| 19 | 2026-10-16 | Working with the Google files from chat was slow: opening the sheet took long and opened in the browser (side panel is out of scope), and the expense edit ran 17 Claude-in-Chrome actions because the Sheets connector was not on in the chat. | claude.ai desktop app 2.37, Nela, 2026-10-16 | Function v0.5.5; Google connectors in claude.ai | Open | — | — | Once the Sheets connector came on, the revert used it. Edit and revert were exact (22.39 restored, total back to €1,692.55). Not a Cantab OS tool fault; improvements to plan. |

## Resolved (verified)

| # | Found | Finding | Session/Msg ID | Stack version | Status | Fix | Decision ref | Notes |
|---|---|---|---|---|---|---|---|---|
| 1 | 2026-10-13 | A missing required argument (`write_todo` with no `name`) returned a generic validation message with no next step. | N/A — `scripts/smoke.sh` run, 2026-10-13 | MCP server SDK 2.3.1, function v0.1.0; no model involved | Verified | Required arguments now carry a message that names the field and says to call again with it filled in. | — | Re-run of the same call returned the new message. |
| 2 | 2026-10-13 | The side-window instruction appeared in results for todos, leads and skills, where it does not apply. | N/A — `scripts/smoke.sh` run, 2026-10-13 | MCP server SDK 2.3.1, function v0.1.0; no model involved | Verified | `write_*` adds the side-window line for sheets, docs and slides only. | — | Checked on `write_todo` (absent) and `write_doc` (present). |
| 3 | 2026-10-14 | Claude Code showed `cantabpi-os` as "Failed to connect": the key in the registration did not match `CANTAB_DEV_KEY` in `supabase\functions\.env`. | N/A — `claude.cmd mcp list` and a direct `initialize` call, 2026-10-14 | Function v0.2.0; Claude Code CLI, user scope | Verified | Re-added at user scope with the key read straight from the file. | — | `mcp list` shows Connected, and a fresh session's `list` call returned the 4 dummy todos. |
| 4 | 2026-10-14 | "What's on my todo list?" could not call `list`: `mcp list` showed `cantabpi-os` Connected, but none of its tools were loaded in the open VS Code session. | N/A — VS Code extension session, 2026-10-14 | Function v0.2.0; Claude Code VS Code extension, Opus 5.5 | Verified | Restart VS Code after adding or changing an MCP server. | — | The session had started before the re-add in #3. After a restart all 9 tools loaded and the question called `list` with entity `todos`. |
| 5 | 2026-10-14 | `edit` rejected importance 1, 2 and 3: the client sent the number as text and the schema allowed only a number or "". | Siniša's POC chats in claude.ai, 2026-10-14 (memo of 2026-10-15) | Function v0.4.0 | Verified | v0.5.0 accepts a number or "1" to "3" as text; unit tests added. | [chat-ux-status.md](chat-ux-status.md) §2.6 | Live `edit` with importance "2" stored 2 (smoke run, 2026-10-15). |
| 6 | 2026-10-15 | After the first view deploy, claude.ai still answered with a markdown table: it had kept the tool list from when it connected; the chat's + toggle did not refresh it. | claude.ai desktop app 2.37, Nela, 2026-10-15 | Function v0.4.1; Opus | Verified | Disconnect and Connect the connector after an update. | [testing-guide.md](testing-guide.md) v2.1 | After a reconnect the view rendered. |
| 7 | 2026-10-15 | With dynamic client registration off, claude.ai could not reconnect: "Automatic client registration isn't supported by Cantab OS". | claude.ai desktop app 2.37, Nela, 2026-10-15 (claude.ai ref ofid_d474a8853f4cb297) | Supabase Auth OAuth server | Verified | Registration switched back on and kept on (Nela). | HANDOFF.md, next steps | Revisit with a pre-registered OAuth client before real data. |
| 8 | 2026-10-15 | After v0.5.1, claude.ai kept drawing the cached spike view: the view's address `ui://cantab-os/list` had not changed. | claude.ai desktop app 2.37, Nela, 2026-10-15 | Function v0.5.1 | Verified | v0.5.2: the address carries a hash of the HTML (`scripts/build-ui.mjs`). | [chat-ux-status.md](chat-ux-status.md) §3.2 | After a reconnect the new views rendered. |
| 10 | 2026-10-15 | File and lead names were cut off in the view ("Dummy - Acme propo…"). | claude.ai desktop app 2.37, Nela, 2026-10-15 | Function v0.5.2 | Verified | v0.5.3 widens the name column (180 to 240 px). | — | Checked live 2026-10-16: "Evidentiranje neknjiženih troškova" fits in the files view. |
| 11 | 2026-10-15 | After a Save in the view, "what's still open?" was answered from memory, without a new `list`, and was wrong. | claude.ai desktop app 2.37, Nela, 2026-10-15 | Function v0.5.3; Opus | Verified | v0.5.4: the footer shows whether Claude was told; the `list` result says to list again for the current state. | [chat-ux-status.md](chat-ux-status.md) §4 | Retest: "Saved · Claude told", and Claude called `list` on every ask. |
| 12 | 2026-10-15 | Saving several ticked todos was slow, about 1.2 s per todo, one after another. | claude.ai desktop app 2.37, Nela, 2026-10-15 | Function v0.5.4 | Verified | v0.5.5 sends the `edit` calls in parallel (one final state per row). | [chat-ux-status.md](chat-ux-status.md) §4 | Nela: "works faster". |
