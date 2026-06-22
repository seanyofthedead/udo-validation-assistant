// @vitest-environment jsdom
// Task 6.6 — Campaign list + create wizard. Creates a campaign end to end:
// fill the wizard, pick "top N by risk", create, and assert it lands in the
// campaign list as DRAFT with the previewed assignments. Queries are
// container-scoped (the suite runs with isolate: false).

import './../test/setup';
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, fireEvent, within } from '@testing-library/react';
import { renderWithProviders } from '../test/renderWithProviders';
import { Campaigns } from './Campaigns';

afterEach(cleanup);

describe('Campaigns create wizard (task 6.6)', () => {
  it('previews per-component assignments for a top-N population', () => {
    const { container } = renderWithProviders(<Campaigns />);
    const q = within(container);

    // Default source is top-N (10). The preview table lists ≥1 assignment.
    const preview = q.getByLabelText('Assignment preview');
    const previewRows = within(preview).getAllByRole('row').slice(1); // drop header
    expect(previewRows.length).toBeGreaterThan(0);

    // The previewed obligation counts sum to the selected population size (10).
    const counts = previewRows.map((r) =>
      Number(r.querySelector('[data-count]')?.getAttribute('data-count')),
    );
    expect(counts.reduce((s, n) => s + n, 0)).toBe(10);
  });

  it('creates a DRAFT campaign that appears in the list with its assignments', () => {
    const { container } = renderWithProviders(<Campaigns />);
    const q = within(container);

    fireEvent.change(q.getByLabelText('Campaign name'), { target: { value: 'Q3 UDO Review' } });
    fireEvent.change(q.getByLabelText('Period'), { target: { value: 'Q3 FY2026' } });

    // Capture the previewed assignment count before creating.
    const preview = q.getByLabelText('Assignment preview');
    const previewCount = within(preview).getAllByRole('row').slice(1).length;

    fireEvent.click(q.getByRole('button', { name: /create campaign/i }));

    const list = q.getByLabelText('Campaign list');
    const rows = within(list).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(1);
    expect(rows[0].getAttribute('data-state')).toBe('DRAFT');
    expect(within(rows[0]).getByText('Q3 UDO Review')).toBeInTheDocument();
    // Assignment-count cell matches the number of previewed assignments.
    const countCell = rows[0].querySelectorAll('td')[3];
    expect(Number(countCell.textContent)).toBe(previewCount);
  });

  it('disables Create until a name, period, and non-empty population are present', () => {
    const { container } = renderWithProviders(<Campaigns />);
    const q = within(container);
    const create = q.getByRole('button', { name: /create campaign/i }) as HTMLButtonElement;

    // Name + period blank initially → disabled even though top-N has a population.
    expect(create.disabled).toBe(true);

    fireEvent.change(q.getByLabelText('Campaign name'), { target: { value: 'X' } });
    fireEvent.change(q.getByLabelText('Period'), { target: { value: 'Q3' } });
    expect(create.disabled).toBe(false);
  });
});
