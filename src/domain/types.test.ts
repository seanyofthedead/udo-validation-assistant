// Schema guard for SPEC.md §5. types.ts is the contract every later wave builds
// on, so this test fixes that contract in place: it constructs a literal of each
// interface with every documented field, and pins the membership of each union.
//
// This is primarily a *compile-time* test — if a field is removed or renamed, or
// a union member dropped, this file stops compiling and `tsc --noEmit` (task 1.1's
// done-check) goes red. The runtime assertions document the shape for readers.

import { describe, it, expect, expectTypeOf } from 'vitest';
import type {
  Component,
  ReportedStatus,
  Verdict,
  EvidenceType,
  UdoRecord,
  EvidenceItem,
  CrgRule,
  PriorYearStat,
  ValidationFinding,
  DeobligationFlag,
  Disposition,
  AuditEvent,
  RiskBand,
  RiskFactor,
  RiskScore,
  CampaignState,
  AssignmentState,
  Campaign,
  Assignment,
} from './types';

describe('SPEC §5 data model: union literals', () => {
  it('Component covers every DHS component', () => {
    const all: Component[] = ['USCG', 'TSA', 'FEMA', 'CBP', 'CISA'];
    expect(all).toHaveLength(5);
  });

  it('ReportedStatus covers every reported status', () => {
    const all: ReportedStatus[] = ['OPEN_ACTIVE', 'OPEN_INACTIVE', 'PENDING_CLOSE', 'CLOSED'];
    expect(all).toHaveLength(4);
  });

  it('Verdict covers every verdict bucket', () => {
    const all: Verdict[] = ['VALID', 'QUESTIONABLE', 'INSUFFICIENT_EVIDENCE'];
    expect(all).toHaveLength(3);
  });

  it('RiskBand covers every risk band (Phase 2)', () => {
    const all: RiskBand[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    expect(all).toHaveLength(4);
  });

  it('EvidenceType covers every evidence type', () => {
    const all: EvidenceType[] = ['PO', 'INVOICE', 'RECEIPT', 'MOD', 'GL'];
    expect(all).toHaveLength(5);
  });

  it('CampaignState covers the forward-only campaign lifecycle (Phase 3)', () => {
    const all: CampaignState[] = ['DRAFT', 'ACTIVE', 'CLOSING', 'CLOSED'];
    expect(all).toHaveLength(4);
  });

  it('AssignmentState covers per-assignment progress (Phase 3)', () => {
    const all: AssignmentState[] = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETE'];
    expect(all).toHaveLength(3);
  });
});

describe('SPEC §5 data model: interface shapes', () => {
  it('UdoRecord carries the full obligation record', () => {
    const udo: UdoRecord = {
      id: 'UDO-USCG-0001',
      component: 'USCG',
      obligationNumber: 'OBL-0001',
      vendor: 'Acme Marine',
      description: 'Patrol boat maintenance',
      fundingType: 'O&M',
      amountObligated: 100_000,
      amountDisbursed: 40_000,
      reportedStatus: 'OPEN_ACTIVE',
      obligationDate: '2024-01-15',
      lastActivityDate: '2025-03-01',
      periodOfPerformanceEnd: '2025-12-31',
    };
    expect(udo.id).toBe('UDO-USCG-0001');
    expectTypeOf(udo.amountObligated).toBeNumber();
  });

  it('EvidenceItem links to a UDO; amount and ref are optional', () => {
    const minimal: EvidenceItem = { udoId: 'UDO-USCG-0001', type: 'PO', present: true };
    const full: EvidenceItem = {
      udoId: 'UDO-USCG-0001',
      type: 'INVOICE',
      present: true,
      amount: 40_000,
      ref: 'INV-77',
    };
    expect(minimal.amount).toBeUndefined();
    expect(full.ref).toBe('INV-77');
  });

  it('CrgRule binds a status to its required evidence', () => {
    const rule: CrgRule = {
      id: 'CRG-OPEN-ACTIVE-01',
      appliesToStatus: 'OPEN_ACTIVE',
      requiredEvidence: ['PO', 'INVOICE'],
      description: 'Active obligations need a PO and at least one invoice.',
    };
    expect(rule.requiredEvidence).toContain('PO');
  });

  it('PriorYearStat summarizes a component population', () => {
    const stat: PriorYearStat = { component: 'FEMA', lineCount: 300, totalAmount: 5_000_000 };
    expect(stat.lineCount).toBe(300);
  });

  it('ValidationFinding carries verdict, confidence, justification, cited rule, QC flag', () => {
    const finding: ValidationFinding = {
      udoId: 'UDO-USCG-0001',
      verdict: 'QUESTIONABLE',
      confidence: 0.7,
      justification: 'Period of performance expired with no recent activity.',
      citedRuleId: 'CRG-OPEN-ACTIVE-01',
      qcAgreed: true,
    };
    expect(finding.confidence).toBeGreaterThanOrEqual(0);
    expect(finding.confidence).toBeLessThanOrEqual(1);
  });

  it('ValidationFinding.citedRuleId is nullable (abstain with no governing rule)', () => {
    const abstain: ValidationFinding = {
      udoId: 'UDO-TSA-0009',
      verdict: 'INSUFFICIENT_EVIDENCE',
      confidence: 0.2,
      justification: 'Required evidence missing.',
      citedRuleId: null,
      qcAgreed: true,
    };
    expect(abstain.citedRuleId).toBeNull();
  });

  it('DeobligationFlag carries candidacy, recoverable $, and reasons', () => {
    const flag: DeobligationFlag = {
      udoId: 'UDO-USCG-0001',
      candidate: true,
      estimatedRecoverable: 60_000,
      reasons: ['Period of performance expired', 'Drawdown < 25%'],
    };
    expect(flag.reasons.length).toBeGreaterThan(0);
  });

  it('Disposition records a human action; overrideVerdict is optional', () => {
    const confirm: Disposition = {
      udoId: 'UDO-USCG-0001',
      action: 'CONFIRM',
      reason: '',
      user: 'analyst@dhs.gov',
      timestamp: '2026-06-21T00:00:00.000Z',
    };
    const override: Disposition = {
      udoId: 'UDO-USCG-0001',
      action: 'OVERRIDE',
      overrideVerdict: 'VALID',
      reason: 'Confirmed active via vendor call.',
      user: 'analyst@dhs.gov',
      timestamp: '2026-06-21T00:00:00.000Z',
    };
    expect(confirm.overrideVerdict).toBeUndefined();
    expect(override.overrideVerdict).toBe('VALID');
  });

  it('RiskScore carries score, band, attributable factors, and asOfDate (Phase 2)', () => {
    const factor: RiskFactor = {
      name: 'R1 verdict',
      points: 25,
      reason: 'Validation QUESTIONABLE.',
    };
    const risk: RiskScore = {
      udoId: 'UDO-USCG-0001',
      score: 78,
      band: 'CRITICAL',
      factors: [factor],
      asOfDate: '2026-06-21',
    };
    expect(risk.score).toBeGreaterThanOrEqual(0);
    expect(risk.score).toBeLessThanOrEqual(100);
    expectTypeOf(risk.factors).toBeArray();
    expect(risk.factors[0].name).toBe('R1 verdict');
  });

  it('Campaign is a first-class entity with scope, state, and creation lineage (Phase 3)', () => {
    const campaign: Campaign = {
      id: 'CMP-2026-Q3-01',
      name: 'Q3 UDO Review',
      objective: 'Review the highest-risk open obligations before quarter-end close.',
      period: 'Q3 FY2026',
      state: 'DRAFT',
      createdBy: 'manager@dhs.gov',
      createdAt: '2026-06-22T00:00:00.000Z',
    };
    expect(campaign.state).toBe('DRAFT');
    expectTypeOf(campaign.createdAt).toBeString();
  });

  it('Assignment links a component slice to a campaign with a due date and progress state (Phase 3)', () => {
    const assignment: Assignment = {
      id: 'ASG-2026-Q3-01-USCG',
      campaignId: 'CMP-2026-Q3-01',
      component: 'USCG',
      udoIds: ['UDO-USCG-0001', 'UDO-USCG-0002'],
      dueDate: '2026-07-15',
      state: 'NOT_STARTED',
    };
    expect(assignment.campaignId).toBe('CMP-2026-Q3-01');
    expectTypeOf(assignment.udoIds).toBeArray();
    expect(assignment.state).toBe('NOT_STARTED');
  });

  it('AuditEvent records an actor, action, and detail; udoId optional', () => {
    const event: AuditEvent = {
      timestamp: '2026-06-21T00:00:00.000Z',
      actor: 'AI',
      action: 'VALIDATE',
      udoId: 'UDO-USCG-0001',
      detail: 'Verdict QUESTIONABLE at confidence 0.70.',
    };
    const exportEvent: AuditEvent = {
      timestamp: '2026-06-21T00:00:00.000Z',
      actor: 'HUMAN',
      action: 'EXPORT',
      detail: 'Exported audit trail as CSV.',
    };
    expect(event.actor).toBe('AI');
    expect(exportEvent.udoId).toBeUndefined();
  });
});
