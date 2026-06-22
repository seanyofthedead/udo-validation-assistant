// @vitest-environment jsdom
// Task 5.11 — Wave 5 demo scenario, encoded end to end (IMPLEMENTATION_PLAN
// Wave 5 "Demo scenario"):
//   Load seed → population scored → queue ranks CRITICAL/HIGH to the top with
//   visible factors → analyst opens the top line and sees the score broken into
//   factors → filter to one component and one band narrows the list.
//
// Queries are container-scoped (the suite runs with isolate: false).

import './test/setup';
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, fireEvent, within } from '@testing-library/react';
import { renderWithProviders } from './test/renderWithProviders';
import { HighRiskQueue, Detail } from './screens';
import { createInitialState } from './state/store';
import { crgRules, seedPopulation, seedEvidence, priorYearStats, AS_OF_DATE } from './data';

afterEach(cleanup);

function rows(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('tbody tr'));
}

describe('Wave 5 demo scenario', () => {
  it('scores the loaded population and records one risk-scoring audit event', () => {
    const state = createInitialState({
      population: seedPopulation,
      evidence: seedEvidence,
      rules: crgRules,
      priorStats: priorYearStats,
      asOfDate: AS_OF_DATE,
    });

    // Every line is scored, ranked by score descending.
    expect(state.riskScores).toHaveLength(seedPopulation.length);
    for (let i = 1; i < state.riskScores.length; i++) {
      expect(state.riskScores[i - 1].score).toBeGreaterThanOrEqual(state.riskScores[i].score);
    }
    // The AI ranking is auditable.
    expect(state.auditLog.some((e) => e.action === 'RISK_SCORE')).toBe(true);
  });

  it('the queue ranks CRITICAL/HIGH to the top, each with visible factors', () => {
    const { container } = renderWithProviders(<HighRiskQueue />);
    const top = rows(container).slice(0, 3);

    // The top of the worklist is the high-severity bands.
    for (const tr of top) {
      expect(['CRITICAL', 'HIGH']).toContain(tr.getAttribute('data-band'));
    }
    expect(top[0].getAttribute('data-band')).toBe('CRITICAL');

    // Each top row surfaces at least one contributing factor.
    for (const tr of top) {
      expect(tr.querySelectorAll('.factor-chip').length).toBeGreaterThan(0);
    }
  });

  it('opening the top line shows its score broken into factors that sum to the score', () => {
    const topId = 'UDO-USCG-0002'; // the seed CRITICAL line
    const { container } = renderWithProviders(<Detail />, { initialUdoId: topId });

    const displayed = Number(
      container.querySelector('[data-risk-score]')?.getAttribute('data-risk-score'),
    );
    expect(displayed).toBeGreaterThanOrEqual(75); // CRITICAL

    const points = Array.from(container.querySelectorAll('[data-points]')).map((el) =>
      Number(el.getAttribute('data-points')),
    );
    expect(points).toHaveLength(8); // R1–R8
    expect(points.reduce((s, p) => s + p, 0)).toBe(displayed);
  });

  it('filtering to one component and one band narrows the list', () => {
    const { container } = renderWithProviders(<HighRiskQueue />);
    const before = rows(container).length;

    fireEvent.change(within(container).getByLabelText('Component'), { target: { value: 'USCG' } });
    fireEvent.change(within(container).getByLabelText('Risk band'), {
      target: { value: 'CRITICAL' },
    });

    const after = rows(container);
    expect(after.length).toBeLessThan(before);
    expect(after.length).toBeGreaterThan(0);
    for (const tr of after) {
      expect(tr.getAttribute('data-udo-id')).toMatch(/^UDO-USCG-/);
      expect(tr.getAttribute('data-band')).toBe('CRITICAL');
    }
  });
});
