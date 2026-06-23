// De-obligation opportunity lifecycle — SPEC §5.7 (Phase 3, Wave 7). Pure,
// React-free state machine over a DeobOpportunity. Forward-only:
//   IDENTIFIED → UNDER_REVIEW → CONFIRMED | REJECTED
// CONFIRMED and REJECTED are terminal. Moving to a terminal state is a human
// disposition and REQUIRES a non-blank reason — the same mandatory-reason
// discipline as a Phase 1 override or a contest. The platform never auto-posts:
// a confirmed opportunity is a recommendation to de-obligate, not the act.
//
// Determinism: no clock/random — any disposition timestamp is supplied by the
// caller (the store action), as elsewhere in src/domain.

import type { DeobDisposition, DeobOpportunity, DeobState, DeobligationFlag } from './types';

/** The only legal next states from each state (forward-only; terminals empty). */
export const LEGAL_DEOB_TRANSITIONS: Record<DeobState, readonly DeobState[]> = {
  IDENTIFIED: ['UNDER_REVIEW'],
  UNDER_REVIEW: ['CONFIRMED', 'REJECTED'],
  CONFIRMED: [],
  REJECTED: [],
};

/** Terminal states require a human disposition carrying a reason. */
const TERMINAL: readonly DeobState[] = ['CONFIRMED', 'REJECTED'];

export function isTerminalDeobState(state: DeobState): boolean {
  return TERMINAL.includes(state);
}

/** True iff `to` is a legal next state from `from` (rejects skips/reversals/self). */
export function canTransitionDeob(from: DeobState, to: DeobState): boolean {
  return LEGAL_DEOB_TRANSITIONS[from].includes(to);
}

/** The disposition action a terminal state expects (keeps the two in sync). */
function expectedActionFor(state: DeobState): DeobDisposition['action'] | null {
  if (state === 'CONFIRMED') return 'CONFIRM';
  if (state === 'REJECTED') return 'REJECT';
  return null;
}

/**
 * Identify de-ob opportunities from the Phase 1 de-ob flags: one IDENTIFIED
 * opportunity per candidate flag, carrying its estimatedRecoverable. This is the
 * lineage seam — an opportunity traces back to its de-ob flag / finding by
 * udoId. Pure; preserves flag order.
 */
export function identifyDeobOpportunities(flags: DeobligationFlag[]): DeobOpportunity[] {
  return flags
    .filter((f) => f.candidate)
    .map((f) => ({
      udoId: f.udoId,
      state: 'IDENTIFIED' as const,
      estimatedRecoverable: f.estimatedRecoverable,
    }));
}

/**
 * Pure transition: returns a NEW opportunity in state `to`, or throws if the
 * transition is illegal, or if `to` is terminal without a disposition that both
 * carries a non-blank reason and matches the target (CONFIRM↔CONFIRMED,
 * REJECT↔REJECTED). The throw makes an un-reasoned disposition impossible to
 * apply silently; callers that must not throw guard with canTransitionDeob and a
 * reason check first (e.g. the store reducer).
 */
export function transitionDeob(
  opp: DeobOpportunity,
  to: DeobState,
  disposition?: DeobDisposition,
): DeobOpportunity {
  if (!canTransitionDeob(opp.state, to)) {
    throw new Error(`Illegal de-ob transition: ${opp.state} → ${to} (udo ${opp.udoId}).`);
  }

  if (isTerminalDeobState(to)) {
    if (!disposition || disposition.reason.trim() === '') {
      throw new Error(`De-ob ${to} requires a disposition with a reason (udo ${opp.udoId}).`);
    }
    const expected = expectedActionFor(to);
    if (disposition.action !== expected) {
      throw new Error(
        `De-ob ${to} expects a ${expected} disposition, got ${disposition.action} (udo ${opp.udoId}).`,
      );
    }
    return { ...opp, state: to, disposition };
  }

  // Non-terminal move (IDENTIFIED → UNDER_REVIEW): no disposition needed.
  return { ...opp, state: to };
}
