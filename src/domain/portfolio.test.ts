// Wave 8 reconciliation tests (SPEC §5 acceptance): every portfolio KPI must
// equal the aggregate of its source records, and each KPI must equal the sum of
// the per-component scorecards. These tests build a small deterministic state and
// assert no drift — the contract the executive dashboard is allowed to display.

import { describe, it, expect } from 'vitest';
import { buildPortfolioSummary, componentScorecard, type PortfolioInputs } from './portfolio';
import type {
  Assignment,
  Component,
  DeobOpportunity,
  Disposition,
  Response,
  RiskBand,
  RiskScore,
  UdoRecord,
  ValidationFinding,
  Verdict,
} from './types';

const ASOF = '2026-06-23';

function udo(id: string, component: Component, amountObligated: number): UdoRecord {
  return {
    id,
    component,
    obligationNumber: `OBL-${id}`,
    vendor: 'Vendor',
    description: 'desc',
    fundingType: 'O&M',
    amountObligated,
    amountDisbursed: 0,
    reportedStatus: 'OPEN_ACTIVE',
    obligationDate: '2024-01-01',
    lastActivityDate: '2024-06-01',
    periodOfPerformanceEnd: '2025-01-01',
  };
}

function finding(udoId: string, verdict: Verdict): ValidationFinding {
  return { udoId, verdict, confidence: 0.5, justification: 'j', citedRuleId: null, qcAgreed: true };
}

function risk(udoId: string, band: RiskBand): RiskScore {
  return { udoId, score: 50, band, factors: [], asOfDate: ASOF };
}

function deob(udoId: string, state: DeobOpportunity['state'], est: number): DeobOpportunity {
  return { udoId, state, estimatedRecoverable: est };
}

// Two components, five lines. USCG: 3 lines, FEMA: 2 lines.
function baseInput(overrides: Partial<PortfolioInputs> = {}): PortfolioInputs {
  const population: UdoRecord[] = [
    udo('UDO-USCG-0001', 'USCG', 1_000_000),
    udo('UDO-USCG-0002', 'USCG', 500_000),
    udo('UDO-USCG-0003', 'USCG', 250_000),
    udo('UDO-FEMA-0001', 'FEMA', 2_000_000),
    udo('UDO-FEMA-0002', 'FEMA', 750_000),
  ];
  const findings: ValidationFinding[] = [
    finding('UDO-USCG-0001', 'VALID'),
    finding('UDO-USCG-0002', 'QUESTIONABLE'),
    finding('UDO-USCG-0003', 'INSUFFICIENT_EVIDENCE'),
    finding('UDO-FEMA-0001', 'QUESTIONABLE'),
    finding('UDO-FEMA-0002', 'VALID'),
  ];
  const riskScores: RiskScore[] = [
    risk('UDO-USCG-0001', 'LOW'),
    risk('UDO-USCG-0002', 'HIGH'),
    risk('UDO-USCG-0003', 'CRITICAL'),
    risk('UDO-FEMA-0001', 'CRITICAL'),
    risk('UDO-FEMA-0002', 'MEDIUM'),
  ];
  const deobOpportunities: DeobOpportunity[] = [
    deob('UDO-USCG-0003', 'CONFIRMED', 250_000),
    deob('UDO-FEMA-0001', 'CONFIRMED', 1_900_000),
    deob('UDO-FEMA-0002', 'UNDER_REVIEW', 700_000), // not confirmed — excluded
  ];
  const dispositions: Disposition[] = [
    {
      udoId: 'UDO-USCG-0001',
      action: 'CONFIRM',
      reason: '',
      user: 'a',
      timestamp: `${ASOF}T00:00:00.000Z`,
    },
  ];
  const responses: Response[] = [
    {
      id: 'r1',
      assignmentId: 'ASG-FEMA',
      udoId: 'UDO-FEMA-0001',
      action: 'CONTEST',
      reason: 'x',
      evidenceRefs: [],
      state: 'SUBMITTED',
    },
    {
      id: 'r2',
      assignmentId: 'ASG-FEMA',
      udoId: 'UDO-FEMA-0002',
      action: 'CONCUR',
      reason: '',
      evidenceRefs: [],
      state: 'DRAFT',
    }, // draft — not reviewed
  ];
  const assignments: Assignment[] = [
    {
      id: 'ASG-USCG',
      campaignId: 'CMP',
      component: 'USCG',
      udoIds: ['UDO-USCG-0001'],
      dueDate: '2026-07-01',
      state: 'COMPLETE',
    },
    {
      id: 'ASG-FEMA',
      campaignId: 'CMP',
      component: 'FEMA',
      udoIds: ['UDO-FEMA-0001', 'UDO-FEMA-0002'],
      dueDate: '2026-07-01',
      state: 'IN_PROGRESS',
    },
  ];
  return {
    population,
    findings,
    riskScores,
    deobOpportunities,
    dispositions,
    responses,
    assignments,
    asOfDate: ASOF,
    ...overrides,
  };
}

describe('componentScorecard reconciles to a component slice', () => {
  it('counts udos, exceptions, reviewed, de-ob $, and risk mix from the sources', () => {
    const input = baseInput();
    const uscg = componentScorecard('USCG', input);

    expect(uscg.udoCount).toBe(3);
    expect(uscg.udoIds).toEqual(['UDO-USCG-0001', 'UDO-USCG-0002', 'UDO-USCG-0003']);
    // exceptions = non-VALID findings: 0002 QUESTIONABLE, 0003 INSUFFICIENT.
    expect(uscg.exceptionCount).toBe(2);
    // reviewed = disposition on 0001 only.
    expect(uscg.reviewedCount).toBe(1);
    expect(uscg.coverage).toBeCloseTo(1 / 3, 10);
    // de-ob $ = CONFIRMED on 0003 only.
    expect(uscg.deobDollars).toBe(250_000);
    expect(uscg.riskMix).toEqual({ LOW: 1, MEDIUM: 0, HIGH: 1, CRITICAL: 1 });
    // risk mix sums to the scored lines.
    const mixSum =
      uscg.riskMix.LOW + uscg.riskMix.MEDIUM + uscg.riskMix.HIGH + uscg.riskMix.CRITICAL;
    expect(mixSum).toBe(uscg.udoCount);
  });

  it('treats a SUBMITTED response as reviewed but a DRAFT as not', () => {
    const fema = componentScorecard('FEMA', baseInput());
    // FEMA-0001 SUBMITTED (reviewed); FEMA-0002 DRAFT (not).
    expect(fema.reviewedCount).toBe(1);
    expect(fema.coverage).toBeCloseTo(1 / 2, 10);
  });
});

describe('buildPortfolioSummary: each KPI equals the aggregate of its sources', () => {
  const input = baseInput();
  const { kpis, scorecards } = buildPortfolioSummary(input);

  it('includes one scorecard per present component in canonical order', () => {
    expect(scorecards.map((s) => s.component)).toEqual(['USCG', 'FEMA']);
  });

  it('udoCount === population size === Σ scorecard udoCount', () => {
    expect(kpis.udoCount).toBe(input.population.length);
    expect(kpis.udoCount).toBe(scorecards.reduce((n, s) => n + s.udoCount, 0));
  });

  it('totalObligated === Σ population amountObligated', () => {
    expect(kpis.totalObligated).toBe(input.population.reduce((n, u) => n + u.amountObligated, 0));
  });

  it('exceptionCount === non-VALID findings === Σ scorecard exceptionCount', () => {
    const nonValid = input.findings.filter((f) => f.verdict !== 'VALID').length;
    expect(kpis.exceptionCount).toBe(nonValid);
    expect(kpis.exceptionCount).toBe(scorecards.reduce((n, s) => n + s.exceptionCount, 0));
  });

  it('reviewedCount and coverage reconcile to the reviewed set', () => {
    expect(kpis.reviewedCount).toBe(scorecards.reduce((n, s) => n + s.reviewedCount, 0));
    expect(kpis.reviewedCount).toBe(2); // USCG-0001 disposition + FEMA-0001 submitted
    expect(kpis.coverage).toBeCloseTo(2 / 5, 10);
  });

  it('deobDollars === Σ CONFIRMED opportunities === Σ scorecard deobDollars', () => {
    const confirmed = input.deobOpportunities
      .filter((o) => o.state === 'CONFIRMED')
      .reduce((n, o) => n + o.estimatedRecoverable, 0);
    expect(kpis.deobDollars).toBe(confirmed);
    expect(kpis.deobDollars).toBe(scorecards.reduce((n, s) => n + s.deobDollars, 0));
    expect(kpis.deobDollars).toBe(2_150_000);
  });

  it('riskMix === Σ scorecard riskMix and sums to the scored population', () => {
    expect(kpis.riskMix).toEqual({ LOW: 1, MEDIUM: 1, HIGH: 1, CRITICAL: 2 });
    const total =
      kpis.riskMix.LOW + kpis.riskMix.MEDIUM + kpis.riskMix.HIGH + kpis.riskMix.CRITICAL;
    expect(total).toBe(input.riskScores.length);
  });

  it('campaignCompletion === COMPLETE assignments / total', () => {
    expect(kpis.campaignCompletion).toBeCloseTo(1 / 2, 10);
  });

  it('carries the asOfDate through unchanged', () => {
    expect(kpis.asOfDate).toBe(ASOF);
  });
});

describe('buildPortfolioSummary: empty and edge cases', () => {
  it('an empty population yields zeroed KPIs, no scorecards, and vacuous completion', () => {
    const { kpis, scorecards } = buildPortfolioSummary({
      population: [],
      findings: [],
      riskScores: [],
      deobOpportunities: [],
      dispositions: [],
      responses: [],
      assignments: [],
      asOfDate: ASOF,
    });
    expect(scorecards).toHaveLength(0);
    expect(kpis.udoCount).toBe(0);
    expect(kpis.coverage).toBe(0);
    expect(kpis.totalObligated).toBe(0);
    expect(kpis.campaignCompletion).toBe(1); // no assignments → vacuously complete
    expect(kpis.riskMix).toEqual({ LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 });
  });
});
