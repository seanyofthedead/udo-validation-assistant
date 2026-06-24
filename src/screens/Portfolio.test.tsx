// @vitest-environment jsdom
// Task 8.3 — Portfolio Command Center: the rendered KPIs and the per-component
// scorecard grid must equal the pure engine output over the same seed (no drift
// between what leadership sees and what reconciles to the records). Queries are
// container-scoped (isolate:false shares the jsdom document across files).

import './../test/setup';
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, within } from '@testing-library/react';
import { renderWithProviders } from '../test/renderWithProviders';
import { Portfolio } from './Portfolio';
import { createInitialState } from '../state/store';
import { buildPortfolioSummary } from '../domain';
import { formatUsd, formatPct } from '../components';
import { crgRules, seedPopulation, seedEvidence, priorYearStats, AS_OF_DATE } from '../data';

// Ground truth: build the store exactly as the provider does, then aggregate.
const state = createInitialState({
  population: seedPopulation,
  evidence: seedEvidence,
  rules: crgRules,
  priorStats: priorYearStats,
  asOfDate: AS_OF_DATE,
});
const { kpis, scorecards } = buildPortfolioSummary(state);

afterEach(cleanup);

describe('Portfolio Command Center', () => {
  it('renders headline KPIs equal to the engine output', () => {
    const { container } = renderWithProviders(<Portfolio />);
    const q = within(container);

    expect(q.getByTestId('kpi-coverage')).toHaveTextContent(formatPct(kpis.coverage));
    expect(q.getByTestId('kpi-exceptions')).toHaveTextContent(String(kpis.exceptionCount));
    expect(q.getByTestId('kpi-deob')).toHaveTextContent(formatUsd(kpis.deobDollars));
    expect(q.getByTestId('kpi-campaign-completion')).toHaveTextContent(
      formatPct(kpis.campaignCompletion),
    );
    expect(q.getByTestId('kpi-total-obligated')).toHaveTextContent(formatUsd(kpis.totalObligated));
    expect(q.getByTestId('kpi-reviewed')).toHaveTextContent(
      `${kpis.reviewedCount} of ${kpis.udoCount} lines reviewed`,
    );
  });

  it('renders one scorecard row per present component, matching the engine', () => {
    const { container } = renderWithProviders(<Portfolio />);
    const q = within(container);

    // At least one component scorecard is present from the seed.
    expect(scorecards.length).toBeGreaterThan(0);

    for (const s of scorecards) {
      const row = q.getByTestId(`scorecard-${s.component}`);
      const rq = within(row);
      expect(rq.getByTestId(`scorecard-${s.component}-udoCount`)).toHaveTextContent(
        String(s.udoCount),
      );
      expect(rq.getByTestId(`scorecard-${s.component}-coverage`)).toHaveTextContent(
        formatPct(s.coverage),
      );
      expect(rq.getByTestId(`scorecard-${s.component}-exceptions`)).toHaveTextContent(
        String(s.exceptionCount),
      );
      expect(rq.getByTestId(`scorecard-${s.component}-deob`)).toHaveTextContent(
        formatUsd(s.deobDollars),
      );
      expect(rq.getByTestId(`scorecard-${s.component}-riskmix`)).toHaveTextContent(
        `${s.riskMix.CRITICAL} / ${s.riskMix.HIGH} / ${s.riskMix.MEDIUM} / ${s.riskMix.LOW}`,
      );
    }
  });

  it('scorecard exception counts sum to the headline exception KPI (no drift)', () => {
    const summed = scorecards.reduce((n, s) => n + s.exceptionCount, 0);
    expect(summed).toBe(kpis.exceptionCount);
  });
});
