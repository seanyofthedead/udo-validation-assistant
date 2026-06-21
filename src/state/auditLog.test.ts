// Task 2.3 — the audit log is append-only. Override and export each append an
// event; the log only grows and prior entries are never mutated.

import { describe, it, expect } from 'vitest';
import { appReducer, createInitialState, type AppState, type AppAction } from './store';
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

const overrideAction: AppAction = {
  type: 'OVERRIDE',
  udoId: 'UDO-USCG-0003',
  overrideVerdict: 'VALID',
  reason: 'Vendor confirmed performance.',
  user: 'analyst@dhs.gov',
  timestamp: TS,
};

const exportAction: AppAction = {
  type: 'RECORD_EXPORT',
  artifact: 'de-obligation shortlist',
  format: 'CSV',
  user: 'analyst@dhs.gov',
  timestamp: TS,
};

describe('immutable audit log', () => {
  it('override appends exactly one event', () => {
    const s0 = initialState();
    const s1 = appReducer(s0, overrideAction);
    expect(s1.auditLog.length).toBe(s0.auditLog.length + 1);
    expect(s1.auditLog[s1.auditLog.length - 1].action).toBe('OVERRIDE');
  });

  it('export appends exactly one EXPORT event', () => {
    const s0 = initialState();
    const s1 = appReducer(s0, exportAction);
    expect(s1.auditLog.length).toBe(s0.auditLog.length + 1);
    const last = s1.auditLog[s1.auditLog.length - 1];
    expect(last).toMatchObject({ actor: 'HUMAN', action: 'EXPORT' });
    expect(last.detail).toContain('de-obligation shortlist');
  });

  it('the log only grows, and every prior entry is preserved by identity', () => {
    let state = initialState();
    const snapshot = [...state.auditLog];
    const actions: AppAction[] = [
      overrideAction,
      { type: 'CONFIRM', udoId: 'UDO-USCG-0001', user: 'u', timestamp: TS },
      exportAction,
    ];
    for (const a of actions) {
      const prev = state;
      state = appReducer(state, a);
      expect(state.auditLog.length).toBe(prev.auditLog.length + 1);
    }
    // Every original AI event is still present, unchanged, in order.
    for (let i = 0; i < snapshot.length; i++) {
      expect(state.auditLog[i]).toBe(snapshot[i]);
    }
    expect(state.auditLog.length).toBe(snapshot.length + actions.length);
  });

  it('a rejected override does not touch the log', () => {
    const s0 = initialState();
    const s1 = appReducer(s0, { ...overrideAction, reason: '   ' });
    expect(s1.auditLog).toBe(s0.auditLog);
  });
});
