// @vitest-environment jsdom
// Task 7.7 — Escalations & De-Obligation Tracker. The escalation banner lists
// overdue + high-dollar lines after a re-evaluation; the de-ob list walks an
// opportunity through its lifecycle, enforcing the mandatory reason on confirm.
// Queries are container-scoped (the suite runs with isolate: false).

import './../test/setup';
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, fireEvent, within } from '@testing-library/react';
import { renderWithProviders } from '../test/renderWithProviders';
import { Campaigns } from './Campaigns';
import { Tracker } from './Tracker';

afterEach(cleanup);

const USCG_LINES = ['UDO-USCG-0001', 'UDO-USCG-0002']; // 0002 is $1.5M (high-dollar)
const PAST_DUE = '2026-05-01'; // before the seed AS_OF_DATE (2026-06-21) → overdue

function selectMany(select: HTMLSelectElement, values: string[]) {
  for (const opt of Array.from(select.options)) opt.selected = values.includes(opt.value);
  fireEvent.change(select);
}

describe('Escalation banner (task 7.7)', () => {
  it('lists overdue and high-dollar escalations after re-evaluation', () => {
    const { container } = renderWithProviders(
      <>
        <Campaigns />
        <Tracker />
      </>,
    );
    const q = within(container);

    // Scope an overdue campaign over a high-dollar USCG line.
    fireEvent.change(q.getByLabelText('Campaign name'), { target: { value: 'Q3 UDO Review' } });
    fireEvent.change(q.getByLabelText('Period'), { target: { value: 'Q3 FY2026' } });
    fireEvent.change(q.getByLabelText('Default due date'), { target: { value: PAST_DUE } });
    fireEvent.change(q.getByLabelText('Population source'), { target: { value: 'MANUAL' } });
    selectMany(q.getByLabelText('Select obligations') as HTMLSelectElement, USCG_LINES);
    fireEvent.click(q.getByRole('button', { name: /create campaign/i }));

    // Before evaluation the banner is empty; re-evaluate to populate it.
    expect(container.querySelector('[data-escalation-empty]')).not.toBeNull();
    fireEvent.click(q.getByRole('button', { name: /re-evaluate escalations/i }));

    const list = container.querySelector('ul[aria-label="Escalation list"]')!;
    const triggers = Array.from(list.querySelectorAll('li')).map((li) => li.getAttribute('data-trigger'));
    expect(triggers).toContain('OVERDUE');
    expect(triggers).toContain('HIGH_DOLLAR');
    // The high-dollar escalation targets the $1.5M line and routes to leadership (L2).
    const high = list.querySelector('li[data-trigger="HIGH_DOLLAR"]')!;
    expect(high.getAttribute('data-target')).toBe('UDO-USCG-0002');
    expect(high.getAttribute('data-level')).toBe('2');
  });
});

describe('De-obligation opportunity lifecycle (task 7.7)', () => {
  it('walks an opportunity Identified → Under Review → Confirmed, reason required', () => {
    const { container } = renderWithProviders(<Tracker />);

    // The seed identifies de-ob opportunities at init; take the first row.
    const firstRow = container.querySelector('table[aria-label="De-ob opportunities"] tbody tr')!;
    const udoId = firstRow.getAttribute('data-udo-id')!;
    expect(firstRow.getAttribute('data-deob-state')).toBe('IDENTIFIED');

    // Begin review → UNDER_REVIEW exposes the disposition controls.
    fireEvent.click(container.querySelector<HTMLButtonElement>(`button[aria-label="Begin review ${udoId}"]`)!);
    const reviewingRow = container.querySelector(`tr[data-udo-id="${udoId}"]`)!;
    expect(reviewingRow.getAttribute('data-deob-state')).toBe('UNDER_REVIEW');

    // Confirm is disabled until a reason is supplied (mandatory-reason discipline).
    const confirmBtn = container.querySelector<HTMLButtonElement>(`button[aria-label="Confirm de-ob ${udoId}"]`)!;
    expect(confirmBtn.disabled).toBe(true);
    fireEvent.change(container.querySelector(`textarea[aria-label="De-ob reason for ${udoId}"]`)!, {
      target: { value: 'PoP long expired, drawdown low; recommend de-obligation.' },
    });
    expect(confirmBtn.disabled).toBe(false);

    fireEvent.click(confirmBtn);
    const confirmedRow = container.querySelector(`tr[data-udo-id="${udoId}"]`)!;
    expect(confirmedRow.getAttribute('data-deob-state')).toBe('CONFIRMED');
    expect(confirmedRow.querySelector('[data-disposition-reason]')?.textContent).toMatch(/CONFIRM/);
  });
});
