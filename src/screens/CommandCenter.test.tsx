// @vitest-environment jsdom
// Task 9.4 — the Enterprise Command Center console renders the cross-component
// heatmap and the top movers, and every value equals the pure engine output
// (buildCrossComponentAnalytics) over the same seed. The spike cells the screen
// marks must match the engine's isSpike. Queries are container-scoped
// (isolate: false shares the jsdom document across files).

import './../test/setup';
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, within } from '@testing-library/react';
import { renderWithProviders } from '../test/renderWithProviders';
import { CommandCenter } from './CommandCenter';
import { createInitialState } from '../state/store';
import {
  buildCrossComponentAnalytics,
  buildHorizon,
  buildPortfolioSummary,
  forecastStaleObligations,
  snapshotPortfolioAt,
} from '../domain';
import type { HeatmapMetric, PortfolioSnapshot } from '../domain';
import { crgRules, seedPopulation, seedEvidence, priorYearStats, AS_OF_DATE } from '../data';

// Ground truth: rebuild the analytics exactly as the screen does.
const state = createInitialState({
  population: seedPopulation,
  evidence: seedEvidence,
  rules: crgRules,
  priorStats: priorYearStats,
  asOfDate: AS_OF_DATE,
});
const summary = buildPortfolioSummary(state);
const currentSnapshot: PortfolioSnapshot = { asOfDate: AS_OF_DATE, summary };
const priorDate = buildHorizon(AS_OF_DATE, -180).endDate;
const priorSnapshot = snapshotPortfolioAt(
  {
    population: seedPopulation,
    evidence: seedEvidence,
    rules: crgRules,
    priorStats: priorYearStats,
  },
  priorDate,
);
const present = summary.scorecards.map((s) => s.component);
const horizon = buildHorizon(AS_OF_DATE);
const forecasts = present.map((c) =>
  forecastStaleObligations(seedPopulation, AS_OF_DATE, horizon, c),
);
const analytics = buildCrossComponentAnalytics({
  snapshots: [priorSnapshot, currentSnapshot],
  forecasts,
});

const METRICS: HeatmapMetric[] = ['exceptions', 'critical', 'projectedStale'];

afterEach(cleanup);

describe('Enterprise Command Center console', () => {
  it('renders the heatmap with one cell per (metric, component) equal to the engine', () => {
    const { container } = renderWithProviders(<CommandCenter />, {
      initialScreen: 'command-center',
    });
    const q = within(container);

    expect(q.getByRole('table', { name: 'Cross-component heatmap' })).toBeInTheDocument();

    for (const metric of METRICS) {
      for (const c of present) {
        const cell = analytics.heatmap.find((h) => h.metric === metric && h.component === c)!;
        expect(q.getByTestId(`heat-${metric}-${c}`)).toHaveTextContent(String(cell.value));
      }
    }
  });

  it('marks exactly the engine’s spike cells (the components to look at first)', () => {
    const { container } = renderWithProviders(<CommandCenter />, {
      initialScreen: 'command-center',
    });
    const q = within(container);

    let spikeCount = 0;
    for (const metric of METRICS) {
      for (const c of present) {
        const cell = analytics.heatmap.find((h) => h.metric === metric && h.component === c)!;
        const el = q.getByTestId(`heat-${metric}-${c}`);
        if (cell.isSpike) {
          expect(el).toHaveAttribute('data-spike', 'true');
          spikeCount++;
        } else {
          expect(el).not.toHaveAttribute('data-spike');
        }
      }
    }
    // The seed lights up at least one spike per non-empty row.
    expect(spikeCount).toBeGreaterThan(0);
  });

  it('renders the top movers with their signed change, matching the engine', () => {
    expect(analytics.topMovers.length).toBeGreaterThan(0); // the seed moves over two quarters

    const { container } = renderWithProviders(<CommandCenter />, {
      initialScreen: 'command-center',
    });
    const q = within(container);

    expect(q.getByRole('table', { name: 'Top movers' })).toBeInTheDocument();
    for (const m of analytics.topMovers) {
      const row = q.getByTestId(`mover-${m.component}`);
      expect(within(row).getByTestId(`mover-${m.component}-delta`)).toHaveTextContent(
        m.delta > 0 ? `+${m.delta}` : String(m.delta),
      );
    }
  });
});
