// @vitest-environment jsdom
// Task 3.2 — UDO Inventory: filtering narrows rows; sorting reorders them.

import '../test/setup';
import { describe, it, expect, afterEach } from 'vitest';
import { screen, fireEvent, cleanup } from '@testing-library/react';
import { renderWithProviders } from '../test/renderWithProviders';
import { Inventory } from './Inventory';

afterEach(cleanup);

function bodyRowIds(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('tbody tr')).map(
    (tr) => tr.getAttribute('data-udo-id') ?? '',
  );
}

describe('Inventory: rendering', () => {
  it('lists the full population with a verdict badge per row', () => {
    const { container } = renderWithProviders(<Inventory />);
    expect(bodyRowIds(container)).toHaveLength(20);
    // at least one of each badge style is present in the seed
    expect(container.querySelector('[data-verdict="VALID"]')).not.toBeNull();
    expect(container.querySelector('[data-verdict="QUESTIONABLE"]')).not.toBeNull();
    expect(container.querySelector('[data-verdict="INSUFFICIENT_EVIDENCE"]')).not.toBeNull();
  });
});

describe('Inventory: filtering', () => {
  it('narrows rows when a component is selected', () => {
    const { container } = renderWithProviders(<Inventory />);
    fireEvent.change(screen.getByLabelText('Component'), { target: { value: 'USCG' } });
    const ids = bodyRowIds(container);
    expect(ids).toHaveLength(5); // USCG has 5 records in the seed
    expect(ids.every((id) => id.startsWith('UDO-USCG-'))).toBe(true);
  });

  it('narrows rows when a status is selected', () => {
    const { container } = renderWithProviders(<Inventory />);
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'CLOSED' } });
    expect(bodyRowIds(container)).toHaveLength(2); // 2 CLOSED records
  });
});

describe('Inventory: sorting', () => {
  it('reorders rows by obligated amount when the column header is toggled', () => {
    const { container } = renderWithProviders(<Inventory />);
    // Default sort is obligated descending -> largest first (CISA large award).
    expect(bodyRowIds(container)[0]).toBe('UDO-CISA-0003');

    fireEvent.click(screen.getByRole('button', { name: /Obligated/ }));
    // Now ascending -> smallest obligated first (CBP closed, $90k).
    expect(bodyRowIds(container)[0]).toBe('UDO-CBP-0004');
  });
});
