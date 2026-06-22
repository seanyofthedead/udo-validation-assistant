// Task 6.2 — campaign state machine. Asserts the mechanism (the transition
// table), not magic: every legal edge is accepted and applied; every other
// ordered pair of distinct states is rejected; CLOSED is terminal; the
// transition is pure (new object, prior unchanged).

import { describe, it, expect } from 'vitest';
import {
  LEGAL_CAMPAIGN_TRANSITIONS,
  canTransitionCampaign,
  transitionCampaign,
} from './campaign';
import type { Campaign, CampaignState } from './types';

const ALL_STATES: CampaignState[] = ['DRAFT', 'ACTIVE', 'CLOSING', 'CLOSED'];

function draft(): Campaign {
  return {
    id: 'CMP-TEST-01',
    name: 'Test Review',
    objective: 'Exercise the state machine.',
    period: 'Q3 FY2026',
    state: 'DRAFT',
    createdBy: 'manager@dhs.gov',
    createdAt: '2026-06-22T00:00:00.000Z',
  };
}

/** Every (from, to) the table marks legal. */
const legalEdges: Array<[CampaignState, CampaignState]> = ALL_STATES.flatMap((from) =>
  LEGAL_CAMPAIGN_TRANSITIONS[from].map((to) => [from, to] as [CampaignState, CampaignState]),
);

describe('campaign state machine: legal transitions', () => {
  it('models the forward-only lifecycle Draft → Active → Closing → Closed', () => {
    // Exactly the three forward edges, nothing else.
    expect(legalEdges).toEqual([
      ['DRAFT', 'ACTIVE'],
      ['ACTIVE', 'CLOSING'],
      ['CLOSING', 'CLOSED'],
    ]);
  });

  it.each(legalEdges)('accepts and applies %s → %s', (from, to) => {
    expect(canTransitionCampaign(from, to)).toBe(true);
    const moved = transitionCampaign({ ...draft(), state: from }, to);
    expect(moved.state).toBe(to);
  });

  it('walks the whole lifecycle end to end', () => {
    let c = draft();
    for (const to of ['ACTIVE', 'CLOSING', 'CLOSED'] as CampaignState[]) {
      c = transitionCampaign(c, to);
      expect(c.state).toBe(to);
    }
    expect(c.state).toBe('CLOSED');
  });

  it('treats CLOSED as terminal (no outgoing transitions)', () => {
    expect(LEGAL_CAMPAIGN_TRANSITIONS.CLOSED).toEqual([]);
    for (const to of ALL_STATES) {
      expect(canTransitionCampaign('CLOSED', to)).toBe(false);
    }
  });
});

describe('campaign state machine: illegal transitions are rejected', () => {
  // Every ordered pair of distinct states that the table does NOT permit.
  const illegalEdges: Array<[CampaignState, CampaignState]> = ALL_STATES.flatMap((from) =>
    ALL_STATES.filter((to) => to !== from && !canTransitionCampaign(from, to)).map(
      (to) => [from, to] as [CampaignState, CampaignState],
    ),
  );

  it.each(illegalEdges)('rejects %s → %s (canTransition false + throws)', (from, to) => {
    expect(canTransitionCampaign(from, to)).toBe(false);
    expect(() => transitionCampaign({ ...draft(), state: from }, to)).toThrow(
      /Illegal campaign transition/,
    );
  });

  it.each(ALL_STATES)('rejects the self-loop %s → %s', (state) => {
    expect(canTransitionCampaign(state, state)).toBe(false);
  });

  it('rejects skipping a state (Draft → Closing, Draft → Closed, Active → Closed)', () => {
    expect(canTransitionCampaign('DRAFT', 'CLOSING')).toBe(false);
    expect(canTransitionCampaign('DRAFT', 'CLOSED')).toBe(false);
    expect(canTransitionCampaign('ACTIVE', 'CLOSED')).toBe(false);
  });

  it('rejects reversals (Active → Draft, Closing → Active, Closed → Closing)', () => {
    expect(canTransitionCampaign('ACTIVE', 'DRAFT')).toBe(false);
    expect(canTransitionCampaign('CLOSING', 'ACTIVE')).toBe(false);
    expect(canTransitionCampaign('CLOSED', 'CLOSING')).toBe(false);
  });
});

describe('campaign state machine: purity', () => {
  it('returns a new object and does not mutate the input', () => {
    const c0 = draft();
    const c1 = transitionCampaign(c0, 'ACTIVE');
    expect(c1).not.toBe(c0);
    expect(c0.state).toBe('DRAFT'); // input untouched
    expect(c1.state).toBe('ACTIVE');
  });
});
