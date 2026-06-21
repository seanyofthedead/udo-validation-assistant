// Task 2.2 — override guard: empty/whitespace reason is rejected (no-op);
// a provided reason is accepted. Confirm requires no reason.

import { describe, it, expect } from 'vitest';
import { appReducer, createInitialState, type AppState } from './store';
import { crgRules } from '../data/crgRules';
import { seedPopulation, seedEvidence, priorYearStats, AS_OF_DATE } from '../data/seed';

function initialState(): AppState {
  return createInitialState({
    population: seedPopulation,
    evidence: seedEvidence,
    rules: crgRules,
    priorStats: priorYearStats,
    asOfDate: AS_OF_DATE,
  });
}

const TS = '2026-06-21T12:00:00.000Z';

describe('override guard', () => {
  it.each(['', '   ', '\t', '\n  \n'])(
    'rejects an override with a blank reason (%j) as a no-op',
    (reason) => {
      const s0 = initialState();
      const s1 = appReducer(s0, {
        type: 'OVERRIDE',
        udoId: 'UDO-USCG-0003',
        overrideVerdict: 'VALID',
        reason,
        user: 'analyst@dhs.gov',
        timestamp: TS,
      });
      expect(s1).toBe(s0); // unchanged
      expect(s1.dispositions).toHaveLength(0);
    },
  );

  it('accepts an override with a non-empty reason', () => {
    const s0 = initialState();
    const s1 = appReducer(s0, {
      type: 'OVERRIDE',
      udoId: 'UDO-USCG-0003',
      overrideVerdict: 'VALID',
      reason: 'Vendor confirmed ongoing performance.',
      user: 'analyst@dhs.gov',
      timestamp: TS,
    });
    expect(s1.dispositions).toHaveLength(1);
    expect(s1.dispositions[0].reason).toBe('Vendor confirmed ongoing performance.');
    expect(s1.auditLog.length).toBe(s0.auditLog.length + 1);
  });

  it('confirm needs no reason', () => {
    const s0 = initialState();
    const s1 = appReducer(s0, {
      type: 'CONFIRM',
      udoId: 'UDO-USCG-0001',
      user: 'analyst@dhs.gov',
      timestamp: TS,
    });
    expect(s1.dispositions).toHaveLength(1);
    expect(s1.dispositions[0].reason).toBe('');
  });
});
