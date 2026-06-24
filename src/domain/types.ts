// Data model — SPEC.md §5. This file is the schema everything else builds on.
// Keep it free of React and of any runtime logic; types only.

export type Component = 'USCG' | 'TSA' | 'FEMA' | 'CBP' | 'CISA';
export type ReportedStatus = 'OPEN_ACTIVE' | 'OPEN_INACTIVE' | 'PENDING_CLOSE' | 'CLOSED';
export type Verdict = 'VALID' | 'QUESTIONABLE' | 'INSUFFICIENT_EVIDENCE';
export type EvidenceType = 'PO' | 'INVOICE' | 'RECEIPT' | 'MOD' | 'GL';

// --- Federal financial-management descriptors (additive, optional) ---------
// These make a UDO line legible to a DHS HQ budget analyst / COR / contracting
// officer. They are descriptive metadata only — the deterministic engines
// (validation, risk, de-ob, forecast) do NOT read them, so they are optional and
// changing them never affects a verdict, score, or Phase 1 guarantee. Values in
// the seed are clearly-labeled MOCK data (SPEC §9: TAS/object-class/owner specifics
// are unconfirmed) and are designed to be edited once real definitions land.

/** Who accountably owns the line's review (drives assignment routing). */
export type OwnerRole = 'COR' | 'PROGRAM_MANAGER' | 'BUDGET_ANALYST' | 'CONTRACTING_OFFICER';

/** Liquidation signal — how far invoicing has progressed against the obligation. */
export type InvoiceStatus = 'NONE' | 'PARTIAL' | 'CURRENT' | 'FINAL';

/** Receiving/acceptance signal — whether goods/services have been accepted. */
export type AcceptanceStatus = 'NONE' | 'PARTIAL' | 'COMPLETE';

export interface UdoRecord {
  id: string; // e.g. "UDO-USCG-0001"
  component: Component;
  obligationNumber: string;
  vendor: string;
  description: string;
  fundingType: string; // e.g. "O&M", "Procurement"
  amountObligated: number; // USD
  amountDisbursed: number; // USD
  reportedStatus: ReportedStatus;
  obligationDate: string; // ISO date
  lastActivityDate: string; // ISO date
  periodOfPerformanceEnd: string; // ISO date

  // --- Optional federal descriptors (see note above) -----------------------
  lineNumber?: string; // obligation line item, e.g. "0001AA"
  treasuryAccountSymbol?: string; // TAS / appropriation symbol, e.g. "070-24/25-0530"
  fiscalYear?: number; // fund/budget year (drives cancelling-fund urgency)
  appropriation?: string; // plain-language appropriation, e.g. "O&M, Coast Guard"
  objectClass?: string; // OMB object class, e.g. "25.2 Other services"
  contractingOffice?: string; // office that can execute a mod / de-ob
  programOwner?: string; // named COR / program owner accountable for the line
  ownerRole?: OwnerRole; // the accountable owner's role
  invoiceStatus?: InvoiceStatus; // liquidation signal
  acceptanceStatus?: AcceptanceStatus; // receiving/acceptance signal
}

export interface EvidenceItem {
  udoId: string;
  type: EvidenceType;
  present: boolean;
  amount?: number;
  ref?: string;
}

export interface CrgRule {
  id: string; // e.g. "CRG-OPEN-ACTIVE-01"
  appliesToStatus: ReportedStatus;
  requiredEvidence: EvidenceType[];
  description: string; // plain-language, surfaced as the "cited rule"
}

export interface PriorYearStat {
  component: Component;
  lineCount: number;
  totalAmount: number;
}

export interface ValidationFinding {
  udoId: string;
  verdict: Verdict;
  confidence: number; // 0..1, deterministic
  justification: string; // plain language, references which rules fired
  citedRuleId: string | null;
  qcAgreed: boolean; // QC agent cross-check result
}

export interface DeobligationFlag {
  udoId: string;
  candidate: boolean;
  estimatedRecoverable: number; // USD = amountObligated - amountDisbursed when candidate
  reasons: string[];
}

// The reviewer's operational disposition of a UDO line (step 6 of the DHS HQ
// process). Distinct from the AI's *assessment* verdict: a Verdict says whether
// the reported status looks right; a ReviewDecision says what HQ will DO about
// the line. A reason is mandatory on every determination (abstain over guessing).
export type ReviewDecision =
  | 'VALID' // obligation still required; keep it open
  | 'LIQUIDATE' // goods/services received; invoice/payment action needed
  | 'DEOBLIGATE' // excess/invalid balance; remove the funds
  | 'CLOSEOUT' // contract/order complete; administrative closeout required
  | 'NEEDS_RESEARCH' // insufficient evidence to decide
  | 'ESCALATE'; // policy/legal/contracting/system issue; higher-level review

export interface Disposition {
  // human-in-the-loop record
  udoId: string;
  action: 'CONFIRM' | 'OVERRIDE' | 'DETERMINATION';
  overrideVerdict?: Verdict;
  reviewDecision?: ReviewDecision; // set when action === 'DETERMINATION' (step 6)
  reason: string; // MANDATORY on override and on a determination
  user: string;
  timestamp: string;
}

export interface AuditEvent {
  // immutable, append-only
  timestamp: string;
  actor: 'AI' | 'HUMAN';
  action: string; // e.g. "VALIDATE", "DEOBLIGATION_FLAG", "OVERRIDE", "EXPORT"
  udoId?: string;
  detail: string;
}

// --- Phase 2 (Wave 5) — Risk-based prioritization -------------------------
// Additive to the Phase 1 model. SPEC §5.1; weights/thresholds live in
// src/domain/riskModel.ts (mirroring docs/wave5-risk-scoring-model.md §2).

export type RiskBand = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RiskFactor {
  name: string; // e.g. "R1 verdict", surfaced in the risk detail panel
  points: number; // this factor's contribution to the score
  reason: string; // plain-language explanation of the contribution
}

export interface RiskScore {
  udoId: string;
  score: number; // 0..100, deterministic; equals the sum of factor points
  band: RiskBand;
  factors: RiskFactor[]; // every point attributable to a factor (explainability)
  asOfDate: string; // ISO date the score was computed against
}

// --- Phase 3 (Wave 6) — Headquarters review campaigns ---------------------
// Additive to the Phase 1/2 model. SPEC §5.3: a campaign is a first-class,
// auditable entity that scopes a review, selects a population, and assigns
// slices to components with due dates. The campaign state machine is forward-
// only (Draft → Active → Closing → Closed); see src/domain/campaign.ts.

export type CampaignState = 'DRAFT' | 'ACTIVE' | 'CLOSING' | 'CLOSED';

// Per-assignment progress lifecycle. Components act on assignments in Wave 7
// (responses); in Wave 6 a fresh assignment starts NOT_STARTED (0% progress).
export type AssignmentState = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE';

export interface Campaign {
  id: string; // e.g. "CMP-2026-Q3-01"
  name: string; // e.g. "Q3 UDO Review"
  objective: string; // plain-language scope statement
  period: string; // e.g. "Q3 FY2026"
  state: CampaignState;
  createdBy: string; // actor who created it (human-in-the-loop)
  createdAt: string; // ISO timestamp; supplied by the caller (engines stay pure)
}

export interface Assignment {
  id: string; // e.g. "ASG-2026-Q3-01-USCG"
  campaignId: string; // lineage: assignment → campaign
  component: Component;
  udoIds: string[]; // the slice of the population this component owns
  dueDate: string; // ISO date
  state: AssignmentState;
}

// --- Phase 3 (Wave 7) — Component collaboration ---------------------------
// SPEC §5.4 (Component Response Workspace) and §5.7 (De-Obligation Opportunity
// Tracker). All additive to the Phase 1/2/3 model; close the HQ→component→HQ
// loop: components respond with evidence, HQ validates, exceptions escalate.

// A component's per-line answer to an assigned obligation. CONCUR agrees with
// the AI verdict; CONTEST disputes it; CORRECT proposes a different reported
// status. A reason is mandatory unless CONCUR — the same discipline as a Phase 1
// override — but that rule lives in the response reducer, not the type.
export type ResponseAction = 'CONCUR' | 'CONTEST' | 'CORRECT';

// Lifecycle of one response: drafted by the component, submitted to HQ, then
// validated by an HQ analyst so concurrence is not rubber-stamped (SPEC §5.4).
export type ResponseState = 'DRAFT' | 'SUBMITTED' | 'VALIDATED';

export interface Response {
  id: string; // e.g. "RSP-CMP-01-USCG-UDO-USCG-0001"
  assignmentId: string; // lineage: response → assignment → campaign
  udoId: string; // the obligation this response answers
  action: ResponseAction;
  correctedStatus?: ReportedStatus; // present only when action === 'CORRECT'
  reason: string; // MANDATORY unless CONCUR (enforced by the reducer)
  evidenceRefs: string[]; // mock evidence handles (SPEC §5.4 mock upload)
  state: ResponseState;
}

// Why an item needs attention now. OVERDUE: a line in an assignment past its due
// date; CONTESTED: a contested response; HIGH_DOLLAR: a large obligation; MANUAL:
// a human-raised flag. (SPEC §4 Escalation Workflow.)
export type EscalationTrigger = 'OVERDUE' | 'CONTESTED' | 'HIGH_DOLLAR' | 'MANUAL';

export interface Escalation {
  id: string; // deterministic: "ESC-<trigger>-<target>"
  target: string; // the escalated obligation's udoId (lineage to the line)
  trigger: EscalationTrigger;
  level: number; // 1 = campaign manager, 2 = leadership visibility
  reason: string; // plain-language basis (explainability, SPEC §7)
}

// De-obligation opportunity lifecycle (SPEC §5.7): a stale-obligation candidate
// surfaced from the Phase 1 de-ob flag, then dispositioned by a human. Confirmed
// dollars roll up to leadership; the platform never auto-posts.
export type DeobState = 'IDENTIFIED' | 'UNDER_REVIEW' | 'CONFIRMED' | 'REJECTED';

export interface DeobDisposition {
  // human-in-the-loop record; reason MANDATORY on confirm/reject.
  action: 'CONFIRM' | 'REJECT';
  reason: string;
  user: string;
  timestamp: string;
}

export interface DeobOpportunity {
  udoId: string; // lineage: opportunity → de-ob flag / finding (by udoId)
  state: DeobState;
  estimatedRecoverable: number; // USD, carried from the de-ob flag
  disposition?: DeobDisposition; // set when CONFIRMED or REJECTED
}

// --- Phase 4 (Wave 8) — Executive visibility ------------------------------
// Additive, READ-ONLY aggregation views over the Phase 1–3 records (UDOs,
// findings, risk, campaigns/assignments, responses, de-ob). SPEC §5: leadership
// needs a defensible department scorecard that drills to the line. No new
// mutation paths — these are pure projections computed over the store. Every
// value reconciles to its source records (asserted in tests) and every row
// carries the lineage (udoIds) needed to drill from a KPI to the lines behind it.

// Count of obligations in each risk band — the scorecard's risk distribution.
// Keyed by RiskBand so the four counts always sum to the row's scored lines
// (explainability: a leadership "risk mix" cell traces to which bands it counts).
export type RiskMix = Record<RiskBand, number>;

export interface ComponentScorecard {
  component: Component;
  udoCount: number; // obligations attributed to this component (denominator)
  reviewedCount: number; // lines with a disposition or a submitted/validated response
  coverage: number; // 0..1 = reviewedCount / udoCount (0 when udoCount === 0)
  exceptionCount: number; // lines needing attention (non-VALID verdict or escalated)
  deobDollars: number; // CONFIRMED de-ob $ rolled up for this component
  riskMix: RiskMix; // band distribution across this component's scored lines
  udoIds: string[]; // lineage: every line behind this row (drill-down target)
}

export interface PortfolioKpis {
  asOfDate: string; // the asOfDate the aggregates were computed against
  udoCount: number; // department-wide obligation count
  totalObligated: number; // sum of amountObligated across the population (USD)
  reviewedCount: number; // department-wide reviewed lines
  coverage: number; // 0..1 = reviewedCount / udoCount (0 when empty)
  exceptionCount: number; // department-wide exception lines
  deobDollars: number; // department-wide CONFIRMED de-ob $ rolled up
  campaignCompletion: number; // 0..1 = COMPLETE assignments / total (1 when none)
  riskMix: RiskMix; // department-wide band distribution
}

export interface PortfolioSummary {
  kpis: PortfolioKpis; // department roll-up; equals the sum of the scorecards
  scorecards: ComponentScorecard[]; // one per component present, stable order
}

// --- Phase 4 → L5 (Wave 9) — Enterprise Command Center --------------------
// The predictive step (SPEC §5.8). All additive and READ-ONLY over the Phase
// 1–4 records. Determinism still holds: forecasts are pure over inputs + an
// explicit `asOfDate` + horizon (no clock, no random), every projection is
// labeled a Projection and carries its `basis` plus the lines driving it
// (lineage: forecast → input obligations). Method is documented in
// docs/wave9-forecast-method.md so the number is reproducible — and the
// signature anticipates a future model-backed implementation (AWS future state).

// What a forecast projects. MVP ships exactly one metric: the count of
// obligations projected to become STALE (de-obligation candidates) by the
// horizon. Kept as a union so a model-backed build can add metrics additively.
export type ForecastMetric = 'STALE_OBLIGATIONS';

// A labeled future window. `endDate` is derived from the forecast's asOfDate +
// `days` (pure calendar math, no clock) and is the as-of date the projection
// re-evaluates the staleness predicate against.
export interface ForecastHorizon {
  label: string; // e.g. "next quarter"
  days: number; // length of the window in days from asOfDate
  endDate: string; // ISO date = asOfDate + days
}

// One obligation behind a projected count — the lineage from a forecast down to
// a specific line expected to cross the staleness threshold, with its reason.
export interface ForecastDriver {
  udoId: string;
  component: Component;
  estimatedRecoverable: number; // USD that becomes recoverable if it goes stale
  reason: string; // plain-language: why this line is projected to go stale by endDate
}

// An advisory projection (SPEC §5.8) — never a fact. The UI always renders the
// "Projection" label and the `basis`. `method` names the documented technique so
// the value is reproducible; `projectedValue` equals `drivers.length`.
export interface Forecast {
  target: Component | 'DEPARTMENT'; // scope of the projection
  metric: ForecastMetric;
  projectedValue: number; // the projected count (equals drivers.length)
  horizon: ForecastHorizon;
  method: string; // documented method label, e.g. "aging extrapolation v0.1"
  basis: string; // plain-language basis + inputs, ALWAYS surfaced
  drivers: ForecastDriver[]; // lineage: the obligations behind the projection
  asOfDate: string; // the date the projection was computed from
}

// A point-in-time portfolio roll-up — the unit of the command center's time
// series. `summary` is the Wave 8 aggregate (buildPortfolioSummary) at `asOfDate`.
export interface PortfolioSnapshot {
  asOfDate: string;
  summary: PortfolioSummary;
}

// Metrics surfaced as rows of the cross-component heatmap. The current-state
// rows reconcile to the Wave 8 scorecards; `projectedStale` reconciles to the
// per-component forecast.
export type HeatmapMetric = 'exceptions' | 'critical' | 'projectedStale';

// One component × metric cell. `intensity` is value / row-max (0..1) for
// coloring; `isSpike` marks the (non-zero) row leader — the spike leadership
// should look at first.
export interface HeatmapCell {
  component: Component;
  metric: HeatmapMetric;
  value: number;
  intensity: number; // 0..1 relative to the metric's max across components
  isSpike: boolean; // value is the non-zero max for this metric
}

// A component whose metric moved most between two snapshots (delta = to − from).
export interface ComponentMover {
  component: Component;
  metric: string; // the metric that moved, e.g. "exceptions"
  from: number; // value in the prior snapshot
  to: number; // value in the latest snapshot
  delta: number; // to − from (signed)
}

// Cross-component analytics over the latest snapshot (+ the prior, for movers).
// The current-state heatmap cells reconcile to the Wave 8 scorecards (asserted).
export interface CrossComponentAnalytics {
  asOfDate: string; // the latest snapshot's date
  heatmap: HeatmapCell[]; // component × metric grid
  topMovers: ComponentMover[]; // largest movers between the two latest snapshots
}
