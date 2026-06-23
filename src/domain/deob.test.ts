// Tests for the de-ob opportunity lifecycle — SPEC §5.7 (Wave 7). Mechanism
// under test: forward-only transitions, illegal transitions rejected, and the
// mandatory-reason discipline on the terminal CONFIRMED/REJECTED states.

import { describe, it, expect } from 'vitest';
import {
  LEGAL_DEOB_TRANSITIONS,
  isTerminalDeobState,
  canTransitionDeob,
  identifyDeobOpportunities,
  transitionDeob,
} from './deob';
import type { DeobDisposition, DeobOpportunity, DeobligationFlag } from './types';

function opp(over: Partial<DeobOpportunity> = {}): DeobOpportunity {
  return { udoId: 'UDO-CISA-0003', state: 'IDENTIFIED', estimatedRecoverable: 4_800_000, ...over };
}

function disposition(over: Partial<DeobDisposition> = {}): DeobDisposition {
  return {
    action: 'CONFIRM',
    reason: 'PoP long expired, drawdown 4%; recommend de-obligation.',
    user: 'analyst@dhs.gov',
    timestamp: '2026-06-21T00:00:00.000Z',
    ...over,
  };
}

describe('LEGAL_DEOB_TRANSITIONS', () => {
  it('is forward-only with two terminal states', () => {
    expect(LEGAL_DEOB_TRANSITIONS.IDENTIFIED).toEqual(['UNDER_REVIEW']);
    expect(LEGAL_DEOB_TRANSITIONS.UNDER_REVIEW).toEqual(['CONFIRMED', 'REJECTED']);
    expect(LEGAL_DEOB_TRANSITIONS.CONFIRMED).toEqual([]);
    expect(LEGAL_DEOB_TRANSITIONS.REJECTED).toEqual([]);
  });

  it('marks CONFIRMED and REJECTED as terminal', () => {
    expect(isTerminalDeobState('CONFIRMED')).toBe(true);
    expect(isTerminalDeobState('REJECTED')).toBe(true);
    expect(isTerminalDeobState('IDENTIFIED')).toBe(false);
    expect(isTerminalDeobState('UNDER_REVIEW')).toBe(false);
  });
});

describe('canTransitionDeob', () => {
  it('accepts each legal step', () => {
    expect(canTransitionDeob('IDENTIFIED', 'UNDER_REVIEW')).toBe(true);
    expect(canTransitionDeob('UNDER_REVIEW', 'CONFIRMED')).toBe(true);
    expect(canTransitionDeob('UNDER_REVIEW', 'REJECTED')).toBe(true);
  });

  it('rejects skips, reversals, and self-loops', () => {
    expect(canTransitionDeob('IDENTIFIED', 'CONFIRMED')).toBe(false); // skip review
    expect(canTransitionDeob('CONFIRMED', 'UNDER_REVIEW')).toBe(false); // reversal
    expect(canTransitionDeob('IDENTIFIED', 'IDENTIFIED')).toBe(false); // self
  });
});

describe('identifyDeobOpportunities', () => {
  it('creates one IDENTIFIED opportunity per candidate flag, carrying recoverable $', () => {
    const flags: DeobligationFlag[] = [
      { udoId: 'UDO-A', candidate: true, estimatedRecoverable: 900_000, reasons: ['stale'] },
      { udoId: 'UDO-B', candidate: false, estimatedRecoverable: 0, reasons: [] },
      { udoId: 'UDO-C', candidate: true, estimatedRecoverable: 4_800_000, reasons: ['stale'] },
    ];
    const opps = identifyDeobOpportunities(flags);
    expect(opps.map((o) => o.udoId)).toEqual(['UDO-A', 'UDO-C']); // non-candidate skipped
    expect(opps.every((o) => o.state === 'IDENTIFIED')).toBe(true);
    expect(opps[1].estimatedRecoverable).toBe(4_800_000);
  });
});

describe('transitionDeob', () => {
  it('moves IDENTIFIED → UNDER_REVIEW with no disposition', () => {
    const next = transitionDeob(opp(), 'UNDER_REVIEW');
    expect(next.state).toBe('UNDER_REVIEW');
    expect(next.disposition).toBeUndefined();
  });

  it('confirms with a reason and attaches the disposition', () => {
    const reviewing = opp({ state: 'UNDER_REVIEW' });
    const confirmed = transitionDeob(reviewing, 'CONFIRMED', disposition({ action: 'CONFIRM' }));
    expect(confirmed.state).toBe('CONFIRMED');
    expect(confirmed.disposition?.reason).toMatch(/de-obligation/i);
  });

  it('rejects with a reason and attaches the disposition', () => {
    const reviewing = opp({ state: 'UNDER_REVIEW' });
    const rejected = transitionDeob(
      reviewing,
      'REJECTED',
      disposition({ action: 'REJECT', reason: 'Funds still needed for a pending mod.' }),
    );
    expect(rejected.state).toBe('REJECTED');
    expect(rejected.disposition?.action).toBe('REJECT');
  });

  it('throws on CONFIRMED without a disposition', () => {
    expect(() => transitionDeob(opp({ state: 'UNDER_REVIEW' }), 'CONFIRMED')).toThrow(/reason/i);
  });

  it('throws on CONFIRMED with a blank reason', () => {
    expect(() =>
      transitionDeob(opp({ state: 'UNDER_REVIEW' }), 'CONFIRMED', disposition({ reason: '   ' })),
    ).toThrow(/reason/i);
  });

  it('throws when the disposition action does not match the target state', () => {
    expect(() =>
      transitionDeob(opp({ state: 'UNDER_REVIEW' }), 'CONFIRMED', disposition({ action: 'REJECT' })),
    ).toThrow(/expects a CONFIRM/i);
  });

  it('throws on an illegal transition (skip review)', () => {
    expect(() => transitionDeob(opp(), 'CONFIRMED', disposition())).toThrow(/Illegal de-ob/i);
  });
});
