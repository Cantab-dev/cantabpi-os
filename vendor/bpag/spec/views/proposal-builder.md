# View: Proposal builder

File `views/proposal-builder.html` · view key `proposal_builder` · agent `proposal_builder` · audience: client

## 1. Purpose and user

Drafts the letter of proposal (LOP) for the follow-on engagement, here wave-1 rollout support. Fees are calculated from the proposed staffing and day rates, so the commercials can never contradict the text. Used by the partner; the proposal builder agent writes the sections and the staffing.

## 2. Questions answered

- What do we propose, to whom, and on what terms?
- What does it cost, and how is the cost built up?

## 3. Data read

| Table | Fields |
|---|---|
| `engagement` | `client`, `partner_id` |
| `people` | `name`, `title`, `rate_day` |
| `proposal` | `title`, `addressee_id`, `date`, `status` |
| `proposal_sections` | `key`, `order`, `title`, `text` |
| `proposal_staffing` | `person_id`, `days` |

## 4. Derived values

| Value | Rule |
|---|---|
| Fee per person | `days × rate_day` |
| Total fees, total days | sums over staffing |
| Blended day rate | total fees ÷ total days |
| Share of fees | fee per person ÷ total |
| Placeholders | `{fees.total}` (€k), `{fees.days}`, `{client.name}` |
| Signatory | the engagement partner |

## 5. Layout and visualisations

1. **Letter (left).** Rendered as a document:
   - letterhead with the Cantab Pi mark and a status pill
   - addressee block and date
   - title
   - the seven sections in order, each line of section text as its own paragraph
   - after the Fees section, a fee table (team member, role, days, day rate, fees, total)
   - sign-off by the partner

   Body text is set in a serif face.
2. **Commercials (right).** Professional fees, consultant days, blended day rate, and a share-of-fees bar with legend.

## 6. Interactions

None. Agent-changed sections and staffing rows show the change marker.

## 7. Render contract

| Item | Limit |
|---|---|
| Sections | exactly 7 fixed keys: context, objectives, scope, approach, team, fees, terms (I25); title ≤ 40; text ≤ 900 with placeholders |
| Staffing | 1–12 rows; consulting people only, each at most once (I25); days ≤ 250 |
| Proposal | title ≤ 80; addressee is a client person (I25) |

## 8. Agent actions for the demo

**A. Add data-science capacity for the CRM remediation.**

```json
{ "agent": "proposal_builder", "reason": "Data remediation in two markets needs more data-science time",
  "ops": [ { "op": "update", "table": "proposal_staffing", "id": "pf-05", "set": { "days": 60 } } ] }
```

Expected effect: Mei Tanaka's row shows 60 days and €144,000, the total becomes €933,600, and the Fees paragraph reads "€934k for 360 consultant days", with no text edit.

**B. Tighten the approach.**

```json
{ "agent": "proposal_builder", "reason": "Approach aligned to the gated wave plan",
  "ops": [ { "op": "update", "table": "proposal_sections", "id": "ps-04", "set": { "text": "Weeks 1-4: production readiness, CRM remediation in the two lagging markets and guardrail sign-off.\nWeeks 5-12: rollout in four cohorts with floor-walkers and weekly adoption reviews.\nWeeks 13-16: stabilisation, run-model handover and the wave-2 gate assessment." } } ] }
```

**C. Rejected: deleting a fixed section.** `{ "op": "delete", "table": "proposal_sections", "id": "ps-07" }` returns `scope`: the proposal builder may not delete sections. Sections are fixed records.

## 9. Acceptance checks

- The seed shows 7 sections and a fee table of 6 people totalling 340 days and €885,600.
- The Fees paragraph reads "€886k for 340 consultant days".
- The blended day rate is €2,605.
- Demo writes A and B commit; C is rejected.
