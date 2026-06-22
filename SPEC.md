# SPEC.md — UDO Review Platform

> **This file is the source of truth.** The build loop reads it every iteration.
> If code and SPEC disagree, SPEC wins. Change scope by editing this file, not by drifting.
> Derived from `DHS_OCFO_UDO_Product_Discovery.md`; evolved to the Headquarters‑Led
> Risk‑Based UDO Review Platform vision (2026‑06).
>
> **Phase 1 (Waves 0–4) is shipped.** Its requirements are preserved verbatim in §10 and
> must not regress. Everything else in this document is forward design for Phases 2–4.

---

## 1. Product vision

**An AI‑powered, Headquarters‑Led, Risk‑Based UDO Review Platform** that helps DHS OCFO
identify which Undelivered Orders deserve attention, coordinate component reviews, validate
the responses that come back, prioritize de‑obligation opportunities, and give leadership
department‑wide visibility.

The platform answers four escalating questions:

1. *Is this UDO's reported status correct?* — record‑level validation (Phase 1, shipped).
2. *Which UDOs, out of thousands, are worth a human's time?* — risk‑based prioritization (Phase 2).
3. *How do we task components and validate what they send back?* — HQ→component review management (Phase 3).
4. *How healthy is the department's UDO portfolio, and what's coming?* — enterprise oversight + forecasting (Phase 4).

Three principles hold across every phase and never relax: **human‑in‑the‑loop on every
disposition**, **explainability behind every machine output**, and an **immutable audit
trail** behind every action.

## 2. Phasing overview

| Phase | Name | Maturity level | Primary user | Core question |
|---|---|---|---|---|
| **1 (shipped)** | UDO Status Validation | L1 Validation Assistant | UDO Analyst | Is the status right? |
| **2** | Risk‑Based UDO Review | L2 Risk‑Based Review | HQ Analyst / Campaign Manager | What deserves attention? |
| **3** | Component Review Management | L3 Review Campaign Management | Campaign Manager / Component FM | How do we task & validate? |
| **4** | Enterprise UDO Command Center | L4 Enterprise Oversight → L5 Predictive | OCFO Leadership / Auditor | How healthy is the portfolio? |

Phases map to delivery Waves 5–9 in `IMPLEMENTATION_PLAN.md` and to the maturity model in
`docs/product-evolution-roadmap.md`. Nothing in Phase 1 is removed; each phase wraps the
prior capability in a wider workflow.

## 3. Personas

**DHS OCFO Leadership** — wants department‑wide confidence and a defensible audit story, not
record detail. Consumes scorecards, exception totals, and de‑obligation dollars surfaced.
Success = "I can see UDO health across all components and explain any number to an auditor."

**Component Financial Managers** — own their component's obligations. Receive HQ review
assignments, respond with evidence, contest findings. Success = "I know exactly which of my
UDOs HQ is asking about, why, and what I owe them by when."

**UDO Analysts** — the day‑to‑day reviewers (HQ and component). Validate statuses, work the
high‑risk queue, record dispositions with reasons. Success = "The system points me at the
20 lines that matter instead of 3,000, and shows its reasoning."

**Review Campaign Managers** — HQ staff who scope a review, select the population, assign it
to components, and track completion. Success = "I can launch a quarter‑end review, see who's
behind, and escalate without spreadsheets."

**Auditors** — internal/external reviewers who need traceability. Consume the audit trail,
data lineage, and the evidence packet behind any verdict or disposition. Success = "Every
decision shows who/what/when/why and the evidence it rested on."

## 4. Core workflows

**Risk‑Based UDO Selection (Phase 2).** The platform scores every UDO for review‑worthiness
and ranks a queue. An analyst or campaign manager filters by component, risk band, dollar,
or age and selects a working set. Replaces "validate everything" with "validate what matters."

**Headquarters Review Campaign Creation (Phase 3).** A campaign manager defines a review
(name, objective, period), selects a population (often from the risk queue), assigns lines or
slices to components, sets due dates, and launches. The campaign is the unit of coordination.

**Component Response Workflow (Phase 3).** A component FM sees assigned lines, submits a
response per line (concur / contest / corrected status) with supporting documentation, and
marks ready for HQ. Status moves Assigned → In Progress → Submitted.

**Escalation Workflow (Phase 3).** Overdue, contested, or high‑dollar items escalate — by due
date breach, by manual flag, or by rule — to a campaign manager and, above a threshold, into
leadership visibility. Every escalation is audited.

**De‑Obligation Opportunity Review (Phase 2–4).** Stale‑obligation candidates surface with an
estimated recoverable dollar amount and reasons; a human reviews, confirms or rejects, and the
confirmed shortlist rolls up to leadership. Never auto‑posts.

**Executive Oversight Workflow (Phase 4).** Leadership views portfolio health: coverage,
exception counts, de‑obligation dollars, and component scorecards, with drill‑down to the
underlying lines and the audit trail. Read‑mostly; any action routes back through the
human‑in‑the‑loop disposition path.

## 5. Feature requirements (Phases 2–4)

Each feature names its phase. Detailed tasks and acceptance criteria live in
`IMPLEMENTATION_PLAN.md` Waves 5–9.

### 5.1 UDO Risk Scoring Engine (Phase 2, Wave 5)
Deterministic, explainable score per UDO indicating review‑worthiness. Inputs: validation
verdict + confidence (Phase 1), staleness (PoP expiry, inactivity), drawdown ratio, dollar
magnitude, evidence completeness, prior‑year anomaly signal. Output: `riskScore` (0–100),
`riskBand` (LOW/MEDIUM/HIGH/CRITICAL), and `riskFactors[]` (each factor, its contribution, and
a plain‑language reason). Must be a pure function of inputs and an explicit `asOfDate` (same
determinism rule as the Phase 1 engine). No black‑box weighting — every point is attributable.

### 5.2 High‑Risk UDO Queue (Phase 2, Wave 5)
A ranked, filterable worklist driven by the risk engine. Sort by score/$/age; filter by
component, band, status, funding type. Each row shows score, top risk factors, dollar, and
verdict badge. This generalizes Phase 1's High‑Risk Queue screen from "Questionable + de‑ob
candidates" to "everything, ranked by risk."

### 5.3 Review Campaign Management (Phase 3, Wave 6)
Create/configure campaigns; select population (manual, saved filter, or "top N by risk");
assign to components; set due dates; track state (Draft → Active → Closing → Closed) and
per‑assignment progress. Campaign is a first‑class entity with its own audit trail.

### 5.4 Component Response Workspace (Phase 3, Wave 7)
Component‑scoped view of assigned lines; per‑line response (concur / contest / corrected
status + value), evidence attachment (mock upload in MVP), and submit‑to‑HQ. Enforces that a
contest or correction carries a mandatory reason — the same discipline as Phase 1 overrides.

### 5.5 Executive Dashboard (Phase 4, Wave 8 — extends Phase 1)
Phase 1 shipped a single‑population dashboard (coverage %, exceptions, de‑ob $). Phase 4
extends it to portfolio scope: department totals, per‑component scorecards, campaign
completion, trend over time, drill‑down to lines and audit.

### 5.6 Stale Obligation Explorer (Phase 2, Wave 5)
A focused view over de‑obligation candidates: aging buckets, expired‑PoP filter, low‑drawdown
filter, sortable by recoverable $. Wraps the Phase 1 `flagDeobligation` engine in an
investigative UI.

### 5.7 De‑Obligation Opportunity Tracker (Phase 3–4, Waves 7–8)
Lifecycle on each opportunity: Identified → Under Review → Confirmed → Rejected →
(Recommended for de‑obligation). Human disposition with reason; confirmed dollars roll up to
the executive view. Still never posts to a system of record.

### 5.8 Enterprise Analytics (Phase 4, Waves 8–9)
Cross‑component aggregation, component scorecards, portfolio KPIs, and — at L5 — predictive
drawdown/forecasting to anticipate which obligations will go stale. Forecasting is advisory
and clearly labeled as a projection.

## 6. User stories

**Risk‑based review (Phase 2)**
- As a *UDO Analyst*, I want UDOs ranked by risk so I work the 20 lines that matter, not 3,000.
- As a *Campaign Manager*, I want to select the top N highest‑risk UDOs as a population so I can scope a review fast.
- As an *Auditor*, I want each risk score to list its contributing factors so I can see why a line was prioritized.

**Review campaigns (Phase 3)**
- As a *Campaign Manager*, I want to create a quarter‑end review, assign slices to components, and set due dates so work is coordinated in one place.
- As a *Campaign Manager*, I want to see per‑component progress and what's overdue so I can escalate without chasing email.
- As *OCFO Leadership*, I want campaign completion visible so I know the review is actually happening.

**Component collaboration (Phase 3)**
- As a *Component FM*, I want to see exactly which UDOs HQ is asking about and why so I can respond precisely.
- As a *Component FM*, I want to concur, contest, or correct a status with evidence and a reason so my response is defensible.
- As a *UDO Analyst (HQ)*, I want to validate component responses against the evidence so concurrence isn't rubber‑stamped.

**De‑obligation (Phase 2–4)**
- As a *UDO Analyst*, I want stale obligations with an estimated recoverable amount so I can prioritize de‑obligation review.
- As *OCFO Leadership*, I want confirmed de‑obligation dollars rolled up so I can report freed budget authority.

**Executive oversight (Phase 4)**
- As *OCFO Leadership*, I want a department‑wide scorecard with drill‑down so I can see UDO health and defend any number.
- As an *Auditor*, I want full lineage from a portfolio number down to the source line and its audit trail.

## 7. Non‑functional requirements (expanded)

- **Auditability** — every AI output and human action appends an immutable `AuditEvent`. Campaigns, assignments, responses, escalations, and de‑ob dispositions are all auditable entities, not just record verdicts. Audit is exportable.
- **Explainability** — no unexplained machine output. Verdicts carry confidence + cited rule (Phase 1); risk scores carry per‑factor contributions (Phase 2); forecasts are labeled projections with their basis (Phase 4).
- **Data lineage** — every surfaced value traces to its source: portfolio KPI → component slice → UDO line → evidence item → (future) source system + ingestion timestamp. Lineage is a first‑class requirement once enterprise data is integrated (see `AWS_FUTURE_STATE.md`).
- **Traceability** — a verdict, a disposition, a campaign assignment, and a response are linkable end to end so any decision can be reconstructed.
- **Human‑in‑the‑loop controls** — the platform proposes; humans dispose. No auto‑posting to any system of record, in any phase. Contests, corrections, overrides, and de‑ob confirmations all require a reason.
- **Determinism (engines)** — risk scoring, validation, staleness, and anomaly logic remain pure functions over inputs + explicit `asOfDate`. This is what keeps the build loop terminating and the outputs auditable.
- **Scalability (design intent)** — the data model and engines are written to move server‑side unchanged (see AWS future state); MVP runs in‑browser on mock data but must not encode single‑population assumptions that block portfolio scope.

## 8. Domain language (carried + extended)

UDO = Undelivered Order (treat ULO as synonym; label everything "UDO"). CRG = the
policy/process guide (mock ruleset in MVP). Drawdown = disbursed / obligated. Stale = expired
PoP + little/no recent activity. **Risk band** = LOW/MEDIUM/HIGH/CRITICAL bucket of riskScore.
**Campaign** = a scoped HQ‑led review with an assigned population and due dates. **Assignment**
= a slice of a campaign given to a component. **Response** = a component's per‑line answer
(concur/contest/correct) with evidence + reason.

## 9. Assumptions requiring validation

- A‑1 ULO ≡ UDO (carried from discovery).
- A‑2 Real CRG document/owner/version still to be confirmed; MVP uses a mock ruleset.
- A‑3 Official UDO status taxonomy + required‑evidence definitions still to be confirmed; they will refine both the validation rules and the risk factors.
- A‑4 Risk‑factor weighting is a starting hypothesis; weights must be reviewed with SMEs and are expected to change after the first risk‑queue demo.
- A‑5 Component/HQ org structure and assignment granularity (by line, by component, by funding type) to be confirmed for campaign design.
- A‑6 CFO Horizons / Advana availability and timeline drive when real populations (vs. submissions) feed the risk engine.

---

## 10. Phase 1 — Shipped requirements (PRESERVED — must not regress)

> The following is the original MVP‑1 specification delivered in Waves 0–4. It remains in
> force. Phases 2–4 extend it; they do not replace it. Do not weaken these requirements.

### 10.1 Phase 1 scope
React + TypeScript SPA (Vite). No backend, no network, no API key. Mock fixtures only.
Deterministic rule‑based engine (pure functions). Vitest suite is the completion gate.
Session state in memory; export via Blob download.

### 10.2 The two P0 jobs
1. **Status validation** — judge whether a reported UDO status is accurate; flag likely‑wrong ones.
2. **De‑obligation detection** — identify open obligations unlikely to draw down that should be de‑obligated.

### 10.3 Data model (Phase 1)
`UdoRecord`, `EvidenceItem`, `CrgRule`, `PriorYearStat`, `ValidationFinding`,
`DeobligationFlag`, `Disposition`, `AuditEvent` — as originally specified (id, component,
obligationNumber, vendor, description, fundingType, amountObligated, amountDisbursed,
reportedStatus ∈ {OPEN_ACTIVE, OPEN_INACTIVE, PENDING_CLOSE, CLOSED}, obligationDate,
lastActivityDate, periodOfPerformanceEnd; evidence types PO/INVOICE/RECEIPT/MOD/GL; verdicts
VALID/QUESTIONABLE/INSUFFICIENT_EVIDENCE). Phases 2–4 add entities (RiskScore, Campaign,
Assignment, Response, Escalation, DeobOpportunity) but must not break these.

### 10.4 Validation rules (Phase 1, deterministic)
`validateStatus()` (VALID / QUESTIONABLE / INSUFFICIENT_EVIDENCE with confidence, plain‑language
justification, cited rule); `qcCheck()` creator+checker fail‑safe to abstain on disagreement;
`flagDeobligation()` (candidate + estimatedRecoverable + reasons); `priorYearAnomaly()`
(population shift + outliers). All pure over inputs + `asOfDate`.

### 10.5 Screens (Phase 1)
Executive Dashboard (single population), UDO Inventory, High‑Risk Queue, UDO Detail + AI
Findings, Review Workspace (confirm/override, mandatory reason), Reporting/Export (CSV + JSON).

### 10.6 Golden‑path acceptance (Phase 1)
Load seed → validate → several VALID, a few QUESTIONABLE with cited reasons, exactly one
INSUFFICIENT_EVIDENCE → ranked de‑ob shortlist with $ → analyst override rejects empty reason,
accepts a real one → export evidenced, audit‑trailed packet.

### 10.7 Definition of done (Phase 1)
`npm run build` exits 0; `npm test` 0 failures; golden‑path integration test passes; all
Wave 0–4 task boxes checked; six screens render without console errors.

### 10.8 Non‑negotiable guardrails (Phase 1, still global)
Never auto‑post; mandatory reason on override; abstain over confident‑wrong; immutable audit
trail; determinism in engines; explainability on every verdict.
