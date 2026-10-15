# Cantab OS — In-chat views: test script

| Status | Version | Owner | Last updated |
| --- | --- | --- | --- |
| Current | v1.0 | Nela | 2026-10-15 |

A scripted round for the in-chat views ([chat-ux-status.md](chat-ux-status.md)), built from Siniša's
POC run. Run it top to bottom in one new chat, about 20 minutes. Fill in the **Result** column, or send
screenshots; findings go in [test_tracker.md](test_tracker.md).

## Before you start

1. **Reconnect once:** Customize → Connectors → Cantab OS → Disconnect, then Connect. claude.ai reads
   the tool list only when it connects.
2. **Tool permissions:** set `list` to Always allow. Note whether claude.ai offers `list` and `get` as a
   read-only group (tracker #9).
3. **Your Cantab OS data** (as Nela): 19 todos with categories, four leads with category, importance,
   next action and LinkedIn, and dummy docs, sheets and slides with category and action.
4. **Google files for tests 8–12.** These edit a sheet and a deck. Use **your own copies**, never
   Siniša's originals:
   - Northwind Analytics – Cash Flow Forecast 2027 (sheet; test 9 uses cell B16, equity raise)
   - Agentic Biotech OS (slides)

   Siniša shares both with you; you make a copy of each (File → Make a copy) in your Drive; then
   Cantab OS gets your copies' links (ask Claude Code, or `write_sheet` / `write_slide` in claude.ai).
   Until then, run tests 8–12 as "not ready".
5. **Gmail** must be connected in claude.ai for test 7.

## Tests

Time in seconds from sending the prompt to the view appearing. "Calls" = Cantab OS tool calls shown
in the chat.

| # | Prompt | Expected | Record | Result |
|---|---|---|---|---|
| 1 | "Hi, how are you today?" | A short greeting. No tool call. | – | |
| 2 | "Can you show me my todos for today?" | One `list` call (todos), then the todos view grouped Overdue / Today / Tomorrow… At most one sentence underneath, e.g. what's overdue. | Seconds until the view appears. Calls (should be 1). Any HTML written by Claude (should be none). Were done todos shown (tracker #15)? | |
| 3 | In the view: tick one todo and press Save. | Footer reads "Saved · Claude told". | Seconds to save. Any approval prompt. | |
| 4 | "What's still open?" | A new `list` call; the ticked todo is missing from the answer. | Did it list again? Was the answer correct? | |
| 5 | "OK, show me the leads now, and remind me what I need to do today." | Leads view grouped by category, plus a short summary that combines todos and lead actions. | Seconds. Does the summary use the ✨ actions from leads? Ada's action says "today" (tracker #16). | |
| 6 | In the leads view: click a row, then double-click one. | Click shows action, history and email. Double-click shows the LinkedIn field and the Open button. | Did anything not respond? Does Open open the profile (example addresses lead nowhere real)? | |
| 7 | "Send a test email to myself: subject 'test', body 'Hello'." | Gmail sends one email to you. | **Use your own address, not real contacts.** Siniša's run sent to real external addresses (Jing, Rob). Sending email is outward-facing and can't be undone. | |
| 8 | "Let's discuss budget. Show me my sheets, then open Northwind." | Files view (sheets), then Northwind opens in the side panel. | Seconds until the sheets view appears. Side panel behaviour is out of scope this phase: note only, don't count as a failure. | |
| 9 | "Change equity raise to 650000." | Claude edits the right cell (B16) in your copy, and the dependent totals update. | Correct cell? Did Claude report the new totals? | |
| 10 | "Change it back to the old value." | Original value restored. | Was it restored exactly? | |
| 11 | "Can we check the slides? There's a Biotech OS draft, please find it and show it." | `list` for slides, then the files view. The deck opens in the side panel. | Seconds. Found by name without a follow-up `get`? | |
| 12 | "Change the title to a bad joke." Then: "Please revert to the old one." | Title replaced in your copy, then restored with the same style. | Was the revert exact (text and style)? | |
| 13 | "Please show the list of leads." | Leads view again, with at most one sentence. | Seconds; compare with step 5 for consistency. | |
| 14 | "Show me my docs and sheets." | One `list` call with both kinds; one files view with two sections. | One call, not two? Do long names fit (tracker #10)? | |

## After the round

- Untick the todo from test 3 (tick it again in a view, Save) if you want the data as it was.
- Send the filled table or screenshots; Claude Code logs findings in the tracker and records the
  timings in [chat-ux-status.md](chat-ux-status.md) §4.

**Changelog** (file history in git)
- v1.0 (2026-10-15) — First version: Siniša's POC prompts adapted for the in-chat views; Google file copies and Gmail safety added.
