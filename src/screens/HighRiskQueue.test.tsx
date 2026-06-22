// @vitest-environment jsdom
// Task 5.7 — High-Risk Queue (risk-ranked). Generalizes the Phase 1 queue
// (SPEC §5.2): the whole population, ranked by risk score descending, with a
// band chip and top factors per row, and filters that narrow the worklist.

import '../test/setup';
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../test/renderWithProviders';
import { HighRiskQueue } from './HighRiskQueue';
import { seedPopulation } from '../data';

afterEach(cleanup);

function bodyRows(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('tbody tr'));
}

function rowScores(container: HTMLElement): number[] {
  return bodyRows(container).map((tr) =>
    Number(tr.querySelector('[data-score]')?.getAttribute('data-score') ?? ''),
  );
}

describe('HighRiskQueue (risk-ranked)', () => {
  it('lists the whole population, ranked by risk score descending by default', () => {
    const { container } = renderWithProviders(<HighRiskQueue />);
    const rows = bodyRows(container);
    expect(rows).toHaveLength(seedPopulation.length);

    const scores = rowScores(container);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]); // non-increasing
    }
  });

  it('renders a risk-band chip on every row', () => {
    const { container } = renderWithProviders(<HighRiskQueue />);
    const chips = container.querySelectorAll('tbody tr [data-band]');
    expect(chips).toHaveLength(seedPopulation.length);
    // The top row is the CRITICAL line the seed is engineered to produce.
    const firstBand = bodyRows(container)[0].getAttribute('data-band');
    expect(firstBand).toBe('CRITICAL');
  });

  it('shows up to three contributing factors per row', () => {
    const { container } = renderWithProviders(<HighRiskQueue />);
    for (const tr of bodyRows(container)) {
      expect(tr.querySelectorAll('.factor-chip').length).toBeLessThanOrEqual(3);
    }
  });

  it('a band filter narrows the rows', () => {
    const { container, getByLabelText } = renderWithProviders(<HighRiskQueue />);
    const before = bodyRows(container).length;

    fireEvent.change(getByLabelText('Risk band'), { target: { value: 'CRITICAL' } });

    const after = bodyRows(container);
    expect(after.length).toBeLessThan(before);
    expect(after.length).toBeGreaterThan(0);
    for (const tr of after) expect(tr.getAttribute('data-band')).toBe('CRITICAL');
  });

  it('a component filter narrows the rows to one component', () => {
    const { container, getByLabelText } = renderWithProviders(<HighRiskQueue />);
    fireEvent.change(getByLabelText('Component'), { target: { value: 'USCG' } });
    const ids = bodyRows(container).map((tr) => tr.getAttribute('data-udo-id') ?? '');
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every((id) => id.startsWith('UDO-USCG-'))).toBe(true);
  });

  it('a dollar-floor filter excludes smaller obligations', () => {
    const { container, getByLabelText } = renderWithProviders(<HighRiskQueue />);
    const before = bodyRows(container).length;
    fireEvent.change(getByLabelText('Minimum obligated dollars'), { target: { value: '1000000' } });
    const after = bodyRows(container).length;
    expect(after).toBeLessThan(before);
  });
});
