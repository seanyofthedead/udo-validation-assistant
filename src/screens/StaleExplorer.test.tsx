// @vitest-environment jsdom
// Task 5.9 — Stale Obligation Explorer (SPEC §5.6): aging buckets, expired-PoP
// and low-drawdown filters, and sort by recoverable $.
//
// Queries are scoped to the rendered container (via `within`) rather than the
// whole document: the suite runs with `isolate: false`, so document-scoped
// queries can occasionally see a sibling file's render.

import '../test/setup';
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, fireEvent, within } from '@testing-library/react';
import { renderWithProviders } from '../test/renderWithProviders';
import { StaleExplorer } from './StaleExplorer';
import { seedPopulation } from '../data';

afterEach(cleanup);

function bodyRows(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('tbody tr'));
}

function recoverables(container: HTMLElement): number[] {
  return bodyRows(container).map((tr) =>
    Number(tr.querySelector('[data-recoverable]')?.getAttribute('data-recoverable') ?? ''),
  );
}

describe('StaleExplorer', () => {
  it('lists the whole population with aging buckets summarized', () => {
    const { container } = renderWithProviders(<StaleExplorer />);
    expect(bodyRows(container)).toHaveLength(seedPopulation.length);
    // four aging-bucket cards
    expect(container.querySelectorAll('.stat-card[data-bucket]')).toHaveLength(4);
  });

  it('sorts by recoverable $ descending by default', () => {
    const { container } = renderWithProviders(<StaleExplorer />);
    const amounts = recoverables(container);
    for (let i = 1; i < amounts.length; i++) {
      expect(amounts[i - 1]).toBeGreaterThanOrEqual(amounts[i]);
    }
    // the de-ob candidate with the largest recoverable leads
    expect(bodyRows(container)[0].getAttribute('data-udo-id')).toBe('UDO-CISA-0003');
  });

  it('toggles sort direction to ascending', () => {
    const { container } = renderWithProviders(<StaleExplorer />);
    fireEvent.click(within(container).getByRole('button', { name: /Recoverable/ }));
    const amounts = recoverables(container);
    for (let i = 1; i < amounts.length; i++) {
      expect(amounts[i - 1]).toBeLessThanOrEqual(amounts[i]);
    }
  });

  it('the expired-PoP filter narrows to expired obligations only', () => {
    const { container } = renderWithProviders(<StaleExplorer />);
    const before = bodyRows(container).length;
    fireEvent.click(within(container).getByLabelText(/Expired PoP only/));
    const after = bodyRows(container);
    expect(after.length).toBeLessThan(before);
    expect(after.length).toBeGreaterThan(0);
    // every shown row reports a positive days-past-PoP (not "Not expired")
    for (const tr of after) {
      expect(tr.getAttribute('data-bucket')).not.toBe('Not expired');
    }
  });

  it('the low-drawdown filter narrows the rows', () => {
    const { container } = renderWithProviders(<StaleExplorer />);
    const before = bodyRows(container).length;
    fireEvent.click(within(container).getByLabelText(/Low drawdown only/));
    expect(bodyRows(container).length).toBeLessThan(before);
  });
});
