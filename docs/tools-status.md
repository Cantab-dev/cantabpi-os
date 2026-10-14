# Cantab OS — Tools: plan and status

| Status | Version | Owner | Last updated |
| --- | --- | --- | --- |
| Current | v1.4 | Nela | 2026-10-14 |

This document is both the plan and the record of what exists. Each item has a status; update the status in the same change that builds the item.

Status values: `planned` (agreed, not built) · `built` (deployed and tested) · `changed` (built, then altered; note what changed) · `open` (needs a decision).

All eleven tools are deployed and tested against dummy data: nine on 2026-10-13, `edit` and `delete` on 2026-10-14 (function v0.3.0). The plan was checked against the project kit's agent design guide (Part 1 and the tool-description format); items marked ▲ were added to close gaps that check found and are not in the original spec.

## Scope

Step 2 of the deployment plan: the tools, as one MCP edge function, tested directly (curl and Claude Code). Connecting a host, sign-in, per-user access rules and real in-host views belong to step 3.

Data structure the tools work on: [data-structure-status.md](data-structure-status.md).

## The server — `built`

- One Supabase edge function named `mcp`, at `https://etofljbxzllkucmearwl.supabase.co/functions/v1/mcp`.
- Speaks MCP over Streamable HTTP, stateless, built with the official MCP TypeScript SDK as in Supabase's guide.
- Acts as the signed-in user: `withSupabase` checks the access token and gives the tools a client for that user, so RLS decides what they see (see [sign-in-status.md](sign-in-status.md)).
- One shared database helper for all tools ▲.

## Access — `changed` (sign-in replaces the development key, 2026-10-14)

- Callers sign in through Supabase Auth's OAuth server; a request without a valid user token gets 401
  with a pointer to the OAuth metadata.
- The development key, the service-role client and the acting user were removed in function v0.4.0.
  Detail: [sign-in-status.md](sign-in-status.md).

## Rules for every tool — `built`

- **Labels only.** No argument takes a database id and no result contains one. `id`, `profile_id`, `created_at` and `updated_at` are never returned.
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

Removed on 2026-10-14: results carry the data only, as the spec defines it; no `render` part and no side-window line. In-host layout comes back in a later phase. Deployed as function v0.2.0 and checked live the same day: no result contains `render` or a side-window line; all live checks pass. → DECISIONS.md 2026-10-14

## Edit, delete and the acting user — `built`

Requested by Siniša, approved by Nela on 2026-10-14; deployed as function v0.3.0 and checked live the same day. → DECISIONS.md 2026-10-14

### edit — `built`
- **Arguments:** `label` (required), plus any field of that entity. Each field given overwrites the whole stored value. The fields are those of the matching `write_*` tool, with the same checks.
- **Never editable:** `id`, `label`, `context` (changed only through `note`), `profile_id`, `created_at`, `updated_at`, `label_no`. `updated_at` is set automatically.
- **Clearing a field:** an empty string clears an optional field. A required field (`name`; `description` for skills) cannot be emptied.
- **Result:** the full record after the edit, as `get` returns it. It is annotated idempotent.

| Failure | Message tells the model to |
|---|---|
| Bad or unknown label | call `list` to find the label |
| A field that isn't on this entity, or a never-editable one | use only the fields listed in the message for this entity |
| No fields given | call again with at least one field to change |
| A field fails its check | the same message as `write_*` |

### delete — `built`
- **Arguments:** `label`. Deletes the whole row. The label is never reused.
- **Annotated destructive**, so the host asks the user to confirm. There is no undo.
- **Result:** the deleted label and its name (`description` for skills).
- **Failures:** a bad label, or a label that doesn't exist. Each says to call `list`.

### Tools act for one user — `changed` (v0.4.0: RLS does this now)
- In v0.3.0 the tools filtered on the acting user themselves. Since v0.4.0 they act as the signed-in user and RLS limits every call to that user's rows; new rows get the user through the column default.
- **Why:** once the dummy data is copied for Nela, Claude Code would otherwise see both sets. This also behaves the way RLS will at step 3, so swapping in sign-in changes where the user comes from, not what the tools see.
- `append_context` gets an owner argument so `note` follows the same rule.

### Testing — `built`
Unit tests for the edit checks (4). Smoke checks, all passing: edit (each failure, a good edit, clearing a field), delete (good, missing, bad label), and a check that Nela's rows are invisible to the acting user.

## Not in this deployment

1. **Upsert through `write_*`** — `write_*` only creates; changes go through `edit`. Keeping them apart means a wrong or missing label can never change or duplicate the wrong record (2026-10-14).
2. **One generic `write` tool** — not for now: six `write_*` tools, as in the spec. May change later.

## Suggestions to consider later

From the agent design guide check. None is built. Former items "update through `write_*`" and "duplicate creates" were closed by `edit` and `delete` on 2026-10-14.

2. **Soft delete** (archive) by label.
3. **One generic `write`** keyed by label, so a new entity is a new type and not a new tool.
5. **`storage_url` on `write_slide`.** The model has no way to produce this value; no tool uploads the PDF.
6. **Entity spelling.** `list` takes `todos`; labels say `todo:`. One spelling would be safer.
7. **Label cannot change.** The label is filled once when a row is created. A database rule that refuses changes to it would guarantee it never drifts.
8. **`render` in every result.** The instruction is the same for every call of a tool; the guide would state it once in the tool description.
9. **Filters on `list`** (for example open todos only), once the lists grow.

## Testing

| Test | Status |
|---|---|
| Unit tests for input checks and failure messages ▲ — `supabase/functions/mcp/lib_test.ts`, run with `deno test` | `built` — 22 pass |
| Live checks for each tool, the error cases, a second page of `list`, edit and delete, and the acting-user filter — `bash scripts/smoke.sh` | `built` — all pass (v0.3.0, 2026-10-14) |
| The server added to Claude Code as an MCP server, to check the tools read naturally to a model | `built` — connected 2026-10-14; "what's on my todo list?" called `list`. Guide for other testers: [testing-guide.md](testing-guide.md) |

Rows created during testing were removed; the label numbers they used are not reused, so new labels continue after a gap.
- Findings go in [test_tracker.md](test_tracker.md).

## Where it lives

- `supabase/functions/mcp/` — `index.ts` (server and key check), `tools.ts` (the eleven tools), `lib.ts` (checks, limits, messages, result exit), `lib_test.ts`
- `scripts/smoke.sh` — live checks
- `supabase/config.toml` — `[functions.mcp] verify_jwt = false`, because the function checks its own key

## Next

Others can test from Claude Code with [testing-guide.md](testing-guide.md). Next: connect claude.ai over Supabase OAuth with the Lovable consent app (see [COMMS.md](COMMS.md) and [open-questions.md](open-questions.md)).

**Changelog** (rationale in DECISIONS.md; file history in git)
- v1.4 (2026-10-14) — Sign-in replaces the development key; tools act as the signed-in user under RLS. Function v0.4.0. → DECISIONS.md 2026-10-14
- v1.3 (2026-10-14) — `edit` and `delete` built; tools act for the acting user only; upsert dropped. Function v0.3.0. → DECISIONS.md 2026-10-14
- v1.2 (2026-10-14) — Claude Code connected and calling the tools; testing guide added for other testers.
- v1.1 (2026-10-14) — `render` removed from every result; data only. → DECISIONS.md 2026-10-14
- v1.0 (2026-10-13) — All nine tools built, deployed and tested. Guideline limit on `get` corrected to the first 8,000 characters. → DECISIONS.md 2026-10-13
- v0.2 (2026-10-13) — Revised after the agent design guide check: paging on `list`, limits, failure tables, display titles, descriptions; suggestions listed. → DECISIONS.md 2026-10-13
- v0.1 (2026-10-13) — Plan drafted; update and delete left out of this deployment. → DECISIONS.md 2026-10-13
