# View: Engagement starter

File `views/engagement-starter.html` · view key `engagement_starter` · agent `engagement_starter` · audience: team

## 1. Purpose and user

Sets the engagement up and keeps the commitments visible: who is responsible, accountable, consulted and informed on each deliverable, and the milestone dates the team has committed to. Used by the engagement manager at kick-off and whenever scope or team changes. The engagement starter agent drafts and maintains both.

## 2. Questions answered

- Who owns each deliverable, and who must be consulted or kept informed?
- Is anyone carrying too many deliverables as R or A?
- How do the phases run over time, and which milestone comes next?

## 3. Data read

| Table | Fields |
|---|---|
| `engagement` | `start`, `end`, `as_of` |
| `people` | `name`, `org`, `title` |
| `phases` | `order`, `name`, `start`, `end` |
| `milestones` | `phase_id`, `name`, `date`, `status` |
| `deliverables` | `phase_id`, `name`, `owner_id`, `due` |
| `raci` | `deliverable_id`, `person_id`, `role` |

## 4. Derived values

| Value | Rule |
|---|---|
| Column order | consulting people first, then client people, each in table order |
| Row order | deliverables grouped by phase (phase `order`), then by `due` |
| Load per person | number of deliverables where the person is R or A (footer row) |
| Phase state | completed, current or planned against `as_of` |
| Next milestone | earliest milestone not done with date ≥ `as_of`; the block title gives its date and days to go |
| Time axis | engagement start to end, one tick per engagement week |

## 5. Layout and visualisations

1. **RACI matrix (full width).**
   - **Header.** Rows are deliverables with due date and owner. Columns are people, labelled with first name over last name; the full name and title appear on hover. Two column groups: "Consulting team" and "Client", with the client columns tinted.
   - **Role chips.** A = solid red, R = red outline, C = grey, I = dashed outline. Each chip carries its letter, so colour is not the only cue.
   - **Footer.** The load per person.
   - The table scrolls inside its block below 980 px.
2. **Phase plan (full width).** A simplified Gantt:
   - Phases are drawn as block arrows (chevrons) along the week axis, shaded by state: completed dark grey, current red, planned light grey. Each arrow carries the phase name and dates.
   - Milestones sit beneath as diamonds coloured by status, with name, date and status. Labels alternate between two lines to avoid overlap.
   - A red today line crosses the plan.
   - The plan scrolls inside its block below 760 px.

## 6. Interactions

Hover on a chip names the person, the role and the deliverable. Hover on a phase arrow or milestone shows its dates and any agent change note.

## 7. Render contract

| Item | Limit |
|---|---|
| People | 3–20 (columns); names ≤ 32 chars |
| Deliverables | 1–16 (rows); names ≤ 48 chars |
| RACI | one role per person per deliverable; exactly one A and at least one R per deliverable; the owner holds R or A (I12) |
| Milestones | 1–12; names ≤ 44 chars; date within phase (I06); done or missed only on or before `as_of` (I07) |
| Deliverables | due within phase and on or before their milestone (I08) |

## 8. Agent actions for the demo

**A. Add the AI engineer to the business case as consulted.**

```json
{ "agent": "engagement_starter", "reason": "IT architecture input needed for the business case",
  "ops": [ { "op": "create", "table": "raci", "record": { "deliverable_id": "dl-05", "person_id": "pe-06", "role": "C" } } ] }
```

Expected effect: a grey C appears in Lukas Brandt's column on the business case row and flashes. The footer count is unchanged.

**B. Add a deliverable with its RACI in one batch.**

```json
{ "agent": "engagement_starter", "reason": "Wave 1 readiness checklist added at sponsor request",
  "ops": [
    { "op": "create", "table": "deliverables", "tmp": "d", "record": { "phase_id": "ph-03", "milestone_id": "ms-06", "name": "Wave 1 readiness checklist", "owner_id": "pe-06", "due": "2026-11-20", "status": "not_started" } },
    { "op": "create", "table": "raci", "record": { "deliverable_id": "$d", "person_id": "pe-06", "role": "R" } },
    { "op": "create", "table": "raci", "record": { "deliverable_id": "$d", "person_id": "pe-02", "role": "A" } },
    { "op": "create", "table": "raci", "record": { "deliverable_id": "$d", "person_id": "pe-10", "role": "C" } }
  ] }
```

Expected effect:
- A new row appears under Rollout plan, between the roadmap (27 Nov) and the change plan (2 Dec).
- The same deliverable without its A and R rows is rejected with I12.

**C. Rejected: bring the board decision forward by a day.**

```json
{ "agent": "engagement_starter", "reason": "Board meeting moved",
  "ops": [ { "op": "update", "table": "milestones", "id": "ms-05", "set": { "date": "2026-11-05" } } ] }
```

The tool returns I08: the board proposal deck (due 6 Nov) must be due on or before its milestone. The agent must move the deliverable's due date in the same batch.

## 9. Acceptance checks

- The seed shows 10 deliverables in 3 phase groups and 11 people columns (6 consulting, 5 client).
- Every row has exactly one A.
- The footer reads 3, 10, 3, 3, 1, 1 for the consulting team and 0 for the client.
- The phase plan title reads "Next: Scale-up business case to SteerCo, 30 Oct (in 9 days)"; Scale-up design is the red arrow, and the SteerCo diamond is amber.
- Demo writes A and B commit; C is rejected.
