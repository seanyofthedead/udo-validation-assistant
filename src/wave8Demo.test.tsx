// @vitest-environment jsdom
// Task 8.5 — Wave 8 demo scenario, encoded end to end (IMPLEMENTATION_PLAN
// Wave 8 "Demo scenario"):
//   Leadership opens the portfolio view → sees coverage %, exception count, total
//   de-ob $, and a scorecard per component → clicks the FEMA exception count →
//   lands on FEMA's exception lines → opens one line's audit trail.
//
// Driven through the real Portfolio screen over the seed store. Every figure the
// leader sees is asserted equal to the pure engine output (no drift), and the
// drill-down lands on exactly the contributing lines. Queries are container-
// scoped (isolate: false shares the jsdom document across files).

import './test/setup';
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, fireEvent, within } from '@testing-library/react';
import { renderWithProviders } from './test/renderWithProviders';
import { Portfolio } from './screens';
import { createInitialState } from './state/store';
import { buildPortfolioSummary } from './domain';
import { formatUsd, formatPct } from './components';
import { crgRules, seedPopulation, seedEvidence, priorYearStats, AS_OF_DATE } from './data';

// Ground truth: the store exactly as the provider builds it, then the roll-up.
const state = createInitialState({
  population: seedPopulation,
  evidence: seedEvidence,
  rules: crgRules,
  priorStats: priorYearStats,
  asOfDate: AS_OF_DATE,
});
const { kpis, scorecards } = buildPortfolioSummary(state);

const verdictById = new Map(state.findings.map((f) => [f.udoId, f.verdict]));
const femaExceptionIds = state.population
  .filter((u) => u.component === 'FEMA')
  .filter((u) => {
    const v = verdictById.get(u.id);
    return v !== undefined && v !== 'VALID';
  })
  .map((u) => u.id);

afterEach(cleanup);

describe('Wave 8 demo scenario', () => {
  it('leadership opens the portfolio, reads the KPIs, and drills FEMA exceptions to the audit trail', () => {
    const { container } = renderWithProviders(<Portfolio />);
    const q = within(container);

    // --- Leadership sees the headline KPIs, equal to the engine output ---------
    expect(q.getByTestId('kpi-coverage')).toHaveTextContent(formatPct(kpis.coverage));
    expect(q.getByTestId('kpi-exceptions')).toHaveTextContent(String(kpis.exceptionCount));
    expect(q.getByTestId('kpi-deob')).toHaveTextContent(formatUsd(kpis.deobDollars));

    // --- ...and a scorecard per component in the portfolio ---------------------
    expect(scorecards.length).toBeGreaterThan(0);
    for (const s of scorecards) {
      expect(q.getByTestId(`scorecard-${s.component}`)).toBeInTheDocument();
    }

    // The scenario is scripted around FEMA — it must have exception lines.
    expect(femaExceptionIds.length).toBeGreaterThan(0);

    // --- Clicks the FEMA exception count → lands on FEMA's exception lines ------
    fireEvent.click(q.getByRole('button', { name: 'Drill into FEMA exception lines' }));

    const panel = q.getByTestId('drill-panel');
    const landedIds = within(panel)
      .getAllByTestId('drill-line')
      .map((li) => li.getAttribute('data-udo-id'));
    expect(landedIds).toEqual(femaExceptionIds);

    // --- Opens one line's audit trail -----------------------------------------
    const firstId = femaExceptionIds[0];
    const line = within(panel)
      .getAllByTestId('drill-line')
      .find((li) => li.getAttribute('data-udo-id') === firstId)!;
    const trail = within(line).getByLabelText(`Audit trail for ${firstId}`);
    const events = within(trail).getAllByTestId('drill-audit-event');
    expect(events.length).toBeGreaterThan(0);
    // The AI's validation of this very line is on the trail (explainable lineage).
    expect(trail).toHaveTextContent('VALIDATE');
  });
});
