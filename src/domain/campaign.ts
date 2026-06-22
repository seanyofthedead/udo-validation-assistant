// Campaign state machine — SPEC §5.3 (Phase 3, Wave 6). Pure, deterministic,
// React-free. A campaign moves forward only: Draft → Active → Closing → Closed.
// There are no skips, no reversals, and no self-loops; the platform never
// auto-advances state — every transition is a deliberate human action (the
// store wires this to an audited reducer action in task 6.5).
//
// Determinism: this module has no clock/random. Any timestamp a transition needs
// (none today) would be supplied by the caller, as with the rest of src/domain.

import type { Campaign, CampaignState } from './types';

/**
 * The only legal next states from each state. Forward-only and single-step:
 * the campaign lifecycle is a straight line, so this also encodes that CLOSED
 * is terminal (no outgoing transitions).
 */
export const LEGAL_CAMPAIGN_TRANSITIONS: Record<CampaignState, readonly CampaignState[]> = {
  DRAFT: ['ACTIVE'],
  ACTIVE: ['CLOSING'],
  CLOSING: ['CLOSED'],
  CLOSED: [],
};

/** True iff `to` is a legal next state from `from` (rejects skips/reversals/self). */
export function canTransitionCampaign(from: CampaignState, to: CampaignState): boolean {
  return LEGAL_CAMPAIGN_TRANSITIONS[from].includes(to);
}

/**
 * Pure transition: returns a NEW campaign in state `to`, or throws if the
 * transition is illegal. Callers that must not throw (e.g. the UI/store) should
 * guard with canTransitionCampaign first; the throw makes illegal transitions
 * impossible to apply silently, which keeps the audit trail honest.
 */
export function transitionCampaign(campaign: Campaign, to: CampaignState): Campaign {
  if (!canTransitionCampaign(campaign.state, to)) {
    throw new Error(
      `Illegal campaign transition: ${campaign.state} → ${to} (campaign ${campaign.id}).`,
    );
  }
  return { ...campaign, state: to };
}
