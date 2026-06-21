// Task 1.7 — priorYearAnomaly(): >=50% population shift + per-line outliers.

import { describe, it, expect } from 'vitest';
import { priorYearAnomaly } from './engine';
import { seedPopulation, priorYearStats } from '../data/seed';
import type { PriorYearStat, UdoRecord } from './types';

function makeUdo(id: string, amountObligated: number): UdoRecord {
  return {
    id,
    component: 'USCG',
    obligationNumber: id,
    vendor: 'V',
    description: 'D',
    fundingType: 'O&M',
    amountObligated,
    amountDisbursed: 0,
    reportedStatus: 'OPEN_ACTIVE',
    obligationDate: '2024-01-01',
    lastActivityDate: '2024-06-01',
    periodOfPerformanceEnd: '2025-01-01',
  };
}

describe('priorYearAnomaly: over the seed fixture', () => {
  it('flags FEMA for a >=50% population shift (prior 10 -> current 4)', () => {
    const result = priorYearAnomaly('FEMA', seedPopulation, priorYearStats);
    expect(result.populationShift).toBe(true);
  });

  it('does not flag USCG, whose count is unchanged (prior 5 -> current 5)', () => {
    const result = priorYearAnomaly('USCG', seedPopulation, priorYearStats);
    expect(result.populationShift).toBe(false);
  });

  it('flags the CISA large award as a per-line outlier (> 3x median)', () => {
    const result = priorYearAnomaly('CISA', seedPopulation, priorYearStats);
    // CISA obligations 180k / 260k / 5,000k -> median 260k, 3x = 780k.
    expect(result.outlierUdoIds).toEqual(['UDO-CISA-0003']);
  });
});

describe('priorYearAnomaly: unit cases', () => {
  const prior: PriorYearStat[] = [{ component: 'USCG', lineCount: 4, totalAmount: 0 }];

  it('computes shift against the matching prior stat', () => {
    // current 2 vs prior 4 -> 50% drop -> flagged
    const current = [makeUdo('A', 100), makeUdo('B', 100)];
    expect(priorYearAnomaly('USCG', current, prior).populationShift).toBe(true);
  });

  it('treats a missing prior stat with a non-empty current population as a shift', () => {
    const current = [makeUdo('A', 100)];
    expect(priorYearAnomaly('USCG', current, []).populationShift).toBe(true);
  });

  it('uses the median (even count) for outlier detection', () => {
    // amounts 100, 100, 100, 1000 -> median 100, 3x = 300 -> 1000 is an outlier
    const current = [makeUdo('A', 100), makeUdo('B', 100), makeUdo('C', 100), makeUdo('D', 1000)];
    expect(priorYearAnomaly('USCG', current, prior).outlierUdoIds).toEqual(['D']);
  });
});
