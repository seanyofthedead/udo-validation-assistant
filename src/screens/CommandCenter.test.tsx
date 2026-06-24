// @vitest-environment jsdom
// Task 9.4 — the Enterprise Command Center console renders the cross-component
// heatmap and the top movers, and every value equals the pure engine output
// (buildCrossComponentAnalytics) over the same seed. The spike cells the screen
// marks must match the engine's isSpike. Queries are container-scoped
// (isolate: false shares the jsdom document across files).

import './../test/setup';
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, fireEvent, within } from '@testing-library/react';
import { renderWithProviders } from '../test/renderWithProviders';
import { CommandCenter } from './CommandCenter';
import { Detail } from './Detail';
import { createInitialState } from '../state/store';
import {
  buildCrossComponentAnalytics,
  buildHorizon,
  buildPortfolioSummary,
  forecastStaleObligations,
  snapshotPortfolioAt,
} from '../domain';
import type { HeatmapMetric, PortfolioSnapshot, UdoRecord } from '../domain';
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

// The department forecast the panel shows (Wave 9.5 / 9.2).
const deptForecast = forecastStaleObligations(seedPopulation, AS_OF_DATE, horizon, 'DEPARTMENT');

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

describe('Command Center forecast panel (Task 9.5)', () => {
  it('always shows the "Projection" label and the basis, and the projected value', () => {
    const { container } = renderWithProviders(<CommandCenter />, {
      initialScreen: 'command-center',
    });
    const q = within(container);

    // The advisory framing is never optional.
    expect(q.getByTestId('forecast-badge')).toHaveTextContent('Projection');

    // The projected count + horizon, equal to the engine.
    expect(q.getByTestId('forecast-projection')).toHaveTextContent(
      String(deptForecast.projectedValue),
    );
    expect(q.getByTestId('forecast-projection')).toHaveTextContent(deptForecast.horizon.endDate);

    // The basis states the method and the inputs it ran over.
    const basis = q.getByTestId('forecast-basis');
    expect(basis).toHaveTextContent(deptForecast.method);
    expect(basis).toHaveTextContent(AS_OF_DATE);
    expect(basis).toHaveTextContent(deptForecast.horizon.endDate);
  });

  it('lists each driving line, and a driver drills to its UDO detail', () => {
    expect(deptForecast.drivers.length).toBeGreaterThan(0);

    // Render the console AND the Detail screen under one nav, so the drill lands.
    const { container } = renderWithProviders(
      <>
        <CommandCenter />
        <Detail />
      </>,
      { initialScreen: 'command-center' },
    );
    const q = within(container);

    for (const d of deptForecast.drivers) {
      expect(q.getByTestId(`forecast-driver-${d.udoId}`)).toBeInTheDocument();
    }

    const target = deptForecast.drivers[0].udoId;
    fireEvent.click(q.getByRole('button', { name: `Drill to ${target}` }));

    // The Detail screen now has the drilled obligation selected (lineage to the line).
    const select = q.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe(target);
    const targetRecord = seedPopulation.find((u) => u.id === target)!;
    expect(q.getByText(targetRecord.vendor)).toBeInTheDocument();
  });

  it('keeps the Projection label and basis even when nothing is projected to go stale', () => {
    // A single line whose PoP is far in the future never goes stale in the horizon,
    // so the department projection is 0 — but the advisory framing must still show.
    const stableLine: UdoRecord = {
      id: 'UDO-USCG-9001',
      component: 'USCG',
      obligationNumber: 'N00024-26-C-9001',
      vendor: 'Evergreen Systems',
      description: 'Multi-year support (active)',
      fundingType: 'O&M',
      amountObligated: 100_000,
      amountDisbursed: 50_000,
      reportedStatus: 'OPEN_ACTIVE',
      obligationDate: '2026-01-01',
      lastActivityDate: AS_OF_DATE,
      periodOfPerformanceEnd: '2030-12-31',
    };

    const { container } = renderWithProviders(<CommandCenter />, {
      initialScreen: 'command-center',
      init: {
        population: [stableLine],
        evidence: [],
        rules: crgRules,
        priorStats: [],
        asOfDate: AS_OF_DATE,
      },
    });
    const q = within(container);

    expect(q.getByTestId('forecast-badge')).toHaveTextContent('Projection');
    expect(q.getByTestId('forecast-projection')).toHaveTextContent('0');
    expect(q.getByTestId('forecast-basis')).toHaveTextContent('aging extrapolation');
    expect(q.getByTestId('forecast-no-drivers')).toBeInTheDocument();
  });
});
