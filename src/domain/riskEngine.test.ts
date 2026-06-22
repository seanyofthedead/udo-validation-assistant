import { describe, expect, it } from 'vitest';

import { bandForScore, scoreRisk } from './riskEngine';
import { RISK_MODEL } from './riskModel';
import type { PriorYearAnomalyResult } from './engine';
import type {
  CrgRule,
  EvidenceItem,
  ReportedStatus,
  UdoRecord,
  ValidationFinding,
  Verdict,
} from './types';

const AS_OF = '2026-06-21';

// Two-status mock ruleset is enough to exercise R7 (evidence completeness).
const RULES: CrgRule[] = [
  {
    id: 'CRG-OPEN-ACTIVE-01',
    appliesToStatus: 'OPEN_ACTIVE',
    requiredEvidence: ['PO', 'INVOICE'],
    description: 'OPEN_ACTIVE needs a PO and an invoice.',
  },
  {
    id: 'CRG-OPEN-INACTIVE-01',
    appliesToStatus: 'OPEN_INACTIVE',
    requiredEvidence: ['PO', 'GL'],
    description: 'OPEN_INACTIVE needs a PO and a GL entry.',
  },
];

function makeUdo(over: Partial<UdoRecord> = {}): UdoRecord {
  return {
    id: 'UDO-TEST-0001',
    component: 'USCG',
    obligationNumber: 'OBL-1',
    vendor: 'Vendor',
    description: 'Test line',
    fundingType: 'O&M',
    amountObligated: 500_000,
    amountDisbursed: 250_000, // drawdown 0.50
    reportedStatus: 'OPEN_ACTIVE',
    obligationDate: '2024-01-01',
    lastActivityDate: AS_OF, // 0 days inactive unless overridden
    periodOfPerformanceEnd: '2027-01-01', // not expired unless overridden
    ...over,
  };
}

function makeFinding(verdict: Verdict, confidence: number): ValidationFinding {
  return {
    udoId: 'UDO-TEST-0001',
    verdict,
    confidence,
    justification: 'test',
    citedRuleId: verdict === 'INSUFFICIENT_EVIDENCE' ? null : 'CRG-OPEN-ACTIVE-01',
    qcAgreed: true,
  };
}

/** Evidence that fully satisfies the rule for `status` (so R7 contributes 0). */
function fullEvidence(status: ReportedStatus): EvidenceItem[] {
  const rule = RULES.find((r) => r.appliesToStatus === status);
  return (rule?.requiredEvidence ?? []).map((type) => ({
    udoId: 'UDO-TEST-0001',
    type,
    present: true,
  }));
}

const noAnomaly: PriorYearAnomalyResult = {
  component: 'USCG',
  populationShift: false,
  outlierUdoIds: [],
};

/** Score a line and read one factor's points by name. */
function pointsFor(
  name: string,
  opts: {
    udo?: Partial<UdoRecord>;
    finding?: ValidationFinding;
    evidence?: EvidenceItem[];
    anomaly?: PriorYearAnomalyResult;
  } = {},
): number {
  const udo = makeUdo(opts.udo);
  const finding = opts.finding ?? makeFinding('VALID', 1);
  const evidence = opts.evidence ?? fullEvidence(udo.reportedStatus);
  const result = scoreRisk(udo, finding, opts.anomaly ?? noAnomaly, evidence, RULES, AS_OF);
  const factor = result.factors.find((f) => f.name === name);
  if (!factor) throw new Error(`no factor named ${name}`);
  return factor.points;
}

/** ISO date `days` before AS_OF, computed without a clock. */
function daysBefore(days: number): string {
  const asOf = Date.UTC(2026, 5, 21);
  const d = new Date(asOf - days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

describe('scoreRisk — R1 verdict', () => {
  it('maps each verdict to its RISK_MODEL points', () => {
    expect(pointsFor('R1 verdict', { finding: makeFinding('QUESTIONABLE', 1) })).toBe(
      RISK_MODEL.r1.questionable,
    );
    expect(pointsFor('R1 verdict', { finding: makeFinding('INSUFFICIENT_EVIDENCE', 1) })).toBe(
      RISK_MODEL.r1.insufficient,
    );
    expect(pointsFor('R1 verdict', { finding: makeFinding('VALID', 1) })).toBe(RISK_MODEL.r1.valid);
  });
});

describe('scoreRisk — R2 confidence (inverse)', () => {
  it('is round((1 - confidence) * max)', () => {
    expect(pointsFor('R2 confidence', { finding: makeFinding('VALID', 1) })).toBe(0);
    expect(pointsFor('R2 confidence', { finding: makeFinding('VALID', 0) })).toBe(
      RISK_MODEL.r2.max,
    );
    expect(pointsFor('R2 confidence', { finding: makeFinding('QUESTIONABLE', 0.4) })).toBe(
      Math.round((1 - 0.4) * RISK_MODEL.r2.max),
    );
  });
});

describe('scoreRisk — R3 PoP expiry bands', () => {
  it('walks pNone → pT1 → pT2 → pOver as days-past-PoP grows', () => {
    const { r3 } = RISK_MODEL;
    expect(pointsFor('R3 PoP expiry', { udo: { periodOfPerformanceEnd: daysBefore(-10) } })).toBe(
      r3.pNone,
    ); // future PoP
    expect(pointsFor('R3 PoP expiry', { udo: { periodOfPerformanceEnd: daysBefore(30) } })).toBe(
      r3.pT1,
    );
    expect(pointsFor('R3 PoP expiry', { udo: { periodOfPerformanceEnd: daysBefore(200) } })).toBe(
      r3.pT2,
    );
    expect(pointsFor('R3 PoP expiry', { udo: { periodOfPerformanceEnd: daysBefore(500) } })).toBe(
      r3.pOver,
    );
  });
});

describe('scoreRisk — R4 inactivity bands', () => {
  it('walks pT1 → pT2 → pT3 → pOver as days-inactive grows', () => {
    const { r4 } = RISK_MODEL;
    expect(pointsFor('R4 inactivity', { udo: { lastActivityDate: daysBefore(10) } })).toBe(r4.pT1);
    expect(pointsFor('R4 inactivity', { udo: { lastActivityDate: daysBefore(120) } })).toBe(r4.pT2);
    expect(pointsFor('R4 inactivity', { udo: { lastActivityDate: daysBefore(210) } })).toBe(r4.pT3);
    expect(pointsFor('R4 inactivity', { udo: { lastActivityDate: daysBefore(500) } })).toBe(
      r4.pOver,
    );
  });
});

describe('scoreRisk — R5 drawdown profile', () => {
  it('rewards low-drawdown open lines and near-full open/pending lines', () => {
    const { r5 } = RISK_MODEL;
    // OPEN + very low drawdown
    expect(
      pointsFor('R5 drawdown', {
        udo: { reportedStatus: 'OPEN_ACTIVE', amountObligated: 100, amountDisbursed: 10 },
      }),
    ).toBe(r5.pLow);
    // OPEN + moderate drawdown
    expect(
      pointsFor('R5 drawdown', {
        udo: { reportedStatus: 'OPEN_INACTIVE', amountObligated: 100, amountDisbursed: 40 },
      }),
    ).toBe(r5.pMid);
    // PENDING_CLOSE + effectively full
    expect(
      pointsFor('R5 drawdown', {
        udo: { reportedStatus: 'PENDING_CLOSE', amountObligated: 100, amountDisbursed: 99 },
      }),
    ).toBe(r5.pFull);
    // CLOSED → no R5 contribution
    expect(
      pointsFor('R5 drawdown', {
        udo: { reportedStatus: 'CLOSED', amountObligated: 100, amountDisbursed: 100 },
      }),
    ).toBe(r5.pNone);
  });
});

describe('scoreRisk — R6 dollar magnitude bands', () => {
  it('walks pT1 → pT2 → pT3 → pOver as the obligation grows', () => {
    const { r6 } = RISK_MODEL;
    expect(pointsFor('R6 dollars', { udo: { amountObligated: r6.t1 - 1 } })).toBe(r6.pT1);
    expect(pointsFor('R6 dollars', { udo: { amountObligated: r6.t1 } })).toBe(r6.pT2);
    expect(pointsFor('R6 dollars', { udo: { amountObligated: r6.t2 } })).toBe(r6.pT3);
    expect(pointsFor('R6 dollars', { udo: { amountObligated: r6.t3 } })).toBe(r6.pOver);
  });
});

describe('scoreRisk — R7 evidence completeness (inverse)', () => {
  it('is min(cap, missingCount * ptsPerMissing), rounded', () => {
    const { r7 } = RISK_MODEL;
    // Full evidence → 0 missing → 0 points
    expect(pointsFor('R7 evidence')).toBe(0);
    // One required item missing (drop the INVOICE for an OPEN_ACTIVE line)
    const oneMissing: EvidenceItem[] = [{ udoId: 'UDO-TEST-0001', type: 'PO', present: true }];
    expect(pointsFor('R7 evidence', { evidence: oneMissing })).toBe(
      Math.round(Math.min(r7.cap, 1 * r7.ptsPerMissing)),
    );
    // No evidence at all → both required items missing → capped
    expect(pointsFor('R7 evidence', { evidence: [] })).toBe(
      Math.round(Math.min(r7.cap, 2 * r7.ptsPerMissing)),
    );
  });
});

describe('scoreRisk — R8 prior-year anomaly', () => {
  it('contributes its points only when the line is an outlier', () => {
    expect(pointsFor('R8 anomaly')).toBe(0);
    const flagged: PriorYearAnomalyResult = {
      component: 'USCG',
      populationShift: false,
      outlierUdoIds: ['UDO-TEST-0001'],
    };
    expect(pointsFor('R8 anomaly', { anomaly: flagged })).toBe(RISK_MODEL.r8.pts);
  });
});

describe('scoreRisk — attribution + determinism', () => {
  it('score equals the sum of factor points, and band is bandForScore(score)', () => {
    const udo = makeUdo({
      reportedStatus: 'OPEN_ACTIVE',
      amountObligated: 2_500_000,
      amountDisbursed: 250_000,
      periodOfPerformanceEnd: daysBefore(200),
      lastActivityDate: daysBefore(210),
    });
    const finding = makeFinding('QUESTIONABLE', 0.4);
    const result = scoreRisk(udo, finding, noAnomaly, fullEvidence('OPEN_ACTIVE'), RULES, AS_OF);
    const sum = result.factors.reduce((s, f) => s + f.points, 0);
    expect(result.score).toBe(sum);
    expect(result.band).toBe(bandForScore(result.score));
    expect(result.factors).toHaveLength(8);
  });

  it('is deterministic across repeated runs', () => {
    const udo = makeUdo();
    const finding = makeFinding('QUESTIONABLE', 0.5);
    const a = scoreRisk(udo, finding, noAnomaly, fullEvidence('OPEN_ACTIVE'), RULES, AS_OF);
    const b = scoreRisk(udo, finding, noAnomaly, fullEvidence('OPEN_ACTIVE'), RULES, AS_OF);
    expect(a).toEqual(b);
  });
});

describe('bandForScore — uses RISK_MODEL.bands cutoffs', () => {
  it('maps boundary scores to the right band', () => {
    const { bands } = RISK_MODEL;
    expect(bandForScore(bands.critical)).toBe('CRITICAL');
    expect(bandForScore(bands.high)).toBe('HIGH');
    expect(bandForScore(bands.medium)).toBe('MEDIUM');
    expect(bandForScore(bands.low)).toBe('LOW');
    expect(bandForScore(bands.high - 1)).toBe('MEDIUM');
  });
});
