// @vitest-environment jsdom
// Task 6.7 — Campaign Detail + progress. A campaign scoped to three components
// (USCG/TSA/FEMA) renders three per-component assignments, each at 0% while
// freshly created (NOT_STARTED), with a 0% overall and a launch action. Built by
// driving the create wizard so the detail reads real store state. Table queries
// are scoped via querySelector (the suite runs with isolate: false).

import './../test/setup';
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, fireEvent, within } from '@testing-library/react';
import { renderWithProviders } from '../test/renderWithProviders';
import { Campaigns } from './Campaigns';
import { CampaignDetail } from './CampaignDetail';

afterEach(cleanup);

const THREE = ['UDO-USCG-0001', 'UDO-TSA-0001', 'UDO-FEMA-0001'];

/** Select the given option values in a <select multiple> and fire change. */
function selectMany(select: HTMLSelectElement, values: string[]) {
  for (const opt of Array.from(select.options)) opt.selected = values.includes(opt.value);
  fireEvent.change(select);
}

function createThreeComponentCampaign(container: HTMLElement) {
  const q = within(container);
  fireEvent.change(q.getByLabelText('Campaign name'), { target: { value: 'Q3 UDO Review' } });
  fireEvent.change(q.getByLabelText('Period'), { target: { value: 'Q3 FY2026' } });
  fireEvent.change(q.getByLabelText('Population source'), { target: { value: 'MANUAL' } });
  selectMany(q.getByLabelText('Select obligations') as HTMLSelectElement, THREE);
  fireEvent.click(q.getByRole('button', { name: /create campaign/i }));
}

function progressRows(container: HTMLElement): HTMLElement[] {
  const table = container.querySelector<HTMLElement>('table[aria-label="Assignment progress"]');
  return table ? Array.from(table.querySelectorAll('tbody tr')) : [];
}

describe('Campaign Detail (task 6.7)', () => {
  it('renders three per-component assignments, each at 0%, with 0% overall', () => {
    const { container } = renderWithProviders(
      <>
        <Campaigns />
        <CampaignDetail />
      </>,
    );
    createThreeComponentCampaign(container);

    const rows = progressRows(container);
    expect(rows).toHaveLength(3);

    const components = rows.map((r) => r.getAttribute('data-component')).sort();
    expect(components).toEqual(['FEMA', 'TSA', 'USCG']);

    for (const r of rows) {
      expect(r.getAttribute('data-assignment-state')).toBe('NOT_STARTED');
      expect(r.querySelector('[data-progress]')?.getAttribute('data-progress')).toBe('0');
    }

    const overall = container.querySelector('[data-overall-progress]');
    expect(overall?.getAttribute('data-overall-progress')).toBe('0');
  });

  it('shows the DRAFT state badge and a launch (activate) action', () => {
    const { container } = renderWithProviders(
      <>
        <Campaigns />
        <CampaignDetail />
      </>,
    );
    createThreeComponentCampaign(container);

    // The detail title (h2#campaign-detail-title) reflects the opened campaign.
    expect(container.querySelector('#campaign-detail-title')?.textContent).toBe('Q3 UDO Review');
    expect(container.querySelector('.badge[data-state="DRAFT"]')).not.toBeNull();

    // The only legal next state from DRAFT is ACTIVE.
    expect(container.querySelector('[data-transition-to="ACTIVE"]')).not.toBeNull();
    expect(container.querySelector('[data-transition-to="CLOSED"]')).toBeNull();
  });
});
