// Portfolio aggregation — SPEC §5 (Phase 4, Wave 8). Pure, READ-ONLY projections
// over the Phase 1–3 records that give leadership a department-wide scorecard
// which drills to the line. Same invariants as the other engines: no React, no
// clock/random — "now" is the explicit `asOfDate`.
//
// The contract (Wave 8 acceptance criteria): every portfolio KPI equals the
// aggregate of its source records, with NO drift. To make that impossible to
// violate, the per-component scorecards are computed first and the department
// KPIs are derived by SUMMING the scorecards (counts, dollars, risk mix). The
// only KPIs not summed from scorecards are sourced directly and reconcilably:
// totalObligated (Σ population amounts) and campaignCompletion (over assignments).
//
// Lineage: each scorecard carries `udoIds`, so a KPI → component → lines →
// (finding / risk / evidence / audit) drill-down has the line set it needs.

import type {
  Assignment,
  Component,
  ComponentScorecard,
  DeobOpportunity,
  Disposition,
  PortfolioKpis,
  PortfolioSummary,
  Response,
  RiskBand,
  RiskMix,
  RiskScore,
  UdoRecord,
  ValidationFinding,
} from './types';

// Canonical component order so the scorecard grid is deterministic regardless of
// population ordering (mirrors assignment.ts's COMPONENT_ORDER).
const COMPONENT_ORDER: readonly Component[] = ['USCG', 'TSA', 'FEMA', 'CBP', 'CISA'];

/** Everything the portfolio roll-up reads. Maps 1:1 from AppState fields. */
export interface PortfolioInputs {
  population: UdoRecord[];
  findings: ValidationFinding[];
  riskScores: RiskScore[];
  deobOpportunities: DeobOpportunity[];
  dispositions: Disposition[];
  responses: Response[];
  assignments: Assignment[];
  asOfDate: string;
}

/** A fresh, all-zero risk-mix accumulator (one slot per band). */
function emptyRiskMix(): RiskMix {
  return { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
}

/** Add `b` into `a` in place, returning `a` (elementwise band sum). */
function addRiskMix(a: RiskMix, b: RiskMix): RiskMix {
  a.LOW += b.LOW;
  a.MEDIUM += b.MEDIUM;
  a.HIGH += b.HIGH;
  a.CRITICAL += b.CRITICAL;
  return a;
}

/**
 * A line is "reviewed" once a human has acted on it: a disposition was recorded
 * (CONFIRM/OVERRIDE), or the owning component answered it to HQ (a SUBMITTED or
 * VALIDATED response). This is the coverage numerator — the share of the
 * population that the review workflow has actually touched.
 */
function reviewedUdoIds(dispositions: Disposition[], responses: Response[]): Set<string> {
  const reviewed = new Set<string>();
  for (const d of dispositions) reviewed.add(d.udoId);
  for (const r of responses) {
    if (r.state === 'SUBMITTED' || r.state === 'VALIDATED') reviewed.add(r.udoId);
  }
  return reviewed;
}

/**
 * SPEC §5 — the scorecard for one component over its slice of the population.
 * `coverage` is reviewed/total (0 when the component owns no lines). `riskMix`
 * counts each scored line by band (sums to the component's scored lines).
 * `deobDollars` rolls up only CONFIRMED opportunities — confirmed dollars are
 * what leadership may act on; the platform never auto-posts.
 */
export function componentScorecard(
  component: Component,
  input: PortfolioInputs,
): ComponentScorecard {
  const { population, findings, riskScores, deobOpportunities, dispositions, responses } = input;

  const lines = population.filter((u) => u.component === component);
  const udoIds = lines.map((u) => u.id);
  const idSet = new Set(udoIds);

  const verdictById = new Map(findings.map((f) => [f.udoId, f.verdict]));
  const bandById = new Map(riskScores.map((s) => [s.udoId, s.band]));
  const reviewed = reviewedUdoIds(dispositions, responses);

  let reviewedCount = 0;
  let exceptionCount = 0;
  const riskMix = emptyRiskMix();
  for (const u of lines) {
    if (reviewed.has(u.id)) reviewedCount++;
    const verdict = verdictById.get(u.id);
    if (verdict !== undefined && verdict !== 'VALID') exceptionCount++;
    const band = bandById.get(u.id) as RiskBand | undefined;
    if (band !== undefined) riskMix[band]++;
  }

  const deobDollars = deobOpportunities
    .filter((o) => o.state === 'CONFIRMED' && idSet.has(o.udoId))
    .reduce((sum, o) => sum + o.estimatedRecoverable, 0);

  const udoCount = lines.length;
  return {
    component,
    udoCount,
    reviewedCount,
    coverage: udoCount > 0 ? reviewedCount / udoCount : 0,
    exceptionCount,
    deobDollars,
    riskMix,
    udoIds,
  };
}

/**
 * SPEC §5 — the full department roll-up. Builds one scorecard per component that
 * owns at least one line (canonical order), then derives the KPIs by summing the
 * scorecards so the numbers cannot drift from their sources. campaignCompletion
 * is COMPLETE assignments over all assignments (1 when there are none — vacuously
 * complete). Pure over its inputs + `asOfDate`.
 */
export function buildPortfolioSummary(input: PortfolioInputs): PortfolioSummary {
  const { population, assignments, asOfDate } = input;

  const present = COMPONENT_ORDER.filter((c) => population.some((u) => u.component === c));
  const scorecards = present.map((c) => componentScorecard(c, input));

  const riskMix = scorecards.reduce((acc, s) => addRiskMix(acc, s.riskMix), emptyRiskMix());
  const udoCount = scorecards.reduce((n, s) => n + s.udoCount, 0);
  const reviewedCount = scorecards.reduce((n, s) => n + s.reviewedCount, 0);
  const exceptionCount = scorecards.reduce((n, s) => n + s.exceptionCount, 0);
  const deobDollars = scorecards.reduce((n, s) => n + s.deobDollars, 0);
  const totalObligated = population.reduce((n, u) => n + u.amountObligated, 0);

  const completeAssignments = assignments.filter((a) => a.state === 'COMPLETE').length;
  const campaignCompletion = assignments.length > 0 ? completeAssignments / assignments.length : 1;

  const kpis: PortfolioKpis = {
    asOfDate,
    udoCount,
    totalObligated,
    reviewedCount,
    coverage: udoCount > 0 ? reviewedCount / udoCount : 0,
    exceptionCount,
    deobDollars,
    campaignCompletion,
    riskMix,
  };

  return { kpis, scorecards };
}
