// @vitest-environment jsdom
// Task 8.3 — Portfolio Command Center: the rendered KPIs and the per-component
// scorecard grid must equal the pure engine output over the same seed (no drift
// between what leadership sees and what reconciles to the records). Queries are
// container-scoped (isolate:false shares the jsdom document across files).

import './../test/setup';
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, within, fireEvent } from '@testing-library/react';
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

// Expected exception lines straight from the records, in population order.
const verdictById = new Map(state.findings.map((f) => [f.udoId, f.verdict]));
const isException = (udoId: string) => {
  const v = verdictById.get(udoId);
  return v !== undefined && v !== 'VALID';
};
const allExceptionIds = state.population.filter((u) => isException(u.id)).map((u) => u.id);
const drillComponent = scorecards.find((s) => s.exceptionCount > 0)!.component;
const componentExceptionIds = state.population
  .filter((u) => u.component === drillComponent && isException(u.id))
  .map((u) => u.id);

function drillLineIds(container: HTMLElement): string[] {
  const panel = within(container).getByTestId('drill-panel');
  return within(panel)
    .getAllByTestId('drill-line')
    .map((li) => li.getAttribute('data-udo-id') ?? '');
}

describe('Portfolio drill-down: KPI → exactly the contributing lines → audit trail', () => {
  it('clicking a component exception count lists exactly that component’s exception lines', () => {
    const { container } = renderWithProviders(<Portfolio />);
    const q = within(container);

    // No drill panel until a count is clicked.
    expect(q.queryByTestId('drill-panel')).toBeNull();

    fireEvent.click(
      q.getByRole('button', { name: `Drill into ${drillComponent} exception lines` }),
    );

    expect(drillLineIds(container)).toEqual(componentExceptionIds);
  });

  it('clicking the department exception KPI lists exactly all exception lines', () => {
    const { container } = renderWithProviders(<Portfolio />);
    const q = within(container);

    fireEvent.click(q.getByRole('button', { name: 'Drill into all exception lines' }));

    const ids = drillLineIds(container);
    expect(ids).toEqual(allExceptionIds);
    expect(ids).toHaveLength(kpis.exceptionCount); // reconciles to the KPI
  });

  it('each drilled line shows its own audit trail (lineage to the recorded events)', () => {
    const { container } = renderWithProviders(<Portfolio />);
    const q = within(container);

    fireEvent.click(
      q.getByRole('button', { name: `Drill into ${drillComponent} exception lines` }),
    );

    const firstId = componentExceptionIds[0];
    const expectedEvents = state.auditLog.filter((e) => e.udoId === firstId).length;
    expect(expectedEvents).toBeGreaterThan(0); // every line has at least its VALIDATE event

    const line = within(container)
      .getAllByTestId('drill-line')
      .find((li) => li.getAttribute('data-udo-id') === firstId)!;
    const trail = within(line).getByLabelText(`Audit trail for ${firstId}`);
    expect(within(trail).getAllByTestId('drill-audit-event')).toHaveLength(expectedEvents);
  });

  it('Close dismisses the drill panel', () => {
    const { container } = renderWithProviders(<Portfolio />);
    const q = within(container);

    fireEvent.click(q.getByRole('button', { name: 'Drill into all exception lines' }));
    expect(q.getByTestId('drill-panel')).toBeInTheDocument();

    fireEvent.click(within(q.getByTestId('drill-panel')).getByRole('button', { name: 'Close' }));
    expect(q.queryByTestId('drill-panel')).toBeNull();
  });
});
