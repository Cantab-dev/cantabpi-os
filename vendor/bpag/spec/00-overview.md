# Cantab Pi agentic consulting environment — overview

Version 2.0 · 22 October 2026 · demo engagement: Big Pharma AG, "Agentic AI for field sales: pilot to scale"

## 1. What this is

A mock-up of an environment where ten AI agents support a consulting engagement. Each agent has one view: a fixed HTML template showing one or two visualisations. All views read from a single shared dataset. During a demo, agents change the data through one tool; the views pick up the change within two seconds and highlight it. Nobody edits the templates.

This package is the reference for the agent that builds the full solution. Everything in it is consistent:

- the schema is the single source of truth
- the data model document is generated from the schema
- the dataset passes the reference validator with zero errors
- every view reads only fields that exist in the schema

## 2. Architecture

```
            agents (10)                         viewers (browser)
                │  contract / query / write / log / reset      ▲  GET index.html, views/*.html,
                ▼                                              │      assets/*, data/*  (poll _version.json)
     ┌──────────────────────── engagement data tool ───────────────────────┐
     │  MCP server (5 verbs)          │  HTTP static server (read-only)    │
     │  validator/validate.js: render-contract enforcement, atomic commit  │
     └───────────────────────────── data/ ───────────────────────────────┘
        _schema.json · _version.json · _log.json · 27 tables · seed/
```

| Layer | Fixed or data | Changed by |
|---|---|---|
| `data/_schema.json` (tables, render contracts, views, placeholders, scopes) | fixed for a contract version | developers only |
| `data/*.json` tables | data | agents, through the tool |
| `assets/runtime.js`, `assets/theme.css` | fixed | developers only |
| `index.html`, `views/*.html` | fixed | developers only |

## 3. Package layout

```
README.md                   brief for the builder agent
spec/
  00-overview.md            this document
  01-data-model.md          generated from the schema: tables, fields, invariants, views, placeholders, scopes
  02-data-tool.md           the tool: verbs, write semantics, error shapes, refresh protocol
  03-demo-script.md         the live demo, step by step
  views/<view>.md           one specification per view, including home
data/
  _schema.json  _version.json  _log.json  <27 tables>.json  seed/
validator/validate.js       reference implementation of validation and write
demo/*.json                 the demo's write requests, in order
tools/build-seed.js         regenerates the seed dataset (model values are computed, not typed)
tools/gen-data-model.js     regenerates spec/01-data-model.md from the schema
tools/check-specs.js        cross-checks view specs against schema, view files and the tool (dry-runs every demo write)
tools/run-demo.js           runs the demo script through the reference write logic
assets/theme.css            Cantab Pi theme (red and white; light and dark)
assets/runtime.js           shared runtime used by every page
index.html                  engagement home (shell landing page)
views/<view>.html           the ten agent views
deck/scale-up-proposal.pdf  6-slide board proposal deck (generated with Oria), shown by the presentation builder
```

## 4. Demo scenario

**Client and engagement.** Big Pharma AG. Engagement "Agentic AI for field sales: pilot to scale", 3 Aug to 4 Dec 2026, 18 weeks.

**Phases.**

| Phase | Weeks | Dates | State at as-of |
|---|---|---|---|
| Pilot | 1–8 | 3 Aug – 25 Sep | done |
| Scale-up design | 9–14 | 28 Sep – 6 Nov | current |
| Rollout plan | 15–18 | 9 Nov – 4 Dec | planned |

**As-of date.** 21 Oct 2026, week 12. Every status and calendar calculation uses `engagement.as_of`, never the system clock, so the demo is deterministic.

**People.**
- Consulting team of 6: partner, engagement manager, two consultants, data scientist, AI engineer.
- Client stakeholders: 5.

**Live issues built into the data.**

- CRM data extraction (tk-08) is late. It blocks the sensitivity analysis and puts the 30 Oct SteerCo milestone at risk.
- The data scientist is planned at 130% of capacity in weeks 12–13, while the AI engineer is at 60%.
- The value model is on its third review cycle.
- Two of nine markets have CRM data gaps, so hypothesis in-08 is refuted.
- The bridge, the model and the sensitivity agree:
  - momentum case €375m
  - net impact +€51m
  - target €426m
  - 5-year NPV €168m
  - adoption is the swing factor

**Seed history.** The seed already contains five agent changes (versions 2–6), so the change markers (red dot and hover note) have content from the first load. The change log itself is kept in `_log.json` for agents and the builder; no view displays it.

## 5. Shell and shared runtime

Every page has the same frame. View pages carry a title only (no subtitle) and no change log:

- **Header**: the Cantab Pi mark plus engagement context (client, engagement, current phase, week, as-of date).
- **Agent rail**: grouped as Engagement / Client-facing / Team. On phones it becomes a horizontal scroller.
- **View content**: everything below the frame.

`assets/runtime.js` provides `CP.boot({ view, base, render })`. On boot and on every data change it:

1. Loads `_schema.json` and checks `contract_version`. On a mismatch it shows a notice and still renders.
2. Loads the shell tables (`engagement`, `phases`) plus the view's `reads`, as well as `_version.json`.
3. **Guards records.** A record with a missing required field, a bad enum, a non-numeric number, a bad date or a dangling required reference is skipped, and the view shows "N items hidden". Over-long plain text is truncated with an ellipsis.
4. Renders the shell, then calls the view's `render(ctx)`. A rendering error is caught and shown as a notice, never a blank page.
5. Polls `_version.json` every 2 s. It refetches changed tables and redraws.

`ctx` gives the view:

| Member | Meaning |
|---|---|
| `data[table]` | Guarded records |
| `by[table][id]`, `get(table, id)` | Lookup |
| `en` | The engagement record |
| `cal` | `week(date)`, `weekStart(n)`, `totalWeeks`, `asOfWeek`, `asOf`, `days(a, b)` |
| `fmt` | `money_m`, `money_k`, `money`, `num`, `signed`, `date`, `dateLong`, `label` |
| `fill(text, values)` | Replaces `{placeholders}` from a map of derived values |
| `mark(node, record)` | Adds the change marker (dot plus hover note "Changed by <agent>: <reason>") for records changed by an agent; flashes records changed since the last render |
| `changedNote(record)` | The note text, for SVG elements |
| `name(personId)` | Person name |
| `el`, `svg` | Element helpers that set text only (never HTML from data) |

## 6. Rules for every view template

1. **Read only from `ctx`.** No business content in the markup; only chrome (column headers, legend labels, button labels) may be static.
2. **Derive layout from data.** Scales, axes, ticks, sort order and column counts are computed. Design every layout for the schema maximums: longest allowed text and largest allowed record count.
3. **Insert data as text only.** Use `textContent` or the `el`/`svg` helpers, never `innerHTML` with data.
4. **Use placeholders.** Text fields that may contain `{placeholders}` go through `ctx.fill` with the view's declared values. The value list must match the schema's placeholder list for that view.
5. **Mark agent changes.** Every record drawn passes through `ctx.mark` (or `changedNote` for SVG).
6. **Respond.** Work at 400 px width without horizontal page scroll; wide charts scroll inside their own container.
7. **Theme.** Support light and dark through the theme tokens. Status uses the shared pill classes (`st-<status>`), and colour is never the only carrier of meaning.
8. **Accessibility.** Every chart has a text alternative built from data.

## 7. Specification template for each view

Each `spec/views/<view>.md` has the same sections:

1. Purpose and user
2. Questions the view answers
3. Data read: tables and fields
4. Derived values
5. Layout and visualisations
6. Interactions
7. Render contract: limits and invariants this view relies on, and its placeholders
8. Agent actions for the demo: example `write` requests and the expected on-screen effect
9. Acceptance checks

## 8. Visual identity

- **Palette.** Cantab Pi red (`#C8102E`; `#EF4A5F` in dark mode) on white.
  - Red marks the brand, the current state and increases in value charts.
  - Neutrals are slightly red-biased greys.
  - Status colours are reserved for status: green done, amber at risk, deep red late.
- **Type.** IBM Plex Sans for text and IBM Plex Mono for figures, both with system fallbacks.
- **Charts.** Totals dark grey, increases red, decreases light grey. Every bar carries its value label.

## 9. Build order and definition of done

1. Data tool: MCP verbs wrapping `validator/validate.js`, plus the static server with `no-store` on `data/`.
2. Serve `index.html`, `assets/`, `views/` unchanged.
3. Run each view against the seed and against the demo writes in its spec.

Done means all of the following:

- `node validator/validate.js` reports 0 errors on the seed.
- `node tools/check-specs.js` reports 0 problems.
- Every demo write in the view specs commits.
- Every deliberately invalid write in the specs is rejected with the documented error.
- Every view redraws within 2 s of a commit and highlights the changed records.
- `reset` restores the seed.
