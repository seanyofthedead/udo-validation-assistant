// @vitest-environment jsdom
// Task 4.2 — empty/edge states: a no-evidence line abstains cleanly in the UI,
// and exporting with zero exceptions does not crash.

import './test/setup';
import { describe, it, expect, afterEach } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import { renderWithProviders } from './test/renderWithProviders';
import { Detail } from './screens/Detail';
import { createInitialState, type InitInputs } from './state/store';
import { exceptionsTable, deobShortlistTable, buildExport, toJson } from './export/serialize';
import { crgRules } from './data/crgRules';
import type { UdoRecord } from './domain/types';

const ASOF = '2026-06-21';

function udo(over: Partial<UdoRecord> = {}): UdoRecord {
  return {
    id: 'UDO-EDGE-0001',
    component: 'USCG',
    obligationNumber: 'OBL-EDGE',
    vendor: 'Edge Vendor',
    description: 'Edge case obligation',
    fundingType: 'O&M',
    amountObligated: 100_000,
    amountDisbursed: 50_000,
    reportedStatus: 'OPEN_ACTIVE',
    obligationDate: '2024-01-01',
    lastActivityDate: '2026-05-01',
    periodOfPerformanceEnd: '2026-12-31',
    ...over,
  };
}

afterEach(cleanup);

describe('edge: a no-evidence line abstains cleanly', () => {
  it('renders the abstain verdict and note without crashing on empty evidence', () => {
    const init: InitInputs = {
      population: [udo()],
      evidence: [], // no evidence at all
      rules: crgRules,
      priorStats: [],
      asOfDate: ASOF,
    };
    renderWithProviders(<Detail />, { init, initialUdoId: 'UDO-EDGE-0001' });

    expect(screen.getByText('Insufficient evidence')).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent(/abstained rather than guess/i);
    // cited rule is "none (abstained)"
    expect(screen.getByText(/none \(abstained\)/i)).toBeInTheDocument();
  });
});

describe('edge: export with zero exceptions does not crash', () => {
  it('produces a header-only CSV and an empty JSON array', () => {
    // One clean VALID line -> no exceptions.
    const state = createInitialState({
      population: [udo()],
      evidence: [
        { udoId: 'UDO-EDGE-0001', type: 'PO', present: true },
        { udoId: 'UDO-EDGE-0001', type: 'INVOICE', present: true, amount: 50_000 },
        { udoId: 'UDO-EDGE-0001', type: 'GL', present: true },
      ],
      rules: crgRules,
      priorStats: [],
      asOfDate: ASOF,
    });

    expect(state.findings[0].verdict).toBe('VALID');
    expect(exceptionsTable(state).rows).toHaveLength(0);

    const csv = buildExport('exceptions', 'CSV', state);
    // header row only, no data rows
    expect(csv.content.split('\n')).toHaveLength(1);

    const json = buildExport('exceptions', 'JSON', state);
    expect(JSON.parse(json.content)).toEqual([]);

    // The de-ob shortlist with no candidates is also empty, not a crash.
    expect(JSON.parse(toJson(deobShortlistTable(state)))).toEqual([]);
  });
});
