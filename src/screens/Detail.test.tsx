// @vitest-environment jsdom
// Task 3.3 — Detail panel renders a known QUESTIONABLE line with its justification.

import '../test/setup';
import { describe, it, expect, afterEach } from 'vitest';
import { screen, fireEvent, cleanup } from '@testing-library/react';
import { renderWithProviders } from '../test/renderWithProviders';
import { Detail } from './Detail';

afterEach(cleanup);

describe('Detail: AI findings panel', () => {
  it('renders a known QUESTIONABLE line with verdict, confidence, cited rule, and justification', () => {
    // UDO-USCG-0003 is QUESTIONABLE via the expired/inactive contradiction.
    renderWithProviders(<Detail />, { initialUdoId: 'UDO-USCG-0003' });

    expect(screen.getByText('Questionable')).toBeInTheDocument();
    expect(screen.getByText(/confidence 100%/i)).toBeInTheDocument();
    expect(screen.getByText(/CRG-OPEN-ACTIVE-01/)).toBeInTheDocument();
    // the justification text from the engine (distinct from the record label)
    expect(
      screen.getByText(/period of performance ended .* with no activity/i),
    ).toBeInTheDocument();
  });

  it('shows the abstain note for the INSUFFICIENT_EVIDENCE line', () => {
    renderWithProviders(<Detail />, { initialUdoId: 'UDO-TSA-0003' });
    expect(screen.getByText('Insufficient evidence')).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent(/abstained rather than guess/i);
  });

  it('shows de-obligation candidacy with recoverable amount and reasons', () => {
    renderWithProviders(<Detail />, { initialUdoId: 'UDO-CISA-0003' });
    expect(screen.getByText(/Candidate/)).toBeInTheDocument();
    expect(screen.getByText(/\$4,800,000/)).toBeInTheDocument();
  });

  it('prompts for a selection when no UDO is chosen, then shows detail on pick', () => {
    renderWithProviders(<Detail />);
    expect(screen.getByText(/Select a UDO to view its details/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Select UDO'), { target: { value: 'UDO-USCG-0001' } });
    expect(screen.getByText('Valid')).toBeInTheDocument();
  });
});
