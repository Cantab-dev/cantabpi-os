# View: Project manager

File `views/project-manager.html` · view key `project_manager` · agent `project_manager` · audience: team

## 1. Purpose and user

Gives the engagement manager the plan against today: what is done, what is slipping, what that does to the milestones, and what to do this week. The project manager agent reads the same signals and writes recommended actions.

## 2. Questions answered

- Where are we against the plan as of today?
- Which tasks are late or at risk, and which milestones does that threaten?
- Where do dependencies conflict?
- What should the engagement manager do this week?

## 3. Data read

| Table | Fields |
|---|---|
| `engagement` | `start`, `end`, `as_of` |
| `people` | `name` |
| `phases` | `order`, `name`, `start`, `end` |
| `milestones` | `phase_id`, `name`, `date`, `status` |
| `deliverables` | `milestone_id`, `name`, `due`, `status` |
| `tasks` | `phase_id`, `deliverable_id`, `name`, `owner_id`, `start`, `end`, `status`, `progress_pct`, `depends_on` |
| `actions` | `source`, `title`, `rationale`, `priority`, `owner_id`, `due`, `status`, `task_id`, `person_id`, `milestone_id` |

## 4. Derived values

| Value | Rule |
|---|---|
| Time axis | engagement start to end, one column per engagement week (W1…), month labels |
| Today line | `as_of` |
| Days late | `as_of − end` for a task with status `late`; the overdue stretch is drawn as a pale red extension up to today |
| Milestone float | milestone date − latest `end` of the tasks whose deliverable feeds the milestone (days) |
| Dependency conflict | a predecessor ends on or after the dependent task's start, and the dependent task is not done |
| Action order | status (proposed, accepted, done, dismissed), then priority (high, medium, low), then due date |

## 5. Layout and visualisations

1. **Gantt (full width).** Rows are grouped by phase:
   - **Phase header row**: name, dates and span bar.
   - **Task rows**: sorted by start.
     - Bar coloured by status: done green, in progress dark grey, at risk amber, late red, not started dashed outline.
     - The solid part shows `progress_pct`.
     - The owner's initials sit after the bar.
     - Late and at-risk bars carry a text flag ("Late 5d", "At risk"), so colour is not the only cue.
   - **Milestone rows**: diamond coloured by status, with date, float and status next to it.
   - Dependency conflicts are drawn as red dashed connectors. Non-conflicting dependencies are not drawn, to keep the chart readable.
   - The chart scrolls inside its block below 900 px.
2. **Recommended actions (full width, below the Gantt).**
   - Cards for actions with `source = project_manager`: title, priority and status pills, rationale.
   - A meta line shows owner, due date and the linked task, milestone or person.

## 6. Interactions

Hover on a bar or diamond shows its full details and, if an agent changed it, "Changed by <agent>: <reason>".

## 7. Render contract

| Item | Limit |
|---|---|
| Phases | 1–6, contiguous, covering the engagement (I04) |
| Tasks | ≤ 40; names ≤ 40 chars; dates within their phase (I09); status consistent with `as_of` and progress (I10); no dependency cycles (I11) |
| Milestones | ≤ 12; names ≤ 44 chars; date within phase (I06) |
| Actions | ≤ 12 in total; title ≤ 64; rationale ≤ 200 |

The project manager agent may only change actions whose `source` is `project_manager`.

## 8. Agent actions for the demo

**A. IT delivers the CRM extract; the task recovers.**

```json
{ "agent": "project_manager", "reason": "CRM extract received for 7 of 9 markets; remaining two by 23 Oct",
  "ops": [ { "op": "update", "table": "tasks", "id": "tk-08", "set": { "status": "in_progress", "progress_pct": 85, "end": "2026-10-23" } } ] }
```

Expected effect:
- The red bar turns dark grey and extends to 23 Oct; the "Late 5d" flag disappears.
- A new red dependency connector appears (tk-08 now ends after tk-10 starts), and is returned as W04.

**B. Re-plan the sensitivity work and raise an action.**

```json
{ "agent": "project_manager", "reason": "Sensitivity needs the full extract; SteerCo pack compressed",
  "ops": [
    { "op": "update", "table": "tasks", "id": "tk-10", "set": { "end": "2026-10-28" } },
    { "op": "create", "table": "actions", "record": { "source": "project_manager", "title": "Compress the SteerCo pack to three working days", "rationale": "Sensitivity now ends 28 Oct; the pack must be built 28-30 Oct with the storyline drafted in advance.", "priority": "high", "owner_id": "pe-02", "due": "2026-10-27", "status": "proposed", "task_id": "tk-14", "milestone_id": "ms-04" } }
  ] }
```

Expected effect: the sensitivity bar lengthens, the red connector to the SteerCo pack stays, and a new high-priority action card flashes at the top.

**C. The engagement manager accepts an action.**

```json
{ "agent": "project_manager", "reason": "Accepted by the engagement manager",
  "ops": [ { "op": "update", "table": "actions", "id": "ac-01", "set": { "status": "accepted" } } ] }
```

**D. Rejected: marking a future task done.**

`{ "op": "update", "table": "tasks", "id": "tk-14", "set": { "status": "done", "progress_pct": 100 } }` returns I10: "done requires progress 100 and end <= as_of".

## 9. Acceptance checks

- The seed shows:
  - CRM data extraction as "Late 5d"
  - Sensitivity "At risk"
  - one red dependency connector, from sensitivity to the SteerCo pack
  - the SteerCo milestone in amber with float 0d
- Three project-manager actions in the order High/Proposed, Medium/Proposed, Medium/Accepted.
- Demo writes A–C commit and redraw within 2 s; D is rejected and nothing changes.
