# View: Team manager

File `views/team-manager.html` · view key `team_manager` · agent `team_manager` · audience: team

## 1. Purpose and user

Lets the engagement manager and partner see how the team's load sits against capacity, week by week, and how delivery is going for each person. The team manager agent spots overload and rework and proposes rebalancing.

The view shows workload, ownership and review signals. It does not score or rank individuals.

## 2. Questions answered

- Who is over or under capacity, in which weeks, actual and planned?
- Who owns what, and where is work late, at risk or going round review cycles?
- What should be rebalanced?

## 3. Data read

| Table | Fields |
|---|---|
| `engagement` | `start`, `end`, `as_of` |
| `people` | `name`, `org`, `title`, `capacity_days_week` |
| `deliverables` | `owner_id`, `status` |
| `tasks` | `owner_id`, `name`, `status` |
| `time_entries` | `person_id`, `week`, `planned_days`, `actual_days` |
| `reviews` | `deliverable_id` |
| `actions` | `source`, `title`, `rationale`, `priority`, `owner_id`, `due`, `status`, `person_id` |

## 4. Derived values

| Value | Rule |
|---|---|
| Days in a week | `actual_days` if present, otherwise `planned_days` |
| Utilisation | days ÷ `capacity_days_week` |
| Utilisation band | < 70%, 70–100%, 100–110%, 110–125%, > 125% |
| Planned weeks | weeks from the as-of week on (hatched) |
| Overload title | consulting people above 110% in any of the as-of week and the 3 weeks after it |
| Last 4 weeks | mean days over the 4 weeks before the as-of week ÷ capacity |
| Next 3 weeks | mean days over the as-of week and the 2 after ÷ capacity |
| Deliverables done | owned deliverables with status done, out of all owned |
| Tasks late or at risk | owned tasks with status late or at_risk |
| Review cycles | mean number of review records per owned deliverable that has any; flagged when any reaches 3 |

## 5. Layout and visualisations

1. **Capacity heatmap (full width).**
   - Rows are consulting people with title and capacity. Columns are engagement weeks; the as-of week is outlined in red.
   - Each cell shows utilisation % and is shaded by band: three neutral shades, amber with an outline for 110–125%, solid red for > 125%.
   - Future weeks are hatched to mark them as planned.
   - Hover shows days of capacity and whether the figure is actual or planned.
2. **Delivery scorecard (left).** One row per consulting person with the six derived measures. Values over 110% and review loops are highlighted in amber or red text.
3. **Team actions (right).** Cards for actions with `source = team_manager`, ordered as in the project manager view.

## 6. Interactions

Hover on cells and on the "Tasks late or at risk" count shows the details. Agent-changed time entries and actions show the change marker.

## 7. Render contract

| Item | Limit |
|---|---|
| Time entries | complete grid of consulting people × engagement weeks; actuals before the as-of week, none from it on (I13) |
| Consulting people | the heatmap is designed for up to 12 rows; names ≤ 32 chars |
| Actions | ≤ 12 in total |

The team manager agent may change only `planned_days` on time entries, and only actions whose `source` is `team_manager`.

## 8. Agent actions for the demo

**A. Rebalance Mei's load to Lukas in weeks 12–13.**

```json
{ "agent": "team_manager", "reason": "CRM data QA moved from Mei to Lukas",
  "ops": [
    { "op": "update", "table": "time_entries", "id": "te-084", "set": { "planned_days": 5 } },
    { "op": "update", "table": "time_entries", "id": "te-085", "set": { "planned_days": 5 } },
    { "op": "update", "table": "time_entries", "id": "te-102", "set": { "planned_days": 4.5 } },
    { "op": "update", "table": "time_entries", "id": "te-103", "set": { "planned_days": 4.5 } },
    { "op": "update", "table": "actions", "id": "ac-04", "set": { "status": "done" } }
  ] }
```

Expected effect:
- Mei's W12–W13 cells drop from 130 (red) to 100.
- Lukas's rise from 60 to 90.
- The four cells flash.
- The title no longer names Mei.
- The action card shows Done.

Ids: Mei Tanaka weeks 12 and 13 are `te-084` and `te-085`; Lukas Brandt weeks 12 and 13 are `te-102` and `te-103`.

**B. Flag rework on the value model.**

```json
{ "agent": "team_manager", "reason": "Third review cycle on the value model",
  "ops": [ { "op": "update", "table": "actions", "id": "ac-05", "set": { "priority": "high" } } ] }
```

**C. Rejected: overwriting an actual.** `{ "op": "update", "table": "time_entries", "id": "te-083", "set": { "actual_days": 5 } }` returns `scope`: the team manager may not change `actual_days`.

## 9. Acceptance checks

- The seed title reads "Tomás and Mei are planned above 110% in the next four weeks".
- Mei's W12–W13 cells read 130; Lukas's read 60.
- The scorecard shows Mei with 2 tasks late or at risk, and Jonas with "3.0 (max 3)" review cycles.
- Three team actions are shown.
- Demo writes A and B commit; C is rejected.
