// Task 9.3 — cross-component analytics reconcile to the Wave 8 portfolio
// outputs. The heatmap's current-state rows are read straight off the latest
// snapshot's scorecards (so they cannot drift from buildPortfolioSummary), and
// the projectedStale row is read off the Wave 9.2 forecasts. Top movers reflect
// the exception delta between two real, recomputed snapshots.

import { describe, it, expect } from 'vitest';
import {
  buildCrossComponentAnalytics,
  snapshotPortfolioAt,
  buildPortfolioSummary,
  buildHorizon,
  forecastStaleObligations,
} from './index';
import type { Component, Forecast, PortfolioSnapshot } from './types';
import { createInitialState } from '../state/store';
import { crgRules, seedPopulation, seedEvidence, priorYearStats, AS_OF_DATE } from '../data';

const COMPONENTS: Component[] = ['USCG', 'TSA', 'FEMA', 'CBP', 'CISA'];

// Ground truth: the live store and its Wave 8 roll-up, exactly as the provider builds them.
const state = createInitialState({
  population: seedPopulation,
  evidence: seedEvidence,
  rules: crgRules,
  priorStats: priorYearStats,
  asOfDate: AS_OF_DATE,
});
const summary = buildPortfolioSummary(state);
const currentSnapshot: PortfolioSnapshot = { asOfDate: AS_OF_DATE, summary };

const snapshotInputs = {
  population: seedPopulation,
  evidence: seedEvidence,
  rules: crgRules,
  priorStats: priorYearStats,
};

const horizon = buildHorizon(AS_OF_DATE);
const forecasts: Forecast[] = COMPONENTS.map((c) =>
  forecastStaleObligations(seedPopulation, AS_OF_DATE, horizon, c),
);

function cell(
  analytics: ReturnType<typeof buildCrossComponentAnalytics>,
  metric: string,
  c: Component,
) {
  return analytics.heatmap.find((h) => h.metric === metric && h.component === c)!;
}

describe('snapshotPortfolioAt: a reproducible point-in-time roll-up', () => {
  it('at the current date reconciles to the live Wave 8 summary (review state empty)', () => {
    const snap = snapshotPortfolioAt(snapshotInputs, AS_OF_DATE);
    // createInitialState seeds no dispositions/responses, so the live summary and
    // a freshly recomputed snapshot must agree on every scorecard field.
    expect(snap.summary.scorecards).toEqual(summary.scorecards);
    expect(snap.summary.kpis.exceptionCount).toBe(summary.kpis.exceptionCount);
  });

  it('is deterministic — two snapshots at the same date are identical', () => {
    expect(snapshotPortfolioAt(snapshotInputs, AS_OF_DATE)).toEqual(
      snapshotPortfolioAt(snapshotInputs, AS_OF_DATE),
    );
  });
});

describe('buildCrossComponentAnalytics: heatmap reconciles to Wave 8 + forecast', () => {
  const analytics = buildCrossComponentAnalytics({ snapshots: [currentSnapshot], forecasts });

  it('exposes one cell per (metric, component) for the components present', () => {
    expect(analytics.heatmap).toHaveLength(3 * summary.scorecards.length);
    expect(analytics.asOfDate).toBe(AS_OF_DATE);
  });

  it('exception cells equal the per-component scorecard exception counts (no drift)', () => {
    for (const s of summary.scorecards) {
      expect(cell(analytics, 'exceptions', s.component).value).toBe(s.exceptionCount);
    }
  });

  it('critical cells equal the per-component scorecard CRITICAL risk-mix counts', () => {
    for (const s of summary.scorecards) {
      expect(cell(analytics, 'critical', s.component).value).toBe(s.riskMix.CRITICAL);
    }
  });

  it('projectedStale cells equal the per-component forecast projected value', () => {
    for (const f of forecasts) {
      if (f.target === 'DEPARTMENT') continue;
      expect(cell(analytics, 'projectedStale', f.target).value).toBe(f.projectedValue);
    }
  });

  it('marks the row leader as the spike (the component to look at first)', () => {
    for (const metric of ['exceptions', 'critical', 'projectedStale'] as const) {
      const row = analytics.heatmap.filter((h) => h.metric === metric);
      const rowMax = Math.max(...row.map((h) => h.value));
      const spikes = row.filter((h) => h.isSpike);
      if (rowMax > 0) {
        expect(spikes.length).toBeGreaterThan(0);
        for (const s of spikes) expect(s.value).toBe(rowMax);
      } else {
        expect(spikes).toHaveLength(0);
      }
    }
  });

  it('intensity is value / row-max in [0,1]', () => {
    for (const h of analytics.heatmap) {
      expect(h.intensity).toBeGreaterThanOrEqual(0);
      expect(h.intensity).toBeLessThanOrEqual(1);
    }
    // The spike cell of a non-empty row has intensity 1.
    const exceptionSpike = analytics.heatmap.find((h) => h.metric === 'exceptions' && h.isSpike)!;
    expect(exceptionSpike.intensity).toBe(1);
  });

  it('has no top movers with a single snapshot (no baseline)', () => {
    expect(analytics.topMovers).toEqual([]);
  });
});

describe('buildCrossComponentAnalytics: top movers over a two-point series', () => {
  // A real earlier snapshot (two quarters back): fewer lines have expired / gone
  // dormant, so exceptions are lower → a positive mover into the present (USCG
  // crosses an OPEN_ACTIVE staleness trigger between this date and now).
  const priorDate = '2025-12-21';
  const priorSnapshot = snapshotPortfolioAt(snapshotInputs, priorDate);
  const series = [priorSnapshot, currentSnapshot];
  const analytics = buildCrossComponentAnalytics({ snapshots: series, forecasts });

  it('reports movers whose delta equals current − prior exception counts', () => {
    const priorByComponent = new Map(
      priorSnapshot.summary.scorecards.map((s) => [s.component, s.exceptionCount]),
    );
    const currentByComponent = new Map(
      currentSnapshot.summary.scorecards.map((s) => [s.component, s.exceptionCount]),
    );
    for (const m of analytics.topMovers) {
      expect(m.from).toBe(priorByComponent.get(m.component) ?? 0);
      expect(m.to).toBe(currentByComponent.get(m.component) ?? 0);
      expect(m.delta).toBe(m.to - m.from);
      expect(m.delta).not.toBe(0); // zero-delta components are not "movers"
    }
  });

  it('sorts movers by absolute delta, largest first', () => {
    const mags = analytics.topMovers.map((m) => Math.abs(m.delta));
    const sorted = [...mags].sort((a, b) => b - a);
    expect(mags).toEqual(sorted);
  });

  it('surfaces at least one mover (the portfolio is not static over a quarter)', () => {
    expect(analytics.topMovers.length).toBeGreaterThan(0);
  });
});
