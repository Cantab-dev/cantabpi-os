# View: Engagement home

File `index.html` · view key `home` · agent none (written by the engagement starter) · audience: team

## 1. Purpose and user

The landing page of the engagement. It shows two things: the time plan by phase with its milestones, and who plays which role in each phase. It is used by everyone on the engagement, and in client meetings as the one-page frame of the project.

## 2. Questions answered

- What are the phases, when do they run, and where are we today?
- Which milestones fall in each phase, and what is their status?
- In each phase, who is accountable, who is responsible, and what exactly does each person do?

## 3. Data read

| Table | Fields |
|---|---|
| `engagement` | `client`, `name`, `start`, `end`, `as_of` |
| `people` | `name`, `org`, `title` |
| `phases` | `order`, `name`, `start`, `end` |
| `milestones` | `phase_id`, `name`, `date`, `status` |
| `phase_raci` | `phase_id`, `person_id`, `role`, `comment` |

## 4. Derived values

| Value | Rule |
|---|---|
| Time axis | engagement start to end; month labels and engagement weeks W1…Wn |
| Phase state | completed if it ends before `as_of`; current if it contains `as_of` (filled up to today); planned otherwise |
| Phase weeks | `W(start)–W(end)` from the engagement calendar |
| Today line | `as_of` |
| Accountable per phase | the person with role A in `phase_raci` for that phase (block title) |
| Row grouping | consulting team first, then client stakeholders under the client's name |

## 5. Layout and visualisations

1. **Time plan (full width).**
   - One row per phase, one under another, in phase order.
   - Left column: phase name, dates and weeks.
   - Timeline: a phase bar shaded by state, with milestones as diamonds coloured by status (done green, at risk amber, planned white, missed red). Labels alternate between two lines to avoid overlap.
   - A single red today line runs across all rows.
   - The plan scrolls inside its block below 760 px.
2. **RACI by phase (full width).**
   - Rows: every person, grouped "Consulting team" then the client. Columns: phases, with their dates.
   - Each cell: an R/A/C/I chip (A solid red, R red outline, C grey, I dashed) plus a one-sentence comment.
   - Empty cells show a dash.
   - The title names the accountable person per phase.

## 6. Interactions

Hover on a milestone diamond shows its change note if an agent changed it. Changed RACI comments carry the change dot and note.

## 7. Render contract

| Item | Limit |
|---|---|
| Phases | 1–6, contiguous, covering the engagement (I04); names ≤ 28 |
| Milestones | ≤ 12; names ≤ 44 chars; date within phase (I06) |
| Phase RACI | ≤ 120 rows; comment ≤ 90 chars; one role per person per phase; one A and at least one R per phase (I27) |
| People | 3–20 rows |

## 8. Agent actions for the demo

**A. The engagement starter rebalances accountability for the rollout plan.**

```json
{ "agent": "engagement_starter", "reason": "Engagement manager takes accountability for the rollout plan; partner consulted",
  "ops": [
    { "op": "update", "table": "phase_raci", "id": "px-023", "set": { "role": "C", "comment": "Reviews the rollout proposal before it goes to the client" } },
    { "op": "update", "table": "phase_raci", "id": "px-024", "set": { "role": "A", "comment": "Owns the rollout plan and drafts the proposal" } }
  ] }
```

Expected effect: in the Rollout plan column, Clara Weber's chip turns from A to C and Tomás Reyes's from R to A. Both comments flash, and the title reads "… Rollout plan: Tomás Reyes".

**B. Rejected: two people accountable.** Setting `role` to `A` on `px-024` alone returns I27: "phase ph-03 needs exactly one A (has 2)".

## 9. Acceptance checks

- The seed shows three phase rows: Pilot completed, Scale-up design current (filled to 21 Oct), Rollout plan planned.
- Six milestones: three done, SteerCo at risk, two planned.
- The RACI shows 11 people × 3 phases, all cells filled.
- The title reads "Accountable: Pilot: Tomás Reyes · Scale-up design: Clara Weber · Rollout plan: Clara Weber".
- Demo write A commits; B is rejected.
