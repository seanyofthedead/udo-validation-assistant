// Task 2.1 — reducer unit tests for confirm/override over the seed-backed state.

import { describe, it, expect } from 'vitest';
import { appReducer, createInitialState, type AppState } from './store';
import { crgRules } from '../data/crgRules';
import { seedPopulation, seedEvidence, priorYearStats, AS_OF_DATE } from '../data/seed';
import { selectTopNByRisk } from '../domain/population';
import { generateAssignments } from '../domain/assignment';
import type { Campaign } from '../domain/types';

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

describe('appReducer: RECORD_DETERMINATION', () => {
  it('records a determination disposition + one HUMAN audit event when reasoned', () => {
    const s0 = initialState();
    const s1 = appReducer(s0, {
      type: 'RECORD_DETERMINATION',
      udoId: 'UDO-USCG-0005',
      decision: 'DEOBLIGATE',
      reason: 'Expired PoP, 10% drawn — recover the balance.',
      user: 'analyst@dhs.gov',
      timestamp: TS,
    });
    expect(s1.dispositions).toHaveLength(1);
    expect(s1.dispositions[0]).toMatchObject({
      udoId: 'UDO-USCG-0005',
      action: 'DETERMINATION',
      reviewDecision: 'DEOBLIGATE',
    });
    const added = s1.auditLog.filter((e) => e.action === 'DETERMINATION');
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ actor: 'HUMAN', udoId: 'UDO-USCG-0005' });
    expect(added[0].detail).toMatch(/DEOBLIGATE/);
  });

  it('is a no-op on a blank justification (abstain over guessing)', () => {
    const s0 = initialState();
    const s1 = appReducer(s0, {
      type: 'RECORD_DETERMINATION',
      udoId: 'UDO-USCG-0005',
      decision: 'ESCALATE',
      reason: '   ',
      user: 'analyst@dhs.gov',
      timestamp: TS,
    });
    expect(s1).toBe(s0); // unchanged: no disposition, no audit entry
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

describe('appReducer: campaigns (Wave 6)', () => {
  function draftCampaign(): Campaign {
    return {
      id: 'CMP-2026-Q3-01',
      name: 'Q3 UDO Review',
      objective: 'Review the highest-risk open obligations.',
      period: 'Q3 FY2026',
      state: 'DRAFT',
      createdBy: 'manager@dhs.gov',
      createdAt: '2026-06-22T00:00:00.000Z',
    };
  }

  function createOverSeed(state: AppState) {
    const campaign = draftCampaign();
    const udoIds = selectTopNByRisk(state.riskScores, 10);
    const assignments = generateAssignments(
      campaign.id,
      udoIds,
      state.population,
      {},
      '2026-07-31',
    );
    return { campaign, assignments, udoIds };
  }

  it('CREATE_CAMPAIGN records the campaign + assignments and appends exactly one audit event', () => {
    const s0 = initialState();
    const { campaign, assignments, udoIds } = createOverSeed(s0);
    const s1 = appReducer(s0, { type: 'CREATE_CAMPAIGN', campaign, assignments });

    expect(s1.campaigns).toHaveLength(1);
    expect(s1.campaigns[0]).toMatchObject({ id: campaign.id, state: 'DRAFT' });
    expect(s1.assignments).toEqual(assignments);
    // Exactly one audit event, attributable, summarizing the scope.
    expect(s1.auditLog.length).toBe(s0.auditLog.length + 1);
    const last = s1.auditLog[s1.auditLog.length - 1];
    expect(last).toMatchObject({ actor: 'HUMAN', action: 'CAMPAIGN_CREATE' });
    expect(last.detail).toContain(campaign.id);
    expect(last.detail).toContain(String(udoIds.length)); // obligation count
    expect(last.timestamp).toBe(campaign.createdAt);
  });

  it('TRANSITION_CAMPAIGN advances a legal step and appends exactly one audit event', () => {
    const s0 = initialState();
    const { campaign, assignments } = createOverSeed(s0);
    const created = appReducer(s0, { type: 'CREATE_CAMPAIGN', campaign, assignments });

    const launched = appReducer(created, {
      type: 'TRANSITION_CAMPAIGN',
      campaignId: campaign.id,
      to: 'ACTIVE',
      user: 'manager@dhs.gov',
      timestamp: '2026-06-23T00:00:00.000Z',
    });

    expect(launched.campaigns[0].state).toBe('ACTIVE');
    expect(launched.auditLog.length).toBe(created.auditLog.length + 1);
    const last = launched.auditLog[launched.auditLog.length - 1];
    expect(last).toMatchObject({ actor: 'HUMAN', action: 'CAMPAIGN_TRANSITION' });
    expect(last.detail).toContain('DRAFT');
    expect(last.detail).toContain('ACTIVE');
  });

  it('rejects an illegal transition as a no-op (no state change, no audit entry)', () => {
    const s0 = initialState();
    const { campaign, assignments } = createOverSeed(s0);
    const created = appReducer(s0, { type: 'CREATE_CAMPAIGN', campaign, assignments });

    // DRAFT → CLOSED skips states — illegal.
    const after = appReducer(created, {
      type: 'TRANSITION_CAMPAIGN',
      campaignId: campaign.id,
      to: 'CLOSED',
      user: 'manager@dhs.gov',
      timestamp: '2026-06-23T00:00:00.000Z',
    });
    expect(after).toBe(created); // exact no-op
  });

  it('ignores a transition for an unknown campaign id', () => {
    const s0 = initialState();
    const after = appReducer(s0, {
      type: 'TRANSITION_CAMPAIGN',
      campaignId: 'CMP-DOES-NOT-EXIST',
      to: 'ACTIVE',
      user: 'manager@dhs.gov',
      timestamp: '2026-06-23T00:00:00.000Z',
    });
    expect(after).toBe(s0);
  });

  it('does not mutate the prior state when creating a campaign', () => {
    const s0 = initialState();
    const { campaign, assignments } = createOverSeed(s0);
    const s1 = appReducer(s0, { type: 'CREATE_CAMPAIGN', campaign, assignments });
    expect(s0.campaigns).toEqual([]); // prior untouched
    expect(s1.campaigns).not.toBe(s0.campaigns);
    expect(s1.auditLog).not.toBe(s0.auditLog);
  });
});

describe('appReducer: component collaboration (Wave 7)', () => {
  // A campaign over two known USCG lines (one high-dollar) with a past-due date,
  // so responses, escalations, and lineage all have something concrete to bite on.
  function seedCampaign(state: AppState) {
    const campaign: Campaign = {
      id: 'CMP-2026-Q3-01',
      name: 'Q3 UDO Review',
      objective: 'Review high-risk USCG obligations.',
      period: 'Q3 FY2026',
      state: 'DRAFT',
      createdBy: 'manager@dhs.gov',
      createdAt: '2026-06-22T00:00:00.000Z',
    };
    const udoIds = ['UDO-USCG-0001', 'UDO-USCG-0002']; // 0002 is $1.5M (high-dollar)
    const assignments = generateAssignments(
      campaign.id,
      udoIds,
      state.population,
      {},
      '2026-05-01', // before AS_OF_DATE → overdue
    );
    const created = appReducer(state, { type: 'CREATE_CAMPAIGN', campaign, assignments });
    return { created, assignmentId: `${campaign.id}-USCG`, campaign };
  }

  it('seeds de-ob opportunities (IDENTIFIED) from the flags with an AI audit event', () => {
    const s = initialState();
    expect(s.deobOpportunities.length).toBeGreaterThan(0);
    expect(s.deobOpportunities.every((o) => o.state === 'IDENTIFIED')).toBe(true);
    expect(s.auditLog.some((e) => e.action === 'DEOB_IDENTIFY' && e.actor === 'AI')).toBe(true);
  });

  it('SUBMIT_RESPONSE records the response, advances the assignment, audits once', () => {
    const { created, assignmentId } = seedCampaign(initialState());
    const s1 = appReducer(created, {
      type: 'SUBMIT_RESPONSE',
      draft: {
        assignmentId,
        udoId: 'UDO-USCG-0001',
        action: 'CONCUR',
        reason: '',
        evidenceRefs: [],
      },
      user: 'fm@uscg.dhs.gov',
      timestamp: TS,
    });

    expect(s1.responses).toHaveLength(1);
    expect(s1.responses[0]).toMatchObject({
      udoId: 'UDO-USCG-0001',
      action: 'CONCUR',
      state: 'SUBMITTED',
    });
    // One of two lines answered → IN_PROGRESS.
    expect(s1.assignments.find((a) => a.id === assignmentId)!.state).toBe('IN_PROGRESS');
    expect(s1.auditLog.length).toBe(created.auditLog.length + 1);
    expect(s1.auditLog[s1.auditLog.length - 1]).toMatchObject({
      actor: 'HUMAN',
      action: 'RESPONSE_SUBMIT',
      udoId: 'UDO-USCG-0001',
    });
  });

  it('lineage resolves: response → assignment → campaign', () => {
    const { created, assignmentId, campaign } = seedCampaign(initialState());
    const s1 = appReducer(created, {
      type: 'SUBMIT_RESPONSE',
      draft: {
        assignmentId,
        udoId: 'UDO-USCG-0001',
        action: 'CONCUR',
        reason: '',
        evidenceRefs: [],
      },
      user: 'fm@uscg.dhs.gov',
      timestamp: TS,
    });
    const response = s1.responses[0];
    const assignment = s1.assignments.find((a) => a.id === response.assignmentId);
    expect(assignment).toBeDefined();
    const camp = s1.campaigns.find((c) => c.id === assignment!.campaignId);
    expect(camp?.id).toBe(campaign.id);
  });

  it('SUBMIT_RESPONSE with a blank-reason CONTEST is a rejected no-op', () => {
    const { created, assignmentId } = seedCampaign(initialState());
    const s1 = appReducer(created, {
      type: 'SUBMIT_RESPONSE',
      draft: {
        assignmentId,
        udoId: 'UDO-USCG-0001',
        action: 'CONTEST',
        reason: '   ',
        evidenceRefs: [],
      },
      user: 'fm@uscg.dhs.gov',
      timestamp: TS,
    });
    expect(s1).toBe(created); // exact no-op
  });

  it('VALIDATE_RESPONSE moves a submitted response to VALIDATED and audits once', () => {
    const { created, assignmentId } = seedCampaign(initialState());
    const submitted = appReducer(created, {
      type: 'SUBMIT_RESPONSE',
      draft: {
        assignmentId,
        udoId: 'UDO-USCG-0001',
        action: 'CONTEST',
        reason: 'Active work ongoing.',
        evidenceRefs: [],
      },
      user: 'fm@uscg.dhs.gov',
      timestamp: TS,
    });
    const responseId = submitted.responses[0].id;
    const validated = appReducer(submitted, {
      type: 'VALIDATE_RESPONSE',
      responseId,
      user: 'analyst@dhs.gov',
      timestamp: TS,
    });
    expect(validated.responses[0].state).toBe('VALIDATED');
    expect(validated.auditLog.length).toBe(submitted.auditLog.length + 1);
    expect(validated.auditLog[validated.auditLog.length - 1]).toMatchObject({
      actor: 'HUMAN',
      action: 'RESPONSE_VALIDATE',
    });
  });

  it('RAISE_ESCALATIONS flags overdue + high-dollar and appends one AI audit event', () => {
    const { created } = seedCampaign(initialState());
    const s1 = appReducer(created, { type: 'RAISE_ESCALATIONS', timestamp: TS });
    expect(s1.escalations.some((e) => e.trigger === 'OVERDUE')).toBe(true);
    expect(
      s1.escalations.some((e) => e.trigger === 'HIGH_DOLLAR' && e.target === 'UDO-USCG-0002'),
    ).toBe(true);
    expect(s1.auditLog.length).toBe(created.auditLog.length + 1);
    expect(s1.auditLog[s1.auditLog.length - 1]).toMatchObject({ actor: 'AI', action: 'ESCALATE' });
  });

  it('TRANSITION_DEOB confirms with a reason; lineage resolves opportunity → de-ob flag', () => {
    const s0 = initialState();
    const udoId = s0.deobOpportunities[0].udoId;

    const reviewing = appReducer(s0, {
      type: 'TRANSITION_DEOB',
      udoId,
      to: 'UNDER_REVIEW',
      reason: '',
      user: 'analyst@dhs.gov',
      timestamp: TS,
    });
    expect(reviewing.deobOpportunities.find((o) => o.udoId === udoId)!.state).toBe('UNDER_REVIEW');

    const confirmed = appReducer(reviewing, {
      type: 'TRANSITION_DEOB',
      udoId,
      to: 'CONFIRMED',
      reason: 'PoP long expired; recommend de-obligation.',
      user: 'analyst@dhs.gov',
      timestamp: TS,
    });
    const opp = confirmed.deobOpportunities.find((o) => o.udoId === udoId)!;
    expect(opp.state).toBe('CONFIRMED');
    expect(opp.disposition?.action).toBe('CONFIRM');
    // Lineage: the opportunity traces to its de-ob flag (a real candidate).
    const flag = confirmed.deobFlags.find((f) => f.udoId === opp.udoId);
    expect(flag?.candidate).toBe(true);
    // Two transitions → two audit events over the IDENTIFIED baseline.
    expect(confirmed.auditLog.filter((e) => e.action === 'DEOB_TRANSITION')).toHaveLength(2);
  });

  it('TRANSITION_DEOB to CONFIRMED with a blank reason is a rejected no-op', () => {
    const s0 = initialState();
    const udoId = s0.deobOpportunities[0].udoId;
    const reviewing = appReducer(s0, {
      type: 'TRANSITION_DEOB',
      udoId,
      to: 'UNDER_REVIEW',
      reason: '',
      user: 'analyst@dhs.gov',
      timestamp: TS,
    });
    const after = appReducer(reviewing, {
      type: 'TRANSITION_DEOB',
      udoId,
      to: 'CONFIRMED',
      reason: '   ',
      user: 'analyst@dhs.gov',
      timestamp: TS,
    });
    expect(after).toBe(reviewing); // exact no-op
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
