# Documentation Rulebook

| Status | Version | Owner | Last updated |
| --- | --- | --- | --- |
| Current | 1.0 | Nela | 2026-10-13 |

The project's document rules, in three layers that are read together and never restate each other:

1. **Part A — Content shape.** What a document's content should look like, by genre.
2. **Part B — Context budget.** How much of it loads into a session, and when a growing doc splits.
3. **Part C — Lifecycle.** How many docs a project should have, what each is called, what status it
   carries, and how whole docs retire.

A gap in one Part isn't patched by repeating another's content — it's cross-referenced. Jump by
Part and section; this is not a cover-to-cover read.

**This doc ships with profiles M and L.** Profile S inlines Part A's core rule into its `CLAUDE.md`
and skips the rest — a project with no sweep should carry only rules that survive without one.

**Scope note.** This governs documents written for people. Instructions written for an *agent*
(`CLAUDE.md`, memory, guardrails) are governed by `instruction_design.md` — different reader,
different failure modes.

---

## Part A — Content shape

### The core rule

**A document's body says what is true now. History goes in one place, at the end, newest first,
compressed — except that a source citation is never compressed away.**

### Sorting "this changed" content

Two independent questions, not one:

1. **Is it still true?** Does the current design match this content, or has it been superseded?
2. **Does it need a source?** Could someone reasonably ask "how do we know this", and would the
   answer matter? Client-supplied facts, compliance and legal constraints, and anything the client
   could later dispute all need one. An internal judgment call or a reversible working decision
   usually doesn't.

| | **Needs a source** | **No source needed** |
|---|---|---|
| **Still true** | **Body, cited.** State it as fact with a short inline attribution: *"Data residency is a hard constraint: `<REGION>` only (`<CLIENT>`, `<DATE>` meeting)."* | **Body, uncited.** State it plainly: *"Write-back target = comments."* |
| **No longer true** | **History footer, compressed — keep the citation.** The line shrinks; the source doesn't. Losing the attribution would quietly reframe a client correction as our own bad guess. Those are different facts and only one is true. | **History footer, compressed, or dropped.** If a rejected option will never be revisited, delete it rather than log it. |

The distinction that matters in practice isn't "client versus us" — it's whether the **correction
itself** needs to survive compression.

### Worked example

**Before** — one fact argued three times, with "why we used to think differently" tangled into
"what's true now":

> ⚠ Not reconciled… this section's decided API-only path and the budget math below predate two
> later signals: (1) the `<DATE>` decision row, (2) `<CLIENT>`'s own confirmation that no rate
> limits apply, which supersedes our earlier assumption… *[then repeated under two more headings]*

**After:**

> **Current state:** API only, for both reads and writes. **Unresolved:** `<CLIENT>` has indicated
> no rate limits apply and access may run via the database instead — this removes the rationale the
> API-only decision was built on and may reverse it. Not decided either way.
>
> **History**
> - **`<DATE>` (`<CLIENT>`): "no rate limits apply."** Superseded the budget the read path was
>   built on. See "Unresolved" above; not assumed here.
> - `<DATE>` — write-back target chosen over two alternatives.

One clean statement of current state plus what's unresolved; the client-sourced correction keeps a
full attributed line in History; the purely internal choice gets a clause with no citation, because
nobody needs to trace it to trust it.

### §1. Spec and plan docs

*Describes a system's current design; changes by revision; has discrete versions worth naming.*

1. **Header table** — `| Status | Version | Owner | Last updated |`. Status is a short
   current-state pill from Part C §3. "Last updated" is the date of the last real change, not of a
   cosmetic edit.
2. **A short orientation note directly under the header** — either what is live right now, or how to
   read this doc. One place, not scattered.
3. **Body = current state only.** No inline dates, no "was X, now Y" narration, no struck-through
   spans woven into live prose.
4. **A changelog at the foot, newest first, one line per version**, pointing at the detail rather
   than restating it:
   ```markdown
   **Changelog** (rationale in DECISIONS.md; file history in git)
   - v1.3 (<DATE>) — <one line>. → DECISIONS.md <DATE>
   ```
   Update `Status` / `Version` / `Last updated` and append the line **in the same change as the
   work**. Deferring it to a later pass is how docs go stale.
5. **Unbuilt or future work gets its own labelled section** (`Draft only — NOT built`, `PARKED`) so
   it is never mistaken for as-built state.
6. **Once a changelog grows long**, move fully superseded entries into a collapsed `<details>`
   block at the foot, newest first inside it too.
7. **Rationale lives in exactly one place** per the project's decision tiers. Cross-reference the
   other tiers; never restate their reasoning.
8. **Proposals** sit flat in the docs folder at `Draft`, with no `proposal_` prefix. A subfolder
   only once there are three or more.
9. **Doc-level status and section-level maturity are two axes, not one field.** The header answers
   "is this artifact retired, or the live source of truth for its scope?" — a whole-doc question. It
   cannot also answer "is every part equally settled", which has a different answer per section. Use
   an inline maturity tag where it applies (`— DRAFT` on a section heading). Dragging a whole doc to
   `Draft` because some sections are unsettled hides that most of it is solid; leaving it `Current`
   with no markers overclaims certainty. Both are wrong the same way: one field, two questions.

### §2. Decision and log docs

*Append-only; no versions of the whole document; evolves by adding entries.*

**Do not apply §1's header table or changelog rules to these** — a version field on a log that never
versions is cosmetic. Each gets its own short "how to use" note instead.

1. **Ordering matches purpose, not one universal rule.** A decision log is newest-first (scanned
   top-down for the latest). A conversation-style channel is chronological and appended at the
   bottom. A tracking table is grouped by category and updated in place, not date-ordered at all.
2. **Add-only, superseded-forward — never edit history in place.** A changed decision gets a new
   entry; the old one's status flips to superseded with a forward link, and moves to a collapsed
   block at the foot on the next sweep.
3. **Every entry cites what it affects**, instead of the affected doc restating the reasoning.
4. **These docs are the home of "why"** for their tier. Nothing points away from them for rationale
   on a decision they cover.
5. **A tracking table's notes cell is one tight current-state paragraph**, never a mirrored
   changelog. State what the thing is, its status, and the single most salient recent fact. Full
   history belongs in the source doc's own changelog.

### §3. Handoff and session-start docs

*Read fresh at the start of most sessions. Not amended like a spec, not accumulated like a log — but
it feels like both, which is why this genre relapses fastest.*

1. **No whole-doc status header.** A handoff doc's currency is definitional — it is read fresh every
   session by design — so a status field is cosmetic. A plain "Updated `<DATE>`" line is enough.
2. **At close-out, edit the current-state sections in place. Never append a dated block.** A closing
   session naturally wants to record what it did, and that block restates what the doc's own
   current-state sections already say. This is the single most common failure in this genre.
3. **A narrative note worth keeping goes straight to the sidecar log**, in the same session — not
   staged in the handoff "to be moved later". Staging is how it re-accumulates.
4. **One exception:** a short "recent changes" pointer at the top, three to five lines, **overwritten
   each time** rather than appended to.

### Maintenance triggers

So that these rules describe a routine and not a one-time cleanup:

1. **An "apply this to doc X" action from another doc becomes tracked debt** in the document log, not
   a line buried inside the source doc, so the sweep surfaces it.
2. **The sweep checks**: any client or meeting notes since last time — reconciled into the relevant
   spec doc yet?
3. **A decision-log entry that references a spec doc is a trigger, not just a citation** — check
   that section the same session.
4. **A compliance check is a point-in-time result, not a standing guarantee.** Re-check a genre's
   worst offender rather than assuming last month's pass still holds.

---

## Part B — Context budget

Some context loads into every session whether or not it is relevant; the rest is supposed to be read
on demand. Bloat happens when that boundary isn't enforced. The fix isn't periodic trimming — that
treats the symptom — it's making the two categories explicit and giving the on-demand category an
objective split trigger.

### §1. Automatic versus controllable

**Automatic** (the agent harness handles these; no convention needed): conversation compaction;
`CLAUDE.md` files loading at session start, with nested ones adding only when work touches their
subtree; a memory index loading in full every session while individual memories load on relevance;
tool and skill definitions fetched on demand, so an unused capability costs nothing; subagents, whose
intermediate work stays in their own context and return only a final report.

**Controllable** (what this Part governs):

- **Targeted reads.** Search or read a slice rather than the whole file. This works *only if the file
  is structured for it* — clear section headers, a stated read pattern. That is an authoring duty,
  not a reader habit.
- **Current-state versus history placement** (Part A). A doc that follows it is cheap to read whole,
  because whole is short.
- **Objective size and staleness triggers** (§2).
- **Closing finished work.** Idle parallel sessions cost coordination attention even when they cost
  no context.

### §2. Explicit triggers, not discretion

Every doc read on demand carries a one-line note near its top saying how to read it and what its
split trigger is — a concrete condition, not "when it feels big". One row per doc type from Part C
§1, so this table and the taxonomy cannot drift apart.

| Doc type | How to read it | Split or archive trigger |
|---|---|---|
| **Reference/spec** | Jump to the relevant section by heading; not cover-to-cover. Only works if headers stay organised per topic. | **No line cap** — these are meant to stay whole. If one *section* grows too large to read in a single call, split that section out, not the doc. |
| **Append-only log** | Query by date or topic; never read start to end. | No size cap. The trigger is whether the top-of-file pointer is still accurate enough to find the right entry without reading everything. |
| **Session/handoff** | Read in full at session start. | Move narrative to the sidecar once it passes roughly **150–200 lines**. The entry point must be readable in one call. |
| **Tracking table** | Scan rows; don't read narratively. | Staleness, not size: if a row hasn't been checked against the thing it describes in about a week, that's the sweep signal. |
| **Evaluation/exploration** | Read once, to extract its conclusion. | No split trigger — bounded shelf life instead. Retire it per Part C §5 once its conclusion is absorbed. |

### §3. The always-loaded ceiling

The root `CLAUDE.md` and the memory index are the only documents **guaranteed** to be read every
session. Everything else is a hope. So they get a stated budget — **≤ 120 lines** and **≤ 40 lines**
— and they spend it on rules, never on history or on defending past decisions. Full reasoning in
`instruction_design.md`.

---

## Part C — Lifecycle

**The real mechanism behind staleness:** docs don't go stale because there are too many of them.
They go stale because **the same fact becomes knowable from more than one place that can disagree**
— a fact restated instead of linked. Doc *count* isn't the risk; doc *overlap* is. Four reference
docs each owning a distinct domain is fine. Two docs partially covering one domain is the risk,
however few docs exist in total.

**The honest limit of everything below.** A written rule not paired with either a hard constraint or
a mechanical check decays under time pressure, even when everyone agreed with it going in. A
scheme's job is to make violations catchable at the next sweep, not to prevent them between sweeps.
No naming or folder convention does that by itself. Hence §7.

### §1. Five doc types, not more

Every new doc should map to one of these. If it doesn't obviously fit, that is a signal to fold it
into an existing doc rather than mint a category.

1. **Reference/spec** — current state only, amended in place, one compressed changelog at the foot.
   One per real domain, not one per feature or session.
2. **Append-only log** — never read start-to-end; queried on demand.
3. **Session/handoff** — current-state body, a bounded "recent changes" pointer, no accumulating
   narrative. Highest-risk type: edited most often, under the most time pressure.
4. **Tracking table** — one row per tracked thing, updated in place, not narrated.
5. **Evaluation/exploration** — exists to produce a decision, not to be an ongoing reference.
   Bounded shelf life *by design*: once its conclusion is captured in a log or in the reference doc
   it informed, its job is done. Retired outright, not kept. **Location follows what is being
   evaluated:** build-specific evaluation lives with the code; broader or strategic evaluation lives
   in the non-git reference location.

### §2. Naming

- **Reference docs:** stable name, no date in the filename. Version and status live in the header —
  a dated filename implies a snapshot and invites "which one is current?"
- **Genuinely one-per-occurrence docs** (meeting agendas, sweep records): a date in the filename is
  correct; it is a real point-in-time artifact.
- **`_temp` suffix:** keep it, and give every temp file an explicit decision — promoted or deleted —
  within a bounded window rather than letting it sit indefinitely.
- **Superseded docs: move the file**, don't just annotate it. A header note only protects someone who
  opens and reads it; a move protects someone browsing who would otherwise trust stale content by
  default.

### §3. Status vocabulary — two ladders, picked by doc type

A fixed, small vocabulary, stated in the header table of every doc that has one. **This is the single
definition; no other file restates it, they link here.**

**Scope: documents, not rows.** This vocabulary is the status of a *document*. A status column
*inside* a tracking table — a findings tracker's `Open` → `Verified`, a tool list's `planned` /
`built` — is that table's own lifecycle and is not governed here. Don't rewrite row statuses to
match; only the doc's own header carries this vocabulary.

It is not one ladder. Living docs and static plans have different lifecycles, so the doc's type picks
its ladder:

| | Ladder | Terminal state |
|---|---|---|
| **Living docs** — reference/spec, catalog, framework, phase status | `Draft` → `Current` → `Closed` | `Closed` — its subject ended (a phase closing), kept for record |
| **Static plans** — one-time, executable, possibly in batches | `Draft` → `Proposed` → `Approved` → `In progress` → `Executed` | `Executed` — it was carried out |

**Shared exits**, available from either ladder: `Superseded` (replaced — a forward link to the
replacement is required) and `Dropped` (decided against, nothing carried out — a one-line reason plus
a pointer to the decision record is required).

Nine words in total, but a doc's type limits it to four or five.

- **A living doc never reaches `Executed`** — there is nothing to execute. It is amended in place.
- **A static plan never sits at `Current`.** While it is being carried out it is `Approved` (signed
  off, not started) or `In progress` (started, not finished). Once carried out it is `Executed`.
- **Why the distinction:** status tracks where a doc sits in **its own lifecycle**, not whether its
  content is trustworthy. Trust is answered by the doc not being `Superseded`. Collapsing `Approved`
  and `In progress` into `Current` makes one field answer two questions — the error §1 rule 9 of
  Part A exists to prevent.
- **Enforcement, stated honestly.** `Draft`, `Current`, `Closed`, `Executed`, `Superseded` and
  `Dropped` are mechanically checkable: a hook can verify the state belongs to the doc's ladder and
  that a retired doc has moved. **`Approved` and `In progress` are sweep-enforced only** — nothing
  can detect sign-off or "work started", so the change that does either flips the status in the same
  change, with the weekly sweep as backstop. The failure mode to watch is a doc frozen at `Proposed`
  or `Approved` while work is underway. If that recurs, the field has stopped carrying information
  and should be cut rather than tolerated.

Freeform status prose reads fine one doc at a time but cannot be scanned across every header in one
pass — which is what makes a sweep cheap enough to actually do.

### §4. Folders

| Status | Where it lives |
|---|---|
| `Draft`, `Proposed`, `Approved`, `In progress`, `Current` | top level of the docs folder |
| `Executed`, `Closed`, `Superseded`, `Dropped` | `archive/` |

The doc moves in the **same change** that sets the status, and live links to it are fixed in that
change. Append-only logs and code comments are not rewritten — find the doc by filename.

### §5. Retiring a whole doc — archive or delete?

Depends on whether version control backs it.

- **Git-backed docs:** deleting is safe, because the content is recoverable. Prefer deletion for
  evaluation/exploration docs whose conclusion has been absorbed — keeping them invites someone to
  read a superseded conclusion as current.
- **Docs with no fine-grained history** (a synced drive, a wiki): **move to `archive/`, never
  delete.** Archived docs stay true and worth keeping; they just aren't active work.

### §6. Making the routine actually run

Two mechanisms, because one isn't enough:

1. **A session-start hook** doing the cheap mechanical subset — aging temp files, missing headers, a
   status that doesn't match its folder or its ladder, an entry-point doc past its line trigger.
   Never blocks the session; any internal error exits silently.
2. **A fixed weekly day** for the manual sweep, with a written checklist and a named owner who is
   accountable for it running. Keep it to about 15 minutes. **If it grows its own overhead, cut it
   back** — a sweep nobody does is worth less than a shorter one that happens.

Scheduled background automation is deliberately not used: a doc sweep needs judgment, and a cron job
that produces findings nobody reads is overhead wearing a process costume.

### §7. Preventing proliferation — the honest part

None of the above stops someone creating an overlapping doc; it only makes the overlap catchable
later. The actual prevention is a **creation-time check**, before writing a new doc:

1. Does an existing reference doc already own this fact or topic? If yes, **amend it**.
2. If the scope is genuinely new, which of the five types (§1) is it?
3. If it doesn't fit a type, that's the signal to fold it in rather than mint a category.

This generalises the decision-tier rule — *if something seems to belong in two places, it goes in the
more specific one and the other links to it* — into a gate applied to every new doc, not just
decisions.

---

## Changelog

- v1.0 (2026-10-13) — Adopted from the Cantab Pi Project Kit, kit version 0.9.1 (pre-release).
