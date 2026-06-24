// @vitest-environment jsdom
// G1 — UDO Process Map: the 10-step lifecycle renders with role, evidence, the
// manual→automated value lines, and a working deep link into the mapped screen.

import '../test/setup';
import { describe, it, expect, afterEach } from 'vitest';
import { screen, fireEvent, cleanup, within } from '@testing-library/react';
import { renderWithProviders } from '../test/renderWithProviders';
import { UdoProcessMap } from './UdoProcessMap';
import { AppShell } from './AppShell';

afterEach(cleanup);

describe('UdoProcessMap', () => {
  it('renders all ten process steps', () => {
    renderWithProviders(<UdoProcessMap />);
    const list = screen.getByRole('list', { name: /UDO process steps/i });
    expect(within(list).getAllByRole('listitem')).toHaveLength(10);
    // first and last steps by title
    expect(screen.getByRole('heading', { name: /1 · UDO data intake/i })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /10 · Continuous monitoring & controls/i }),
    ).toBeInTheDocument();
  });

  it('shows the manual→automated value framing on every step', () => {
    renderWithProviders(<UdoProcessMap />);
    expect(screen.getAllByText('Manual today')).toHaveLength(10);
    expect(screen.getAllByText('With the platform')).toHaveLength(10);
  });

  it('names the accountable DHS role and the evidence per step', () => {
    renderWithProviders(<UdoProcessMap />);
    expect(screen.getByText('UDO Coordinator (HQ)')).toBeInTheDocument();
    expect(screen.getByText('Reviewer / Certifier')).toBeInTheDocument();
    expect(screen.getByText('OCFO Leadership')).toBeInTheDocument();
  });

  it('deep-links from a step into the mapped product screen', () => {
    // Rendered inside the shell so navigation actually switches screens.
    renderWithProviders(<AppShell />, { initialScreen: 'process' });
    fireEvent.click(screen.getByRole('button', { name: /Open High-Risk Queue/i }));
    expect(screen.getByRole('heading', { level: 2, name: 'High-Risk Queue' })).toBeInTheDocument();
  });
});
