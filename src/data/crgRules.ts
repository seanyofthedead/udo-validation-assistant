// Mock CRG ruleset — SPEC.md §4 / §6. In MVP-1 the CRG (the policy/process guide)
// is represented by this small ruleset: exactly one CrgRule per ReportedStatus,
// declaring the evidence that status is expected to carry. The status engine
// (1.4) looks up the rule matching `udo.reportedStatus` and abstains
// (INSUFFICIENT_EVIDENCE) when the required evidence is missing.
//
// `description` is plain language on purpose: it is surfaced verbatim in the UI
// as the "cited rule" behind a verdict.
//
// Evidence types (SPEC §5): PO | INVOICE | RECEIPT | MOD | GL.

import type { CrgRule, ReportedStatus } from '../domain/types';

export const crgRules: CrgRule[] = [
  {
    id: 'CRG-OPEN-ACTIVE-01',
    appliesToStatus: 'OPEN_ACTIVE',
    requiredEvidence: ['PO', 'INVOICE'],
    description:
      'An obligation reported OPEN_ACTIVE must carry an awarding purchase order and at least one invoice evidencing ongoing performance.',
  },
  {
    id: 'CRG-OPEN-INACTIVE-01',
    appliesToStatus: 'OPEN_INACTIVE',
    requiredEvidence: ['PO', 'GL'],
    description:
      'An obligation reported OPEN_INACTIVE must carry an awarding purchase order and a general-ledger entry establishing the open balance.',
  },
  {
    id: 'CRG-PENDING-CLOSE-01',
    appliesToStatus: 'PENDING_CLOSE',
    requiredEvidence: ['PO', 'INVOICE', 'RECEIPT'],
    description:
      'An obligation reported PENDING_CLOSE must carry a purchase order, invoicing, and a receipt confirming delivery before closeout.',
  },
  {
    id: 'CRG-CLOSED-01',
    appliesToStatus: 'CLOSED',
    requiredEvidence: ['PO', 'INVOICE', 'RECEIPT'],
    description:
      'An obligation reported CLOSED must retain its purchase order, final invoicing, and a receipt of goods or services.',
  },
];

/** Every ReportedStatus the ruleset must cover (kept in sync with SPEC §5). */
export const ALL_REPORTED_STATUSES: ReportedStatus[] = [
  'OPEN_ACTIVE',
  'OPEN_INACTIVE',
  'PENDING_CLOSE',
  'CLOSED',
];

/** Look up the single governing rule for a reported status, or undefined. */
export function ruleForStatus(
  status: ReportedStatus,
  rules: CrgRule[] = crgRules,
): CrgRule | undefined {
  return rules.find((r) => r.appliesToStatus === status);
}
