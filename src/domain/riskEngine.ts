// Pure risk-scoring engine — SPEC.md §5.1 (Phase 2, Wave 5).
//
// Same two invariants as the Phase 1 engine (see determinism.guard.test.ts):
//   1. No React imports.
//   2. No wall-clock / random calls — determinism comes from the explicit
//      `asOfDate` argument. Date math uses Date.UTC() (pure).
//
// Every tunable number lives in RISK_MODEL (src/domain/riskModel.ts), which
// mirrors docs/wave5-risk-scoring-model.md §2. This file reads those values and
// hard-codes NONE of them (task 5.10 guards that). A line's displayed score
// equals the sum of its factor points, and every point carries a plain-language
// reason — that is the explainability contract (SPEC §7).
//
// Signature note: SPEC §5.1 names the scoring inputs as validation verdict +
// confidence, staleness, drawdown, dollar magnitude, evidence completeness, and
// the prior-year anomaly signal. Those are the inputs below. (The draft
// scoring-model doc §6 sketches `scoreRisk(udo, finding, deobFlag, anomaly,
// asOfDate)`, but that predates the R7 evidence factor — which needs evidence +
// rules — and lists no de-ob input; SPEC §5.1 governs, so this follows it.)

import { RISK_MODEL } from './riskModel';
import type {
  AuditEvent,
  CrgRule,
  EvidenceItem,
  RiskBand,
  RiskFactor,
  RiskScore,
  UdoRecord,
  ValidationFinding,
} from './types';
import type { PriorYearAnomalyResult } from './engine';

// ---------------------------------------------------------------------------
// Deterministic helpers (local copies so the Phase 1 engine stays untouched)
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

/** Parse an ISO 'YYYY-MM-DD' date to epoch ms via Date.UTC (pure, no clock). */
function toEpochMs(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Whole days from `from` to `to` (positive when `to` is later). Pure. */
function daysBetween(fromIso: string, toIso: string): number {
  return Math.floor((toEpochMs(toIso) - toEpochMs(fromIso)) / DAY_MS);
}

/** Drawdown ratio = disbursed / obligated (0 when nothing is obligated). */
function drawdown(udo: UdoRecord): number {
  return udo.amountObligated > 0 ? udo.amountDisbursed / udo.amountObligated : 0;
}

function pct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

function usd(amount: number): string {
  return `$${amount.toLocaleString('en-US')}`;
}

// ---------------------------------------------------------------------------
// Per-factor scorers (R1–R8). Each returns { name, points, reason }.
// Points are whole numbers so the score is an exact sum of attributable parts.
// ---------------------------------------------------------------------------

function r1Verdict(finding: ValidationFinding): RiskFactor {
  const { r1 } = RISK_MODEL;
  const points =
    finding.verdict === 'QUESTIONABLE'
      ? r1.questionable
      : finding.verdict === 'INSUFFICIENT_EVIDENCE'
        ? r1.insufficient
        : r1.valid;
  return { name: 'R1 verdict', points, reason: `Validation ${finding.verdict}.` };
}

function r2Confidence(finding: ValidationFinding): RiskFactor {
  const points = Math.round((1 - finding.confidence) * RISK_MODEL.r2.max);
  return {
    name: 'R2 confidence',
    points,
    reason: `Validation confidence ${pct(finding.confidence)}.`,
  };
}

function r3PopExpiry(udo: UdoRecord, asOfDate: string): RiskFactor {
  const { r3 } = RISK_MODEL;
  const daysPastPoP = daysBetween(udo.periodOfPerformanceEnd, asOfDate);
  let points: number;
  if (daysPastPoP <= 0) points = r3.pNone;
  else if (daysPastPoP <= r3.t1Days) points = r3.pT1;
  else if (daysPastPoP <= r3.t2Days) points = r3.pT2;
  else points = r3.pOver;
  const reason =
    daysPastPoP <= 0
      ? 'Period of performance has not expired.'
      : `PoP ended ${daysPastPoP} days ago.`;
  return { name: 'R3 PoP expiry', points, reason };
}

function r4Inactivity(udo: UdoRecord, asOfDate: string): RiskFactor {
  const { r4 } = RISK_MODEL;
  const daysInactive = daysBetween(udo.lastActivityDate, asOfDate);
  let points: number;
  if (daysInactive <= r4.t1Days) points = r4.pT1;
  else if (daysInactive <= r4.t2Days) points = r4.pT2;
  else if (daysInactive <= r4.t3Days) points = r4.pT3;
  else points = r4.pOver;
  return { name: 'R4 inactivity', points, reason: `No activity for ${daysInactive} days.` };
}

function r5Drawdown(udo: UdoRecord): RiskFactor {
  const { r5 } = RISK_MODEL;
  const dd = drawdown(udo);
  const status = udo.reportedStatus;
  const isOpen = status === 'OPEN_ACTIVE' || status === 'OPEN_INACTIVE';
  let points: number;
  if (isOpen && dd < r5.lowThresh) points = r5.pLow;
  else if (isOpen && dd < r5.midThresh) points = r5.pMid;
  else if ((isOpen || status === 'PENDING_CLOSE') && dd >= r5.fullThresh) points = r5.pFull;
  else points = r5.pNone;
  return { name: 'R5 drawdown', points, reason: `Drawdown ${pct(dd)} while ${status}.` };
}

function r6Dollars(udo: UdoRecord): RiskFactor {
  const { r6 } = RISK_MODEL;
  const amount = udo.amountObligated;
  let points: number;
  if (amount < r6.t1) points = r6.pT1;
  else if (amount < r6.t2) points = r6.pT2;
  else if (amount < r6.t3) points = r6.pT3;
  else points = r6.pOver;
  return { name: 'R6 dollars', points, reason: `Obligation ${usd(amount)}.` };
}

function r7Evidence(udo: UdoRecord, evidence: EvidenceItem[], rules: CrgRule[]): RiskFactor {
  const { r7 } = RISK_MODEL;
  const rule = rules.find((rl) => rl.appliesToStatus === udo.reportedStatus);
  const presentTypes = new Set(
    evidence.filter((e) => e.udoId === udo.id && e.present).map((e) => e.type),
  );
  const missing = rule ? rule.requiredEvidence.filter((t) => !presentTypes.has(t)) : [];
  const points = Math.round(Math.min(r7.cap, missing.length * r7.ptsPerMissing));
  return {
    name: 'R7 evidence',
    points,
    reason: `${missing.length} required evidence item(s) missing.`,
  };
}

function r8Anomaly(udo: UdoRecord, anomaly: PriorYearAnomalyResult | undefined): RiskFactor {
  const flagged = anomaly ? anomaly.outlierUdoIds.includes(udo.id) : false;
  return {
    name: 'R8 anomaly',
    points: flagged ? RISK_MODEL.r8.pts : 0,
    reason: flagged
      ? 'Flagged by prior-year anomaly check.'
      : 'Not flagged by prior-year anomaly check.',
  };
}

/** Map a 0–100 score to its band using RISK_MODEL.bands (SPEC §5.1, doc §4). */
export function bandForScore(score: number): RiskBand {
  const { bands } = RISK_MODEL;
  if (score >= bands.critical) return 'CRITICAL';
  if (score >= bands.high) return 'HIGH';
  if (score >= bands.medium) return 'MEDIUM';
  return 'LOW';
}

/**
 * SPEC §5.1 — deterministic, explainable risk score for one UDO. Pure over its
 * inputs + `asOfDate`. Reads only RISK_MODEL. The returned `score` equals the
 * sum of `factors[].points`, and `band` is `bandForScore(score)`.
 */
export function scoreRisk(
  udo: UdoRecord,
  finding: ValidationFinding,
  anomaly: PriorYearAnomalyResult | undefined,
  evidence: EvidenceItem[],
  rules: CrgRule[],
  asOfDate: string,
): RiskScore {
  const factors: RiskFactor[] = [
    r1Verdict(finding),
    r2Confidence(finding),
    r3PopExpiry(udo, asOfDate),
    r4Inactivity(udo, asOfDate),
    r5Drawdown(udo),
    r6Dollars(udo),
    r7Evidence(udo, evidence, rules),
    r8Anomaly(udo, anomaly),
  ];
  const score = factors.reduce((sum, f) => sum + f.points, 0);
  return { udoId: udo.id, score, band: bandForScore(score), factors, asOfDate };
}

/** Result of scoring a whole population: ranked scores + the run's audit trail. */
export interface RiskRun {
  scores: RiskScore[]; // sorted by score descending (ties broken by udoId)
  audit: AuditEvent[]; // exactly one event summarizing the scoring run
}

/**
 * SPEC §5.1 / §7 — score an entire population for review-worthiness. For each
 * UDO it pairs the line with its validation finding (by udoId) and its
 * component's prior-year anomaly result, scores it, then returns the scores
 * sorted by score descending (deterministic tie-break on udoId). Appends exactly
 * one immutable AuditEvent per run (the platform proposes; humans dispose — this
 * records that the AI ranked the population). Pure over inputs + `asOfDate`.
 */
export function scorePopulation(
  population: UdoRecord[],
  findings: ValidationFinding[],
  anomalies: PriorYearAnomalyResult[],
  evidence: EvidenceItem[],
  rules: CrgRule[],
  asOfDate: string,
): RiskRun {
  const findingById = new Map(findings.map((f) => [f.udoId, f]));
  const anomalyByComponent = new Map(anomalies.map((a) => [a.component, a]));

  const scores: RiskScore[] = population.map((udo) => {
    const finding = findingById.get(udo.id);
    if (!finding) throw new Error(`scorePopulation: no validation finding for ${udo.id}`);
    return scoreRisk(
      udo,
      finding,
      anomalyByComponent.get(udo.component),
      evidence,
      rules,
      asOfDate,
    );
  });

  scores.sort((a, b) => b.score - a.score || a.udoId.localeCompare(b.udoId));

  const bandMix: Record<RiskBand, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const s of scores) bandMix[s.band]++;

  const audit: AuditEvent[] = [
    {
      timestamp: `${asOfDate}T00:00:00.000Z`,
      actor: 'AI',
      action: 'RISK_SCORE',
      detail:
        `Scored ${scores.length} UDO(s) for risk as of ${asOfDate}. Bands: ` +
        `${bandMix.CRITICAL} CRITICAL, ${bandMix.HIGH} HIGH, ${bandMix.MEDIUM} MEDIUM, ${bandMix.LOW} LOW.`,
    },
  ];

  return { scores, audit };
}
