// @vitest-environment jsdom
// Task 7.6 — Component Response Workspace. A component fills out and submits a
// response set: concur on one line, contest another (with a reason), and the
// mandatory-reason discipline keeps the contest's Submit disabled until a reason
// is present. Queries are container-scoped (the suite runs with isolate: false).

import './../test/setup';
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, fireEvent, within } from '@testing-library/react';
import { renderWithProviders } from '../test/renderWithProviders';
import { Campaigns } from './Campaigns';
import { ComponentWorkspace } from './ComponentWorkspace';

afterEach(cleanup);

const USCG_LINES = ['UDO-USCG-0001', 'UDO-USCG-0002'];

function selectMany(select: HTMLSelectElement, values: string[]) {
  for (const opt of Array.from(select.options)) opt.selected = values.includes(opt.value);
  fireEvent.change(select);
}

/** Create a DRAFT campaign assigning two USCG lines, so the workspace has work. */
function createUscgCampaign(q: ReturnType<typeof within>) {
  fireEvent.change(q.getByLabelText('Campaign name'), { target: { value: 'Q3 UDO Review' } });
  fireEvent.change(q.getByLabelText('Period'), { target: { value: 'Q3 FY2026' } });
  fireEvent.change(q.getByLabelText('Population source'), { target: { value: 'MANUAL' } });
  selectMany(q.getByLabelText('Select obligations') as HTMLSelectElement, USCG_LINES);
  fireEvent.click(q.getByRole('button', { name: /create campaign/i }));
}

describe('Component Response Workspace (task 7.6)', () => {
  it('submits a response set: concur one line, contest another with a reason', () => {
    const { container } = renderWithProviders(
      <>
        <Campaigns />
        <ComponentWorkspace />
      </>,
    );
    createUscgCampaign(within(container));

    // The workspace defaults to USCG (the only component with assigned work) and
    // lists both assigned lines.
    const lineRows = container.querySelectorAll('table[aria-label="Assigned lines CMP-01-USCG"] tbody tr');
    expect(lineRows).toHaveLength(2);

    // Line 1: concur (no reason needed) → submit.
    const concurBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Submit UDO-USCG-0001"]')!;
    expect(concurBtn.disabled).toBe(false);
    fireEvent.click(concurBtn);

    const concurCell = container.querySelector('tr[data-udo-id="UDO-USCG-0001"] td[data-response-state]')!;
    expect(concurCell.getAttribute('data-response-state')).toBe('SUBMITTED');
    expect(concurCell.getAttribute('data-response-action')).toBe('CONCUR');

    // Line 2: switch to CONTEST → Submit disabled until a reason is entered.
    fireEvent.change(container.querySelector('select[aria-label="Response action for UDO-USCG-0002"]')!, {
      target: { value: 'CONTEST' },
    });
    const contestBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Submit UDO-USCG-0002"]')!;
    expect(contestBtn.disabled).toBe(true); // mandatory-reason discipline

    fireEvent.change(container.querySelector('textarea[aria-label="Reason for UDO-USCG-0002"]')!, {
      target: { value: 'Work is active; vendor invoiced last week.' },
    });
    fireEvent.change(container.querySelector('input[aria-label="Evidence reference for UDO-USCG-0002"]')!, {
      target: { value: 'mock://upload/invoice.pdf' },
    });
    expect(contestBtn.disabled).toBe(false);
    fireEvent.click(contestBtn);

    const contestCell = container.querySelector('tr[data-udo-id="UDO-USCG-0002"] td[data-response-state]')!;
    expect(contestCell.getAttribute('data-response-state')).toBe('SUBMITTED');
    expect(contestCell.getAttribute('data-response-action')).toBe('CONTEST');
  });

  it('shows an empty-state when no campaign has been launched yet', () => {
    const { container } = renderWithProviders(<ComponentWorkspace />);
    expect(container.textContent).toContain('No assignments yet');
  });
});
