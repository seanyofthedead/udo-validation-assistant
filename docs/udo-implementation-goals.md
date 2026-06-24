# UDO Implementation Goals — DHS HQ UDO Review Platform

> Companion to [`udo-process-audit.md`](./udo-process-audit.md). This is the execution
> backlog: prioritized goals, acceptance criteria, status, and a running implementation log.
>
> **Priority order:** P0 (process accuracy & demo coherence) → P1 (operational enhancement) →
> P2 (polish). **Status values:** NOT STARTED · IN PROGRESS · COMPLETE · BLOCKED.
>
> **Global guardrails (every goal):** additive only — no Phase 1 regression; new `UdoRecord`
> fields optional; `src/domain` stays pure (no clock/random); mandatory reason on any new
> human disposition; never auto-post; `npm run gate` green before a goal is marked COMPLETE.

---

## Backlog at a glance

| ID  | Title                                             | Priority | Status      |
| --- | ------------------------------------------------- | -------- | ----------- |
| G1  | UDO Process Map screen                            | P0       | COMPLETE    |
| G2  | Federal data realism on UdoRecord + seed + Detail | P0       | COMPLETE    |
| G3  | Reviewer validity-determination vocabulary        | P0       | COMPLETE    |
| G4  | Platform framing / terminology                    | P0       | COMPLETE    |
| G5  | Record-level evidence posture                     | P1       | NOT STARTED |
| G6  | Suggested determination + draftable rationale     | P1       | NOT STARTED |
| G7  | Certification / attestation artifact              | P1       | NOT STARTED |
| G8  | Named owner/role routing on assignments           | P1       | NOT STARTED |
| G9  | "Why this matters" value framing                  | P2       | NOT STARTED |
| G10 | Generic action-item tracking                      | P2       | NOT STARTED |
| G11 | Cycle-time & funds-recovered metrics              | P2       | NOT STARTED |

---

## P0 goals

### G1 — UDO Process Map screen

- **Priority:** P0
- **User problem:** A stakeholder cannot see the end-to-end UDO process, who acts at each
  step, what evidence each decision needs, or how the product replaces manual effort. The
  capability is spread across 13 nav buttons with no narrative spine.
- **DHS HQ process alignment:** Makes all ten lifecycle steps (intake → continuous monitoring)
  explicit and maps each to a role, the evidence required, and the screen that performs it.
- **Product enhancement:** New first screen "UDO Process Map" — a ten-step walkthrough with
  role, evidence, the linked product screen, and a **manual pain → product enhancement** line
  per step. Becomes the spine of every demo.
- **Files likely impacted:** `src/screens/UdoProcessMap.tsx` (new), `src/screens/registry.ts`,
  `src/screens/AppShell.tsx`, `src/screens/index.ts`, `src/screens/UdoProcessMap.test.tsx`
  (new), `src/index.css` (minor).
- **Acceptance criteria:** screen renders all 10 steps with role + evidence + linked screen;
  each step shows a manual→automated value line; a step's "Open" link navigates to the mapped
  screen; appears first in the nav.
- **Validation method:** RTL test asserts 10 steps render, the value lines are present, and a
  navigate link calls into the router; `npm run gate` green.
- **Status:** COMPLETE

### G2 — Federal data realism on UdoRecord + seed + Detail

- **Priority:** P0
- **User problem:** Records don't read like federal financial data — missing line number, TAS/
  appropriation, fiscal year, object class, contracting office, named owner/role, invoice and
  acceptance status. A budget analyst wouldn't recognize a row as a real UDO line.
- **DHS HQ process alignment:** Steps 2 (inventory), 5 (evidence/research), 6 (determination)
  all depend on these fields being present and visible.
- **Product enhancement:** Add optional federal fields to `UdoRecord`; populate all seed
  records with clearly-mock-but-realistic values; surface them in UDO Detail's obligation
  record.
- **Files likely impacted:** `src/domain/types.ts`, `src/data/seed.ts`, `src/screens/Detail.tsx`,
  `src/data/seed.test.ts` (extend), `src/screens/Detail.test.tsx` (extend).
- **Acceptance criteria:** every seed record carries the new fields; `tsc --noEmit` clean (fields
  optional ⇒ no other construction site breaks); Detail renders TAS, appropriation, FY, object
  class, contracting office, owner+role, invoice & acceptance status; existing seed structural
  snapshot unchanged (amounts/status/component/evidence untouched).
- **Validation method:** seed test asserts new fields present and well-formed on all records;
  Detail test asserts the fields render; `npm run gate` green, no Phase 1 regression.
- **Status:** COMPLETE

### G3 — Reviewer validity-determination vocabulary

- **Priority:** P0
- **User problem:** The reviewer can only confirm/override the AI's _assessment_ verdict; they
  cannot record the federal _disposition_ decision (Valid / Liquidate / De-obligate / Closeout
  required / Needs research / Escalate) that drives the actual next action.
- **DHS HQ process alignment:** Step 6 (validity determination) — the heart of the process.
- **Product enhancement:** Add a "Reviewer determination" block to the Review Workspace with
  the six federal categories and a mandatory justification, recorded as a disposition and an
  audit event. Additive `RECORD_DETERMINATION` action + optional `Disposition.reviewDecision`.
- **Files likely impacted:** `src/domain/types.ts`, `src/state/store.ts`,
  `src/screens/ReviewWorkspace.tsx`, `src/state/store.test.ts` (extend),
  `src/screens/ReviewWorkspace.test.tsx` (extend).
- **Acceptance criteria:** six determination options selectable; an empty justification is
  rejected (no-op, no audit), mirroring the override guard; a recorded determination appears in
  disposition history and the audit trail; the existing confirm/override paths are unchanged.
- **Validation method:** store unit test (empty reason no-op; valid determination appends one
  disposition + one audit event); RTL test records a determination and finds it in history +
  audit; `npm run gate` green. The new justification field is labeled "Justification" (not
  "Reason") so the existing `getByLabelText(/Reason/i)` override tests stay unambiguous.
- **Status:** COMPLETE

### G4 — Platform framing / terminology

- **Priority:** P0
- **User problem:** The header reads as a Phase 1 "validation assistant," underselling the
  department-wide review platform the product has become.
- **DHS HQ process alignment:** Sets the executive frame; ties the header to the OCFO mission.
- **Product enhancement:** Reframe the header to "DHS HQ UDO Review Platform — Headquarters-led,
  risk-based review of undelivered orders," preserving the validation-assistant lineage in the
  subtitle; add concise "why this matters" value lines on the Process Map.
- **Files likely impacted:** `src/screens/AppShell.tsx`, `src/screens/UdoProcessMap.tsx`,
  `src/screens/AppShell` tests if any assert the title.
- **Acceptance criteria:** header reflects the platform scope; no test that asserts the old
  exact title breaks (update such a test in lockstep if present); subtitle keeps the as-of date.
- **Validation method:** visual + `npm run gate` green.
- **Status:** COMPLETE

---

## P1 goals (recommended next)

### G5 — Record-level evidence posture

- **Priority:** P1 · **Status:** NOT STARTED
- **User problem:** Reviewers see per-item present/absent, not whether a line's evidence as a
  whole is complete, missing, inconsistent, or needs review.
- **Process alignment:** Step 5 (evidence collection & research).
- **Enhancement:** Pure `evidencePosture(udo, evidence, rule)` →
  COMPLETE / MISSING / INCONSISTENT / NEEDS_REVIEW; surface as a badge in Detail/Review.
- **Files:** `src/domain/engine.ts` (or new `evidence.ts`), `src/components`, Detail/Review,
  tests. **Acceptance:** posture derives deterministically from evidence + CRG required set;
  badge renders; tests cover each posture. **Validation:** unit + RTL; gate green.

### G6 — Suggested determination + draftable reviewer rationale

- **Priority:** P1 · **Status:** NOT STARTED
- **User problem:** Reviewers start the determination from a blank box.
- **Process alignment:** Step 6. **Enhancement:** deterministic `suggestDetermination(finding,
deobFlag)` pre-selects a determination and drafts an editable rationale; the human still
  decides and must keep a non-empty justification. **Files:** new domain helper, ReviewWorkspace,
  tests. **Acceptance:** suggestion never auto-submits; rationale is editable; mandatory-reason
  discipline intact. **Validation:** unit + RTL; gate green.

### G7 — Certification / attestation artifact

- **Priority:** P1 · **Status:** NOT STARTED
- **User problem:** No explicit "reviewed and certified as of date" record for audit.
- **Process alignment:** Step 7. **Enhancement:** `Certification { scope, period, certifiedBy,
certifiedAt, lineCount, decisionSummary }`; a certify action over a reviewed slice; surface a
  "certified as of" status + export. **Files:** types, store, a Certification view, export, tests.
  **Acceptance:** certification appends one audit event, captures reviewer/date/decision summary,
  is exportable; never auto-certifies. **Validation:** unit + RTL; gate green.

### G8 — Named owner/role routing on assignments

- **Priority:** P1 · **Status:** NOT STARTED
- **User problem:** Assignments route to a component, not a named accountable owner/role.
- **Process alignment:** Step 4. **Enhancement:** carry `programOwner`/`ownerRole` (from G2)
  into assignment display and the component workspace so the accountable person is explicit.
  **Files:** assignment display, ComponentWorkspace, tests. **Acceptance:** owner + role show on
  assignments; **Validation:** RTL; gate green.

## P2 goals

- **G9 — "Why this matters" value framing** across triage/leadership screens (manual→automated
  callouts). NOT STARTED.
- **G10 — Generic action-item tracking** (contracting mod / invoice follow-up / receiving
  confirmation) beyond de-ob + escalation. NOT STARTED.
- **G11 — Cycle-time & funds-recovered leadership metrics** on the Portfolio view. NOT STARTED.

---

## Running implementation log

> Newest first. Each entry: goal, change, validation.

- **2026-06-24 — Audit + backlog created.** Inspected the repo (Waves 0–9, 350 tests green).
  Wrote `udo-process-audit.md` and this backlog. Conclusion: platform covers 9/10 process steps;
  gaps are legibility + federal fidelity, not missing capability. Prioritized P0 = G1–G4.
- **2026-06-24 — G2 COMPLETE.** Added 10 optional federal fields to `UdoRecord`
  (lineNumber, treasuryAccountSymbol, fiscalYear, appropriation, objectClass, contractingOffice,
  programOwner, ownerRole, invoiceStatus, acceptanceStatus); populated all 20 seed records with
  labeled-mock values; surfaced them in UDO Detail. Extended seed + Detail tests. Gate: see final.
- **2026-06-24 — G1 COMPLETE.** Added the `UDO Process Map` screen (10 steps · role · evidence ·
  linked screen · manual→automated value), wired into registry/nav/shell as the first screen,
  with an RTL test. Gate: see final.
- **2026-06-24 — G3 COMPLETE.** Added the six-category reviewer determination (Valid · Liquidate ·
  De-obligate · Closeout required · Needs research · Escalate) to the Review Workspace with a
  mandatory justification, a new additive `RECORD_DETERMINATION` store action, and
  `Disposition.reviewDecision`/`determinationReason`. Store + RTL tests added. Gate: see final.
- **2026-06-24 — G4 COMPLETE.** Reframed the header to the platform scope; value lines live on
  the Process Map. Updated the App shell title test in lockstep.
- **2026-06-24 — FINAL GATE GREEN.** `npm run gate` (typecheck + lint + build + test) passes:
  **51 files, 360 tests** (was 350; +10 new). No Phase 1 regression — golden path, seed band,
  determinism, and risk-model guards all still pass. P0 (G1–G4) complete.
