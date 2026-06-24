// App state — IMPLEMENTATION_PLAN.md Wave 2. Pure store: state shape + reducer,
// no React (so it is unit-testable in isolation and the audit invariants are
// easy to assert). The React Context/provider lives in AppStateContext.tsx.
//
// Guardrails encoded here (SPEC §10):
//   - Human dispositions are recorded; the app never auto-posts.
//   - Override requires a non-empty reason (enforced in 2.2).
//   - The audit log is append-only: every reducer branch returns a NEW array
//     and never mutates a prior entry.

import type {
  Assignment,
  AuditEvent,
  Campaign,
  CampaignState,
  CrgRule,
  DeobDisposition,
  DeobOpportunity,
  DeobState,
  DeobligationFlag,
  Disposition,
  Escalation,
  EvidenceItem,
  PriorYearStat,
  Response,
  ReviewDecision,
  RiskScore,
  UdoRecord,
  ValidationFinding,
  Verdict,
} from '../domain/types';
import { runValidation, type PriorYearAnomalyResult } from '../domain/engine';
import { scorePopulation } from '../domain/riskEngine';
import { canTransitionCampaign, transitionCampaign } from '../domain/campaign';
import { reduceResponses, type ResponseDraft } from '../domain/response';
import { evaluateEscalations } from '../domain/escalation';
import {
  canTransitionDeob,
  identifyDeobOpportunities,
  isTerminalDeobState,
  transitionDeob,
} from '../domain/deob';
import type { AssignmentState } from '../domain/types';

export interface AppState {
  asOfDate: string;
  population: UdoRecord[];
  evidence: EvidenceItem[];
  rules: CrgRule[];
  priorStats: PriorYearStat[];
  findings: ValidationFinding[];
  deobFlags: DeobligationFlag[];
  anomalies: PriorYearAnomalyResult[];
  riskScores: RiskScore[]; // Wave 5 — ranked by score desc (scorePopulation)
  campaigns: Campaign[]; // Wave 6 — HQ review campaigns (first-class, audited)
  assignments: Assignment[]; // Wave 6 — per-component slices of a campaign
  responses: Response[]; // Wave 7 — component per-line answers (concur/contest/correct)
  escalations: Escalation[]; // Wave 7 — items needing attention (overdue/contested/high-$)
  deobOpportunities: DeobOpportunity[]; // Wave 7 — de-ob candidates under disposition
  dispositions: Disposition[];
  auditLog: AuditEvent[];
}

export interface InitInputs {
  population: UdoRecord[];
  evidence: EvidenceItem[];
  rules: CrgRule[];
  priorStats: PriorYearStat[];
  asOfDate: string;
}

/** Build the initial state by running the validation pipeline once over the seed. */
export function createInitialState(input: InitInputs): AppState {
  const run = runValidation(
    input.population,
    input.evidence,
    input.rules,
    input.priorStats,
    input.asOfDate,
  );
  // Wave 5 — score the population for review-worthiness in the same init pass.
  // scorePopulation appends exactly one RISK_SCORE audit event, so the running
  // app records the ranking the same way it records validation (SPEC §7).
  const risk = scorePopulation(
    input.population,
    run.findings,
    run.anomalies,
    input.evidence,
    input.rules,
    input.asOfDate,
  );
  // Wave 7 — surface the Phase 1 de-ob candidates as lifecycle opportunities
  // (SPEC §5.7). Identification is a machine action, so it appends one AI audit
  // event, mirroring how validation and risk scoring record their runs.
  const deobOpportunities = identifyDeobOpportunities(run.deobFlags);
  const deobIdentifyAudit: AuditEvent[] = [
    {
      timestamp: `${input.asOfDate}T00:00:00.000Z`,
      actor: 'AI',
      action: 'DEOB_IDENTIFY',
      detail:
        `Identified ${deobOpportunities.length} de-obligation opportunity(ies) from the ` +
        `de-ob flags as of ${input.asOfDate}.`,
    },
  ];
  return {
    asOfDate: input.asOfDate,
    population: input.population,
    evidence: input.evidence,
    rules: input.rules,
    priorStats: input.priorStats,
    findings: run.findings,
    deobFlags: run.deobFlags,
    anomalies: run.anomalies,
    riskScores: risk.scores,
    campaigns: [], // Wave 6 — campaigns are created by humans at runtime, not seeded
    assignments: [],
    responses: [], // Wave 7 — components answer at runtime, not seeded
    escalations: [], // Wave 7 — raised by evaluation at runtime
    deobOpportunities, // Wave 7 — IDENTIFIED from the de-ob flags
    dispositions: [],
    // AI actions (validation, risk, de-ob identification); human actions append after.
    auditLog: [...run.audit, ...risk.audit, ...deobIdentifyAudit],
  };
}

export type AppAction =
  | { type: 'CONFIRM'; udoId: string; user: string; timestamp: string }
  | {
      type: 'OVERRIDE';
      udoId: string;
      overrideVerdict: Verdict;
      reason: string;
      user: string;
      timestamp: string;
    }
  | {
      type: 'RECORD_EXPORT';
      artifact: string;
      format: 'CSV' | 'JSON';
      user: string;
      timestamp: string;
    }
  // Step 6 of the DHS HQ process — the reviewer's operational determination of a
  // line (keep / liquidate / de-obligate / closeout / research / escalate). A
  // reason is MANDATORY (abstain over guessing); a blank reason is a no-op, the
  // same discipline as a blank-reason override. Recorded as a disposition + one
  // audit event; the platform still never auto-posts.
  | {
      type: 'RECORD_DETERMINATION';
      udoId: string;
      decision: ReviewDecision;
      reason: string;
      user: string;
      timestamp: string;
    }
  // Wave 6 — campaign lifecycle (SPEC §5.3). The UI builds the campaign and its
  // assignments with the pure domain helpers (generateAssignments etc.) and
  // dispatches the result; the reducer records them and appends the audit event.
  | { type: 'CREATE_CAMPAIGN'; campaign: Campaign; assignments: Assignment[] }
  | {
      type: 'TRANSITION_CAMPAIGN';
      campaignId: string;
      to: CampaignState;
      user: string;
      timestamp: string;
    }
  // Wave 7 — component collaboration (SPEC §5.4, §5.7). The component submits a
  // per-line response (the reducer enforces the mandatory-reason discipline); HQ
  // validates it; escalations are evaluated; de-ob opportunities are dispositioned.
  | { type: 'SUBMIT_RESPONSE'; draft: ResponseDraft; user: string; timestamp: string }
  | { type: 'VALIDATE_RESPONSE'; responseId: string; user: string; timestamp: string }
  | { type: 'RAISE_ESCALATIONS'; manualFlags?: string[]; timestamp: string }
  | {
      type: 'TRANSITION_DEOB';
      udoId: string;
      to: DeobState;
      reason: string;
      user: string;
      timestamp: string;
    };

/** Append an event to the immutable audit log (new array; no mutation). */
function appendAudit(log: AuditEvent[], event: AuditEvent): AuditEvent[] {
  return [...log, event];
}

/**
 * Derive an assignment's progress from its responses (Wave 7). A line counts as
 * answered once its response is submitted or validated. None answered →
 * NOT_STARTED; all answered → COMPLETE; some → IN_PROGRESS. This keeps the
 * Wave 6 progress table (and SPEC §5.4's Assigned → In Progress → Submitted
 * lifecycle) honest as responses land, without a separate human action.
 */
function assignmentStateFromResponses(
  assignment: Assignment,
  responses: Response[],
): AssignmentState {
  const answered = assignment.udoIds.filter((udoId) =>
    responses.some(
      (r) =>
        r.assignmentId === assignment.id &&
        r.udoId === udoId &&
        (r.state === 'SUBMITTED' || r.state === 'VALIDATED'),
    ),
  ).length;
  if (answered === 0) return 'NOT_STARTED';
  if (answered === assignment.udoIds.length) return 'COMPLETE';
  return 'IN_PROGRESS';
}

/**
 * Build the audit event for an export. Shared by the reducer and the export
 * orchestrator so a downloaded audit-trail snapshot can include the very export
 * that produced it (single source of truth for the event shape).
 */
export function exportAuditEvent(input: {
  artifact: string;
  format: 'CSV' | 'JSON';
  user: string;
  timestamp: string;
}): AuditEvent {
  return {
    timestamp: input.timestamp,
    actor: 'HUMAN',
    action: 'EXPORT',
    detail: `${input.user} exported ${input.artifact} as ${input.format}.`,
  };
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'CONFIRM': {
      const disposition: Disposition = {
        udoId: action.udoId,
        action: 'CONFIRM',
        reason: '', // confirm needs no reason
        user: action.user,
        timestamp: action.timestamp,
      };
      const event: AuditEvent = {
        timestamp: action.timestamp,
        actor: 'HUMAN',
        action: 'CONFIRM',
        udoId: action.udoId,
        detail: `${action.user} confirmed the AI verdict.`,
      };
      return {
        ...state,
        dispositions: [...state.dispositions, disposition],
        auditLog: appendAudit(state.auditLog, event),
      };
    }

    case 'OVERRIDE': {
      // SPEC §10 — mandatory reason on override. A blank/whitespace reason is
      // rejected: the reducer is a no-op, so no disposition or audit entry is
      // recorded. (Confirm, by contrast, needs no reason.)
      if (action.reason.trim() === '') return state;

      const disposition: Disposition = {
        udoId: action.udoId,
        action: 'OVERRIDE',
        overrideVerdict: action.overrideVerdict,
        reason: action.reason,
        user: action.user,
        timestamp: action.timestamp,
      };
      const event: AuditEvent = {
        timestamp: action.timestamp,
        actor: 'HUMAN',
        action: 'OVERRIDE',
        udoId: action.udoId,
        detail: `${action.user} overrode the verdict to ${action.overrideVerdict}. Reason: ${action.reason}`,
      };
      return {
        ...state,
        dispositions: [...state.dispositions, disposition],
        auditLog: appendAudit(state.auditLog, event),
      };
    }

    case 'RECORD_DETERMINATION': {
      // SPEC §10 discipline — mandatory reason; a blank/whitespace reason is a
      // no-op (no disposition, no audit), mirroring the override guard. The
      // determination is the reviewer's *operational* decision, recorded distinctly
      // from a verdict override so the audit trail shows what HQ will DO with the line.
      if (action.reason.trim() === '') return state;

      const disposition: Disposition = {
        udoId: action.udoId,
        action: 'DETERMINATION',
        reviewDecision: action.decision,
        reason: action.reason.trim(),
        user: action.user,
        timestamp: action.timestamp,
      };
      const event: AuditEvent = {
        timestamp: action.timestamp,
        actor: 'HUMAN',
        action: 'DETERMINATION',
        udoId: action.udoId,
        detail: `${action.user} determined ${action.udoId}: ${action.decision}. Reason: ${action.reason.trim()}`,
      };
      return {
        ...state,
        dispositions: [...state.dispositions, disposition],
        auditLog: appendAudit(state.auditLog, event),
      };
    }

    case 'RECORD_EXPORT': {
      // Exporting an artifact is an auditable action (SPEC §10): record it.
      const event = exportAuditEvent({
        artifact: action.artifact,
        format: action.format,
        user: action.user,
        timestamp: action.timestamp,
      });
      return { ...state, auditLog: appendAudit(state.auditLog, event) };
    }

    case 'CREATE_CAMPAIGN': {
      // SPEC §5.3 — a campaign and its assignments are recorded together as one
      // creation act, appending exactly one audit event (the campaign carries the
      // creator + creation time, so the event is fully attributable). The platform
      // never auto-advances state: a fresh campaign is DRAFT until a human acts.
      const { campaign, assignments } = action;
      const udoCount = assignments.reduce((n, a) => n + a.udoIds.length, 0);
      const event: AuditEvent = {
        timestamp: campaign.createdAt,
        actor: 'HUMAN',
        action: 'CAMPAIGN_CREATE',
        detail:
          `${campaign.createdBy} created campaign "${campaign.name}" (${campaign.id}) for ` +
          `${campaign.period}: ${udoCount} obligation(s) across ${assignments.length} ` +
          `assignment(s).`,
      };
      return {
        ...state,
        campaigns: [...state.campaigns, campaign],
        assignments: [...state.assignments, ...assignments],
        auditLog: appendAudit(state.auditLog, event),
      };
    }

    case 'TRANSITION_CAMPAIGN': {
      // SPEC §5.3 — move a campaign forward (Draft→Active→Closing→Closed). An
      // illegal transition is a no-op (no state change, no audit entry), the same
      // discipline as a blank-reason override; a legal one appends exactly one
      // audit event. The pure state machine (canTransition/transition) is the
      // single source of truth for legality.
      const current = state.campaigns.find((c) => c.id === action.campaignId);
      if (!current || !canTransitionCampaign(current.state, action.to)) return state;

      const from = current.state;
      const moved = transitionCampaign(current, action.to);
      const event: AuditEvent = {
        timestamp: action.timestamp,
        actor: 'HUMAN',
        action: 'CAMPAIGN_TRANSITION',
        detail: `${action.user} moved campaign ${moved.id} from ${from} to ${moved.state}.`,
      };
      return {
        ...state,
        campaigns: state.campaigns.map((c) => (c.id === moved.id ? moved : c)),
        auditLog: appendAudit(state.auditLog, event),
      };
    }

    case 'SUBMIT_RESPONSE': {
      // SPEC §5.4 — a component answers a line. The pure response reducer enforces
      // the mandatory-reason discipline: a CONTEST/CORRECT with a blank reason (or
      // a CORRECT with no corrected status) is rejected, so reduceResponses returns
      // the same array — we treat that as a no-op (no audit entry), the same way a
      // blank-reason override is a no-op. An accepted response advances the owning
      // assignment's progress and appends exactly one audit event.
      const nextResponses = reduceResponses(state.responses, action.draft, 'SUBMITTED');
      if (nextResponses === state.responses) return state; // rejected — no-op

      const { draft } = action;
      const assignments = state.assignments.map((a) =>
        a.id === draft.assignmentId
          ? { ...a, state: assignmentStateFromResponses(a, nextResponses) }
          : a,
      );
      const correctionNote =
        draft.action === 'CORRECT' ? ` Proposed status: ${draft.correctedStatus}.` : '';
      const reasonNote = draft.action === 'CONCUR' ? '' : ` Reason: ${draft.reason.trim()}`;
      const event: AuditEvent = {
        timestamp: action.timestamp,
        actor: 'HUMAN',
        action: 'RESPONSE_SUBMIT',
        udoId: draft.udoId,
        detail:
          `${action.user} submitted a ${draft.action} response on ${draft.udoId} ` +
          `(assignment ${draft.assignmentId}).${correctionNote}${reasonNote}`,
      };
      return {
        ...state,
        responses: nextResponses,
        assignments,
        auditLog: appendAudit(state.auditLog, event),
      };
    }

    case 'VALIDATE_RESPONSE': {
      // SPEC §5.4 — HQ validates a submitted response so concurrence isn't
      // rubber-stamped. Only a SUBMITTED response can be validated; anything else
      // (unknown id, already validated/draft) is a no-op. Appends one audit event.
      const target = state.responses.find((r) => r.id === action.responseId);
      if (!target || target.state !== 'SUBMITTED') return state;

      const event: AuditEvent = {
        timestamp: action.timestamp,
        actor: 'HUMAN',
        action: 'RESPONSE_VALIDATE',
        udoId: target.udoId,
        detail:
          `${action.user} validated the ${target.action} response on ${target.udoId} ` +
          `(assignment ${target.assignmentId}).`,
      };
      return {
        ...state,
        responses: state.responses.map((r) =>
          r.id === target.id ? { ...r, state: 'VALIDATED' } : r,
        ),
        auditLog: appendAudit(state.auditLog, event),
      };
    }

    case 'RAISE_ESCALATIONS': {
      // SPEC §4 — re-evaluate which lines under review need attention as of the
      // store's asOfDate. The pure engine proposes; this records the proposal as a
      // single AI audit event (mirroring the risk-scoring run). Replaces the prior
      // escalation set so the list always reflects the current world.
      const escalations = evaluateEscalations(
        state.assignments,
        state.responses,
        state.population,
        state.asOfDate,
        action.manualFlags ?? [],
      );
      const event: AuditEvent = {
        timestamp: action.timestamp,
        actor: 'AI',
        action: 'ESCALATE',
        detail:
          `Evaluated escalations as of ${state.asOfDate}: ${escalations.length} item(s) ` +
          `flagged (overdue / contested / high-dollar / manual).`,
      };
      return { ...state, escalations, auditLog: appendAudit(state.auditLog, event) };
    }

    case 'TRANSITION_DEOB': {
      // SPEC §5.7 — move a de-ob opportunity through its lifecycle. The pure state
      // machine is the single source of legality; a terminal CONFIRM/REJECT
      // requires a non-blank reason. An illegal transition or a blank-reason
      // disposition is a no-op (no state change, no audit), the same discipline as
      // a blank-reason override. A legal change appends exactly one audit event.
      const current = state.deobOpportunities.find((o) => o.udoId === action.udoId);
      if (!current || !canTransitionDeob(current.state, action.to)) return state;

      const terminal = isTerminalDeobState(action.to);
      if (terminal && action.reason.trim() === '') return state; // mandatory reason

      const disposition: DeobDisposition | undefined = terminal
        ? {
            action: action.to === 'CONFIRMED' ? 'CONFIRM' : 'REJECT',
            reason: action.reason.trim(),
            user: action.user,
            timestamp: action.timestamp,
          }
        : undefined;

      const moved = transitionDeob(current, action.to, disposition);
      const reasonNote = terminal ? ` Reason: ${action.reason.trim()}` : '';
      const event: AuditEvent = {
        timestamp: action.timestamp,
        actor: 'HUMAN',
        action: 'DEOB_TRANSITION',
        udoId: action.udoId,
        detail:
          `${action.user} moved de-ob opportunity ${action.udoId} from ${current.state} to ` +
          `${moved.state}.${reasonNote}`,
      };
      return {
        ...state,
        deobOpportunities: state.deobOpportunities.map((o) =>
          o.udoId === moved.udoId ? moved : o,
        ),
        auditLog: appendAudit(state.auditLog, event),
      };
    }

    default:
      return state;
  }
}
