// Response logic — SPEC §5.4 (Phase 3, Wave 7). A component's per-line answer to
// an assigned obligation. Pure and React-free; no clock/random — ids come from
// the line + assignment, and any timestamp a caller needs is supplied by it, as
// with the rest of src/domain.
//
// The rule encoded here is the mandatory-reason discipline (SPEC §5.4 / §10 —
// the same guard as a Phase 1 override): CONTEST and CORRECT must carry a
// non-blank reason, and CORRECT must also name a corrected status. CONCUR needs
// neither (it agrees with the AI verdict). A draft that violates this is
// REJECTED: the reducer returns the responses unchanged, so nothing un-reasoned
// ever reaches the record. Abstain over confident-wrong.

import type { ReportedStatus, Response, ResponseAction, ResponseState } from './types';

/** Whether an action requires a reason (CONCUR agrees with the AI; no reason). */
export const RESPONSE_NEEDS_REASON: Record<ResponseAction, boolean> = {
  CONCUR: false,
  CONTEST: true,
  CORRECT: true,
};

/** A component's intent for one line, before it becomes a stored Response. */
export interface ResponseDraft {
  assignmentId: string;
  udoId: string;
  action: ResponseAction;
  correctedStatus?: ReportedStatus;
  reason: string;
  evidenceRefs: string[];
}

/**
 * Why this draft cannot be recorded, or null if it is acceptable. Surfacing the
 * reason (rather than a bare boolean) keeps the rejection explainable — every
 * machine output carries its reasoning (SPEC §7).
 */
export function responseRejectionReason(draft: ResponseDraft): string | null {
  if (RESPONSE_NEEDS_REASON[draft.action] && draft.reason.trim() === '') {
    return `${draft.action} requires a reason.`;
  }
  if (draft.action === 'CORRECT' && draft.correctedStatus === undefined) {
    return 'CORRECT requires a corrected status.';
  }
  return null;
}

/** True iff the draft is acceptable (the negation of a rejection). */
export function isResponseAcceptable(draft: ResponseDraft): boolean {
  return responseRejectionReason(draft) === null;
}

/** Deterministic response id from its assignment + line (one answer per line). */
export function responseId(assignmentId: string, udoId: string): string {
  return `RSP-${assignmentId}-${udoId}`;
}

/**
 * Build a stored Response from an acceptable draft, or return null if the draft
 * is rejected (mandatory-reason / corrected-status discipline). A CONCUR is
 * normalized to an empty reason and no corrected status; a CONTEST/CORRECT keeps
 * its trimmed reason. Defaults to SUBMITTED (the component is answering HQ).
 */
export function buildResponse(
  draft: ResponseDraft,
  state: ResponseState = 'SUBMITTED',
): Response | null {
  if (!isResponseAcceptable(draft)) return null;

  const base: Response = {
    id: responseId(draft.assignmentId, draft.udoId),
    assignmentId: draft.assignmentId,
    udoId: draft.udoId,
    action: draft.action,
    reason: draft.action === 'CONCUR' ? '' : draft.reason.trim(),
    evidenceRefs: draft.evidenceRefs,
    state,
  };
  // correctedStatus is meaningful only for CORRECT (guaranteed present above).
  return draft.action === 'CORRECT'
    ? { ...base, correctedStatus: draft.correctedStatus }
    : base;
}

/**
 * Reducer over a component's responses: record `draft` (replacing any prior
 * answer for the same line, so a component can revise before HQ validates), or
 * return `responses` unchanged if the draft is rejected. Pure — a revision keeps
 * its original position; a new answer appends.
 */
export function reduceResponses(
  responses: Response[],
  draft: ResponseDraft,
  state?: ResponseState,
): Response[] {
  const next = buildResponse(draft, state);
  if (!next) return responses; // rejected no-op
  const idx = responses.findIndex((r) => r.id === next.id);
  if (idx === -1) return [...responses, next];
  const copy = responses.slice();
  copy[idx] = next;
  return copy;
}
