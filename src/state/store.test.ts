// Task 2.1 — reducer unit tests for confirm/override over the seed-backed state.

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

describe('createInitialState', () => {
  it('runs the pipeline once and seeds findings + AI audit events', () => {
    const s = initialState();
    expect(s.findings).toHaveLength(seedPopulation.length);
    expect(s.dispositions).toEqual([]);
    expect(s.auditLog.length).toBeGreaterThan(0);
    expect(s.auditLog.every((e) => e.actor === 'AI')).toBe(true);
  });
});

describe('appReducer: CONFIRM', () => {
  it('records a CONFIRM disposition (no reason) and appends a HUMAN audit event', () => {
    const s0 = initialState();
    const s1 = appReducer(s0, {
      type: 'CONFIRM',
      udoId: 'UDO-USCG-0001',
      user: 'analyst@dhs.gov',
      timestamp: TS,
    });
    expect(s1.dispositions).toHaveLength(1);
    expect(s1.dispositions[0]).toMatchObject({ udoId: 'UDO-USCG-0001', action: 'CONFIRM' });
    const last = s1.auditLog[s1.auditLog.length - 1];
    expect(last).toMatchObject({ actor: 'HUMAN', action: 'CONFIRM', udoId: 'UDO-USCG-0001' });
    expect(s1.auditLog.length).toBe(s0.auditLog.length + 1);
  });
});

describe('appReducer: OVERRIDE', () => {
  it('records an OVERRIDE disposition with verdict + reason and audits it', () => {
    const s0 = initialState();
    const s1 = appReducer(s0, {
      type: 'OVERRIDE',
      udoId: 'UDO-USCG-0003',
      overrideVerdict: 'VALID',
      reason: 'Confirmed active via vendor call.',
      user: 'analyst@dhs.gov',
      timestamp: TS,
    });
    expect(s1.dispositions[0]).toMatchObject({
      udoId: 'UDO-USCG-0003',
      action: 'OVERRIDE',
      overrideVerdict: 'VALID',
      reason: 'Confirmed active via vendor call.',
    });
    const last = s1.auditLog[s1.auditLog.length - 1];
    expect(last).toMatchObject({ actor: 'HUMAN', action: 'OVERRIDE', udoId: 'UDO-USCG-0003' });
    expect(last.detail).toContain('Confirmed active via vendor call.');
  });
});

describe('appReducer: purity', () => {
  it('does not mutate the prior state or its audit log', () => {
    const s0 = initialState();
    const beforeLen = s0.auditLog.length;
    const beforeFirst = s0.auditLog[0];
    const s1 = appReducer(s0, {
      type: 'CONFIRM',
      udoId: 'UDO-USCG-0001',
      user: 'u',
      timestamp: TS,
    });
    expect(s0.auditLog.length).toBe(beforeLen); // prior log unchanged
    expect(s0.auditLog[0]).toBe(beforeFirst); // prior entry identity preserved
    expect(s1.auditLog).not.toBe(s0.auditLog); // new array
  });

  it('ignores unknown actions', () => {
    const s0 = initialState();
    // @ts-expect-error — exercising the default branch with an unknown action
    const s1 = appReducer(s0, { type: 'NOPE' });
    expect(s1).toBe(s0);
  });
});
