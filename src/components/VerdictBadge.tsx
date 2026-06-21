// Verdict badge — SPEC UI guardrails: VALID green, QUESTIONABLE amber,
// INSUFFICIENT_EVIDENCE grey. Renders a labelled pill.

import type { Verdict } from '../domain/types';

const LABEL: Record<Verdict, string> = {
  VALID: 'Valid',
  QUESTIONABLE: 'Questionable',
  INSUFFICIENT_EVIDENCE: 'Insufficient evidence',
};

const CLASS: Record<Verdict, string> = {
  VALID: 'badge badge-valid',
  QUESTIONABLE: 'badge badge-questionable',
  INSUFFICIENT_EVIDENCE: 'badge badge-insufficient',
};

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  return (
    <span className={CLASS[verdict]} data-verdict={verdict}>
      {LABEL[verdict]}
    </span>
  );
}
