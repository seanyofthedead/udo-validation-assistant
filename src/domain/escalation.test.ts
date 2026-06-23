// Tests for evaluateEscalations — SPEC §4 (Wave 7). The mechanism under test:
// an overdue line and a high-dollar line each escalate deterministically, a
// contested line escalates, an answered/under-threshold line does not, and the
// output is stable across runs (pure over inputs + asOfDate).

import { describe, it, expect } from 'vitest';
import { evaluateEscalations, ESCALATION_MODEL } from './escalation';
import type { Assignment, Response, UdoRecord } from './types';

const AS_OF = '2026-06-21';

function udo(id: string, amountObligated: number): UdoRecord {
  return {
    id,
    component: 'USCG',
    obligationNumber: `OBL-${id}`,
    vendor: 'Test Vendor',
    description: 'Test obligation',
    fundingType: 'O&M',
    amountObligated,
    amountDisbursed: 0,
    reportedStatus: 'OPEN_ACTIVE',
    obligationDate: '2024-01-01',
    lastActivityDate: '2026-01-01',
    periodOfPerformanceEnd: '2026-12-31',
  };
}

function assignment(over: Partial<Assignment> = {}): Assignment {
  return {
    id: 'CMP-01-USCG',
    campaignId: 'CMP-01',
    component: 'USCG',
    udoIds: [],
    dueDate: '2026-12-31', // not overdue by default
    state: 'NOT_STARTED',
    ...over,
  };
}

function response(over: Partial<Response> = {}): Response {
  return {
    id: 'RSP-CMP-01-USCG-UDO-USCG-0001',
    assignmentId: 'CMP-01-USCG',
    udoId: 'UDO-USCG-0001',
    action: 'CONCUR',
    reason: '',
    evidenceRefs: [],
    state: 'SUBMITTED',
    ...over,
  };
}

describe('evaluateEscalations — OVERDUE', () => {
  const population = [udo('UDO-USCG-0001', 100_000)];

  it('flags a past-due, unanswered line', () => {
    const a = assignment({ udoIds: ['UDO-USCG-0001'], dueDate: '2026-05-01' }); // before AS_OF
    const escs = evaluateEscalations([a], [], population, AS_OF);
    const overdue = escs.find((e) => e.trigger === 'OVERDUE');
    expect(overdue).toBeDefined();
    expect(overdue!.target).toBe('UDO-USCG-0001');
    expect(overdue!.level).toBe(ESCALATION_MODEL.managerLevel);
  });

  it('does not flag a past-due line that has been submitted to HQ', () => {
    const a = assignment({ udoIds: ['UDO-USCG-0001'], dueDate: '2026-05-01' });
    const escs = evaluateEscalations([a], [response({ state: 'SUBMITTED' })], population, AS_OF);
    expect(escs.some((e) => e.trigger === 'OVERDUE')).toBe(false);
  });

  it('does not flag a line whose due date is on/after the as-of date', () => {
    const a = assignment({ udoIds: ['UDO-USCG-0001'], dueDate: '2026-12-31' });
    const escs = evaluateEscalations([a], [], population, AS_OF);
    expect(escs.some((e) => e.trigger === 'OVERDUE')).toBe(false);
  });
});

describe('evaluateEscalations — HIGH_DOLLAR', () => {
  it('flags an obligation at/above the threshold and routes it to leadership', () => {
    const population = [udo('UDO-USCG-0002', ESCALATION_MODEL.highDollarThreshold)];
    const a = assignment({ udoIds: ['UDO-USCG-0002'] });
    const escs = evaluateEscalations([a], [], population, AS_OF);
    const high = escs.find((e) => e.trigger === 'HIGH_DOLLAR');
    expect(high).toBeDefined();
    expect(high!.target).toBe('UDO-USCG-0002');
    expect(high!.level).toBe(ESCALATION_MODEL.leadershipLevel);
  });

  it('does not flag an obligation below the threshold', () => {
    const population = [udo('UDO-USCG-0003', ESCALATION_MODEL.highDollarThreshold - 1)];
    const a = assignment({ udoIds: ['UDO-USCG-0003'] });
    const escs = evaluateEscalations([a], [], population, AS_OF);
    expect(escs.some((e) => e.trigger === 'HIGH_DOLLAR')).toBe(false);
  });
});

describe('evaluateEscalations — CONTESTED and MANUAL', () => {
  const population = [udo('UDO-USCG-0001', 100_000)];

  it('flags a contested line', () => {
    const a = assignment({ udoIds: ['UDO-USCG-0001'] });
    const contest = response({ action: 'CONTEST', reason: 'Work is active.', state: 'SUBMITTED' });
    const escs = evaluateEscalations([a], [contest], population, AS_OF);
    expect(escs.some((e) => e.trigger === 'CONTESTED' && e.target === 'UDO-USCG-0001')).toBe(true);
  });

  it('flags a manually-flagged line that exists in the population', () => {
    const a = assignment({ udoIds: ['UDO-USCG-0001'] });
    const escs = evaluateEscalations([a], [], population, AS_OF, ['UDO-USCG-0001']);
    expect(escs.some((e) => e.trigger === 'MANUAL')).toBe(true);
  });

  it('ignores a manual flag for an unknown udoId', () => {
    const a = assignment({ udoIds: ['UDO-USCG-0001'] });
    const escs = evaluateEscalations([a], [], population, AS_OF, ['UDO-NOPE-9999']);
    expect(escs.some((e) => e.trigger === 'MANUAL')).toBe(false);
  });
});

describe('evaluateEscalations — combined + determinism', () => {
  it('flags an overdue AND a high-$ item together, deterministically', () => {
    const population = [udo('UDO-USCG-0001', 100_000), udo('UDO-USCG-0002', 2_000_000)];
    const a = assignment({ udoIds: ['UDO-USCG-0001', 'UDO-USCG-0002'], dueDate: '2026-05-01' });

    const first = evaluateEscalations([a], [], population, AS_OF);
    const second = evaluateEscalations([a], [], population, AS_OF);

    // Both an overdue and a high-dollar escalation are present.
    expect(first.some((e) => e.trigger === 'OVERDUE')).toBe(true);
    expect(first.some((e) => e.trigger === 'HIGH_DOLLAR')).toBe(true);
    // The big line escalates on BOTH overdue and high-dollar (two distinct ids).
    expect(first.filter((e) => e.target === 'UDO-USCG-0002').map((e) => e.trigger).sort()).toEqual([
      'HIGH_DOLLAR',
      'OVERDUE',
    ]);
    // Pure: identical inputs → identical output (same ids, same order).
    expect(second).toEqual(first);
  });

  it('de-duplicates when a line appears under more than one assignment', () => {
    const population = [udo('UDO-USCG-0002', 2_000_000)];
    const a1 = assignment({ id: 'CMP-01-USCG', udoIds: ['UDO-USCG-0002'] });
    const a2 = assignment({ id: 'CMP-02-USCG', campaignId: 'CMP-02', udoIds: ['UDO-USCG-0002'] });
    const escs = evaluateEscalations([a1, a2], [], population, AS_OF);
    expect(escs.filter((e) => e.trigger === 'HIGH_DOLLAR')).toHaveLength(1);
  });
});
