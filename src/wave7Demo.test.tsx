// @vitest-environment jsdom
// Task 7.8 — Wave 7 demo scenario, encoded end to end (IMPLEMENTATION_PLAN
// Wave 7 "Demo scenario"):
//   A component opens its assignment → concurs on two lines, contests one (with a
//   reason + evidence), corrects one status → submits → an overdue line
//   auto-escalates → HQ validates the contested response → a stale line is
//   confirmed as a de-obligation opportunity.
//
// Driven entirely through the real screens (Campaigns → ComponentWorkspace →
// Tracker) over one shared store. Queries are container-scoped (isolate: false).

import './test/setup';
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, fireEvent, within } from '@testing-library/react';
import { renderWithProviders } from './test/renderWithProviders';
import { Campaigns, ComponentWorkspace, Tracker } from './screens';

afterEach(cleanup);

// Five USCG lines: -0001/-0002 concur, -0003 contest, -0004 correct, -0005 left
// unanswered (it is overdue AND a stale de-ob candidate — the line the loop is
// about). -0002 is $1.5M (a high-dollar escalation).
const USCG_LINES = ['UDO-USCG-0001', 'UDO-USCG-0002', 'UDO-USCG-0003', 'UDO-USCG-0004', 'UDO-USCG-0005'];
const STALE_LINE = 'UDO-USCG-0005';
const CONTESTED_LINE = 'UDO-USCG-0003';
const PAST_DUE = '2026-05-01'; // before AS_OF_DATE (2026-06-21) → overdue

function selectMany(select: HTMLSelectElement, values: string[]) {
  for (const opt of Array.from(select.options)) opt.selected = values.includes(opt.value);
  fireEvent.change(select);
}

const ASSIGNED = 'table[aria-label="Assigned lines CMP-01-USCG"]';
const SUBMITTED = 'table[aria-label="Submitted responses"]';
const DEOB = 'table[aria-label="De-ob opportunities"]';

describe('Wave 7 demo scenario', () => {
  it('runs the HQ→component→HQ loop: respond, escalate, validate, confirm de-ob', () => {
    const { container } = renderWithProviders(
      <>
        <Campaigns />
        <ComponentWorkspace />
        <Tracker />
      </>,
    );
    const q = within(container);
    const css = <T extends Element>(sel: string) => container.querySelector<T>(sel)!;

    // --- Campaign manager scopes an overdue review across five USCG lines ------
    fireEvent.change(q.getByLabelText('Campaign name'), { target: { value: 'Q3 UDO Review' } });
    fireEvent.change(q.getByLabelText('Period'), { target: { value: 'Q3 FY2026' } });
    fireEvent.change(q.getByLabelText('Default due date'), { target: { value: PAST_DUE } });
    fireEvent.change(q.getByLabelText('Population source'), { target: { value: 'MANUAL' } });
    selectMany(q.getByLabelText('Select obligations') as HTMLSelectElement, USCG_LINES);
    fireEvent.click(q.getByRole('button', { name: /create campaign/i }));

    expect(container.querySelectorAll(`${ASSIGNED} tbody tr`)).toHaveLength(5);

    // --- Component responds: concur 2, contest 1 (reason+evidence), correct 1 --
    const concur = (udoId: string) =>
      fireEvent.click(css<HTMLButtonElement>(`button[aria-label="Submit ${udoId}"]`));
    concur('UDO-USCG-0001');
    concur('UDO-USCG-0002');

    // Contest -0003 with a reason and a mock evidence reference.
    fireEvent.change(css(`select[aria-label="Response action for ${CONTESTED_LINE}"]`), {
      target: { value: 'CONTEST' },
    });
    fireEvent.change(css(`textarea[aria-label="Reason for ${CONTESTED_LINE}"]`), {
      target: { value: 'Vendor confirmed active work; invoice in flight.' },
    });
    fireEvent.change(css(`input[aria-label="Evidence reference for ${CONTESTED_LINE}"]`), {
      target: { value: 'mock://upload/po-amendment.pdf' },
    });
    fireEvent.click(css<HTMLButtonElement>(`button[aria-label="Submit ${CONTESTED_LINE}"]`));

    // Correct -0004's status (reason mandatory on a correction too).
    fireEvent.change(css('select[aria-label="Response action for UDO-USCG-0004"]'), {
      target: { value: 'CORRECT' },
    });
    fireEvent.change(css('select[aria-label="Corrected status for UDO-USCG-0004"]'), {
      target: { value: 'CLOSED' },
    });
    fireEvent.change(css('textarea[aria-label="Reason for UDO-USCG-0004"]'), {
      target: { value: 'Closeout package signed; status should be CLOSED.' },
    });
    fireEvent.click(css<HTMLButtonElement>('button[aria-label="Submit UDO-USCG-0004"]'));

    // Four lines answered; the contested one is recorded as a CONTEST.
    const stateOf = (udoId: string) =>
      css(`${ASSIGNED} tr[data-udo-id="${udoId}"] td[data-response-state]`).getAttribute(
        'data-response-state',
      );
    expect(stateOf('UDO-USCG-0001')).toBe('SUBMITTED');
    expect(stateOf(CONTESTED_LINE)).toBe('SUBMITTED');
    expect(
      css(`${ASSIGNED} tr[data-udo-id="${CONTESTED_LINE}"] td[data-response-action]`).getAttribute(
        'data-response-action',
      ),
    ).toBe('CONTEST');

    // --- An overdue line auto-escalates (the unanswered, stale -0005) ----------
    fireEvent.click(q.getByRole('button', { name: /re-evaluate escalations/i }));
    const escList = css('ul[aria-label="Escalation list"]');
    const overdue = Array.from(escList.querySelectorAll('li[data-trigger="OVERDUE"]')).map((li) =>
      li.getAttribute('data-target'),
    );
    expect(overdue).toContain(STALE_LINE); // the line nobody answered
    // The $1.5M line escalates to leadership on dollars.
    expect(escList.querySelector('li[data-trigger="HIGH_DOLLAR"][data-target="UDO-USCG-0002"]')).not.toBeNull();

    // --- HQ validates the contested response ----------------------------------
    const validateBtn = css<HTMLButtonElement>(`button[aria-label="Validate ${CONTESTED_LINE}"]`);
    fireEvent.click(validateBtn);
    expect(
      css(`${SUBMITTED} tr[data-udo-id="${CONTESTED_LINE}"]`).getAttribute('data-response-state'),
    ).toBe('VALIDATED');

    // --- A stale line is confirmed as a de-obligation opportunity -------------
    fireEvent.click(css<HTMLButtonElement>(`button[aria-label="Begin review ${STALE_LINE}"]`));
    fireEvent.change(css(`textarea[aria-label="De-ob reason for ${STALE_LINE}"]`), {
      target: { value: 'PoP long expired, drawdown 10%; recommend de-obligation.' },
    });
    fireEvent.click(css<HTMLButtonElement>(`button[aria-label="Confirm de-ob ${STALE_LINE}"]`));
    expect(css(`${DEOB} tr[data-udo-id="${STALE_LINE}"]`).getAttribute('data-deob-state')).toBe(
      'CONFIRMED',
    );
  });
});
