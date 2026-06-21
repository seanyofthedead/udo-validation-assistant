// Task 1.6 — flagDeobligation() per SPEC §6. Asserts candidate vs non-candidate
// across each condition, and the exact estimatedRecoverable.

import { describe, it, expect } from 'vitest';
import { flagDeobligation } from './engine';
import { seedPopulation, AS_OF_DATE } from '../data/seed';
import type { UdoRecord } from './types';

const ASOF = '2026-06-21'; // asOf-180 = 2025-12-23

function makeUdo(over: Partial<UdoRecord> = {}): UdoRecord {
  return {
    id: 'UDO-X',
    component: 'USCG',
    obligationNumber: 'OBL-X',
    vendor: 'Vendor X',
    description: 'Test obligation',
    fundingType: 'O&M',
    amountObligated: 1_000_000,
    amountDisbursed: 100_000, // drawdown 0.10
    reportedStatus: 'OPEN_INACTIVE',
    obligationDate: '2023-01-01',
    lastActivityDate: '2025-03-01', // inactive > 180d
    periodOfPerformanceEnd: '2025-06-30', // expired
    ...over,
  };
}

const seedById = (id: string) => seedPopulation.find((u) => u.id === id)!;

describe('flagDeobligation: candidate logic', () => {
  it('flags a candidate when expired AND drawdown < 0.25 AND inactive > 180d', () => {
    const flag = flagDeobligation(makeUdo(), ASOF);
    expect(flag.candidate).toBe(true);
    expect(flag.estimatedRecoverable).toBe(900_000); // 1,000,000 - 100,000
    expect(flag.reasons.length).toBe(3);
  });

  it('is NOT a candidate when the period of performance has not expired', () => {
    const flag = flagDeobligation(makeUdo({ periodOfPerformanceEnd: '2027-01-01' }), ASOF);
    expect(flag.candidate).toBe(false);
    expect(flag.estimatedRecoverable).toBe(0);
    // not expired -> the expiry reason did not fire
    expect(flag.reasons.some((r) => r.startsWith('Period of performance ended'))).toBe(false);
  });

  it('is NOT a candidate when drawdown is at/above 0.25', () => {
    const flag = flagDeobligation(makeUdo({ amountDisbursed: 250_000 }), ASOF); // 0.25 exactly
    expect(flag.candidate).toBe(false);
    expect(flag.estimatedRecoverable).toBe(0);
  });

  it('is NOT a candidate when there has been recent activity', () => {
    const flag = flagDeobligation(makeUdo({ lastActivityDate: '2026-05-01' }), ASOF);
    expect(flag.candidate).toBe(false);
    expect(flag.estimatedRecoverable).toBe(0);
    // expired + low drawdown still fired, just not "inactive"
    expect(flag.reasons.length).toBe(2);
  });
});

describe('flagDeobligation: over the seed fixture', () => {
  it('matches the designed candidate set and recoverable amounts', () => {
    const candidates = seedPopulation
      .map((u) => flagDeobligation(u, AS_OF_DATE))
      .filter((f) => f.candidate);
    const byId = Object.fromEntries(candidates.map((f) => [f.udoId, f.estimatedRecoverable]));

    expect(byId).toEqual({
      'UDO-USCG-0005': 540_000,
      'UDO-FEMA-0002': 900_000,
      'UDO-CBP-0002': 630_000,
      'UDO-CISA-0003': 4_800_000,
    });
  });

  it('computes recoverable as obligated minus disbursed for a known candidate', () => {
    const udo = seedById('UDO-CISA-0003');
    const flag = flagDeobligation(udo, AS_OF_DATE);
    expect(flag.estimatedRecoverable).toBe(udo.amountObligated - udo.amountDisbursed);
  });
});
