# Engagement data tool — specification

Contract version 2.0 · applies to `data/_schema.json` 2.0

## 1. Purpose

Agents change the demo only through this tool. The HTML views are fixed templates that read the data and never change. The tool's job is to guarantee that **every committed state of the data renders correctly in every view**. It does that by rejecting any write that would break a view's render contract, and by telling the agent exactly why, so it can correct and retry.

Principles:

1. **The tool is the only writer.** Views and humans read; agents write through `write`.
2. **All or nothing.** A write is a batch of operations, validated against the whole resulting dataset and committed atomically, or not at all.
3. **Errors block, warnings inform.** Anything that would break rendering is an error. Anything that is only inconsistent (e.g. the bridge no longer matches the model) is a warning returned with a committed write.
4. **The contract is data.** All limits live in `data/_schema.json`. The tool reads them; nothing is hard-coded in the tool except the named invariants (I01–I26, W01–W04), whose definitions are in the data model.

## 2. Store layout

```
data/
  _schema.json        tables, fields, render contracts, views, placeholders, agent scopes
  _version.json       { "global": 6, "tables": { "tasks": 2, ... } }
  _log.json           append-only change log (last 200 entries)
  <table>.json        one array of records per table (27 tables)
  seed/               frozen copy of all of the above, for reset
```

Every record carries `_meta`:

```json
{ "version": 2, "updated_at": "2026-10-21T09:12:00Z", "updated_by": "project_manager", "reason": "CRM extract not received from IT; task now 5 days overdue" }
```

`version` is the global version at which the record last changed. Views use it to highlight what changed.

## 3. Deployment

One process provides both:

- **MCP server** exposing the five tools below.
- **HTTP server** serving the repository root read-only: `index.html`, `views/`, `assets/`, `deck/`, `data/`. Responses for `data/*` carry `Cache-Control: no-store`.

Writes are serialised through a single queue; there is never more than one write in flight. Files are written to a temporary name and renamed, so a reader never sees a half-written table.

## 4. Tools

All inputs and outputs are JSON. `agent` is one of the ten agent keys in `_schema.json` → `agents`.

### 4.1 `contract`

Orientation for an agent: what exists, what each view shows and what this agent may change.

**Input**

```json
{ "agent": "value_estimator" }
```

**Output**

```json
{
  "contract_version": "2.0",
  "as_of": "2026-10-21",
  "version": { "global": 6 },
  "tables": { "...": "full table definitions from _schema.json" },
  "writes": { "value_steps": { "create": true, "delete": true, "update": ["order", "label", "kind", "value", "hypothesis_id", "model_cell_id"] } },
  "views": { "value_estimator": { "reads": ["..."], "placeholders": { "bridge.target": { "format": "money_m", "width": 8 } } } },
  "invariants": [ { "id": "I17", "severity": "error", "rule": "Bridge shape: ..." } ]
}
```

### 4.2 `query`

Read records from one table.

**Input**

| Field | Type | Req. | Meaning |
|---|---|---|---|
| `table` | string | yes | Table name |
| `where` | object | no | Field equality; an array value means "in" |
| `fields` | string[] | no | Projection; `id` is always returned |
| `expand` | string[] | no | Reference fields to resolve one level; the referenced record is returned under `_expanded.<field>` |
| `limit` | integer | no | Default 500 |

```json
{ "table": "tasks", "where": { "status": ["late", "at_risk"] }, "fields": ["name", "end", "owner_id"], "expand": ["owner_id"] }
```

**Output**

```json
{
  "table": "tasks",
  "version": 6,
  "records": [
    { "id": "tk-08", "name": "CRM data extraction, all markets", "end": "2026-10-16", "owner_id": "pe-05",
      "_expanded": { "owner_id": { "id": "pe-05", "name": "Mei Tanaka", "title": "Data scientist" } } }
  ]
}
```

### 4.3 `write`

Apply one batch of operations.

**Input**

| Field | Type | Req. | Meaning |
|---|---|---|---|
| `agent` | string | yes | Writing agent |
| `reason` | string | yes | One line, shown to viewers next to the change |
| `ops` | array | yes | Operations, applied in order |
| `dry_run` | boolean | no | Validate and report without committing |
| `if_version` | integer | no | Reject if the global version has moved |

Operations:

```json
{ "op": "update", "table": "tasks", "id": "tk-10", "set": { "end": "2026-10-29", "status": "at_risk" } }
{ "op": "create", "table": "actions", "record": { "source": "project_manager", "title": "...", "...": "..." } }
{ "op": "delete", "table": "actions", "id": "ac-02" }
```

- `update` sets only the listed fields. An empty string or `null` clears an optional field.
- `create` must not include `id` or `_meta`; the tool assigns the next id with the table prefix.
- To insert into an ordered list, give a fractional position (e.g. `"order": 7.5`). The tool renumbers the group 1..n afterwards.
- A `create` may carry `"tmp": "<name>"`. Later operations in the same batch can then use the string `"$<name>"` wherever an id is expected (in `id`, `set`, `record` or a reference list), for example a new deliverable and its RACI rows in one batch. The result's `written` lists the assigned ids.

**Processing order**

1. **Authorise** each op against the agent's scope:
   - the table is writable
   - the operation is allowed
   - every field in `set` is updatable
   - the record matches the row filter before and after the change
2. **Refuse fixed records.** Singletons and fixed tables cannot be created or deleted.
3. **Refuse referenced deletes.** A delete is refused while another record references the target; the error lists the referencing records.
4. **Sanitise text.** Normalise line endings, strip markup tags, remove control characters.
5. **Apply** the ops to a copy of the dataset.
6. **Renumber** ordered fields per group, preserving relative order.
7. **Stamp** `_meta` on every touched record with the new global version.
8. **Validate** the whole copy (all field rules and invariants).
9. **Commit or reject.**
   - On zero errors, and if not `dry_run`: write the touched tables, bump `_version.json`, append to `_log.json`.
   - Otherwise return the errors and change nothing.

**Output: committed**

```json
{
  "committed": true,
  "written": ["tk-10"],
  "version": { "global": 7, "tables": { "tasks": 7 } },
  "warnings": [ { "rule": "W04", "table": "tasks", "id": "tk-14", "message": "starts 2026-10-26 before dependency tk-10 ends 2026-10-29" } ],
  "affected_views": ["project_manager", "team_manager"]
}
```

**Output: rejected**

```json
{
  "committed": false,
  "errors": [
    { "rule": "field", "table": "narratives", "id": "nv-02", "message": "text is 122 characters", "allowed": "<= 110" },
    { "rule": "I22", "table": "narratives", "id": "nv-02", "message": "text uses undeclared placeholder {bridge.total}", "allowed": ["bridge.start", "bridge.momentum", "bridge.target", "bridge.net_impact", "sensitivity.base", "sensitivity.top_driver", "sensitivity.top_downside"] }
  ],
  "warnings": []
}
```

Errors from authorisation carry `op` (1-based index) and a `rule` of `scope`, `fixed`, `referenced`, `not_found`, `field`, `table` or `op`. Errors from validation carry the invariant id (`I01`…`I26`) or `field`.

### 4.4 `log`

**Input:** `{ "since_version": 4 }` or `{ "limit": 5 }`.

**Output:** an array of log entries, newest last:

```json
{ "version": 2, "at": "2026-10-21T09:12:00Z", "agent": "project_manager", "reason": "CRM extract not received from IT; task now 5 days overdue",
  "changes": [ { "op": "update", "table": "tasks", "id": "tk-08", "before": { "status": "in_progress", "progress_pct": 60 }, "after": { "status": "late", "progress_pct": 70 } } ] }
```

### 4.5 `reset`

Restore `data/` from `data/seed/`.

**Input:** `{ "confirm": true }`

**Output:** `{ "version": { "global": 6 } }`

Run it before every demo.

## 5. Render-contract rules the tool enforces

Field rules come from `_schema.json` (type, required, enum, bounds, decimals, length, lines, pattern, references). The named invariants are defined in `spec/01-data-model.md`. Four mechanisms deserve emphasis because they are what keep the templates intact.

1. **Hard text limits.** Every text field has a maximum length sized to its slot in the template. Narrative slots override the field limit per slot. Multi-line labels (bridge steps) are limited in lines and in characters per line.
2. **Cardinality.** Every table has min/max records, and grouped slots have their own bounds. Examples:
   - the bridge has 3–12 steps
   - the tornado has 3–10 drivers
   - so-what has 1–5 points, at most one highlighted

   The layouts are designed for the maximum.
3. **Fixed records.** Singletons, the seven proposal sections and the fixed narrative slots can be edited but never created or deleted.
4. **Placeholders.** Text fields marked with `placeholders` may contain `{name}` tokens from the owning view's declared list. The view fills them from derived values at render time, so text cannot go stale. For length checks, each token counts as its declared width. Undeclared tokens and stray braces are errors.

Layout parameters are never stored: chart scales, axis ranges, ticks, sort orders and column counts are derived in the templates. That makes no data value capable of overflowing a chart.

## 6. View refresh protocol

The views implement this; the tool only has to serve the files.

1. **Load.** On load, a view fetches `_schema.json`, checks `contract_version`, then fetches the tables listed in its `reads`.
2. **Poll.** Every 2 seconds it fetches `_version.json` with `no-store`. If any table it reads has a newer version, it refetches those tables and re-renders.
3. **Highlight.** Records whose `_meta.version` is newer than the version last rendered are highlighted for 4 seconds. They keep a hover note with `updated_by` and `reason`.

## 7. Reference implementation

`validator/validate.js` implements the contract exactly. The tool server should wrap it rather than reimplement it.

| Tool verb | Function |
|---|---|
| `write` | `applyWrite(schema, data, request, { version, now })` returns the result plus the new dataset and log entry. Persist with `saveDataset(dir, data, version, logEntry, tables)`. |
| validation | `validateDataset(schema, data)` returns `{ errors, warnings }` |
| `reset` | CLI: `node validator/validate.js --reset` |
| manual write | CLI: `node validator/validate.js --apply request.json` |
| check current data | CLI: `node validator/validate.js` |

## 8. Out of scope for the demo

- Authentication and per-user permissions. The agent key is trusted.
- Multiple engagements.
- A formula engine. The model builder agent writes computed values together with the formula text.
- Undo beyond `reset`. The log keeps before/after values, so a later version can add it.
