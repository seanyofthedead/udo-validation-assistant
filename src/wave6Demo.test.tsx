// @vitest-environment jsdom
// Task 6.8 — Wave 6 demo scenario, encoded end to end (IMPLEMENTATION_PLAN
// Wave 6 "Demo scenario"):
//   Create "Q3 UDO Review" → select a population → assign to USCG/TSA/FEMA →
//   set a due date → the detail shows three assignments at 0% → launch
//   (Draft → Active) → the detail reflects the active state.
//
// (The seed holds 20 lines across 5 components, so the demo's "three" is scoped
// by selecting one line each from USCG/TSA/FEMA — the platform's manual source.)
// Queries are container-scoped (the suite runs with isolate: false).

import './test/setup';
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, fireEvent, within } from '@testing-library/react';
import { renderWithProviders } from './test/renderWithProviders';
import { Campaigns, CampaignDetail } from './screens';

afterEach(cleanup);

const THREE = ['UDO-USCG-0001', 'UDO-TSA-0001', 'UDO-FEMA-0001'];
const DUE = '2026-07-15';

function selectMany(select: HTMLSelectElement, values: string[]) {
  for (const opt of Array.from(select.options)) opt.selected = values.includes(opt.value);
  fireEvent.change(select);
}

describe('Wave 6 demo scenario', () => {
  it('creates a 3-component campaign, shows assignments at 0%, then launches it', () => {
    const { container } = renderWithProviders(
      <>
        <Campaigns />
        <CampaignDetail />
      </>,
    );
    const q = within(container);

    // Scope a quarter-end review across three components, with a due date.
    fireEvent.change(q.getByLabelText('Campaign name'), { target: { value: 'Q3 UDO Review' } });
    fireEvent.change(q.getByLabelText('Period'), { target: { value: 'Q3 FY2026' } });
    fireEvent.change(q.getByLabelText('Default due date'), { target: { value: DUE } });
    fireEvent.change(q.getByLabelText('Population source'), { target: { value: 'MANUAL' } });
    selectMany(q.getByLabelText('Select obligations') as HTMLSelectElement, THREE);

    fireEvent.click(q.getByRole('button', { name: /create campaign/i }));

    // The detail shows three per-component assignments, each at 0%, due on DUE.
    const progress = container.querySelector<HTMLElement>(
      'table[aria-label="Assignment progress"]',
    )!;
    const rows = Array.from(progress.querySelectorAll('tbody tr'));
    expect(rows).toHaveLength(3);
    for (const r of rows) {
      expect(r.querySelector('[data-progress]')?.getAttribute('data-progress')).toBe('0');
      expect(r.textContent).toContain(DUE);
    }
    expect(
      container.querySelector('[data-overall-progress]')?.getAttribute('data-overall-progress'),
    ).toBe('0');

    // Launch: Draft → Active. The detail reflects the new state and offers the
    // next legal transition (Closing), not a relaunch.
    const launch = container.querySelector('[data-transition-to="ACTIVE"]') as HTMLButtonElement;
    expect(launch).not.toBeNull();
    fireEvent.click(launch);

    expect(container.querySelector('.badge[data-state="ACTIVE"]')).not.toBeNull();
    expect(container.querySelector('[data-transition-to="CLOSING"]')).not.toBeNull();
    expect(container.querySelector('[data-transition-to="ACTIVE"]')).toBeNull();
  });
});
