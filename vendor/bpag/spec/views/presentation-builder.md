# View: Presentation builder

File `views/presentation-builder.html` · view key `presentation_builder` · agent `presentation_builder` · audience: client

## 1. Purpose and user

Shows the current client deck and the storyline it carries. The deck is a PDF, generated outside the environment (here with Oria) and referenced by URL. The storyline follows the pyramid principle and sits next to it, so the team can see at once whether every answer has a slide. Used by the engagement manager and partner before SteerCo and board meetings. The presentation builder agent maintains the deck record and the slide list; the story builder agent maintains the storyline.

## 2. Questions answered

- What does the deck look like, slide by slide?
- What does each slide claim, and which part of the storyline does it carry?
- Does every key-line answer have a slide, and is the governing thought on a slide?

## 3. Data read

| Table | Fields |
|---|---|
| `engagement` | `currency` |
| `deck` | `title`, `version`, `date`, `status`, `pdf_url` |
| `slides` | `number`, `section`, `title`, `issue_node_id`, `status` |
| `issue_nodes` | `parent_id`, `kind`, `order`, `text`, `answer`, `status` |
| `narratives` | `view`, `slot`, `text` |
| `value_steps` | `order`, `kind`, `value` |
| `value_settings` | `annotation_from_id`, `annotation_to_id` |

## 4. Derived values

| Value | Rule |
|---|---|
| PDF location | `pdf_url` as given if it starts with http(s); otherwise relative to the package root |
| Page count | from the PDF; the slide list's count when the PDF cannot be loaded |
| Slides per storyline element | slides whose `issue_node_id` is the branch or one of its hypotheses; slides on the question carry the governing thought |
| Storyline gaps | key-line answers (branches) with no slide (block title) |
| Placeholders | `{value.net_impact}`, `{value.target}` from the value bridge exactly as in the value estimator; `{hypotheses.confirmed}`, `{hypotheses.total}` from the issue tree |

## 5. Layout and visualisations

1. **Deck viewer (left, about two thirds).**
   - The PDF is rendered page by page at 16:9 with pdf.js (cdnjs, version 3.11.174, main-thread mode).
   - Previous and Next buttons, a "Slide n of N" counter and a link to open the PDF.
   - If the PDF cannot be loaded, the stage shows the slide's section and action title from the data, so the view never goes blank.
2. **Slides (right).** One entry per slide: number, action title, status pill, section and the storyline element it carries ("Not on the storyline" for the cover). Selecting an entry shows that page.
3. **Storyline (full width).**
   - The governing thought, with placeholders filled and chips for the slides carrying it.
   - The key line: one card per branch, with the branch question, its answer and the slides carrying it.
   - A branch with no slide is drawn with a dashed border and an amber "No slide yet" chip.

## 6. Interactions

- Previous and Next, and selecting a slide in the list, move the viewer.
- Agent-changed slides, the deck record and storyline text show the change marker.

## 7. Render contract

| Item | Limit |
|---|---|
| Deck | exactly one record (I26); title ≤ 80; version ≤ 10; `pdf_url` ≤ 300 |
| Slides | 1–30, numbered 1..n (I23); title ≤ 110; section ≤ 24 |
| Governing thought | narrative slot `presentation_builder/governing_thought`, fixed, ≤ 220 chars, placeholders allowed |
| Branch answers | ≤ 120 chars, placeholders allowed (I15, I22) |

The presentation builder agent writes `deck` and `slides`. The story builder agent writes the governing thought and the branch answers, and may also re-map slides (`title`, `issue_node_id`).

## 8. Agent actions for the demo

**A. Close the storyline gap: give the risks answer its own slide.**

```json
{ "agent": "story_builder", "reason": "Risk slide carries the risks answer; feasibility moves to the summary",
  "ops": [ { "op": "update", "table": "slides", "id": "sl-05", "set": { "issue_node_id": "in-10" } } ] }
```

Expected effect:
- The "Are the risks manageable?" card gains "Slide 5" and loses its dashed border.
- The feasibility card shows "No slide yet".
- The title still reads "1 of 4 key-line answers have no slide yet", showing the trade-off.

**B. Publish a new deck version after the partner's review.**

```json
{ "agent": "presentation_builder", "reason": "Partner review comments applied; ready for SteerCo",
  "ops": [ { "op": "update", "table": "deck", "id": "dk-01", "set": { "version": "v1.1", "status": "final", "date": "2026-10-28" } },
           { "op": "update", "table": "slides", "id": "sl-06", "set": { "status": "final" } } ] }
```

**C. Rejected: a gap in slide numbers.** Creating a slide with `"number": 9` while there are 6 slides is renumbered by the tool to 7. Deleting slide 3 renumbers the rest. Numbers can never have gaps (I23).

## 9. Acceptance checks

- With `deck/scale-up-proposal.pdf` present, the viewer shows 6 pages and "Slide 1 of 6"; selecting slide 4 shows the value bridge page.
- Without the PDF, the stage shows each slide's title and the note that the PDF is not available.
- The storyline title reads "1 of 4 key-line answers have no slide yet" (the risks branch).
- The governing thought reads "…the pilot proved €51m of annual EBIT…" and carries Slide 2.
- Demo writes A and B commit.
