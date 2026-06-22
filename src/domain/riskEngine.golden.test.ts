// GOLDEN VECTOR — docs/wave5-risk-scoring-model.md §5 worked example, v0.1 defaults.
//
// This is the ONE test allowed to assert raw scoring numbers. It pins the §5
// worked example end-to-end: a single line whose eight factors sum to 78 and
// land in the CRITICAL band. If RISK_MODEL changes, recompute §5 and update the
// expected numbers here together (the doc and this test share one version).
//
//   Line: QUESTIONABLE, confidence 0.40, PoP ended 200 days ago, inactive 210
//   days, OPEN_ACTIVE drawdown 0.10, $2.5M, 1 evidence item missing, not an
//   anomaly  →  score 78  →  band CRITICAL.

import { describe, expect, it } from 'vitest';

import { scoreRisk } from './riskEngine';
import type { PriorYearAnomalyResult } from './engine';
import type { CrgRule, EvidenceItem, UdoRecord, ValidationFinding } from './types';

const AS_OF = '2026-06-21';

/** ISO date `days` before AS_OF (pure: built from Date.UTC, no clock read). */
function daysBefore(days: number): string {
  return new Date(Date.UTC(2026, 5, 21) - days * 86_400_000).toISOString().slice(0, 10);
}

const RULES: CrgRule[] = [
  {
    id: 'CRG-OPEN-ACTIVE-01',
    appliesToStatus: 'OPEN_ACTIVE',
    requiredEvidence: ['PO', 'INVOICE'],
    description: 'OPEN_ACTIVE needs a PO and an invoice.',
  },
];

describe('GOLDEN VECTOR — scoring-model §5 worked example (v0.1)', () => {
  it('scores the worked-example line to 78 / CRITICAL with the documented factor breakdown', () => {
    const udo: UdoRecord = {
      id: 'UDO-GOLD-0001',
      component: 'FEMA',
      obligationNumber: 'OBL-GOLD',
      vendor: 'Worked Example Co.',
      description: 'The §5 worked example',
      fundingType: 'Procurement',
      amountObligated: 2_500_000, // $2.5M  → R6 = 12
      amountDisbursed: 250_000, // drawdown 0.10 (OPEN_ACTIVE) → R5 = 15
      reportedStatus: 'OPEN_ACTIVE',
      obligationDate: '2024-01-01',
      lastActivityDate: daysBefore(210), // inactive 210 days → R4 = 7
      periodOfPerformanceEnd: daysBefore(200), // PoP ended 200 days ago → R3 = 10
    };
    const finding: ValidationFinding = {
      udoId: udo.id,
      verdict: 'QUESTIONABLE', // R1 = 25
      confidence: 0.4, // R2 = round((1-0.4)*10) = 6
      justification: 'worked example',
      citedRuleId: 'CRG-OPEN-ACTIVE-01',
      qcAgreed: true,
    };
    // 1 required evidence item missing (PO present, INVOICE absent) → R7 = 3
    const evidence: EvidenceItem[] = [{ udoId: udo.id, type: 'PO', present: true }];
    const noAnomaly: PriorYearAnomalyResult = {
      component: 'FEMA',
      populationShift: false,
      outlierUdoIds: [], // not an anomaly → R8 = 0
    };

    const result = scoreRisk(udo, finding, noAnomaly, evidence, RULES, AS_OF);

    const points = (name: string) => result.factors.find((f) => f.name === name)?.points;
    expect(points('R1 verdict')).toBe(25);
    expect(points('R2 confidence')).toBe(6);
    expect(points('R3 PoP expiry')).toBe(10);
    expect(points('R4 inactivity')).toBe(7);
    expect(points('R5 drawdown')).toBe(15);
    expect(points('R6 dollars')).toBe(12);
    expect(points('R7 evidence')).toBe(3);
    expect(points('R8 anomaly')).toBe(0);

    expect(result.score).toBe(78);
    expect(result.band).toBe('CRITICAL');
  });
});
