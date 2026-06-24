// @vitest-environment jsdom
// Task 9.6 — Wave 9 demo scenario, encoded end to end through the real App
// (IMPLEMENTATION_PLAN Wave 9 "Demo scenario"):
//   Open the command center → the cross-component heatmap highlights one
//   component's spike → the forecast panel projects N stale obligations next
//   quarter with the basis shown → drill to the lines driving the projection.
//
// Driven by clicking the actual nav and the actual controls; every figure the
// leader sees is asserted equal to the pure engine output (no drift). Queries
// are container-scoped (isolate: false shares the jsdom document across files).

import './test/setup';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent, within } from '@testing-library/react';
import App from './App';
import { createInitialState } from './state/store';
import {
  buildCrossComponentAnalytics,
  buildHorizon,
  buildPortfolioSummary,
  forecastStaleObligations,
  snapshotPortfolioAt,
} from './domain';
import type { PortfolioSnapshot } from './domain';
import { crgRules, seedPopulation, seedEvidence, priorYearStats, AS_OF_DATE } from './data';

// Ground truth: rebuild the console's analytics + forecast exactly as the screen does.
const state = createInitialState({
  population: seedPopulation,
  evidence: seedEvidence,
  rules: crgRules,
  priorStats: priorYearStats,
  asOfDate: AS_OF_DATE,
});
const summary = buildPortfolioSummary(state);
const currentSnapshot: PortfolioSnapshot = { asOfDate: AS_OF_DATE, summary };
const priorSnapshot = snapshotPortfolioAt(
  {
    population: seedPopulation,
    evidence: seedEvidence,
    rules: crgRules,
    priorStats: priorYearStats,
  },
  buildHorizon(AS_OF_DATE, -180).endDate,
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
const deptForecast = forecastStaleObligations(seedPopulation, AS_OF_DATE, horizon, 'DEPARTMENT');

// The projected-stale spike: the component the heatmap should highlight — and the
// same component that drives the department forecast (one coherent story).
const projectedSpike = analytics.heatmap.find((h) => h.metric === 'projectedStale' && h.isSpike)!;

afterEach(cleanup);

describe('Wave 9 demo scenario', () => {
  it('opens the console, reads the spike + projection, and drills to the driving line', () => {
    const { container } = render(<App />);
    const q = within(container);

    // --- Open the command center from the nav ----------------------------------
    fireEvent.click(q.getByRole('button', { name: 'Enterprise Command Center' }));
    expect(
      q.getByRole('heading', { level: 2, name: 'Enterprise Command Center' }),
    ).toBeInTheDocument();

    // --- The heatmap highlights one component's spike --------------------------
    expect(deptForecast.projectedValue).toBeGreaterThan(0); // the demo has a projection
    const spikeCell = q.getByTestId(`heat-projectedStale-${projectedSpike.component}`);
    expect(spikeCell).toHaveAttribute('data-spike', 'true');
    expect(spikeCell).toHaveTextContent(String(projectedSpike.value));

    // --- The forecast panel projects N stale next quarter, with its basis -------
    expect(q.getByTestId('forecast-badge')).toHaveTextContent('Projection');
    const projection = q.getByTestId('forecast-projection');
    expect(projection).toHaveTextContent(String(deptForecast.projectedValue));
    expect(projection).toHaveTextContent(horizon.endDate); // "next quarter" end
    const basis = q.getByTestId('forecast-basis');
    expect(basis).toHaveTextContent(deptForecast.method);
    expect(basis).toHaveTextContent(AS_OF_DATE);
    expect(basis).toHaveTextContent(horizon.endDate);

    // The spike component is exactly the component driving the projection.
    expect(deptForecast.drivers.every((d) => d.component === projectedSpike.component)).toBe(true);

    // --- Drill to the lines driving the projection ------------------------------
    const driver = deptForecast.drivers[0];
    expect(q.getByTestId(`forecast-driver-${driver.udoId}`)).toBeInTheDocument();
    fireEvent.click(q.getByRole('button', { name: `Drill to ${driver.udoId}` }));

    // The App navigates to the UDO Detail with the driving line selected.
    expect(q.getByRole('heading', { level: 2, name: 'UDO Detail' })).toBeInTheDocument();
    const select = q.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe(driver.udoId);
    const record = seedPopulation.find((u) => u.id === driver.udoId)!;
    expect(q.getByText(record.vendor)).toBeInTheDocument();
  });
});
