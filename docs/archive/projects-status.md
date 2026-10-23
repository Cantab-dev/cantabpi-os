# Cantab OS — Projects (v2, phase 1): plan and status

| Status | Version | Owner | Last updated |
| --- | --- | --- | --- |
| Executed — built and live 2026-10-22; archived 2026-10-23 (open choices in open-questions.md) | v0.3 | Nela | 2026-10-23 |

Plan and record for the first phase of Cantab OS v2 ([cantapi_os_2_0.md](../cantapi_os_2_0.md), Siniša, work in
progress): the **Projects** part, backend only. Phase 2 is the views (Siniša is preparing them as a package),
phase 3 how they show in claude.ai. Approved by Nela on 2026-10-22 ("build and deploy"); model changed the same
day after Siniša's answers (§1). Read whole.

Status values: `planned` (agreed, not built) · `built` (deployed and tested) · `changed` (built, then
altered; note what changed) · `open` (needs a decision).

## Goal and scope

**Goal:** every user has projects and works in **one selected project** at a time, held in the backend. Every
todo, sheet, doc and slide belongs to one project, and every tool and signed-in read sees only the selected
project's, without a project argument (v2 doc: "Project_id is NOT argument for tools; it is implicit").

**In scope:** the `projects` table, the selection, `project_id` on four tables, the access rules (RLS), tool
changes, dummy data, tests.

**Out of scope:** the views and slots (phase 2); display in claude.ai, the projects picker and scope badge (phase
3, §5); projects shared by a team; moving an item to another project; real data.

## 1. Decisions (all may change)

| # | Decision | By | Status |
|---|---|---|---|
| D1 | Projects scope **todos, sheets, docs, slides**. Leads and skills are shared by all projects | Nela; Siniša agreed | `built` |
| D2 | A project belongs to **one user** | Nela | `built` |
| D3 | **Exactly one selected project per user**, on `profiles.selected_project_id`; selecting switches it. The filter lives in RLS | Siniša (replaces "one, several or none", and the flag on the project row) | `built` |
| D4 | **No project selected: tools fail** with "select a project first", and nothing is shown. Project calls still work (list, select, create, and get, edit, note, delete on a project label), or a user could never start (Aleph lesson 5) | Siniša (replaces "none means all"); the exceptions by Claude | `built` |
| D5 | **Every item belongs to a project**: `project_id` is required and defaults to the selected one | Siniša (replaces "no project when unclear") | `built` |
| D6 | The model can create projects (`write_project`) | Nela | `built` |
| D7 | Only an **empty** project can be deleted, since items cannot be without one | Claude, to confirm | `built` |
| D8 | Rows from before projects (Nela's test rows, Siniša's POC rows, two real Google files) go to a per-user **`Unsorted (from v1)`** project | Claude, to confirm | `built` |
| D9 | Each user starts with **Atlas selected** | Claude, to confirm | `built` |
| D10 | "mcp widgets as for aleph": MCP Apps views, as ours. Phase 3 (§5) | Siniša | `planned` |

## 2. Database — `built`

Two migrations, both applied by Nela on 2026-10-22: `20261022120000_projects.sql` (the first model: several
selected, rows without a project) and `20261022130000_single_project.sql` (Siniša's model, which replaced it the
same day). Tested together first in an in-memory Postgres with the earlier migrations.

### 2.1 Table `projects`
| Column | Type | Rules |
|---|---|---|
| id | uuid | primary key, generated |
| label | text | unique, generated (`project:1`), as the other labels; `label_no` as elsewhere |
| name | text | required |
| icon | text | an emoji |
| context | text | so `note` works on a project |
| profile_id | uuid | owner, default the signed-in user, cascade on user delete (D2) |
| created_at, updated_at | timestamptz | set automatically |

RLS: a user reads and changes only their own projects.

### 2.2 Selection and `project_id`
- `profiles.selected_project_id` → `projects.id`, on delete set null (deleting the selected project leaves none
  selected). The profile update rule only accepts one of the user's own projects.
- `project_id` on todos, sheets, docs, slides: required, references `projects.id` **on delete restrict** (D7),
  indexed, default `current_project_id()`.

### 2.3 Functions
- `current_project_id()`: the selected project's id or null. Column default and RLS filter.
- `current_project()`: label, name and icon of the selected project; no row when none.
- `owns_project(id)`: true for the user's own projects.
- `select_project(label)`: selects one project; an unknown label fails and changes nothing.
- `project_summary()`: per project, `selected` and the item counts of the four kinds, whatever is selected.

### 2.4 Access rules (RLS) on the four tables
- **Read, change, delete:** own row, in the selected project. Nothing selected: nothing.
- **Insert and the new state on update:** own row, in one of the user's own projects.

Leads, skills, categories, `ui_views` and `demo_sales` keep their rules. Realtime applies RLS when it delivers a
change, so a subscription follows the selection.

### 2.5 Data
Per user: `Dummy - Project Atlas` 🧭 and `Dummy - Project Birch` 🌲; the `Dummy - ` rows split between them, the
newest of each kind to Birch. Other rows in `Unsorted (from v1)` 📥 (D8). Atlas selected (D9). Labels:
claude@test.com project:1–2, Nela 3–4, Siniša 5–6, then the Unsorted projects.

## 3. Tools — `built` (function v0.7.0)

| Tool | Change |
|---|---|
| All | Each reply starts with `Project: <name> (<label>).` and carries `project` in the data. Without a selection, every call except the project calls below fails with "No project selected. Select a project first…" (D4) |
| `list` | New entity `projects` (works without a selection). Todos, sheets, docs and slides rows carry their `project` |
| `select_project` | **New.** `label`: one project label. Replies with every project, `selected` and its item counts |
| `write_project` | **New.** `name`, optional `icon`. Does not select the new project |
| `get`, `edit`, `note`, `delete` | Accept `project:` labels, also without a selection. A label in another project answers "not found", with a hint to switch. `delete` refuses a project that holds items, naming the counts |
| `write_todo`, `write_sheet`, `write_doc`, `write_slide` | No new argument; the new row goes into the selected project |

`view` (live views POC) is unchanged; without a selection it finds no slides. Phase 2 reworks it. The in-chat
views draw projects with the plain list. The tool list changed: claude.ai needs a Disconnect and Connect.

## 4. Build order and testing

0. **Close v1** — `built`. `view_json_id` applied; staged work committed (22256a7).
1. **Migrations** — `built`. Applied by Nela.
2. **SQL checks** (in-memory Postgres, all migrations) — `built`: Atlas selected at the start; each project
   shows only its rows; insert goes to the selected project; other users' projects refused for select, insert
   and profile update; unknown label changes nothing; a project with items cannot be deleted, an empty one can;
   no selection shows nothing and refuses inserts; anon sees nothing.
3. **Tools** with unit tests — `built`. 39 tests pass.
4. **`smoke.sh`** projects section — `built`.
5. **Deploy and live check** — `built`: smoke live and claude.ai checked (2026-10-22). See §6.
6. **Docs** — data-structure-status, tools-status, DECISIONS, HANDOFF, Document Log.

## 5. Compared with Aleph (answers received 2026-10-22, patterns only)

Aleph is a reference project with projects and MCP widgets. After Siniša's answers our model is close to it:
one active project, no selection blocks the tools, with project calls exempt.

| Topic | Aleph | Ours | Why ours |
|---|---|---|---|
| Where the selection lives | Per connection (user × OAuth client) | Per user, on the profile | The v2 doc says per user, and the phase 2 live page is not an MCP client |
| Where the filter runs | Tool code under the service role, plus RLS for browser paths | RLS only; tools act as the signed-in user | We never use the service role |
| Sharing | `project_members` with roles | One owner (D2) | Aleph's table is the model when sharing comes |
| Select tool | Generic `select { label }` | `select_project { label }` | We have no generic select |

**Lessons taken:** project calls work without a selection (lesson 5); business errors come back as content with
`isError` (lesson 6, already so); `structuredContent` carries the whole payload (lesson 4, already so).

**For phase 3 (claude.ai display):** a projects picker on `list projects` (click a card → `select_project`
through the host, then `ui/update-model-context`); `list` types without a view draw nothing at zero height
(`prefersBorder: false`); a scope badge; result size caps per host with paging; content hash in the `ui://`
address (we do this already).

## 6. Progress

- 2026-10-22: plan v0.1–v0.2; Nela's go. First migration written, tested and applied; Siniša's answers changed
  the model; second migration written, tested together with the first; tools reworked to one project. Second
  migration applied by Nela; function v0.7.0 deployed; `smoke.sh` run live as `claude@test.com`: all checks as
  expected, 14 tools listed, no crashes; Test rows removed. claude.ai, as Nela after a reconnect: "switch to
  Birch" selected `project:4` and replied with the right counts (1 todo, 1 sheet, 1 doc, 1 slide deck). Also
  passed: list projects (three, selected one named), todos in Birch only, a new todo landing in Birch, `todo:39`
  (Atlas) not found in Birch with an offer to switch, and found after switching back. Test todo removed.
  **Phase 1 done.**
  Note: Siniša's Atlas and Birch are empty (his rows have no `Dummy - ` prefix), so his data is in `project:8`
  (Unsorted).

## Open

1. D7, D8, D9 (Claude's choices) — Nela and Siniša to confirm.
2. Moving an item to another project: not possible yet (no tool, and RLS hides other projects). Needed?
