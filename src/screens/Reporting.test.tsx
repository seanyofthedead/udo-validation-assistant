// @vitest-environment jsdom
// Task 3.7 — Reporting screen: clicking an export builds the file (serializer +
// Blob download) and appends an audit event.

import '../test/setup';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, cleanup, within } from '@testing-library/react';
import { renderWithProviders } from '../test/renderWithProviders';
import { Reporting } from './Reporting';

describe('Reporting screen', () => {
  beforeEach(() => {
    Object.assign(URL, {
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('offers CSV and JSON buttons for each of the four artifacts', () => {
    renderWithProviders(<Reporting />);
    for (const label of [
      'validated population',
      'exception worklist',
      'de-obligation shortlist',
      'audit trail',
    ]) {
      expect(screen.getByRole('button', { name: `Export ${label} as CSV` })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: `Export ${label} as JSON` })).toBeInTheDocument();
    }
  });

  it('clicking export triggers the download serializer and records an audit event', () => {
    renderWithProviders(<Reporting />);
    expect(screen.getByText('No exports yet.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Export de-obligation shortlist as CSV' }));

    // serializer + Blob download ran
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);

    // recorded on the audit trail (visible in "Recent exports")
    const recent = screen.getByRole('list', { name: 'Recent exports' });
    expect(
      within(recent).getByText(/exported de-obligation shortlist as CSV/i),
    ).toBeInTheDocument();
  });
});
