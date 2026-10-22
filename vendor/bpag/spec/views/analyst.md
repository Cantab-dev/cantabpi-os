# View: Analyst

File `views/analyst.html` · view key `analyst` · agent `analyst` · audience: team

## 1. Purpose and user

Shows what the research says about each hypothesis in the issue tree and where it comes from, down to the verbatim quotes. Used by consultants preparing analyses and by the engagement manager deciding which hypotheses are settled. The analyst agent adds sources and findings and updates hypothesis status.

## 2. Questions answered

- For each hypothesis, what evidence is there, and does it support, refute or leave it open?
- Which sources stand behind each hypothesis, how credible are they, and what exactly do they say?
- Which hypotheses rest on thin evidence?

## 3. Data read

| Table | Fields |
|---|---|
| `issue_nodes` | `parent_id`, `kind`, `order`, `text`, `status` |
| `sources` | `title`, `publisher`, `year`, `type`, `credibility`, `url` |
| `findings` | `source_id`, `hypothesis_id`, `stance`, `text`, `metric`, `quote` |

## 4. Derived values

| Value | Rule |
|---|---|
| Evidence order | supports, then refutes, then inconclusive |
| Sources per hypothesis | distinct sources of the hypothesis's findings, most credible first |
| Quotes per source | the `quote` of each finding from that source for that hypothesis; the finding `text` when `quote` is empty |
| Thin evidence | fewer than two supporting or refuting findings (block title) |
| Source usage | number of findings citing the source |
| Source order (list) | credibility (high first), then year (newest first) |

## 5. Layout and visualisations

1. **Evidence board (full width).** Three columns, with rows grouped under their branch:
   - **Hypothesis**: text and status pill.
   - **Evidence**: one merged list of findings. Each finding shows its metric (mono) and text on a subtle tint by stance (green supports, red refutes, neutral inconclusive), with a small stance label so colour is not the only cue.
   - **Sources**: one item per source, with credibility dots (●●●, ●●○, ●○○) and the number of quotes. Hovering or focusing a source opens a popover with publisher, year and type, and its verbatim quotes for this hypothesis.

   The board scrolls inside its block below 860 px. The popover is positioned against the viewport, so the scroller never clips it.
2. **Sources (full width).** Table of source, publisher, year, type, credibility and number of findings. Titles link out when the source has a `url`.

## 6. Interactions

- Source items take keyboard focus (Tab) and open their quote popover on focus as well as on hover.
- Agent-changed findings, sources and hypotheses show the change dot and note.

## 7. Render contract

| Item | Limit |
|---|---|
| Findings | ≤ 60; text ≤ 140; metric ≤ 14; quote ≤ 200; must point to a hypothesis node (I16) |
| Sources | ≤ 30; title ≤ 80; publisher ≤ 40 |
| Hypotheses | as in the story builder spec (I15) |

The analyst agent may change only the `status` of issue nodes.

## 8. Agent actions for the demo

**A. New evidence on adoption, from a second benchmark.**

```json
{ "agent": "analyst", "reason": "Second benchmark on post-pilot adoption added",
  "ops": [
    { "op": "create", "table": "sources", "tmp": "s", "record": { "title": "Benchmark: adoption curves in 4 commercial AI rollouts", "publisher": "Cantab Pi research", "year": 2026, "type": "benchmark", "credibility": "medium" } },
    { "op": "create", "table": "findings", "record": { "source_id": "$s", "hypothesis_id": "in-09", "stance": "supports", "text": "Rollouts with weekly floor-walker support held daily use above 70% after 6 months", "metric": ">70% at 6 mo", "quote": "Where floor-walkers stayed for the first quarter, daily use was still above 70% six months after go-live." } }
  ] }
```

Expected effect:
- A green finding appears under "Reps adopt the agents without extra incentives".
- A new source item appears in the Sources column with its quote on hover.
- The source list gains a row.

**B. The analyst settles a hypothesis.**

```json
{ "agent": "analyst", "reason": "Two benchmarks and pilot data support adoption without incentives",
  "ops": [ { "op": "update", "table": "issue_nodes", "id": "in-09", "set": { "status": "confirmed" } } ] }
```

Expected effect: the pill turns green here and in the story builder.

**C. Rejected: a finding attached to a branch.** `"hypothesis_id": "in-02"` returns I16: "hypothesis_id must point to a hypothesis".

## 9. Acceptance checks

- The seed shows 14 findings across 10 hypotheses in 4 branch groups, and the title "7 of 10 hypotheses rest on fewer than two decisive findings".
- Every source item opens a popover with at least one quote.
- The source list has 8 rows; the pilot telemetry source is cited 4 times.
- Demo writes A and B commit; C is rejected.
