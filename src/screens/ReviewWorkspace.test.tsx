// @vitest-environment jsdom
// Task 3.5 — Review Workspace: empty-reason override is blocked; a valid override
// is recorded and audited.

import '../test/setup';
import { describe, it, expect, afterEach } from 'vitest';
import { screen, fireEvent, cleanup, within } from '@testing-library/react';
import { renderWithProviders } from '../test/renderWithProviders';
import { ReviewWorkspace } from './ReviewWorkspace';
import { AppShell } from './AppShell';

afterEach(cleanup);

describe('ReviewWorkspace: picker stays on the review screen', () => {
  it('selecting another UDO in the picker does not navigate away to Detail', () => {
    renderWithProviders(<AppShell />, { initialScreen: 'review', initialUdoId: 'UDO-USCG-0003' });

    fireEvent.change(screen.getByLabelText('Select UDO'), {
      target: { value: 'UDO-USCG-0001' },
    });

    // still on the Review Workspace, not bounced to UDO Detail
    expect(screen.getByRole('heading', { level: 2, name: 'Review Workspace' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'UDO Detail' })).not.toBeInTheDocument();
  });
});

describe('ReviewWorkspace: override guard', () => {
  it('disables the override button until a reason is entered', () => {
    renderWithProviders(<ReviewWorkspace />, { initialUdoId: 'UDO-USCG-0003' });
    const button = screen.getByRole('button', { name: /Record override/i });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Reason/i), {
      target: { value: 'Vendor confirmed ongoing performance.' },
    });
    expect(button).toBeEnabled();
  });

  it('keeps the override blocked for a whitespace-only reason', () => {
    renderWithProviders(<ReviewWorkspace />, { initialUdoId: 'UDO-USCG-0003' });
    fireEvent.change(screen.getByLabelText(/Reason/i), { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: /Record override/i })).toBeDisabled();
  });
});

describe('ReviewWorkspace: recording dispositions', () => {
  it('records a valid override in the disposition history and the audit trail', () => {
    renderWithProviders(<ReviewWorkspace />, { initialUdoId: 'UDO-USCG-0003' });

    fireEvent.change(screen.getByLabelText(/New verdict/i), { target: { value: 'VALID' } });
    fireEvent.change(screen.getByLabelText(/Reason/i), {
      target: { value: 'Vendor confirmed ongoing performance.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Record override/i }));

    // recorded in disposition history
    const history = screen.getByRole('list', { name: 'Disposition history list' });
    expect(within(history).getByText(/OVERRIDE/)).toBeInTheDocument();
    expect(within(history).getByText(/Vendor confirmed ongoing performance/)).toBeInTheDocument();

    // audited
    const audit = screen.getByLabelText('Audit activity');
    expect(within(audit).getByText(/overrode the verdict to VALID/i)).toBeInTheDocument();
  });

  it('records a confirm with no reason required', () => {
    renderWithProviders(<ReviewWorkspace />, { initialUdoId: 'UDO-USCG-0001' });
    fireEvent.click(screen.getByRole('button', { name: /Confirm AI verdict/i }));
    const history = screen.getByRole('list', { name: 'Disposition history list' });
    expect(within(history).getByText(/CONFIRM/)).toBeInTheDocument();
  });
});

describe('ReviewWorkspace: reviewer determination (step 6)', () => {
  it('blocks the determination until a justification is entered', () => {
    renderWithProviders(<ReviewWorkspace />, { initialUdoId: 'UDO-USCG-0005' });
    const button = screen.getByRole('button', { name: /Record determination/i });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Justification/i), {
      target: { value: 'Expired PoP, 10% drawn — recover the balance.' },
    });
    expect(button).toBeEnabled();
  });

  it('records a determination in disposition history and the audit trail', () => {
    renderWithProviders(<ReviewWorkspace />, { initialUdoId: 'UDO-USCG-0005' });
    fireEvent.change(screen.getByLabelText(/Determination/i), {
      target: { value: 'DEOBLIGATE' },
    });
    fireEvent.change(screen.getByLabelText(/Justification/i), {
      target: { value: 'Expired PoP, 10% drawn — recover the balance.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Record determination/i }));

    const history = screen.getByRole('list', { name: 'Disposition history list' });
    expect(within(history).getByText(/DETERMINATION/)).toBeInTheDocument();
    expect(within(history).getByText(/DEOBLIGATE/)).toBeInTheDocument();

    const audit = screen.getByLabelText('Audit activity');
    expect(within(audit).getByText(/determined UDO-USCG-0005: DEOBLIGATE/i)).toBeInTheDocument();
  });
});
