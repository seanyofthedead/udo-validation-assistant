# SPEC.md — UDO Validation Assistant (MVP‑1)

> **This file is the source of truth.** The build loop reads it every iteration.
> If code and SPEC disagree, SPEC wins. Change scope by editing this file, not by drifting.
> Derived from `DHS_OCFO_UDO_Product_Discovery.md` (Phase 5 Option 1 / Phase 7).

---

## 1. North star

Give every DHS UDO an **independent, explainable second opinion**: for any obligation a
component reports, say — with a confidence score and a cited reason — whether the reported
status looks right, and whether the obligation looks stale enough to de‑obligate. A human is
in the loop on every disposition; an immutable trail sits behind every decision.

This is the literal answer to the highest‑authority request in the discovery doc (Jeff, 1.7):
*"our UDO validation and verification process."*

## 2. MVP‑1 scope (this build)

- **Stack:** React + TypeScript single‑page app, built with **Vite**. **No backend, no network, no API key.**
- **Data:** **mock fixtures only**, shipped as TypeScript modules.
- **"AI":** **deterministic rule‑based engine** (pure functions). No LLM calls. Same input → same output, always.
- **Tests:** **Vitest**. The test suite is the loop's completion gate (see §9).
- **Persistence:** in‑memory React state for the session; export to file via Blob download. No database, no `localStorage` dependency.

Out of scope for MVP‑1 (documented for later): live ERP/CFO Horizons feed, real LLM reasoning,
multi‑user auth, HQ‑driven population push, predictive forecasting. See `AWS_FUTURE_STATE.md`.

## 3. The two P0 jobs (from SME, 2.13)

1. **Status validation** — when a component reports a UDO with status X, judge whether X is accurate; flag the likely‑wrong ones.
2. **De‑obligation detection** — identify open obligations unlikely to draw down further that should be de‑obligated to free budget authority.

## 4. Domain language

- **UDO** = Undelivered Order (DHS term). Treat **ULO** as a synonym (assumption A‑1). Use "UDO" in all UI labels.
- **CRG** = the policy/process guide; in MVP‑1 it is represented by a small mock ruleset (`crgRules`). No real CRG ingested.
- **Drawdown** = `amountDisbursed / amountObligated`.
- **Stale** = open obligation with expired period of performance and little/no recent activity.

## 5. Data model (TypeScript)

```ts
type Component = 'USCG' | 'TSA' | 'FEMA' | 'CBP' | 'CISA';
type ReportedStatus = 'OPEN_ACTIVE' | 'OPEN_INACTIVE' | 'PENDING_CLOSE' | 'CLOSED';
type Verdict = 'VALID' | 'QUESTIONABLE' | 'INSUFFICIENT_EVIDENCE';
type EvidenceType = 'PO' | 'INVOICE' | 'RECEIPT' | 'MOD' | 'GL';

interface UdoRecord {
  id: string;                 // e.g. "UDO-USCG-0001"
  component: Component;
  obligationNumber: string;
  vendor: string;
  description: string;
  fundingType: string;        // e.g. "O&M", "Procurement"
  amountObligated: number;    // USD
  amountDisbursed: number;    // USD
  reportedStatus: ReportedStatus;
  obligationDate: string;     // ISO date
  lastActivityDate: string;   // ISO date
  periodOfPerformanceEnd: string; // ISO date
}

interface EvidenceItem {
  udoId: string;
  type: EvidenceType;
  present: boolean;
  amount?: number;
  ref?: string;
}

interface CrgRule {
  id: string;                 // e.g. "CRG-OPEN-ACTIVE-01"
  appliesToStatus: ReportedStatus;
  requiredEvidence: EvidenceType[];
  description: string;        // plain-language, surfaced as the "cited rule"
}

interface PriorYearStat {
  component: Component;
  lineCount: number;
  totalAmount: number;
}

interface ValidationFinding {
  udoId: string;
  verdict: Verdict;
  confidence: number;         // 0..1, deterministic
  justification: string;      // plain language, references which rules fired
  citedRuleId: string | null;
  qcAgreed: boolean;          // QC agent cross-check result
}

interface DeobligationFlag {
  udoId: string;
  candidate: boolean;
  estimatedRecoverable: number; // USD = amountObligated - amountDisbursed when candidate
  reasons: string[];
}

interface Disposition {           // human-in-the-loop record
  udoId: string;
  action: 'CONFIRM' | 'OVERRIDE';
  overrideVerdict?: Verdict;
  reason: string;               // MANDATORY on override
  user: string;
  timestamp: string;
}

interface AuditEvent {            // immutable, append-only
  timestamp: string;
  actor: 'AI' | 'HUMAN';
  action: string;               // e.g. "VALIDATE", "DEOBLIGATION_FLAG", "OVERRIDE", "EXPORT"
  udoId?: string;
  detail: string;
}
```

## 6. Validation rules (deterministic — this is the "AI")

The engine is **pure functions** over the data model. No randomness, no clock reads inside
logic (pass a fixed `asOfDate` so tests are stable).

**Status verdict** — `validateStatus(udo, evidence, rules, asOfDate)`:
- **INSUFFICIENT_EVIDENCE (abstain)** — required evidence for the reported status (per matching `CrgRule.requiredEvidence`) is missing or fewer than 2 evidence items present. The engine must abstain rather than guess ("I don't know" bucket, 1.15).
- **QUESTIONABLE** — at least one contradiction fires, e.g.:
  - reported `OPEN_ACTIVE` but `periodOfPerformanceEnd` < asOfDate − 90 days **and** `lastActivityDate` < asOfDate − 180 days;
  - reported `OPEN_ACTIVE`/`OPEN_INACTIVE` but drawdown ≥ 0.98 (effectively fully disbursed → should be closing);
  - reported `PENDING_CLOSE` but drawdown < 0.50 (large undisbursed balance);
  - reported status contradicts evidence amounts (sum of INVOICE evidence ≉ `amountDisbursed`).
- **VALID** — required evidence present and no contradiction fires.
- **confidence** — deterministic: start 1.0; subtract fixed penalties per missing evidence item and per borderline metric; floor 0.0. Document the exact formula in code comments.
- **justification** — assembled from the rule IDs that fired, in plain language.
- **citedRuleId** — the governing `CrgRule.id` (or `null` when abstaining for missing rule).

**QC agent (creator + checker pattern, 1.19/1.16)** — `qcCheck(finding, udo, evidence)`:
- Re-derives the verdict by an independent path and sets `qcAgreed`. If QC disagrees, force verdict to `INSUFFICIENT_EVIDENCE` and lower confidence (fail safe, never confidently wrong).

**De‑obligation** — `flagDeobligation(udo, asOfDate)`:
- `candidate = true` when: `periodOfPerformanceEnd` < asOfDate (expired) **and** drawdown < 0.25 **and** `lastActivityDate` < asOfDate − 180 days.
- `estimatedRecoverable = amountObligated − amountDisbursed` when candidate, else 0.
- `reasons[]` lists each condition that fired.

**Prior‑year anomaly** — `priorYearAnomaly(component, current, priorStats)`:
- population shift flag when current line count differs from prior by ≥ 50% (Alyssa's 3,000→300, 1.14);
- per‑line outlier when `amountObligated` > 3× component median.

## 7. Screens (P0 + selected P1)

1. **Executive Dashboard** — coverage % (validated / total), exception count, total de‑obligation $ surfaced.
2. **UDO Inventory** — full population table; filter/sort by component, status, $, age; verdict badge per row.
3. **High‑Risk Queue** — Questionable + de‑obligation candidates, sorted by $ descending.
4. **UDO Detail + AI Findings panel** — record, linked evidence, verdict, confidence, justification, cited rule, abstention note, de‑ob flag + reasons.
5. **Review Workspace** — confirm or override; **override requires a non‑empty reason**; disposition history shown.
6. **Reporting / Export** — download validated population, exception worklist, de‑ob shortlist, and full audit trail as **CSV and JSON**.

## 8. Golden‑path demo = acceptance scenario (from Phase 7)

This scenario must work end to end and is encoded as an integration test:

1. Load the seed component UDO population (mock data).
2. Assistant validates statuses → several **VALID**, a few **QUESTIONABLE** with cited reasons + confidence, **exactly one INSUFFICIENT_EVIDENCE** (abstain) on a thin‑evidence line.
3. Surface a ranked **de‑obligation shortlist** with an estimated **$** total.
4. Analyst **overrides** one verdict; the app **rejects an empty reason** and **accepts** a provided reason.
5. **Export** the evidenced, audit‑trailed packet (CSV + JSON), and the audit trail contains the AI verdicts, the override (with reason), and the export event.

## 9. Definition of done (the loop's gate)

The build is complete when **all** of these hold:
- `npm run build` exits 0.
- `npm test` runs the Vitest suite with **0 failures**.
- The suite includes, at minimum, the tests enumerated in `IMPLEMENTATION_PLAN.md` §"Verification", including the §8 golden‑path integration test.
- Every task checkbox in `IMPLEMENTATION_PLAN.md` is checked.
- `npm run dev` serves the app and all six screens render without console errors.

## 10. Non‑negotiable guardrails

- **Never auto‑posts** to any system of record (1.16). The app only proposes; humans dispose.
- **Mandatory reason on override** (1.15) — enforced in UI and in the disposition model.
- **Abstention over confident‑wrong** (1.15) — when in doubt, `INSUFFICIENT_EVIDENCE`.
- **Immutable audit trail** (1.16) — append‑only; every AI and human action recorded; exportable.
- **Determinism** — no `Math.random()`, no `Date.now()` inside engine logic; pass `asOfDate` explicitly.
- **Explainability** — every verdict carries a confidence and a plain‑language justification with a cited rule.
