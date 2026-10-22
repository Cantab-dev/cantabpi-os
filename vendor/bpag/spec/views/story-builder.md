# View: Story builder

File `views/story-builder.html` · view key `story_builder` · agent `story_builder` · audience: team

## 1. Purpose and user

Builds the engagement's logic the consulting way: one key question, broken down into a MECE issue tree of branches and testable hypotheses. Each hypothesis shows its status, the analysis that tests it, the evidence count and any value lever resting on it; hovering shows the evidence itself. Used by the engagement manager and partner to shape the SteerCo and board story.

The storyline (governing thought, key line, slides) is shown in the presentation builder. The story builder agent still writes it.

## 2. Questions answered

- What exactly are we answering, and is the breakdown complete and non-overlapping?
- Which hypotheses are confirmed, refuted or still open?
- What evidence and value levers sit behind each one?

## 3. Data read

| Table | Fields |
|---|---|
| `engagement` | `currency` |
| `issue_nodes` | `parent_id`, `kind`, `order`, `text`, `status`, `analysis` |
| `findings` | `hypothesis_id`, `source_id`, `stance`, `text`, `metric` |
| `sources` | `title`, `credibility` |
| `value_steps` | `order`, `label`, `kind`, `value`, `hypothesis_id` |

## 4. Derived values

| Value | Rule |
|---|---|
| Evidence count per hypothesis | findings with that `hypothesis_id`, counted by `stance` |
| Value lever per hypothesis | value steps whose `hypothesis_id` is the hypothesis, shown with their signed value |
| Confirmed, refuted, total | counts of hypotheses by status (block title) |

## 5. Layout and visualisations

**Issue tree (full width).** Three columns joined by rule lines:

1. **Key question** in a solid red box.
2. **Branches.**
3. **Hypotheses.** Each shows its text, a status pill, the test (`analysis`), the evidence count and any linked value lever.

Hovering or focusing a hypothesis opens an evidence card listing each finding: stance and metric, text, and source with credibility dots. Cards are tinted by stance. The card sits below the hypothesis, or above it near the bottom of the window.

On phones the columns stack with indentation.

## 6. Interactions

Hypotheses take keyboard focus (Tab), and the evidence card opens on focus as well as on hover. Agent-changed nodes show the change dot and note.

## 7. Render contract

| Item | Limit |
|---|---|
| Tree shape | exactly one question; 2–5 branches; 1–5 hypotheses per branch (I15) |
| Text | node text ≤ 100 chars; `analysis` ≤ 60; branch `answer` ≤ 120 |
| Required fields | branches need an `answer`, used by the presentation builder's key line; hypotheses need `status` and `analysis` (I15) |

## 8. Agent actions for the demo

**A. Add a hypothesis under "Can it scale across all nine markets?"**

```json
{ "agent": "story_builder", "reason": "Data gaps in two markets need their own test",
  "ops": [ { "op": "create", "table": "issue_nodes", "record": { "parent_id": "in-07", "kind": "hypothesis", "order": 2, "text": "CRM gaps in the two markets can be fixed within three months", "status": "open", "analysis": "IT remediation plan and effort estimate" } } ] }
```

Expected effect:
- A new Open hypothesis appears second under branch 2, and the existing one renumbers to 3.
- The block title reads "5 of 11 hypotheses confirmed".
- Its evidence card says no evidence has been linked yet.

**B. Re-word a branch answer for the key line.**

```json
{ "agent": "story_builder", "reason": "Answer aligned to the value bridge",
  "ops": [ { "op": "update", "table": "issue_nodes", "id": "in-02", "set": { "answer": "Yes: {value.net_impact} of EBIT a year from more calls and better targeting" } } ] }
```

The answer is shown in the presentation builder's key line, with the placeholder filled from the value bridge.

**C. Rejected: a branch without an answer.** Creating `{ "parent_id": "in-01", "kind": "branch", "order": 5, "text": "Who should own it?" }` returns I15: "branch needs an answer".

## 9. Acceptance checks

- The seed shows 4 branches and 10 hypotheses, and the title "5 of 10 hypotheses confirmed, 1 refuted".
- "Value lever: More calls +28" appears under the first hypothesis.
- Hovering "CRM data quality is sufficient in all markets" shows one refuting finding from the CRM activity extract.
- Demo writes A and B commit; C is rejected.
