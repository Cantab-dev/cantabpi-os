# View: Value estimator

File `views/value-estimator.html` · view key `value_estimator` · agent `value_estimator` · audience: client

## 1. Purpose and user

Shows the client what the initiative is worth, how robust the number is, and what to decide. Used by the partner and engagement manager in client meetings and in the SteerCo pack.

## 2. Questions answered

- How does 2028 EBIT move from today to the target, and which levers drive it?
- Which assumption could move NPV most, and does any single one turn it negative?
- What should the client decide?

## 3. Data read

| Table | Fields |
|---|---|
| `engagement` | `currency` |
| `value_steps` | `order`, `label`, `kind`, `value` |
| `value_settings` | `npv_base`, `annotation_from_id`, `annotation_to_id` |
| `sensitivity_drivers` | `name`, `downside_input`, `downside_value`, `upside_input`, `upside_value` |
| `narratives` | `view`, `slot`, `order`, `text`, `highlight` |

## 4. Derived values

| Value | Rule |
|---|---|
| Running level | `start` sets it; `delta` adds; `subtotal` shows it unchanged |
| Bar extent | Totals from the axis floor to the level; deltas between the level before and after |
| Axis floor | 0, unless the lowest level is above 40% of the highest bar top. Then floor = (lowest level − 0.6 × span), rounded down to 25, 50 or 100 depending on the span. Total bars carry a break mark, and a note states where the axis starts. |
| Vertical scale top | highest bar top + 14% of (top − floor) |
| Net impact | level at `annotation_to_id` − level at `annotation_from_id` |
| Tornado order | drivers sorted by swing (`upside_value − downside_value`), largest first |
| Tornado axis | a "nice" scale of about 5 intervals covering all driver values and `npv_base` |
| Placeholders | see section 7 |

## 5. Layout and visualisations

1. **Bridge (headline, full width).**
   - Eyebrow and action title from narratives.
   - Legend: totals dark grey, increases red, decreases light grey.
   - Bars carry value labels: totals plain; deltas signed with a true minus and one decimal only when needed. Category labels go under the bars, up to two lines.
   - A bracket with a pill shows the annotation text between the two annotated totals.
   - Footnote below. The chart scrolls horizontally inside its block below 720 px.
2. **Sensitivity (left, about two thirds).**
   - Tornado rows show the driver name, the downside bar (grey) and upside bar (red) either side of a 2 px base line, the input values at the bar ends, and the swing on the right.
   - Ticks are drawn below.
3. **So what (right, about one third).**
   - Title, then an ordered list of points. The highlighted point sits in a red-tinted panel.

## 6. Interactions

None beyond hover notes on agent-changed items, which show the dot and "Changed by <agent>: <reason>".

## 7. Render contract

| Item | Limit |
|---|---|
| Bridge steps | 3–12; first is the only `start`, last is a `subtotal`; level never below 0 (I17) |
| Step label | ≤ 2 lines × 14 chars |
| Drivers | 3–10; `downside_value ≤ npv_base ≤ upside_value` (I19); input labels ≤ 10 chars; names ≤ 26 chars |
| Narrative slots | `bridge.eyebrow` 60, `bridge.title` 110, `bridge.annotation` 34, `bridge.footnote` 260, `sensitivity.eyebrow` 60, `sensitivity.title` 100, `so_what.title` 70, `so_what.point` 1–5 × 220 with at most 1 highlighted (I21) |

Placeholders:

| Placeholder | Value |
|---|---|
| `{bridge.start}` | level of the start step |
| `{bridge.momentum}` | level of the first subtotal |
| `{bridge.target}` | level of the last subtotal |
| `{bridge.net_impact}` | net impact |
| `{sensitivity.base}` | `npv_base` |
| `{sensitivity.top_driver}` | name of the largest-swing driver |
| `{sensitivity.top_downside}` | that driver's `downside_value` |

## 8. Agent actions for the demo

**A. Pilot evidence lowers the next-best-action uplift.** The model builder agent changes the model first (see the model builder spec), then the value estimator aligns the bridge:

```json
{ "agent": "value_estimator", "reason": "Next-best-action lever aligned to revised model (4% uplift)",
  "ops": [ { "op": "update", "table": "value_steps", "id": "vs-05", "set": { "value": 17.6 } } ] }
```

Expected effect:
- The NBA bar shrinks to +17.6.
- The target becomes €422m and the net impact €47m.
- The headline and annotation update through their placeholders, with no text edit.
- The bar pulses.
- With the model already changed, W01 still flags the adoption haircut (−9.3 in the model) and the target. The agent fixes both with a second write updating `vs-10` to −9.3, after which the target reads €422m.

**B. Add a new lever between "Content" and "Review effort".**

```json
{ "agent": "value_estimator", "reason": "Sample reduction lever added from analyst finding",
  "ops": [ { "op": "create", "table": "value_steps", "record": { "order": 6.5, "label": "Sample\nreduction", "kind": "delta", "value": 3 } } ] }
```

Expected effect: a new red bar appears in position 7 and later steps renumber. The target becomes €429m.

**C. Sharpen the recommendation.**

```json
{ "agent": "value_estimator", "reason": "Recommendation tightened after sponsor pre-wire",
  "ops": [ { "op": "update", "table": "narratives", "id": "nv-10", "set": { "text": "Approve wave 1 (Germany, Italy) now; release wave 2 when daily use exceeds 70% for four consecutive weeks." } } ] }
```

**D. Rejected: a headline that is too long or uses an unknown placeholder.** The tool returns `field` (length > 110) or `I22` (undeclared placeholder), and the view does not change.

## 9. Acceptance checks

- The seed renders the levels 410 → 375 → 426, the bracket reads "€51m net impact", and the axis-cut note reads €325m.
- The tornado shows 7 rows sorted 72, 65, 45, 36, 26, 24, 15, and the title reads "Rep adoption rate is the swing factor…".
- Demo writes A–C commit, and the view redraws within 2 s with the changed items pulsing or flashing.
- At 400 px wide the page has no horizontal scroll; the bridge scrolls inside its block.
