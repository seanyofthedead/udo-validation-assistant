// Escalation engine — SPEC §4 (Escalation Workflow) / Wave 7. Pure, deterministic,
// React-free: there is no clock or randomness here — "now" is the explicit
// `asOfDate`, exactly like the validation and risk engines. evaluateEscalations
// surveys the lines under review and raises an Escalation for each one that needs
// attention now, each carrying a plain-language reason (explainability, SPEC §7).
//
// An escalation is a *proposal* for a human (campaign manager or, above the
// dollar threshold, leadership): the platform never auto-posts or auto-resolves.
// Every tunable threshold lives in ESCALATION_MODEL so no magic number is buried
// in the logic.

import type {
  Assignment,
  Escalation,
  EscalationTrigger,
  Response,
  UdoRecord,
} from './types';

/** Escalation thresholds and levels. The single source of tunable numbers. */
export const ESCALATION_MODEL = {
  // Obligation dollars at or above which a line escalates on magnitude alone —
  // and, because size means leadership cares, straight to leadership visibility.
  highDollarThreshold: 1_000_000,
  managerLevel: 1, // campaign manager
  leadershipLevel: 2, // OCFO leadership
} as const;

/** A line is "answered to HQ" once its response is submitted or validated. */
function isAnswered(response: Response | undefined): boolean {
  return response !== undefined && (response.state === 'SUBMITTED' || response.state === 'VALIDATED');
}

/** Pure ISO 'YYYY-MM-DD' comparison: true iff `a` is strictly before `b`. */
function isBefore(a: string, b: string): boolean {
  return a < b; // ISO dates are lexicographically ordered
}

function usd(amount: number): string {
  return `$${amount.toLocaleString('en-US')}`;
}

function levelFor(trigger: EscalationTrigger): number {
  return trigger === 'HIGH_DOLLAR'
    ? ESCALATION_MODEL.leadershipLevel
    : ESCALATION_MODEL.managerLevel;
}

/** Deterministic id so re-evaluating the same world yields the same escalations. */
function escalationId(trigger: EscalationTrigger, target: string): string {
  return `ESC-${trigger}-${target}`;
}

/**
 * SPEC §4 — evaluate which lines under review must escalate, as of `asOfDate`.
 * Scope is the population reachable from `assignments` (the lines in the review).
 * Rules, each emitting at most one escalation per (trigger, line):
 *   - OVERDUE: the line's assignment due date has passed and the line is not yet
 *     answered to HQ (no submitted/validated response).
 *   - CONTESTED: the component contested the line.
 *   - HIGH_DOLLAR: the obligation is at/above the dollar threshold → leadership.
 *   - MANUAL: a human flagged the line's udoId for escalation.
 * Pure over its inputs + `asOfDate`. Output is de-duplicated by id and sorted by
 * id, so it is stable across runs.
 */
export function evaluateEscalations(
  assignments: Assignment[],
  responses: Response[],
  population: UdoRecord[],
  asOfDate: string,
  manualFlags: string[] = [],
): Escalation[] {
  const recordById = new Map(population.map((u) => [u.id, u]));
  const byId = new Map<string, Escalation>();

  const raise = (trigger: EscalationTrigger, target: string, reason: string) => {
    const id = escalationId(trigger, target);
    if (!byId.has(id)) byId.set(id, { id, target, trigger, level: levelFor(trigger), reason });
  };

  for (const a of assignments) {
    const overdue = isBefore(a.dueDate, asOfDate);
    for (const udoId of a.udoIds) {
      const record = recordById.get(udoId);
      if (!record) continue; // unknown line — skip

      const response = responses.find((r) => r.assignmentId === a.id && r.udoId === udoId);

      if (overdue && !isAnswered(response)) {
        raise(
          'OVERDUE',
          udoId,
          `Assignment ${a.id} was due ${a.dueDate}; line not yet submitted as of ${asOfDate}.`,
        );
      }

      if (response?.action === 'CONTEST') {
        raise('CONTESTED', udoId, `Component contested this line: ${response.reason}`);
      }

      if (record.amountObligated >= ESCALATION_MODEL.highDollarThreshold) {
        raise(
          'HIGH_DOLLAR',
          udoId,
          `Obligation ${usd(record.amountObligated)} is at or above the ` +
            `${usd(ESCALATION_MODEL.highDollarThreshold)} escalation threshold.`,
        );
      }
    }
  }

  for (const udoId of manualFlags) {
    if (recordById.has(udoId)) {
      raise('MANUAL', udoId, 'Manually flagged for escalation by a reviewer.');
    }
  }

  return [...byId.values()].sort((x, y) => x.id.localeCompare(y.id));
}
