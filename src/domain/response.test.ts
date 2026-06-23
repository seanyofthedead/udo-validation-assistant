// Tests for the response reducer — SPEC §5.4 (Wave 7). The mechanism under test
// is the mandatory-reason discipline: CONTEST/CORRECT with a blank reason are a
// rejected no-op; CONCUR needs none; CORRECT must also name a corrected status.

import { describe, it, expect } from 'vitest';
import {
  RESPONSE_NEEDS_REASON,
  responseRejectionReason,
  isResponseAcceptable,
  responseId,
  buildResponse,
  reduceResponses,
  type ResponseDraft,
} from './response';
import type { Response } from './types';

function draft(over: Partial<ResponseDraft> = {}): ResponseDraft {
  return {
    assignmentId: 'CMP-01-USCG',
    udoId: 'UDO-USCG-0001',
    action: 'CONCUR',
    reason: '',
    evidenceRefs: [],
    ...over,
  };
}

describe('RESPONSE_NEEDS_REASON', () => {
  it('requires a reason for CONTEST and CORRECT but not CONCUR', () => {
    expect(RESPONSE_NEEDS_REASON.CONCUR).toBe(false);
    expect(RESPONSE_NEEDS_REASON.CONTEST).toBe(true);
    expect(RESPONSE_NEEDS_REASON.CORRECT).toBe(true);
  });
});

describe('responseRejectionReason — mandatory-reason discipline', () => {
  it('accepts CONCUR with no reason', () => {
    expect(responseRejectionReason(draft({ action: 'CONCUR' }))).toBeNull();
    expect(isResponseAcceptable(draft({ action: 'CONCUR' }))).toBe(true);
  });

  it('rejects CONTEST with an empty reason', () => {
    expect(responseRejectionReason(draft({ action: 'CONTEST', reason: '' }))).toMatch(/reason/i);
  });

  it('rejects CONTEST with a whitespace-only reason', () => {
    expect(responseRejectionReason(draft({ action: 'CONTEST', reason: '   ' }))).toMatch(/reason/i);
  });

  it('accepts CONTEST with a real reason', () => {
    expect(
      responseRejectionReason(draft({ action: 'CONTEST', reason: 'Vendor confirmed active work.' })),
    ).toBeNull();
  });

  it('rejects CORRECT with a real reason but no corrected status', () => {
    expect(
      responseRejectionReason(draft({ action: 'CORRECT', reason: 'Closeout signed.' })),
    ).toMatch(/corrected status/i);
  });

  it('accepts CORRECT with a reason and a corrected status', () => {
    expect(
      responseRejectionReason(
        draft({ action: 'CORRECT', reason: 'Closeout signed.', correctedStatus: 'CLOSED' }),
      ),
    ).toBeNull();
  });
});

describe('responseId', () => {
  it('is deterministic from assignment + line (one answer per line)', () => {
    expect(responseId('CMP-01-USCG', 'UDO-USCG-0001')).toBe('RSP-CMP-01-USCG-UDO-USCG-0001');
  });
});

describe('buildResponse', () => {
  it('returns null for a rejected draft (no Response constructed)', () => {
    expect(buildResponse(draft({ action: 'CONTEST', reason: '' }))).toBeNull();
  });

  it('normalizes a CONCUR to an empty reason and no corrected status', () => {
    const r = buildResponse(draft({ action: 'CONCUR', reason: 'ignored', correctedStatus: 'CLOSED' }))!;
    expect(r.reason).toBe('');
    expect(r.correctedStatus).toBeUndefined();
    expect(r.state).toBe('SUBMITTED'); // default
  });

  it('keeps a CORRECT trimmed reason and corrected status', () => {
    const r = buildResponse(
      draft({ action: 'CORRECT', reason: '  Closeout signed.  ', correctedStatus: 'CLOSED' }),
    )!;
    expect(r.reason).toBe('Closeout signed.');
    expect(r.correctedStatus).toBe('CLOSED');
  });

  it('honors an explicit state (e.g. a DRAFT not yet submitted)', () => {
    const r = buildResponse(draft({ action: 'CONCUR' }), 'DRAFT')!;
    expect(r.state).toBe('DRAFT');
  });
});

describe('reduceResponses', () => {
  it('appends a new acceptable answer', () => {
    const next = reduceResponses([], draft({ action: 'CONCUR' }));
    expect(next).toHaveLength(1);
    expect(next[0].udoId).toBe('UDO-USCG-0001');
  });

  it('is a no-op for a rejected draft (returns the same array reference)', () => {
    const responses: Response[] = [];
    const next = reduceResponses(responses, draft({ action: 'CONTEST', reason: '' }));
    expect(next).toBe(responses);
  });

  it('replaces a prior answer for the same line in place (a revision)', () => {
    const first = reduceResponses([], draft({ action: 'CONCUR' }));
    const revised = reduceResponses(
      first,
      draft({ action: 'CONTEST', reason: 'Changed my mind — this is wrong.' }),
    );
    expect(revised).toHaveLength(1);
    expect(revised[0].action).toBe('CONTEST');
  });

  it('keeps distinct lines as separate responses, order preserved', () => {
    let responses: Response[] = [];
    responses = reduceResponses(responses, draft({ udoId: 'UDO-USCG-0001', action: 'CONCUR' }));
    responses = reduceResponses(responses, draft({ udoId: 'UDO-USCG-0002', action: 'CONCUR' }));
    expect(responses.map((r) => r.udoId)).toEqual(['UDO-USCG-0001', 'UDO-USCG-0002']);
  });
});
