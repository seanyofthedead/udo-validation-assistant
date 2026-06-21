// @vitest-environment jsdom
// Task 3.4 — High-Risk Queue: ordering by $ desc; clean VALID lines excluded.

import '../test/setup';
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { renderWithProviders } from '../test/renderWithProviders';
import { HighRiskQueue } from './HighRiskQueue';

afterEach(cleanup);

function bodyRowIds(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('tbody tr')).map(
    (tr) => tr.getAttribute('data-udo-id') ?? '',
  );
}

describe('HighRiskQueue', () => {
  it('includes questionable lines and de-ob candidates, ranked by obligated $ desc', () => {
    const { container } = renderWithProviders(<HighRiskQueue />);
    const ids = bodyRowIds(container);
    // 4 QUESTIONABLE + 4 de-ob candidates = 8 rows
    expect(ids).toHaveLength(8);
    // largest obligations first
    expect(ids.slice(0, 4)).toEqual([
      'UDO-CISA-0003', // $5.0M (de-ob candidate)
      'UDO-FEMA-0002', // $1.0M (de-ob candidate)
      'UDO-CBP-0002', // $700k (de-ob candidate)
      'UDO-USCG-0005', // $600k (de-ob candidate)
    ]);
  });

  it('excludes clean VALID lines that are not de-ob candidates', () => {
    const { container } = renderWithProviders(<HighRiskQueue />);
    const ids = bodyRowIds(container);
    // UDO-USCG-0001 is a clean VALID line -> must not appear
    expect(ids).not.toContain('UDO-USCG-0001');
    expect(ids).not.toContain('UDO-FEMA-0001');
  });

  it('includes a de-ob candidate even though its verdict is VALID', () => {
    const { container } = renderWithProviders(<HighRiskQueue />);
    expect(bodyRowIds(container)).toContain('UDO-CISA-0003');
  });
});
