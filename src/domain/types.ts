// Data model — SPEC.md §5. This file is the schema everything else builds on.
// Keep it free of React and of any runtime logic; types only.

export type Component = 'USCG' | 'TSA' | 'FEMA' | 'CBP' | 'CISA';
export type ReportedStatus = 'OPEN_ACTIVE' | 'OPEN_INACTIVE' | 'PENDING_CLOSE' | 'CLOSED';
export type Verdict = 'VALID' | 'QUESTIONABLE' | 'INSUFFICIENT_EVIDENCE';
export type EvidenceType = 'PO' | 'INVOICE' | 'RECEIPT' | 'MOD' | 'GL';

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

export interface Disposition {
  // human-in-the-loop record
  udoId: string;
  action: 'CONFIRM' | 'OVERRIDE';
  overrideVerdict?: Verdict;
  reason: string; // MANDATORY on override
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
