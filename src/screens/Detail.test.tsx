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
    // Anchored so it matches the AI-finding confidence span, not the risk
    // panel's "Validation confidence 100%." factor reason (Wave 5 added that).
    expect(screen.getByText(/^confidence 100%$/i)).toBeInTheDocument();
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

describe('Detail: risk assessment panel (Wave 5)', () => {
  it('breaks the score into factors whose points sum to the displayed score', () => {
    // UDO-USCG-0002 is the seed CRITICAL line.
    const { container } = renderWithProviders(<Detail />, { initialUdoId: 'UDO-USCG-0002' });

    const scoreEl = container.querySelector('[data-risk-score]');
    const displayedScore = Number(scoreEl?.getAttribute('data-risk-score'));
    expect(displayedScore).toBeGreaterThan(0);

    const factorPoints = Array.from(container.querySelectorAll('[data-points]')).map((el) =>
      Number(el.getAttribute('data-points')),
    );
    expect(factorPoints).toHaveLength(8); // R1–R8
    const sum = factorPoints.reduce((s, p) => s + p, 0);
    expect(sum).toBe(displayedScore);

    // the footer Total cell also equals the score
    const total = Number(
      container.querySelector('[data-total-score]')?.getAttribute('data-total-score'),
    );
    expect(total).toBe(displayedScore);
  });

  it('shows the risk band chip for the line', () => {
    const { container } = renderWithProviders(<Detail />, { initialUdoId: 'UDO-USCG-0002' });
    const chip = container.querySelector('#risk-title ~ .finding-verdict [data-band]');
    expect(chip?.getAttribute('data-band')).toBe('CRITICAL');
  });
});
