# Data model

Generated from `data/_schema.json` (contract version 2.0). Do not edit by hand: change the schema and run `node tools/gen-data-model.js`.

## Conventions

- **id_pattern**: <prefix>-<2 or 3 digits>, e.g. tk-07; ids are assigned by the tool on create and never change
- **dates**: ISO 8601 calendar dates (YYYY-MM-DD)
- **money**: Amounts in the engagement currency; value tables are in millions (€m) unless the field says otherwise
- **text**: Plain text only. No markup. Line breaks (\n) only where the field allows more than one line
- **meta**: Every record carries _meta {version, updated_at, updated_by, reason}, set by the tool only
- **order**: Order and number fields are renumbered 1..n by the tool after each write, preserving relative order

## Entity map

| Table | Kind | Records | References |
|---|---|---|---|
| `engagement` | singleton | 1–1 | people |
| `people` | list | 3–20 | — |
| `phases` | list | 1–6 | — |
| `milestones` | list | 1–12 | phases |
| `deliverables` | list | 1–16 | phases, milestones, people |
| `tasks` | list | 1–40 | phases, deliverables, people, tasks |
| `raci` | list | 0–200 | deliverables, people |
| `phase_raci` | list | 0–120 | phases, people |
| `time_entries` | list | 0–600 | people |
| `reviews` | list | 0–100 | deliverables, people |
| `actions` | list | 0–12 | people, tasks, milestones |
| `issue_nodes` | list | 3–31 | issue_nodes |
| `sources` | list | 0–30 | — |
| `findings` | list | 0–60 | sources, issue_nodes |
| `value_steps` | list | 3–12 | issue_nodes, model_cells |
| `value_settings` | singleton | 1–1 | model_cells, value_steps |
| `sensitivity_drivers` | list | 3–10 | — |
| `model_cells` | list | 1–80 | — |
| `narratives` | list | 1–40 | — |
| `deck` | singleton | 1–1 | — |
| `slides` | list | 1–30 | issue_nodes |
| `proposal` | singleton | 1–1 | people |
| `proposal_sections` | fixed | 7–7 | — |
| `proposal_staffing` | list | 1–12 | people |
| `skills` | list | 0–30 | — |
| `agents` | list | 0–12 | people, skills |
| `agent_lines` | list | 0–150 | agents |

## Tables

### `engagement`

The engagement itself. Exactly one record. Prefix `en`; singleton (id en-01); 1–1 records.

| Field | Type | Req. | Constraints | Description |
|---|---|---|---|---|
| `id` | id | yes |  |  |
| `client` | string | yes | ≤ 40 chars | Client name |
| `name` | string | yes | ≤ 70 chars | Engagement name |
| `objective` | text | yes | ≤ 280 chars | One- or two-sentence objective |
| `start` | date | yes |  | First day of week 1 (a Monday) |
| `end` | date | yes |  | Last day of the engagement |
| `as_of` | date | yes |  | Demo 'today'. All status, slippage and week calculations use this date |
| `currency` | enum | yes | `EUR` · `USD` · `GBP` · `CHF` |  |
| `partner_id` | ref | yes | → `people` |  |
| `manager_id` | ref | yes | → `people` | Engagement manager |
| `sponsor_id` | ref | yes | → `people` | Client sponsor |

### `people`

Consulting team members and client stakeholders. Prefix `pe`; list; 3–20 records.

| Field | Type | Req. | Constraints | Description |
|---|---|---|---|---|
| `id` | id | yes |  |  |
| `name` | string | yes | ≤ 32 chars |  |
| `org` | enum | yes | `consulting` · `client` |  |
| `title` | string | yes | ≤ 48 chars | Job title or project role |
| `rate_day` | number |  | 0 … 10000; 0 dp | Day rate in engagement currency. Consulting only |
| `capacity_days_week` | number |  | 0 … 5; 1 dp | Days per week available to the engagement. Consulting only |

### `phases`

Engagement phases, contiguous and non-overlapping. Prefix `ph`; list; 1–6 records. Ordered by `order`.

| Field | Type | Req. | Constraints | Description |
|---|---|---|---|---|
| `id` | id | yes |  |  |
| `order` | integer | yes | 1 … 6 |  |
| `name` | string | yes | ≤ 28 chars |  |
| `start` | date | yes |  |  |
| `end` | date | yes |  |  |

### `milestones`

Dated checkpoints such as kick-off, go-live, SteerCo or board decisions. Prefix `ms`; list; 1–12 records.

| Field | Type | Req. | Constraints | Description |
|---|---|---|---|---|
| `id` | id | yes |  |  |
| `phase_id` | ref | yes | → `phases` |  |
| `name` | string | yes | ≤ 44 chars |  |
| `date` | date | yes |  |  |
| `type` | enum | yes | `kickoff` · `go_live` · `readout` · `steerco` · `board` · `signoff` |  |
| `status` | enum | yes | `planned` · `at_risk` · `done` · `missed` |  |

### `deliverables`

Work products the team commits to. Prefix `dl`; list; 1–16 records.

| Field | Type | Req. | Constraints | Description |
|---|---|---|---|---|
| `id` | id | yes |  |  |
| `phase_id` | ref | yes | → `phases` |  |
| `milestone_id` | ref |  | → `milestones` | Milestone the deliverable feeds, if any |
| `name` | string | yes | ≤ 48 chars |  |
| `owner_id` | ref | yes | → `people` | Consulting team member |
| `due` | date | yes |  |  |
| `status` | enum | yes | `not_started` · `in_progress` · `at_risk` · `late` · `done` |  |

### `tasks`

Scheduled work items shown on the Gantt chart. Prefix `tk`; list; 1–40 records.

| Field | Type | Req. | Constraints | Description |
|---|---|---|---|---|
| `id` | id | yes |  |  |
| `phase_id` | ref | yes | → `phases` |  |
| `deliverable_id` | ref |  | → `deliverables` |  |
| `name` | string | yes | ≤ 40 chars |  |
| `owner_id` | ref | yes | → `people` | Consulting team member |
| `start` | date | yes |  |  |
| `end` | date | yes |  |  |
| `status` | enum | yes | `not_started` · `in_progress` · `at_risk` · `late` · `done` |  |
| `progress_pct` | integer | yes | 0 … 100 |  |
| `depends_on` | ref_list |  | → `tasks`, max 4 | Tasks that must finish first |

### `raci`

RACI assignment of one person to one deliverable. Prefix `ra`; list; 0–200 records.

| Field | Type | Req. | Constraints | Description |
|---|---|---|---|---|
| `id` | id | yes |  |  |
| `deliverable_id` | ref | yes | → `deliverables` |  |
| `person_id` | ref | yes | → `people` |  |
| `role` | enum | yes | `R` · `A` · `C` · `I` |  |

### `phase_raci`

Role and one-line responsibility of each person in each phase. Prefix `px`; list; 0–120 records.

| Field | Type | Req. | Constraints | Description |
|---|---|---|---|---|
| `id` | id | yes |  |  |
| `phase_id` | ref | yes | → `phases` |  |
| `person_id` | ref | yes | → `people` |  |
| `role` | enum | yes | `R` · `A` · `C` · `I` |  |
| `comment` | string | yes | ≤ 90 chars | One sentence: what this person does in the phase |

### `time_entries`

Planned and actual days per consulting team member per engagement week. Complete grid: every consulting person has one record per week. Prefix `te`; list; 0–600 records.

| Field | Type | Req. | Constraints | Description |
|---|---|---|---|---|
| `id` | id | yes |  |  |
| `person_id` | ref | yes | → `people` |  |
| `week` | integer | yes | 1 … 52 | Engagement week, 1 = week containing engagement.start |
| `planned_days` | number | yes | 0 … 7; 1 dp |  |
| `actual_days` | number |  | 0 … 7; 1 dp | Required for weeks before the as-of week, empty from the as-of week on |

### `reviews`

Review cycles on deliverables. Prefix `rv`; list; 0–100 records.

| Field | Type | Req. | Constraints | Description |
|---|---|---|---|---|
| `id` | id | yes |  |  |
| `deliverable_id` | ref | yes | → `deliverables` |  |
| `reviewer_id` | ref | yes | → `people` |  |
| `date` | date | yes |  |  |
| `cycle` | integer | yes | 1 … 9 |  |
| `outcome` | enum | yes | `approved` · `changes_requested` |  |

### `actions`

Recommended actions raised by the project manager and team manager agents. Prefix `ac`; list; 0–12 records.

| Field | Type | Req. | Constraints | Description |
|---|---|---|---|---|
| `id` | id | yes |  |  |
| `source` | enum | yes | `project_manager` · `team_manager` | Agent that raised the action |
| `title` | string | yes | ≤ 64 chars |  |
| `rationale` | text | yes | ≤ 200 chars |  |
| `priority` | enum | yes | `high` · `medium` · `low` |  |
| `owner_id` | ref | yes | → `people` |  |
| `due` | date | yes |  |  |
| `status` | enum | yes | `proposed` · `accepted` · `done` · `dismissed` |  |
| `task_id` | ref |  | → `tasks` |  |
| `person_id` | ref |  | → `people` | Person the action is about, if any |
| `milestone_id` | ref |  | → `milestones` |  |

### `issue_nodes`

Issue tree: one key question, 2-5 branches, 1-5 hypotheses per branch. Prefix `in`; list; 3–31 records. Ordered by `order` within parent_id.

| Field | Type | Req. | Constraints | Description |
|---|---|---|---|---|
| `id` | id | yes |  |  |
| `parent_id` | ref |  | → `issue_nodes` | Empty for the key question |
| `kind` | enum | yes | `question` · `branch` · `hypothesis` |  |
| `order` | integer | yes | 1 … 9 |  |
| `text` | string | yes | ≤ 100 chars |  |
| `answer` | string |  | ≤ 120 chars; placeholders: presentation_builder | Branches only: the key-line statement for the storyline |
| `status` | enum |  | `open` · `confirmed` · `refuted` | Hypotheses only |
| `analysis` | string |  | ≤ 60 chars | Hypotheses only: the analysis that tests it |

### `sources`

Research sources used by the analyst. Prefix `so`; list; 0–30 records.

| Field | Type | Req. | Constraints | Description |
|---|---|---|---|---|
| `id` | id | yes |  |  |
| `title` | string | yes | ≤ 80 chars |  |
| `publisher` | string | yes | ≤ 40 chars |  |
| `year` | integer | yes | 2000 … 2030 |  |
| `type` | enum | yes | `pilot_data` · `client_data` · `benchmark` · `expert_interview` · `industry_report` · `academic` |  |
| `credibility` | enum | yes | `high` · `medium` · `low` |  |
| `url` | string |  | ≤ 200 chars | Link, if the source is public |

### `findings`

Evidence linking a source to a hypothesis. Prefix `fi`; list; 0–60 records.

| Field | Type | Req. | Constraints | Description |
|---|---|---|---|---|
| `id` | id | yes |  |  |
| `source_id` | ref | yes | → `sources` |  |
| `hypothesis_id` | ref | yes | → `issue_nodes` | Must be a hypothesis node |
| `stance` | enum | yes | `supports` · `refutes` · `neutral` |  |
| `text` | string | yes | ≤ 140 chars |  |
| `metric` | string |  | ≤ 14 chars | Headline number, e.g. +14% calls |
| `quote` | string |  | ≤ 200 chars | Verbatim excerpt from the source, shown on hover |

### `value_steps`

Bars of the value bridge, left to right. Prefix `vs`; list; 3–12 records. Ordered by `order`.

| Field | Type | Req. | Constraints | Description |
|---|---|---|---|---|
| `id` | id | yes |  |  |
| `order` | integer | yes | 1 … 12 |  |
| `label` | string | yes | ≤ 28 chars; ≤ 2 lines of 14 | Category label; \n forces a line break |
| `kind` | enum | yes | `start` · `delta` · `subtotal` |  |
| `value` | number |  | -1000 … 1000; 1 dp | Absolute for start, signed change for delta, empty for subtotal (derived) |
| `hypothesis_id` | ref |  | → `issue_nodes` | Hypothesis the lever rests on |
| `model_cell_id` | ref |  | → `model_cells` | Model cell the value comes from |

### `value_settings`

Settings for the value view. Exactly one record. Prefix `vt`; singleton (id vt-01); 1–1 records.

| Field | Type | Req. | Constraints | Description |
|---|---|---|---|---|
| `id` | id | yes |  |  |
| `npv_base` | number | yes | -10000 … 10000; 0 dp | Base-case NPV used by the sensitivity chart |
| `npv_cell_id` | ref |  | → `model_cells` | Model output the NPV comes from |
| `annotation_from_id` | ref |  | → `value_steps` | Bridge bracket start (a start or subtotal step) |
| `annotation_to_id` | ref |  | → `value_steps` | Bridge bracket end (a later subtotal step) |

### `sensitivity_drivers`

Tornado chart inputs: output value at the downside and upside value of one input. Prefix `sd`; list; 3–10 records.

| Field | Type | Req. | Constraints | Description |
|---|---|---|---|---|
| `id` | id | yes |  |  |
| `name` | string | yes | ≤ 26 chars |  |
| `downside_input` | string | yes | ≤ 10 chars | Displayed input value that gives the lower output |
| `downside_value` | number | yes | -10000 … 10000; 0 dp |  |
| `upside_input` | string | yes | ≤ 10 chars |  |
| `upside_value` | number | yes | -10000 … 10000; 0 dp |  |

### `model_cells`

Business-case spreadsheet. Each record is one row of a sheet: label in column B, value in column C (the ref), unit in D, formula or note in E. Prefix `mc`; list; 1–80 records.

| Field | Type | Req. | Constraints | Description |
|---|---|---|---|---|
| `id` | id | yes |  |  |
| `sheet` | enum | yes | `Inputs` · `Calculations` · `Outputs` |  |
| `ref` | string | yes | ≤ 4 chars; pattern `^C([4-9]\|[1-5][0-9])$` | Value cell, C4 to C59; the row number orders the sheet |
| `label` | string | yes | ≤ 44 chars |  |
| `kind` | enum | yes | `input` · `calc` · `output` |  |
| `value` | number | yes | -1000000000 … 1000000000; 4 dp |  |
| `decimals` | integer | yes | 0 … 3 | Display precision |
| `unit` | string |  | ≤ 8 chars |  |
| `formula` | string |  | ≤ 120 chars | Calc and output rows only; references as Sheet!C7 or C7 |
| `note` | string |  | ≤ 60 chars | Source or assumption |

### `narratives`

Text blocks on views: titles, eyebrows, footnotes, so-what points. Slots are defined below; fixed slots always exist. Prefix `nv`; list; 1–40 records. Ordered by `order` within view, slot.

| Field | Type | Req. | Constraints | Description |
|---|---|---|---|---|
| `id` | id | yes |  |  |
| `view` | enum | yes | `value_estimator` · `presentation_builder` |  |
| `slot` | string | yes | ≤ 40 chars |  |
| `order` | integer | yes | 1 … 9 |  |
| `text` | text | yes | ≤ 300 chars; placeholders: per `view` | Length limit per slot is set in slots |
| `highlight` | boolean | yes |  |  |

Slots:

| View | Slot | Fixed | Count | Max chars | Highlight |
|---|---|---|---|---|---|
| value_estimator | `bridge.eyebrow` | yes | 1 | 60 | — |
| value_estimator | `bridge.title` | yes | 1 | 110 | — |
| value_estimator | `bridge.annotation` | yes | 1 | 34 | — |
| value_estimator | `bridge.footnote` | yes | 1 | 260 | — |
| value_estimator | `sensitivity.eyebrow` | yes | 1 | 60 | — |
| value_estimator | `sensitivity.title` | yes | 1 | 100 | — |
| value_estimator | `so_what.title` | yes | 1 | 70 | — |
| value_estimator | `so_what.point` | no | 1–5 | 220 | ≤ 1 |
| presentation_builder | `governing_thought` | yes | 1 | 220 | — |

### `deck`

The current deck. Exactly one record. Prefix `dk`; singleton (id dk-01); 1–1 records.

| Field | Type | Req. | Constraints | Description |
|---|---|---|---|---|
| `id` | id | yes |  |  |
| `title` | string | yes | ≤ 80 chars |  |
| `version` | string | yes | ≤ 10 chars |  |
| `date` | date | yes |  |  |
| `status` | enum | yes | `draft` · `review` · `final` |  |
| `pdf_url` | string | yes | ≤ 300 chars | Relative path or https URL of the PDF |

### `slides`

Slides of the deck, with their action titles and link to the storyline. Prefix `sl`; list; 1–30 records. Ordered by `number`.

| Field | Type | Req. | Constraints | Description |
|---|---|---|---|---|
| `id` | id | yes |  |  |
| `number` | integer | yes | 1 … 30 |  |
| `section` | string |  | ≤ 24 chars |  |
| `title` | string | yes | ≤ 110 chars | Action title |
| `issue_node_id` | ref |  | → `issue_nodes` | Storyline element the slide carries |
| `status` | enum | yes | `draft` · `review` · `final` |  |

### `proposal`

Letter of proposal header. Exactly one record. Prefix `pr`; singleton (id pr-01); 1–1 records.

| Field | Type | Req. | Constraints | Description |
|---|---|---|---|---|
| `id` | id | yes |  |  |
| `title` | string | yes | ≤ 80 chars |  |
| `addressee_id` | ref | yes | → `people` |  |
| `date` | date | yes |  |  |
| `status` | enum | yes | `draft` · `review` · `sent` |  |

### `proposal_sections`

Sections of the letter of proposal. The seven keys are fixed. Prefix `ps`; fixed (keys context, objectives, scope, approach, team, fees, terms); 7–7 records. Ordered by `order`.

| Field | Type | Req. | Constraints | Description |
|---|---|---|---|---|
| `id` | id | yes |  |  |
| `key` | enum | yes | `context` · `objectives` · `scope` · `approach` · `team` · `fees` · `terms` |  |
| `order` | integer | yes | 1 … 7 |  |
| `title` | string | yes | ≤ 40 chars |  |
| `text` | text | yes | ≤ 900 chars; placeholders: proposal_builder |  |

### `proposal_staffing`

Consultant days proposed per team member; fees are derived from day rates. Prefix `pf`; list; 1–12 records.

| Field | Type | Req. | Constraints | Description |
|---|---|---|---|---|
| `id` | id | yes |  |  |
| `person_id` | ref | yes | → `people` |  |
| `days` | number | yes | 0 … 250; 1 dp |  |

### `skills`

Catalogue of skills available to agents. Prefix `sk`; list; 0–30 records.

| Field | Type | Req. | Constraints | Description |
|---|---|---|---|---|
| `id` | id | yes |  |  |
| `name` | string | yes | ≤ 32 chars |  |
| `description` | string | yes | ≤ 100 chars |  |

### `agents`

Agent setups: goal, system prompt, trigger and assigned skills. Prefix `ag`; list; 0–12 records.

| Field | Type | Req. | Constraints | Description |
|---|---|---|---|---|
| `id` | id | yes |  |  |
| `name` | string | yes | ≤ 40 chars |  |
| `audience` | enum | yes | `client` · `team` | team = an agent for the consulting team; client = an agent built for the client |
| `goal` | string | yes | ≤ 200 chars |  |
| `system_prompt` | text | yes | ≤ 1500 chars |  |
| `trigger` | string | yes | ≤ 60 chars | When the agent runs |
| `owner_id` | ref | yes | → `people` |  |
| `status` | enum | yes | `draft` · `testing` · `live` |  |
| `skill_ids` | ref_list |  | → `skills`, max 8 | Skills assigned to the agent |

### `agent_lines`

List blocks of an agent setup: tools (with data access), state variables and guardrails. Prefix `al`; list; 0–150 records. Ordered by `order` within agent_id, block.

| Field | Type | Req. | Constraints | Description |
|---|---|---|---|---|
| `id` | id | yes |  |  |
| `agent_id` | ref | yes | → `agents` |  |
| `block` | enum | yes | `tools` · `state` · `guardrails` |  |
| `order` | integer | yes | 1 … 12 |  |
| `name` | string | yes | ≤ 64 chars |  |
| `detail` | string |  | ≤ 120 chars |  |
| `access` | enum |  | `read` · `write` · `read_write` · `action` | Tools only |
| `resource` | string |  | ≤ 32 chars | Tools only: system or table the tool touches |
| `type` | enum |  | `text` · `integer` · `number` · `date` · `datetime` · `boolean` · `list` | State only |
| `value` | string |  | ≤ 40 chars | State only: current value |

## Invariants

Errors block a write; warnings are returned with a committed write.

| Id | Severity | Tables | Rule |
|---|---|---|---|
| I01 | error | engagement | engagement.start < engagement.end and start <= as_of <= end; start is a Monday |
| I02 | error | engagement, people | partner_id and manager_id are consulting people; sponsor_id is a client person |
| I03 | error | people | Consulting people have rate_day and capacity_days_week; client people have neither |
| I04 | error | phases, engagement | Phases ordered 1..n do not overlap, each start <= end, the first starts on engagement.start and the last ends on engagement.end |
| I05 | error | milestones, deliverables, tasks, reviews, actions, deck, proposal | Every date field lies within [engagement.start, engagement.end] |
| I06 | error | milestones, phases | A milestone date lies within its phase |
| I07 | error | milestones | status done or missed requires date <= as_of |
| I08 | error | deliverables | Owner is consulting; due lies within the phase; if milestone_id is set the milestone is in the same phase and due <= milestone date; status late requires due < as_of |
| I09 | error | tasks | Owner is consulting; start <= end; start and end lie within the phase; deliverable (if set) is in the same phase |
| I10 | error | tasks | Status vs as_of and progress: done requires progress 100 and end <= as_of; not_started requires progress 0 and start > as_of; in_progress, at_risk and late require start <= as_of and progress < 100; late requires end < as_of |
| I11 | error | tasks | depends_on contains no self-reference and the dependency graph has no cycles |
| I12 | error | raci, deliverables | One role per (deliverable, person); every deliverable has exactly one A and at least one R; the deliverable owner holds R or A |
| I13 | error | time_entries, people, engagement | Exactly one record per consulting person per engagement week (complete grid); week <= number of engagement weeks; actual_days present for weeks before the as-of week and empty from the as-of week on |
| I14 | error | reviews | Per deliverable, cycles run 1..n in date order; review dates are <= as_of |
| I15 | error | issue_nodes | Exactly one question (no parent); branches have the question as parent (2-5 branches); hypotheses have a branch as parent (1-5 per branch); answer is required on branches and absent elsewhere; status and analysis are required on hypotheses and absent elsewhere |
| I16 | error | findings, value_steps, issue_nodes | findings.hypothesis_id and value_steps.hypothesis_id point to hypothesis nodes |
| I17 | error | value_steps | Bridge shape: the first step is the only start; the last step is a subtotal; start and delta steps have a value, subtotals do not; deltas are non-zero; the running level stays >= 0 |
| I18 | error | value_settings, value_steps | Annotation (if set): both ends set, from is a start or subtotal, to is a later subtotal |
| I19 | error | sensitivity_drivers, value_settings | downside_value <= npv_base <= upside_value and downside_value < upside_value |
| I20 | error | model_cells | ref unique per sheet; calc and output rows have a formula, input rows do not; every reference in a formula resolves to an existing cell |
| I21 | error | narratives | Slot rules: slot exists for the view; fixed slots present exactly once; group slots within min..max; highlight only where highlight_max allows and within it; text within the slot's max_len |
| I22 | error | narratives, issue_nodes, proposal_sections | Placeholders {name} must be declared by the view; for length checks each placeholder counts as its declared width |
| I23 | error | slides | Slide numbers run 1..n without gaps or duplicates |
| I24 | error | agent_lines | Tools lines have access and resource and no type or value; state lines have type (value optional) and no access or resource; guardrail lines have none of access, resource, type or value |
| I25 | error | proposal_sections, proposal_staffing, proposal | Each section key exists exactly once; staffing persons are consulting and unique; addressee is a client person |
| I26 | error | * | Record ids are unique, match the table prefix, and fixed ids and keys are present; table cardinality within min..max; ordered fields form 1..n per group |
| I27 | error | phase_raci, phases, people | One role per (phase, person); every phase that has phase RACI rows has exactly one A and at least one R |
| W01 | warning | value_steps, model_cells | A start or delta step linked to a model cell has the cell's value (rounded to 1 decimal); a linked subtotal's derived level equals the cell value within 0.5 |
| W02 | warning | value_settings, model_cells | npv_base equals the linked model output (rounded) |
| W03 | warning | narratives | Narrative text quotes a literal money figure (e.g. €51m); prefer a placeholder so the text cannot go stale |
| W04 | warning | tasks, milestones, deliverables | A task ends after its deliverable's due date, or a deliverable is due after its milestone, or a dependency ends after the dependent task starts |

## Views

| View | File | Audience | Reads |
|---|---|---|---|
| Engagement home (`home`) | `index.html` | team | `engagement`, `people`, `phases`, `milestones`, `phase_raci` |
| Engagement starter (`engagement_starter`) | `views/engagement-starter.html` | team | `engagement`, `people`, `phases`, `milestones`, `deliverables`, `raci` |
| Analyst (`analyst`) | `views/analyst.html` | team | `engagement`, `issue_nodes`, `sources`, `findings` |
| Value estimator (`value_estimator`) | `views/value-estimator.html` | client | `engagement`, `value_steps`, `value_settings`, `sensitivity_drivers`, `narratives` |
| Presentation builder (`presentation_builder`) | `views/presentation-builder.html` | client | `engagement`, `deck`, `slides`, `issue_nodes`, `narratives`, `value_steps`, `value_settings` |
| Project manager (`project_manager`) | `views/project-manager.html` | team | `engagement`, `people`, `phases`, `milestones`, `deliverables`, `tasks`, `actions` |
| Team manager (`team_manager`) | `views/team-manager.html` | team | `engagement`, `people`, `deliverables`, `tasks`, `time_entries`, `reviews`, `actions` |
| Story builder (`story_builder`) | `views/story-builder.html` | team | `engagement`, `issue_nodes`, `findings`, `sources`, `value_steps` |
| Agent builder (`agent_builder`) | `views/agent-builder.html` | team | `engagement`, `people`, `agents`, `agent_lines`, `skills` |
| Proposal builder (`proposal_builder`) | `views/proposal-builder.html` | client | `engagement`, `people`, `proposal`, `proposal_sections`, `proposal_staffing` |
| Model builder (`model_builder`) | `views/model-builder.html` | team | `engagement`, `model_cells`, `value_steps`, `value_settings` |

### Placeholders

Formats: `money_m` Currency symbol + whole millions, e.g. €51m; negative values get −. Width 8; `money_k` Currency symbol + whole thousands, e.g. €894k. Width 10; `number` Plain number. Width 8; `integer` Whole number. Width 4; `text` Text from data. Width as declared.

| View | Placeholder | Format | Width | Meaning |
|---|---|---|---|---|
| value_estimator | `{bridge.start}` | money_m | 8 | Value of the start step |
| value_estimator | `{bridge.momentum}` | money_m | 8 | Level at the first subtotal |
| value_estimator | `{bridge.target}` | money_m | 8 | Level at the last subtotal |
| value_estimator | `{bridge.net_impact}` | money_m | 8 | Annotation 'to' level minus 'from' level |
| value_estimator | `{sensitivity.base}` | money_m | 8 | npv_base |
| value_estimator | `{sensitivity.top_driver}` | text | 26 | Driver with the largest swing |
| value_estimator | `{sensitivity.top_downside}` | money_m | 8 | Downside value of that driver |
| presentation_builder | `{value.net_impact}` | money_m | 8 | Net impact from the value bridge annotation |
| presentation_builder | `{value.target}` | money_m | 8 | Last subtotal of the value bridge |
| presentation_builder | `{hypotheses.confirmed}` | integer | 4 | Number of confirmed hypotheses |
| presentation_builder | `{hypotheses.total}` | integer | 4 | Number of hypotheses |
| proposal_builder | `{fees.total}` | money_k | 10 | Sum of days x day rate, e.g. €894k |
| proposal_builder | `{fees.days}` | number | 6 | Total proposed days |
| proposal_builder | `{client.name}` | text | 40 | engagement.client |

## Agent write scopes

All agents may read every table. Writes are limited to the tables, operations and fields below.

| Agent | Table | Create | Delete | Updatable fields | Row filter |
|---|---|---|---|---|---|
| engagement_starter | `engagement` |  |  | `name`, `objective` |  |
| engagement_starter | `people` | yes |  | `name`, `title`, `rate_day`, `capacity_days_week` |  |
| engagement_starter | `milestones` | yes | yes | `name`, `date`, `type`, `phase_id` |  |
| engagement_starter | `deliverables` | yes | yes | `name`, `owner_id`, `due`, `milestone_id`, `phase_id` |  |
| engagement_starter | `raci` | yes | yes | `role` |  |
| engagement_starter | `phase_raci` | yes | yes | `role`, `comment` |  |
| analyst | `sources` | yes | yes | all |  |
| analyst | `findings` | yes | yes | all |  |
| analyst | `issue_nodes` |  |  | `status` |  |
| value_estimator | `value_steps` | yes | yes | `order`, `label`, `kind`, `value`, `hypothesis_id`, `model_cell_id` |  |
| value_estimator | `value_settings` |  |  | `npv_base`, `annotation_from_id`, `annotation_to_id` |  |
| value_estimator | `sensitivity_drivers` | yes | yes | all |  |
| value_estimator | `narratives` | yes | yes | `text`, `order`, `highlight` | `view = value_estimator` |
| presentation_builder | `deck` |  |  | `title`, `version`, `date`, `status`, `pdf_url` |  |
| presentation_builder | `slides` | yes | yes | all |  |
| project_manager | `tasks` | yes |  | `start`, `end`, `status`, `progress_pct`, `owner_id`, `depends_on` |  |
| project_manager | `milestones` |  |  | `status`, `date` |  |
| project_manager | `deliverables` |  |  | `status`, `due` |  |
| project_manager | `actions` | yes | yes | all | `source = project_manager` |
| team_manager | `time_entries` |  |  | `planned_days` |  |
| team_manager | `actions` | yes | yes | all | `source = team_manager` |
| story_builder | `issue_nodes` | yes | yes | `parent_id`, `kind`, `order`, `text`, `answer`, `analysis` |  |
| story_builder | `slides` |  |  | `title`, `issue_node_id` |  |
| story_builder | `narratives` |  |  | `text` | `view = presentation_builder` |
| agent_builder | `agents` | yes |  | all |  |
| agent_builder | `agent_lines` | yes | yes | all |  |
| agent_builder | `skills` | yes |  | `name`, `description` |  |
| proposal_builder | `proposal` |  |  | `title`, `addressee_id`, `date`, `status` |  |
| proposal_builder | `proposal_sections` |  |  | `title`, `text`, `order` |  |
| proposal_builder | `proposal_staffing` | yes | yes | `days` |  |
| model_builder | `model_cells` | yes | yes | `label`, `kind`, `value`, `decimals`, `unit`, `formula`, `note` |  |
