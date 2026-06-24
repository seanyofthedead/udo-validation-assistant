# UDO Process Audit — DHS HQ OCFO Undelivered Orders Review Platform

> **Auditor's framing.** This audit is written from three seats at once: a DHS HQ OCFO
> Undelivered Orders (UDO) process owner, a federal financial-management product auditor
> (obligation monitoring, validation, de-obligation, liquidation, internal controls, audit
> readiness), and the implementation lead for this repository.
>
> **Date:** 2026-06-24 · **Scope:** the shipped platform (Waves 0–9) measured against the
> end-to-end DHS HQ UDO review process. **Source of truth precedence:** repository
> `SPEC.md` → `docs/product-evolution-roadmap.md` → this audit's federal baseline.

---

## 1. Executive summary

The platform is **already a mature, department-scale, Headquarters-led UDO review system** —
not a generic invoice or task tracker. Across Waves 0–9 it ships: deterministic record-level
**validation** with explainable verdicts; an explainable **risk-scoring engine** and ranked
queue; **review campaigns** with per-component assignments and due dates; a **component
response** loop (concur / contest / correct) with mandatory reasons; **escalations**; a
**de-obligation opportunity lifecycle**; **portfolio** and **enterprise command-center**
leadership views; and a deterministic **forecast** of staleness — all behind an **append-only
audit trail**, **human-in-the-loop on every disposition**, and **explainability on every
machine output**. 350 tests pass; the gate is green.

Measured against the expected federal UDO workflow, the platform covers **9 of 10 process
steps** in substance. The gaps are not missing capability so much as **missing legibility and
federal fidelity**:

1. **No explicit end-to-end process map.** A stakeholder cannot see, in one place, the ten
   UDO lifecycle steps, which DHS role acts at each, what evidence each decision needs, and
   _which manual pain each product screen removes_. The capability exists; the **story** does
   not. This is the single biggest demo-coherence gap. **(P0)**
2. **Record data reads thinner than real federal financial data.** Records carry obligation
   number, vendor, amounts, status, and three dates — but **not** line number, Treasury
   Account Symbol / appropriation, fiscal year, object class, contracting office, COR /
   program owner (and role), invoice status, or receiving/acceptance status. A budget analyst
   would not recognize a row as a real UDO line. **(P0)**
3. **Reviewer "validity determination" is collapsed into the AI's assessment taxonomy.** The
   Review Workspace lets a human only _confirm_ or _override_ the AI verdict
   (VALID / QUESTIONABLE / INSUFFICIENT_EVIDENCE). The federal process asks the reviewer for a
   **disposition decision** — Valid · Liquidate · De-obligate · Closeout required · Needs
   research · Escalate — which is a different and more operational vocabulary. **(P0)**
4. **No first-class certification / attestation.** Dispositions + audit _approximate_
   certification, but there is no explicit "I reviewed and certify these UDOs as of this date"
   artifact a reviewer/certifier produces and leadership consumes. **(P1)**
5. **Evidence is per-item present/absent; there is no record-level evidence posture**
   ("evidence complete / missing / inconsistent / needs review") surfaced to the reviewer.
   **(P1)**

**Recommendation:** treat the platform as feature-complete for the demo and invest in
**fidelity and legibility** — a process map, realer data, federal disposition vocabulary, and
explicit certification — so the product unmistakably reads as a DHS HQ OCFO operational tool.

---

## 2. Current product assessment

**Architecture (sound; do not redesign).** `src/domain` holds pure, deterministic engines
(validation, QC, de-ob, anomaly, risk, campaign/assignment state machines, response,
escalation, de-ob lifecycle, portfolio aggregation, forecast, analytics), all free of React
and of wall-clock/random calls (a guard test enforces this). `src/state` is an immutable
store + reducer with an append-only audit log. `src/screens` + `src/components` are the UI;
`src/data` holds the deterministic seed; `src/export` does CSV/JSON Blob download.

**User journey today (13 screens).** Executive Dashboard → Portfolio Command Center →
Enterprise Command Center → UDO Inventory → High-Risk Queue → Stale Obligation Explorer →
Review Campaigns → Campaign Detail → Component Workspace → Escalations & De-Ob Tracker → UDO
Detail → Review Workspace → Reporting/Export.

**What is genuinely strong.**

- **Explainability everywhere.** Verdicts cite a CRG rule + confidence; risk scores break into
  eight attributable factors that sum to the score; forecasts are labeled "Projection" with a
  basis. This is exactly what an auditor wants.
- **Determinism.** A fixed `AS_OF_DATE` and pure engines make every number reproducible — the
  backbone of audit readiness.
- **Human-in-the-loop discipline.** Mandatory reason on override, contest, correct, and de-ob
  confirm/reject; the platform never auto-posts.
- **Lineage.** KPI → component → line → evidence/audit is wired in the portfolio views.

**What undercuts the federal story.**

- The header still reads **"UDO Validation Assistant — Independent second opinion on
  undelivered orders,"** which describes Phase 1, not the department-wide review platform the
  product has become.
- The process is implemented but **never narrated**; a first-time stakeholder has to infer the
  workflow from 13 nav buttons.
- The seed data is internally consistent and well-engineered for the _rules_, but it omits the
  fields that make a row legible as a federal obligation.

---

## 3. Expected DHS HQ UDO workflow (audit baseline)

| #   | Step                                 | What happens                                                                               | Primary DHS role(s)       | Evidence at the decision point                |
| --- | ------------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------- | --------------------------------------------- |
| 1   | **UDO data intake**                  | Ingest open-obligation records from the system of record / contract writing / payment data | UDO Coordinator (HQ)      | Source extract, ingestion timestamp           |
| 2   | **Inventory & aging**                | Display the open population; classify by age, $, fund status, PoP, activity, office, risk  | Budget Analyst            | Obligation record, GL balance                 |
| 3   | **Triage & prioritization**          | Rank by operational + audit risk; segment into queues; show _why_                          | HQ Analyst / Campaign Mgr | Risk factors, aging, drawdown                 |
| 4   | **Assignment & routing**             | Route each UDO to the accountable owner/office with due dates                              | Campaign Manager          | Assignment, due date, owner                   |
| 5   | **Evidence collection & research**   | Capture/reference supporting docs; classify evidence posture                               | COR / Program Owner       | PO, invoice, receipt, mod, GL, correspondence |
| 6   | **Validity determination**           | Decide: Valid · Liquidate · De-obligate · Closeout · Needs research · Escalate             | Reviewer / Certifier      | Evidence summary + rationale                  |
| 7   | **Certification / attestation**      | Periodic certification that UDOs were reviewed and validated                               | Certifying Official       | Reviewer, date, decision, comments            |
| 8   | **Action execution & follow-up**     | De-ob request, mod, invoice follow-up, receiving confirmation, closeout, correction        | Contracting / Finance     | Action ticket, status, resolution             |
| 9   | **Leadership reporting**             | Dashboards: population, $, aged, high-risk, de-ob $, reviews done/overdue, cycle time      | OCFO Leadership           | Aggregates with drill-down                    |
| 10  | **Continuous monitoring & controls** | Recurring review cycles, exception trends, control evidence                                | OCFO / Auditor            | Trend, audit trail, forecast                  |

---

## 4. Gap analysis by process step

| Step                      | Coverage  | Where it lives today                                                 | Gap & severity                                                                                                               |
| ------------------------- | --------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1 Intake                  | ◑ Partial | `createInitialState` runs the engines over the seed on load          | No visible "intake" moment, source, or ingestion lineage. The seed just _appears_ validated. **(P1)**                        |
| 2 Inventory & aging       | ● Strong  | `Inventory`, `StaleExplorer` (aging buckets)                         | Inventory lacks federal columns (fund, FY, object class, owner). **(P0 data)**                                               |
| 3 Triage & prioritization | ● Strong  | `riskEngine`, `HighRiskQueue` (8 factors, bands, filters)            | Excellent. Minor: "why this matters" copy could be louder. **(P2)**                                                          |
| 4 Assignment & routing    | ● Strong  | `campaign.ts`, `assignment.ts`, `Campaigns`, `CampaignDetail`        | Routes by component, not by named owner/role. **(P1)**                                                                       |
| 5 Evidence & research     | ◑ Partial | `EvidenceItem`, Detail evidence table, CRG required-evidence         | Per-item present/absent only; no record-level posture (complete/missing/inconsistent/needs-review). **(P1)**                 |
| 6 Validity determination  | ◑ Partial | `ReviewWorkspace` confirm/override of AI verdict                     | Reviewer cannot record the federal **disposition vocabulary** (Liquidate / De-ob / Closeout / Research / Escalate). **(P0)** |
| 7 Certification           | ◔ Weak    | Dispositions + audit approximate it                                  | No explicit certification artifact or "certified as of" status. **(P1)**                                                     |
| 8 Action execution        | ● Strong  | `escalation.ts`, `deob.ts`, `Tracker` (de-ob lifecycle, escalations) | Action types are de-ob + escalation; no generic "contracting mod / invoice follow-up" action item. **(P2)**                  |
| 9 Leadership reporting    | ● Strong  | `portfolio.ts`, `Portfolio`, `Dashboard`                             | Strong, reconciled, drill-down. Add cycle-time / funds-recovered framing. **(P2)**                                           |
| 10 Continuous monitoring  | ● Strong  | `analytics.ts`, `forecast.ts`, `CommandCenter`                       | Strong. Recurring-cycle cadence is implicit. **(P2)**                                                                        |
| — End-to-end legibility   | ◔ Missing | (nowhere)                                                            | No single view of the 10-step process, roles, evidence, and the manual→automated value story. **(P0)**                       |

Legend: ● strong · ◑ partial · ◔ weak/missing.

---

## 5. Terminology corrections

The product's vocabulary is mostly correct and federal. Targeted corrections:

| Current                                                            | Issue                                                                            | Recommended                                                                                                                               |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Header: "UDO Validation Assistant — Independent second opinion"    | Under-sells; describes Phase 1 only                                              | "DHS HQ UDO Review Platform — Headquarters-led, risk-based review of undelivered orders" (keep "validation assistant" lineage in subtext) |
| Reviewer can only set VALID / QUESTIONABLE / INSUFFICIENT_EVIDENCE | These are the **AI's assessment** categories, not the **reviewer's disposition** | Add reviewer **determination**: Valid · Liquidate · De-obligate · Closeout required · Needs research · Escalate                           |
| "Component Workspace"                                              | Fine, but the role is implicit                                                   | Subtitle: "Component Financial Manager response workspace"                                                                                |
| "Escalations & De-Ob"                                              | Abbreviated                                                                      | Keep nav short; full title "Escalations & De-Obligation Tracker" (already used in-screen)                                                 |
| Risk band CRITICAL/HIGH/MEDIUM/LOW                                 | Correct                                                                          | No change                                                                                                                                 |
| Evidence types PO/INVOICE/RECEIPT/MOD/GL                           | Correct and federal                                                              | No change; add record-level **evidence posture** as a derived label                                                                       |

All correct already: UDO/ULO synonymy, "de-obligation," "liquidation," "period of
performance," "obligated/disbursed," "drawdown," "appropriation/funding type," "CRG."

---

## 6. Data model corrections

`UdoRecord` should carry the fields a federal reviewer expects. **All additive and optional**
so no engine, test, or Phase 1 guarantee changes:

| Field                   | Type   | Why it matters (federal)                                              |
| ----------------------- | ------ | --------------------------------------------------------------------- |
| `lineNumber`            | string | Obligations are reviewed at the **line** level (e.g., `0001AA`)       |
| `treasuryAccountSymbol` | string | The **TAS / appropriation** the funds sit in (e.g., `070-24/25-0530`) |
| `fiscalYear`            | number | Fund/budget year — drives **cancelling-fund** urgency                 |
| `appropriation`         | string | Plain-language appropriation name (e.g., "O&M, Coast Guard")          |
| `objectClass`           | string | OMB **object class** (e.g., `25.2 Other services`)                    |
| `contractingOffice`     | string | The office that can execute a mod / de-ob                             |
| `programOwner`          | string | Named **COR / program owner** accountable for the line                |
| `ownerRole`             | enum   | COR · Program Manager · Budget Analyst · Contracting Officer          |
| `invoiceStatus`         | enum   | NONE · PARTIAL · CURRENT · FINAL — liquidation signal                 |
| `acceptanceStatus`      | enum   | NONE · PARTIAL · COMPLETE — receiving/acceptance signal               |

`Disposition` should additionally carry an optional `reviewDecision` (the six-category federal
determination) and `determinationReason`, so the human's _operational_ decision is recorded
distinctly from a verdict override, and rolls into the audit trail.

(Optional future-state: a record-level `evidencePosture` derived value —
COMPLETE / MISSING / INCONSISTENT / NEEDS_REVIEW — computed from the evidence + CRG required
set. Documented as a P1 goal.)

---

## 7. UX / demo-story corrections

1. **Open with the process, not a nav bar.** Add a **"UDO Process Map"** as the first screen:
   the ten steps, the DHS role at each, the evidence needed, the product screen that performs
   it, and the **manual pain point → product enhancement** for each step. This turns 13 nav
   buttons into one legible story and is the spine of every demo.
2. **Make a record look federal.** Surface the new fields in UDO Detail's obligation record so
   a budget analyst recognizes the line.
3. **Give the reviewer the federal decision.** Add the six-category determination to the
   Review Workspace alongside confirm/override.
4. **Name the value.** Each process step should state the before (manual spreadsheets, email
   chasing, sampling) and the after (ranked queue, coordinated campaign, reconciled rollup).

---

## 8. AI enhancement opportunities

The platform's "AI" is a deterministic rule engine (correct for an auditable MVP; opaque ML is
explicitly out of scope). Where AI **assists but never decides**:

| Opportunity                              | Where                                      | Status                                                                                   |
| ---------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Summarize evidence posture for a line    | Detail / Review                            | **Add** (derive COMPLETE/MISSING/INCONSISTENT) — P1                                      |
| Recommend a validity determination       | Review Workspace                           | **Add** a _suggested_ determination from verdict + de-ob flag (human still decides) — P1 |
| Draft the reviewer's comment / rationale | Review Workspace                           | **Add** a pre-filled, editable rationale string — P1                                     |
| Identify de-obligation candidates with $ | `flagDeobligation`, StaleExplorer, Tracker | **Shipped** ✓                                                                            |
| Flag missing evidence                    | `validateStatus` abstain path              | **Shipped** ✓ (abstains rather than guess)                                               |
| Generate leadership-ready explanations   | Portfolio / Command Center                 | **Shipped** ✓ (reconciled KPIs + basis)                                                  |
| **Never** auto-post or auto-dispose      | All disposition paths                      | **Enforced** ✓ (human-in-the-loop, mandatory reasons)                                    |

---

## 9. Implementation priorities

**P0 — process accuracy & demo coherence (do now):**

- **G1** UDO Process Map screen (10 steps · roles · evidence · screen · manual→automated value).
- **G2** Federal data realism on `UdoRecord` + seed + Detail surfacing.
- **G3** Reviewer validity-determination vocabulary in the Review Workspace + audit.
- **G4** Platform framing/terminology (header + step "why this matters" copy).

**P1 — operational enhancement (next):**

- **G5** Record-level evidence posture (COMPLETE/MISSING/INCONSISTENT/NEEDS_REVIEW).
- **G6** Suggested determination + draftable reviewer rationale (AI-assist, human-decides).
- **G7** Certification / attestation artifact + "certified as of" status.
- **G8** Named owner/role routing on assignments.

**P2 — polish & maintainability:**

- **G9** "Why this matters" value framing across triage/leadership screens.
- **G10** Generic action-item tracking (contracting mod / invoice follow-up) beyond de-ob.
- **G11** Cycle-time and funds-recovered leadership metrics.

Goal detail, acceptance criteria, and the running log live in
[`udo-implementation-goals.md`](./udo-implementation-goals.md).

---

## 10. Constraints honored

- **No Phase 1 regression.** Every change is additive; new `UdoRecord` fields are optional;
  new disposition data is a new path; no engine or existing test is weakened.
- **Determinism.** No new wall-clock/random in `src/domain`; the process map and data are
  static; the determination action takes an injected timestamp like every other human action.
- **Human-in-the-loop.** The new determination requires a mandatory reason; the platform still
  never auto-posts.
- **Assumptions are labeled.** Federal specifics not confirmed by the repo (TAS formats, object
  classes, owner names) are **mock, clearly-labeled, easily-editable seed values**, consistent
  with SPEC §9 (CRG, status taxonomy, evidence definitions are mocked until confirmed).
