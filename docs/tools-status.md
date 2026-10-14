# Cantab OS — Tools: plan and status

| Status | Version | Owner | Last updated |
| --- | --- | --- | --- |
| Current | v1.1 | Nela | 2026-10-14 |

This document is both the plan and the record of what exists. Each item has a status; update the status in the same change that builds the item.

Status values: `planned` (agreed, not built) · `built` (deployed and tested) · `changed` (built, then altered; note what changed) · `open` (needs a decision).

All nine tools are deployed and tested against dummy data (2026-10-13). The plan was checked against the project kit's agent design guide (Part 1 and the tool-description format); items marked ▲ were added to close gaps that check found and are not in the original spec.

## Scope

Step 2 of the deployment plan: the tools, as one MCP edge function, tested directly (curl and Claude Code). Connecting a host, sign-in, per-user access rules and real in-host views belong to step 3.

Data structure the tools work on: [data-structure-status.md](data-structure-status.md).

## The server — `built`

- One Supabase edge function named `mcp`, at `https://etofljbxzllkucmearwl.supabase.co/functions/v1/mcp`.
- Speaks MCP over Streamable HTTP, stateless, built with the official MCP TypeScript SDK as in Supabase's guide.
- Reads and writes the database with the backend (service role) key, which stays inside the function.
- One shared database helper for all tools ▲.

## Temporary access for this phase — `built`

The function has a public URL and full access to the data, so it cannot be left open, even with dummy data.

- **Development key**: every request must carry the key as `Authorization: Bearer <key>`. The key is stored as a Supabase secret and in the git-ignored `supabase/functions/.env`; never in the repo. Requests without it get 401.
- **Acting user**: rows created by the tools get `owner_id` of the test user `claude@test.com` (decided 2026-10-13). All tools see all rows.
- Both are replaced in step 3 by real sign-in and per-user rules.

## Rules for every tool — `built`

- **Labels only.** No argument takes a database id and no result contains one. `id`, `owner_id`, `created_at` and `updated_at` are never returned.
- **One exit for results ▲.** Every result is built from a fixed list of columns per entity and passes one check before it leaves: no id fields, plain JSON values only (dates as `YYYY-MM-DD` text).
- **Bounded results ▲.** Every tool has row and character limits that are always on. When a limit cuts something, the result says so with `truncated: true` and how to get the rest.
- **Errors name the next call ▲.** Every failure listed under a tool returns a message that says what was wrong and what to call next.
- **Inputs are checked ▲.** Each argument is checked against what is allowed (lists of values, formats, lengths). A value that fails is an error naming the field; it never reaches the database.
- **Each tool has a display title ▲**, defined with the tool.
- **Descriptions say when to call the tool and give example journeys ▲**; they do not describe what comes back.

## Tools

### list — `built`
Display title: "List records".

- **Arguments**: `entity` — one of `skills`, `todos`, `leads`, `sheets`, `docs`, `slides`. `page` ▲ — whole number from 1; default 1.
- **Returns**: one page of that entity's rows, ordered by label number, with all columns except `context`. For skills, `label` and `description` only ▲; the `guideline` comes from `get`.
- **Paging ▲**: 25 rows per page. The result carries `page`, `total` (rows in the entity) and `truncated`; when more rows exist it names the next page to call.
- No filters in this phase.
- **Description**: *Call this to see what exists before fetching or adding anything, or when the user asks what is on a list. "What's on my todo list?" → `list(todos)`. "Do we have Ada as a lead?" → `list(leads)`. "Which skills are there?" → `list(skills)`, then `get` the one you need.*

| Failure | Message tells the model to |
|---|---|
| Unknown `entity` | use one of the six values, listed |
| `page` not a whole number from 1 | pass a whole number from 1 |
| `page` beyond the last page | call again with a page up to the last one, named |
| No rows at all (not an error) | create one with the matching `write_*` tool |

### get — `built`
Display title: "Get records".

- **Argument**: `labels` — 1 to 10 labels ▲; entities can be mixed (`["todo:1", "lead:2"]`).
- **Returns**: one entry per label, each either the record with all columns including `context`, or not found. One bad label does not fail the others.
- **Limits ▲**: `context` is cut to its most recent 4,000 characters; `guideline` is cut to its first 8,000 (the same limit as on writing it, so one written through the tools is never cut). A cut entry carries `truncated: true`.
- **Description**: *Call this when you have a label and need the full record, including its notes. Labels come from `list`; never invent one. "What do we know about Ada?" → `list(leads)` to find her label, then `get(["lead:1"])`. "Run the weekly review skill" → `get(["skill:1"])` for its guideline.*

| Failure | Message tells the model to |
|---|---|
| Label not found | call `list` for that entity to see which labels exist |
| Label malformed (unknown prefix, no number, a raw id) | use `<entity>:<number>`, and call `list` to find it |
| More than 10 labels | split into calls of 10 or fewer |
| Empty `labels` | pass at least one label |

### write_todo, write_lead, write_sheet, write_doc, write_slide, write_skill — `built`
Display titles: "Add todo", "Add lead", "Add sheet", "Add doc", "Add slide", "Add skill".

Create one record. The label is generated by the database. These tools only create.

| Tool | Arguments |
|---|---|
| `write_todo` | `name` (required), `category`, `due` (date `YYYY-MM-DD`), `importance` (1–3), `status` (true = done) |
| `write_lead` | `name` (required), `full_name`, `email`, `url_linkedin` |
| `write_sheet` | `name` (required), `url` |
| `write_doc` | `name` (required), `url` |
| `write_slide` | `name` (required), `url`, `storage_url` |
| `write_skill` | `description` (required), `guideline` |

- **Returns**: confirmation with the new label and the stored record, or an error.
- **Input limits ▲**: `name`, `category`, `full_name` up to 200 characters; `description` up to 500; `guideline` up to 8,000; urls up to 2,000 and must be `http` or `https`; `email` must look like an email address.
- **Description** (pattern, one per tool): *Call this when the user asks to add a new todo. It always creates a new record; check `list(todos)` first if it might already exist. "Remind me to send the proposal by Friday" → `write_todo(name, due)`. To record more about it afterwards, use `note` with the label this returns.*

| Failure | Message tells the model to |
|---|---|
| Required field missing or empty | supply it, named |
| `due` not a real date | use `YYYY-MM-DD` |
| `importance` not 1, 2 or 3 | use 1 (low), 2 (medium) or 3 (high) |
| Text too long | shorten the named field to its limit; put detail in a `note` |
| Url or email not valid | correct the named field or leave it out |
| Database error | not retry blindly; call `list` to check whether the record was created |

### note — `built`
Display title: "Add note".

- **Arguments**: `label`, `text` (up to 1,000 characters ▲).
- Appends a dated line to the record's context.
- **Returns**: confirmation naming the label.
- **Description**: *Call this to record something learned about an existing todo, lead, sheet, doc or slide. "Ada said she's back in March" → find her label with `list(leads)`, then `note("lead:1", …)`. Not for skills.*

| Failure | Message tells the model to |
|---|---|
| Label not found | call `list` for that entity to see which labels exist |
| Label malformed | use `<entity>:<number>`, and call `list` to find it |
| Label is a skill | not retry: skills take no notes |
| `text` empty or too long | supply text within 1,000 characters; split into several notes if needed |

## Render instructions — `changed` (removed)

Removed on 2026-10-14: results carry the data only, as the spec defines it; no `render` part and no side-window line. In-host layout comes back in a later phase. Code changed and unit-tested; **not yet deployed** — live checks to re-run after the deploy. → DECISIONS.md 2026-10-14

## Not in this deployment (decided 2026-10-13)

1. **Updating a record** — not for now; confirmed after the guide check. The `write_*` tools only create. Known consequence: a todo cannot be marked done, a due date cannot be changed and a lead cannot be corrected through the tools.
2. **Deleting a record** — not included.
3. **One generic `write` tool** — not for now: six `write_*` tools, as in the spec. May change later.

## Suggestions to consider later

From the agent design guide check. None is built.

1. **Update through `write_*`.** The guide treats `write` as an upsert, because revising an earlier record is the normal case. Suggested shape: `write_*` accepts an optional `label`; when given, it updates only the fields supplied.
2. **Soft delete** (archive) by label.
3. **One generic `write`** keyed by label, so a new entity is a new type and not a new tool.
4. **Duplicate creates.** A retried `write_*` creates a second record under a new label, and nothing can remove it. Update or delete would resolve it.
5. **`storage_url` on `write_slide`.** The model has no way to produce this value; no tool uploads the PDF.
6. **Entity spelling.** `list` takes `todos`; labels say `todo:`. One spelling would be safer.
7. **Label cannot change.** The label is filled once when a row is created. A database rule that refuses changes to it would guarantee it never drifts.
8. **`render` in every result.** The instruction is the same for every call of a tool; the guide would state it once in the tool description.
9. **Filters on `list`** (for example open todos only), once the lists grow.

## Testing

| Test | Status |
|---|---|
| Unit tests for input checks and failure messages ▲ — `supabase/functions/mcp/lib_test.ts`, run with `deno test` | `built` — 18 pass |
| Live checks for each tool, the error cases and a second page of `list` — `bash scripts/smoke.sh` | `built` — all pass |
| The server added to Claude Code as an MCP server, to check the tools read naturally to a model | `planned` — not done yet |

Rows created during testing were removed; the label numbers they used are not reused, so new labels continue after a gap.
- Findings go in [test_tracker.md](test_tracker.md).

## Where it lives

- `supabase/functions/mcp/` — `index.ts` (server and key check), `tools.ts` (the nine tools), `lib.ts` (checks, limits, messages, result exit), `lib_test.ts`
- `scripts/smoke.sh` — live checks
- `supabase/config.toml` — `[functions.mcp] verify_jwt = false`, because the function checks its own key

## Next

Try the tools from Claude Code as an MCP server. Then step 3: connect a host (see [open-questions.md](open-questions.md)).

**Changelog** (rationale in DECISIONS.md; file history in git)
- v1.1 (2026-10-14) — `render` removed from every result; data only. → DECISIONS.md 2026-10-14
- v1.0 (2026-10-13) — All nine tools built, deployed and tested. Guideline limit on `get` corrected to the first 8,000 characters. → DECISIONS.md 2026-10-13
- v0.2 (2026-10-13) — Revised after the agent design guide check: paging on `list`, limits, failure tables, display titles, descriptions; suggestions listed. → DECISIONS.md 2026-10-13
- v0.1 (2026-10-13) — Plan drafted; update and delete left out of this deployment. → DECISIONS.md 2026-10-13
