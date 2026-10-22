# View: Model builder

File `views/model-builder.html` · view key `model_builder` · agent `model_builder` · audience: team

## 1. Purpose and user

Shows the business-case spreadsheet behind the value estimator, and whether the value bridge still matches it. Used by the consultant who owns the model and by the engagement manager before any client meeting. The model builder agent edits inputs and writes the recomputed calculations and outputs.

There is no formula engine in the demo. The agent computes values itself and writes them together with the formula text.

## 2. Questions answered

- What are the inputs, where do they come from, and how is each lever calculated?
- What does the model say about 2028 EBIT, NPV and value per rep?
- Does the value bridge still show what the model says?

## 3. Data read

| Table | Fields |
|---|---|
| `engagement` | `currency` |
| `model_cells` | `sheet`, `ref`, `label`, `kind`, `value`, `decimals`, `unit`, `formula`, `note` |
| `value_steps` | `order`, `label`, `kind`, `value`, `model_cell_id` |
| `value_settings` | `npv_base`, `npv_cell_id` |

## 4. Derived values

| Value | Rule |
|---|---|
| Row number | the digits of `ref` (C4 is row 4); empty rows up to the last used row are drawn, and row 2 carries the sheet name |
| Display value | `value` rounded to `decimals` |
| Formula links | each `Sheet!C7` or `C7` reference in a formula links to that row |
| Link status | for a start or delta step, matches if the step value and cell value agree to one decimal; for a subtotal, matches if the derived bridge level and the cell value differ by ≤ 0.5; the NPV link compares `npv_base` with the rounded cell value |

## 5. Layout and visualisations

1. **Workbook (left, about two thirds).**
   - Three sheets (Inputs, Calculations, Outputs), each drawn as a spreadsheet with a sheet tab, row numbers and columns B (label), C (value), D (unit) and E (formula or source note).
   - Input values are blue, following financial-modelling convention.
   - Output rows are bold on a red tint.
   - Wide sheets scroll inside their block.
2. **Model → value view (right).**
   - One row per bridge step linked to a model cell, plus the NPV used by the sensitivity chart.
   - Each row shows the bridge item, the linked cell, the value in the view, the value in the model, and ✓ or ≠.
   - The title states how many links differ.

## 6. Interactions

Formula references and cell links jump to the referenced row, which is outlined. Agent-changed rows show the change marker.

## 7. Render contract

| Item | Limit |
|---|---|
| Rows | ≤ 80; `ref` C4–C59, unique per sheet (I20) |
| Labels and units | labels ≤ 44 chars; units ≤ 8 |
| Formula and note | formula ≤ 120; note ≤ 60 |
| Formula rule | input rows have no formula; calc and output rows must have one; every reference must resolve (I20) |

A differing link is warning W01 or W02, never an error. The model and the view may disagree for a while; the view makes it visible.

## 8. Agent actions for the demo

**A. A lower next-best-action uplift.** The pilot re-analysis gives 4%, not 5%. The agent changes the input and writes every value that depends on it:

```json
{ "agent": "model_builder", "reason": "NBA conversion uplift revised to 4% after control-group correction",
  "ops": [
    { "op": "update", "table": "model_cells", "id": "mc-10", "set": { "value": 4 } },
    { "op": "update", "table": "model_cells", "id": "mc-25", "set": { "value": 17.6 } },
    { "op": "update", "table": "model_cells", "id": "mc-30", "set": { "value": -9.2872 } },
    { "op": "update", "table": "model_cells", "id": "mc-32", "set": { "value": 47.3433 } },
    { "op": "update", "table": "model_cells", "id": "mc-33", "set": { "value": 422.3433 } },
    { "op": "update", "table": "model_cells", "id": "mc-34", "set": { "value": 154.7753 } },
    { "op": "update", "table": "model_cells", "id": "mc-35", "set": { "value": 19.7264 } }
  ] }
```

Expected effect:
- Seven rows flash.
- The link panel title becomes "4 of 12 links differ": next-best action, adoption haircut, Target 2028 and NPV.
- W01 and W02 are returned.
- The value estimator agent then aligns the bridge (value estimator demo A plus `vs-10` = −9.3).

Before it can set `npv_base` to 155, it must re-run the sensitivity drivers in the same batch. Otherwise drivers whose downside is above 155 break I19.

**B. Add an input row.**

```json
{ "agent": "model_builder", "reason": "Wave timing made explicit",
  "ops": [ { "op": "create", "table": "model_cells", "record": { "sheet": "Inputs", "ref": "C26", "label": "Months to full rollout", "kind": "input", "value": 18, "decimals": 0, "unit": "months", "note": "Three waves, gated" } } ] }
```

**C. Rejected: a formula that points nowhere.** Setting `formula` on `mc-25` to `Inputs!C12*Inputs!C40/100` returns I20: "formula references missing cell Inputs!C40".

## 9. Acceptance checks

- The seed shows Inputs rows 4–25, Calculations rows 4–13 and Outputs rows 4–6.
- Outputs read 426, 168 and 21.2.
- The link panel reads "All 12 links match the model".
- After demo write A the panel shows 4 differing links. After the value estimator aligns the bridge (two steps) and the sensitivity, all match again.
