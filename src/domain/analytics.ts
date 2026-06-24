// Cross-component analytics — SPEC §5.8 (Phase 4 → L5). The enterprise oversight
// layer: a time series of portfolio snapshots, a cross-component heatmap, and
// the top movers between the two latest snapshots. READ-ONLY and pure (no React,
// no clock/random — "now" is the explicit asOfDate).
//
// Reconciliation is the contract (Wave 9 acceptance): the current-state heatmap
// rows are read STRAIGHT OFF the latest snapshot's Wave 8 scorecards, so they
// cannot drift from buildPortfolioSummary. The `projectedStale` row is read off
// the per-component forecasts (Wave 9.2), and DEPARTMENT = Σ components holds by
// the forecast's partition property.

import { runValidation, type PriorYearAnomalyResult } from './engine';
import { scorePopulation } from './riskEngine';
import { identifyDeobOpportunities } from './deob';
import { buildPortfolioSummary } from './portfolio';
import type {
  Component,
  ComponentMover,
  CrgRule,
  CrossComponentAnalytics,
  EvidenceItem,
  Forecast,
  HeatmapCell,
  HeatmapMetric,
  PortfolioSnapshot,
  PriorYearStat,
  UdoRecord,
} from './types';

// Metrics shown as heatmap rows, in display order. `exceptions` and `critical`
// are current-state (reconcile to the Wave 8 scorecards); `projectedStale` is
// the forward-looking forecast row.
const HEATMAP_METRICS: readonly HeatmapMetric[] = ['exceptions', 'critical', 'projectedStale'];

// Number of top movers surfaced (largest |delta| between the two latest snapshots).
const TOP_MOVERS_LIMIT = 5;

/** Everything a point-in-time portfolio snapshot needs to be recomputed. */
export interface SnapshotInputs {
  population: UdoRecord[];
  evidence: EvidenceItem[];
  rules: CrgRule[];
  priorStats: PriorYearStat[];
}

/**
 * Recompute the full portfolio roll-up as of `asOfDate` and tag it as a
 * snapshot. The review state (dispositions / responses / assignments) is empty:
 * a historical snapshot reflects the obligations as the engines scored them at
 * that date, before any human review had landed. Pure over its inputs +
 * asOfDate, so a series of snapshots is fully reproducible (the time series the
 * command center trends and computes movers from).
 */
export function snapshotPortfolioAt(input: SnapshotInputs, asOfDate: string): PortfolioSnapshot {
  const run = runValidation(
    input.population,
    input.evidence,
    input.rules,
    input.priorStats,
    asOfDate,
  );
  const anomalies: PriorYearAnomalyResult[] = run.anomalies;
  const risk = scorePopulation(
    input.population,
    run.findings,
    anomalies,
    input.evidence,
    input.rules,
    asOfDate,
  );
  const deobOpportunities = identifyDeobOpportunities(run.deobFlags);
  const summary = buildPortfolioSummary({
    population: input.population,
    findings: run.findings,
    riskScores: risk.scores,
    deobOpportunities,
    dispositions: [],
    responses: [],
    assignments: [],
    asOfDate,
  });
  return { asOfDate, summary };
}

/** The current value of a heatmap metric for one component, off a snapshot. */
function metricValue(
  metric: HeatmapMetric,
  component: Component,
  snapshot: PortfolioSnapshot,
  projectedByComponent: Map<Component, number>,
): number {
  if (metric === 'projectedStale') return projectedByComponent.get(component) ?? 0;
  const card = snapshot.summary.scorecards.find((s) => s.component === component);
  if (!card) return 0;
  return metric === 'exceptions' ? card.exceptionCount : card.riskMix.CRITICAL;
}

/**
 * SPEC §5.8 — cross-component analytics over a snapshot series. The heatmap is
 * built from the LATEST snapshot (current state), one row per metric across the
 * components present in that snapshot, in scorecard order. Per metric row,
 * `intensity` normalizes against the row max (for coloring) and `isSpike` marks
 * the non-zero leader — the component leadership should look at first.
 *
 * Top movers compare the latest snapshot to the one before it on the
 * `exceptions` metric, sorted by |delta| desc (ties by component order). With
 * fewer than two snapshots there is no baseline, so movers is empty.
 *
 * `forecasts` supplies the per-component `projectedStale` row; pass the Wave 9.2
 * forecasts (one per component). Cells reconcile to those sources by construction.
 */
export function buildCrossComponentAnalytics(input: {
  snapshots: PortfolioSnapshot[];
  forecasts: Forecast[];
}): CrossComponentAnalytics {
  const { snapshots, forecasts } = input;
  if (snapshots.length === 0) {
    return { asOfDate: '', heatmap: [], topMovers: [] };
  }

  const latest = snapshots[snapshots.length - 1];
  const components = latest.summary.scorecards.map((s) => s.component);

  const projectedByComponent = new Map<Component, number>();
  for (const f of forecasts) {
    if (f.target !== 'DEPARTMENT') projectedByComponent.set(f.target, f.projectedValue);
  }

  // Build the grid, then mark each metric row's max as the spike + set intensity.
  const heatmap: HeatmapCell[] = [];
  for (const metric of HEATMAP_METRICS) {
    const row = components.map((component) => ({
      component,
      value: metricValue(metric, component, latest, projectedByComponent),
    }));
    const rowMax = row.reduce((max, c) => Math.max(max, c.value), 0);
    for (const c of row) {
      heatmap.push({
        component: c.component,
        metric,
        value: c.value,
        intensity: rowMax > 0 ? c.value / rowMax : 0,
        isSpike: c.value > 0 && c.value === rowMax,
      });
    }
  }

  const topMovers = computeTopMovers(snapshots);

  return { asOfDate: latest.asOfDate, heatmap, topMovers };
}

/** Largest exception-count movers between the two latest snapshots. */
function computeTopMovers(snapshots: PortfolioSnapshot[]): ComponentMover[] {
  if (snapshots.length < 2) return [];
  const latest = snapshots[snapshots.length - 1];
  const prior = snapshots[snapshots.length - 2];

  const priorExceptions = new Map(
    prior.summary.scorecards.map((s) => [s.component, s.exceptionCount]),
  );

  const movers: ComponentMover[] = latest.summary.scorecards.map((s) => {
    const from = priorExceptions.get(s.component) ?? 0;
    const to = s.exceptionCount;
    return { component: s.component, metric: 'exceptions', from, to, delta: to - from };
  });

  return movers
    .filter((m) => m.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, TOP_MOVERS_LIMIT);
}
