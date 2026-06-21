// Pure validation engine — SPEC.md §6.
//
// Two invariants, enforced from day one (see determinism.guard.test.ts):
//   1. No React imports here.
//   2. No wall-clock / random calls — determinism comes from the explicit
//      `asOfDate` argument. Date math uses Date.UTC() (a pure function of its
//      arguments) rather than any constructor or clock read.
// The `void` statements mark stub parameters as intentionally unused.

import type {
  AuditEvent,
  Component,
  CrgRule,
  DeobligationFlag,
  EvidenceItem,
  PriorYearStat,
  ReportedStatus,
  UdoRecord,
  ValidationFinding,
} from './types';

// ---------------------------------------------------------------------------
// Deterministic date + math helpers
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

/** Parse an ISO 'YYYY-MM-DD' date to epoch ms via Date.UTC (pure, no clock). */
function toEpochMs(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Drawdown ratio = disbursed / obligated (0 when nothing is obligated). */
function drawdown(udo: UdoRecord): number {
  return udo.amountObligated > 0 ? udo.amountDisbursed / udo.amountObligated : 0;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Round to 2 decimals so confidence values are clean and exactly comparable. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Final confidence: penalties applied, clamped to [0,1], rounded to 2 dp. */
function confidenceScore(raw: number): number {
  return round2(clamp01(raw));
}

function pct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

// ---------------------------------------------------------------------------
// SPEC §6 thresholds (named so the rules read like the spec)
// ---------------------------------------------------------------------------

const POP_EXPIRED_DAYS = 90; // OPEN_ACTIVE: period of performance ended > 90d ago
const INACTIVE_DAYS = 180; // OPEN_ACTIVE: no activity in > 180d
const FULLY_DRAWN = 0.98; // OPEN_*: drawdown >= 0.98 -> should be closing
const PENDING_CLOSE_MIN_DRAWDOWN = 0.5; // PENDING_CLOSE: drawdown < 0.50 is suspect
const MIN_EVIDENCE_ITEMS = 2; // fewer than this present -> abstain

// Confidence model — SPEC §6 ("start 1.0; subtract fixed penalties ...; floor 0.0").
// Confidence is the engine's certainty in the assessment, as a function of
// evidence completeness and how close the deciding metrics sit to their cutoffs:
//
//   confidence = clamp01( 1.0
//     − MISSING_EVIDENCE_PENALTY × (required evidence types not present)
//     − SPARSE_EVIDENCE_PENALTY  × max(0, MIN_EVIDENCE_ITEMS − present items)
//     − BORDERLINE_PENALTY       × (deciding metrics within epsilon of a cutoff) )
//
// A clean VALID/QUESTIONABLE line (full evidence, no borderline metric) scores 1.0.
const MISSING_EVIDENCE_PENALTY = 0.2;
const SPARSE_EVIDENCE_PENALTY = 0.2;
const BORDERLINE_PENALTY = 0.1;
const DRAWDOWN_EPSILON = 0.02; // drawdown within 2 points of a cutoff is borderline
const DATE_EPSILON_DAYS = 15; // a date within 15 days of a cutoff is borderline

export const CONFIDENCE_MODEL = {
  MISSING_EVIDENCE_PENALTY,
  SPARSE_EVIDENCE_PENALTY,
  BORDERLINE_PENALTY,
  MIN_EVIDENCE_ITEMS,
} as const;

/**
 * Engine output shapes. These are NOT part of the SPEC §5 data model (which
 * lives in ./types); they are the return contracts of the pure pipeline.
 */
export interface PriorYearAnomalyResult {
  component: Component;
  populationShift: boolean;
  outlierUdoIds: string[];
}

export interface ValidationRun {
  findings: ValidationFinding[];
  deobFlags: DeobligationFlag[];
  anomalies: PriorYearAnomalyResult[];
  audit: AuditEvent[];
}

const NOT_IMPLEMENTED = 'not implemented — see IMPLEMENTATION_PLAN.md Wave 1';

/** SPEC §6 — status verdict for a single UDO. Pure. */
export function validateStatus(
  udo: UdoRecord,
  evidence: EvidenceItem[],
  rules: CrgRule[],
  asOfDate: string,
): ValidationFinding {
  const rule = rules.find((r) => r.appliesToStatus === udo.reportedStatus);

  const presentItems = evidence.filter((e) => e.udoId === udo.id && e.present);
  const presentTypes = new Set(presentItems.map((e) => e.type));
  const missingRequired = rule ? rule.requiredEvidence.filter((t) => !presentTypes.has(t)) : [];

  // --- Abstain (INSUFFICIENT_EVIDENCE) -------------------------------------
  // Required evidence missing, fewer than 2 items present, or no governing rule.
  // SPEC: "abstain rather than guess." citedRuleId is null on abstain.
  if (!rule || missingRequired.length > 0 || presentItems.length < MIN_EVIDENCE_ITEMS) {
    const parts: string[] = [];
    if (!rule) parts.push(`No CRG rule governs reported status ${udo.reportedStatus}.`);
    if (missingRequired.length > 0)
      parts.push(`Required evidence missing: ${missingRequired.join(', ')}.`);
    if (presentItems.length < MIN_EVIDENCE_ITEMS)
      parts.push(
        `Only ${presentItems.length} evidence item(s) present; at least ${MIN_EVIDENCE_ITEMS} required to assess.`,
      );

    const confidence = confidenceScore(
      1 -
        MISSING_EVIDENCE_PENALTY * missingRequired.length -
        SPARSE_EVIDENCE_PENALTY * Math.max(0, MIN_EVIDENCE_ITEMS - presentItems.length),
    );

    return {
      udoId: udo.id,
      verdict: 'INSUFFICIENT_EVIDENCE',
      confidence,
      justification: `Abstaining: ${parts.join(' ')}`,
      citedRuleId: null,
      qcAgreed: true,
    };
  }

  // --- Contradictions (QUESTIONABLE triggers) ------------------------------
  const dd = drawdown(udo);
  const asOf = toEpochMs(asOfDate);
  const popEnd = toEpochMs(udo.periodOfPerformanceEnd);
  const lastActivity = toEpochMs(udo.lastActivityDate);
  const status: ReportedStatus = udo.reportedStatus;
  const reasons: string[] = [];

  // (a) OPEN_ACTIVE but period of performance expired >90d AND inactive >180d.
  if (
    status === 'OPEN_ACTIVE' &&
    popEnd < asOf - POP_EXPIRED_DAYS * DAY_MS &&
    lastActivity < asOf - INACTIVE_DAYS * DAY_MS
  ) {
    reasons.push(
      `Reported OPEN_ACTIVE, but period of performance ended ${udo.periodOfPerformanceEnd} (>${POP_EXPIRED_DAYS} days ago) with no activity since ${udo.lastActivityDate} (>${INACTIVE_DAYS} days).`,
    );
  }

  // (b) OPEN_ACTIVE / OPEN_INACTIVE but effectively fully disbursed.
  if ((status === 'OPEN_ACTIVE' || status === 'OPEN_INACTIVE') && dd >= FULLY_DRAWN) {
    reasons.push(
      `Reported ${status}, but drawdown is ${pct(dd)} (>=${pct(FULLY_DRAWN)}); the obligation appears fully disbursed and should be closing.`,
    );
  }

  // (c) PENDING_CLOSE but a large balance is still undisbursed.
  if (status === 'PENDING_CLOSE' && dd < PENDING_CLOSE_MIN_DRAWDOWN) {
    reasons.push(
      `Reported PENDING_CLOSE, but drawdown is only ${pct(dd)} (<${pct(PENDING_CLOSE_MIN_DRAWDOWN)}); a large balance remains undisbursed.`,
    );
  }

  // (d) Invoice evidence does not reconcile to the disbursed amount.
  const invoiceItems = presentItems.filter((e) => e.type === 'INVOICE');
  if (invoiceItems.length > 0) {
    const invoiceSum = invoiceItems.reduce((s, e) => s + (e.amount ?? 0), 0);
    const tolerance = Math.max(1, udo.amountDisbursed * 0.01);
    if (Math.abs(invoiceSum - udo.amountDisbursed) > tolerance) {
      reasons.push(
        `Invoice evidence totals $${invoiceSum.toLocaleString('en-US')} but the disbursed amount is $${udo.amountDisbursed.toLocaleString('en-US')}; the amounts do not reconcile.`,
      );
    }
  }

  // --- Confidence: count borderline deciding metrics -----------------------
  let borderline = 0;
  const drawdownCutoff = status === 'PENDING_CLOSE' ? PENDING_CLOSE_MIN_DRAWDOWN : FULLY_DRAWN;
  if (status !== 'CLOSED' && Math.abs(dd - drawdownCutoff) <= DRAWDOWN_EPSILON) borderline++;
  if (status === 'OPEN_ACTIVE') {
    if (Math.abs(popEnd - (asOf - POP_EXPIRED_DAYS * DAY_MS)) <= DATE_EPSILON_DAYS * DAY_MS)
      borderline++;
    if (Math.abs(lastActivity - (asOf - INACTIVE_DAYS * DAY_MS)) <= DATE_EPSILON_DAYS * DAY_MS)
      borderline++;
  }
  const confidence = confidenceScore(1 - BORDERLINE_PENALTY * borderline);

  const verdict = reasons.length > 0 ? 'QUESTIONABLE' : 'VALID';
  const justification =
    reasons.length > 0
      ? `${reasons.join(' ')} Cited rule: ${rule.description}`
      : `Reported ${status} is consistent with the cited rule and shows no contradiction. ${rule.description}`;

  return {
    udoId: udo.id,
    verdict,
    confidence,
    justification,
    citedRuleId: rule.id,
    qcAgreed: true,
  };
}

// QC fail-safe: how much to scale confidence down when the checker disagrees.
const QC_DISAGREE_FACTOR = 0.5;

/**
 * SPEC §6 — independent QC re-derivation (creator + checker pattern).
 *
 * The checker deliberately uses a DIFFERENT path than validateStatus: it has no
 * CRG rules and no asOfDate, so it judges only what it can see independently —
 * evidence sufficiency and financial consistency. It will not overturn a
 * cautious verdict (QUESTIONABLE / INSUFFICIENT_EVIDENCE). It disagrees only
 * when the creator asserted VALID yet the checker independently finds the
 * evidence too thin or the financials self-contradictory. On disagreement it
 * fails safe: force INSUFFICIENT_EVIDENCE and lower confidence — never
 * confidently wrong.
 */
export function qcCheck(
  finding: ValidationFinding,
  udo: UdoRecord,
  evidence: EvidenceItem[],
): ValidationFinding {
  const present = evidence.filter((e) => e.udoId === udo.id && e.present);
  const dd = drawdown(udo);

  const evidenceInsufficient = present.length < MIN_EVIDENCE_ITEMS;

  const invoiceItems = present.filter((e) => e.type === 'INVOICE');
  const invoiceSum = invoiceItems.reduce((s, e) => s + (e.amount ?? 0), 0);
  const tolerance = Math.max(1, udo.amountDisbursed * 0.01);
  const financialInconsistency =
    invoiceItems.length > 0 && Math.abs(invoiceSum - udo.amountDisbursed) > tolerance;

  const overDrawnOpen =
    (udo.reportedStatus === 'OPEN_ACTIVE' || udo.reportedStatus === 'OPEN_INACTIVE') &&
    dd >= FULLY_DRAWN;
  const underDrawnPendingClose =
    udo.reportedStatus === 'PENDING_CLOSE' && dd < PENDING_CLOSE_MIN_DRAWDOWN;

  const qcSeesProblem = financialInconsistency || overDrawnOpen || underDrawnPendingClose;

  // The checker only challenges a clean bill of health (VALID).
  const disagrees = finding.verdict === 'VALID' && (evidenceInsufficient || qcSeesProblem);

  if (!disagrees) {
    return { ...finding, qcAgreed: true };
  }

  const why: string[] = [];
  if (evidenceInsufficient) why.push('evidence is too thin to support a VALID call');
  if (financialInconsistency)
    why.push('invoice evidence does not reconcile to the disbursed amount');
  if (overDrawnOpen) why.push('the obligation appears fully disbursed');
  if (underDrawnPendingClose) why.push('a large balance remains undisbursed');

  return {
    ...finding,
    verdict: 'INSUFFICIENT_EVIDENCE',
    confidence: round2(finding.confidence * QC_DISAGREE_FACTOR),
    citedRuleId: null,
    qcAgreed: false,
    justification: `${finding.justification} | QC disagreed with the VALID assessment (${why.join('; ')}); abstaining as a fail-safe.`,
  };
}

// De-obligation: an open balance is recoverable when its performance window has
// closed, little was drawn, and it has gone quiet.
const DEOB_DRAWDOWN_MAX = 0.25;

/** SPEC §6 — de-obligation candidacy for a single UDO. Pure. */
export function flagDeobligation(udo: UdoRecord, asOfDate: string): DeobligationFlag {
  const asOf = toEpochMs(asOfDate);
  const popEnd = toEpochMs(udo.periodOfPerformanceEnd);
  const lastActivity = toEpochMs(udo.lastActivityDate);
  const dd = drawdown(udo);

  const expired = popEnd < asOf;
  const lowDrawdown = dd < DEOB_DRAWDOWN_MAX;
  const inactive = lastActivity < asOf - INACTIVE_DAYS * DAY_MS;

  const reasons: string[] = [];
  if (expired)
    reasons.push(
      `Period of performance ended ${udo.periodOfPerformanceEnd}, before the as-of date.`,
    );
  if (lowDrawdown)
    reasons.push(
      `Drawdown is ${pct(dd)} (<${pct(DEOB_DRAWDOWN_MAX)}); most of the obligation is undisbursed.`,
    );
  if (inactive) reasons.push(`No activity since ${udo.lastActivityDate} (>${INACTIVE_DAYS} days).`);

  const candidate = expired && lowDrawdown && inactive;
  const estimatedRecoverable = candidate ? udo.amountObligated - udo.amountDisbursed : 0;

  return { udoId: udo.id, candidate, estimatedRecoverable, reasons };
}

// Anomaly thresholds (SPEC §6).
const POPULATION_SHIFT_THRESHOLD = 0.5; // current vs prior line count differs by >=50%
const OUTLIER_MEDIAN_MULTIPLE = 3; // amountObligated > 3x the component median

/** Median of a numeric list (0 for an empty list). Pure. */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * SPEC §6 — prior-year anomalies for one component. `current` is the current
 * population (any subset is filtered to `component`); `priorStats` supplies the
 * prior-year line count. Flags a >=50% population shift and the per-line
 * obligation outliers (> 3x the component median). Pure.
 */
export function priorYearAnomaly(
  component: Component,
  current: UdoRecord[],
  priorStats: PriorYearStat[],
): PriorYearAnomalyResult {
  const lines = current.filter((u) => u.component === component);
  const currentCount = lines.length;

  const prior = priorStats.find((s) => s.component === component);
  const priorCount = prior ? prior.lineCount : 0;
  const shift =
    priorCount > 0 ? Math.abs(currentCount - priorCount) / priorCount : currentCount > 0 ? 1 : 0;
  const populationShift = shift >= POPULATION_SHIFT_THRESHOLD;

  const med = median(lines.map((u) => u.amountObligated));
  const outlierUdoIds = lines
    .filter((u) => med > 0 && u.amountObligated > OUTLIER_MEDIAN_MULTIPLE * med)
    .map((u) => u.id);

  return { component, populationShift, outlierUdoIds };
}

/** SPEC §6 / Plan 1.8 — full pipeline; emits one AuditEvent per AI action. */
export function runValidation(
  population: UdoRecord[],
  evidence: EvidenceItem[],
  rules: CrgRule[],
  priorStats: PriorYearStat[],
  asOfDate: string,
): ValidationRun {
  void population;
  void evidence;
  void rules;
  void priorStats;
  void asOfDate;
  throw new Error(`runValidation ${NOT_IMPLEMENTED}`);
}
