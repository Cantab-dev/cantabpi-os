# Cantab Pi agentic consulting environment: mock-up package

Brief for the builder agent · contract version 2.0 · 22 October 2026

## What this is

A working mock-up of an environment in which ten AI agents support a consulting engagement. The demo client is Big Pharma AG; the engagement is "Agentic AI for field sales: pilot to scale". Each agent has one view, which is a fixed HTML template. All views read one shared dataset. Agents change the demo only by writing data through one tool; the tool refuses any write that would break a view.

Everything here is consistent and checked:

- the schema is the single source of truth
- the data model document is generated from it
- the dataset passes the reference validator with zero errors
- every field a view spec lists exists in the schema
- every demo write in the specs, and the full demo script, runs as documented

## Your job

1. **Build the engagement data tool** described in `spec/02-data-tool.md`.
   - One process that exposes five MCP verbs (`contract`, `query`, `write`, `log`, `reset`) and serves the repository read-only over HTTP, with `Cache-Control: no-store` on `data/`.
   - Wrap `validator/validate.js` rather than reimplementing the rules: `applyWrite` is the `write` verb, `saveDataset` persists a commit.
   - Serialise writes and write files atomically.
2. **Serve `index.html`, `views/`, `assets/` and `deck/` unchanged.** The templates are finished; do not edit them to fit data. If something does not render, the data or the tool is wrong.
3. **Connect the ten agents** with the write scopes in `data/_schema.json` → `agents`. Each agent calls `contract` first, `query` to read, and `write` with a one-line reason.
4. **Run the demo script** (`spec/03-demo-script.md`) end to end against the tool.

## Definition of done

- `node validator/validate.js` reports 0 errors on the seed.
- `node tools/check-specs.js` reports 0 problems.
- `node tools/run-demo.js --dry` shows steps 1–9 committed and step 10 rejected.
- Through the tool, each demo step redraws the open view within 2 seconds, and the changed records flash or pulse.
- `reset` restores the seed exactly.

## Package map

| Path | What it is |
|---|---|
| `spec/00-overview.md` | Architecture, scenario, shell and runtime, template rules, visual identity |
| `spec/01-data-model.md` | Tables, fields, invariants, views, placeholders, agent scopes (generated from the schema) |
| `spec/02-data-tool.md` | The tool: verbs, write semantics, errors, refresh protocol |
| `spec/03-demo-script.md` | The live demo, step by step |
| `spec/views/*.md` | One specification per view (11, including home) |
| `data/_schema.json` | Schema and render contracts (contract 2.0) |
| `data/*.json`, `data/seed/` | The Big Pharma AG dataset (27 tables) and its frozen copy for reset |
| `validator/validate.js` | Reference implementation of validation and `write` |
| `demo/*.json` | The demo's write requests, in order |
| `tools/build-seed.js` | Regenerates the seed (model values are computed, not typed) |
| `tools/gen-data-model.js` | Regenerates `spec/01-data-model.md` from the schema |
| `tools/check-specs.js` | Cross-checks specs against schema, view files and the tool |
| `tools/run-demo.js` | Runs the demo script through the reference write logic |
| `assets/theme.css`, `assets/runtime.js` | Shared Cantab Pi theme and runtime used by every page |
| `index.html`, `views/*.html` | Engagement home and the ten agent views |
| `deck/scale-up-proposal.pdf` | The board proposal deck shown by the presentation builder |

## Views

| View | Main visual | Second visual | Agent writes |
|---|---|---|---|
| Engagement home | Time plan by phase | RACI by phase with one-line roles | (engagement starter) |
| Engagement starter | RACI by deliverable | Phase plan as block arrows with milestones | people, milestones, deliverables, RACI |
| Analyst | Evidence board: hypothesis, evidence, sources with quotes | Source list | sources, findings, hypothesis status |
| Value estimator | EBIT bridge | NPV tornado and so what | bridge, sensitivity, value narratives |
| Presentation builder | Deck viewer (PDF) | Slide list and storyline | deck, slides |
| Project manager | Gantt against today | Recommended actions | tasks, milestones, deliverables, its actions |
| Team manager | Capacity heatmap | Delivery scorecard and team actions | planned days, its actions |
| Story builder | Issue tree with evidence on hover | (none) | issue tree, storyline, slide mapping |
| Agent builder | Agent setup: goal, prompt, tools, state, skills, trigger, guardrails | (none) | agents, agent lines, skills |
| Proposal builder | Letter of proposal | Commercials | proposal, sections, staffing |
| Model builder | Business-case workbook | Model-to-bridge link check | model cells |

## Principles you must keep

- **Templates are fixed; data changes.** All business content comes from data. Layout parameters (scales, axes, sort orders) are derived, never stored.
- **The tool is the only writer.** Each write is validated against the whole resulting dataset and committed atomically or not at all. Errors block; warnings inform.
- **Placeholders keep text true.** Narrative text quotes figures as `{placeholders}` filled at render time, so numbers in text cannot go stale.
- **Deterministic demo.** All dates and status are judged against `engagement.as_of` (21 Oct 2026), never the system clock.
- **Agents act within scope.** Field-level write scopes and row filters per agent are enforced by the tool.

## Known limits and open items

- **No formula engine.** The model builder agent writes computed values together with formula text; the tool warns (W01, W02) when the bridge and the model disagree.
- **External CDN loads.** Fonts come from Google Fonts. The PDF viewer loads pdf.js 3.11.174 from cdnjs in main-thread mode. Both fall back gracefully: system fonts, and slide titles from data if the PDF cannot load.
- **Deck source.** The deck was generated with Oria (Corporate Red style). An editable PPTX can be exported from Oria once the PDF is approved; it is not in this package.
- **Out of scope.** Authentication, multiple engagements, and undo beyond `reset`. The log keeps before and after values, so undo can be added later.
