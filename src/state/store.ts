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
  DeobligationFlag,
  Disposition,
  EvidenceItem,
  PriorYearStat,
  RiskScore,
  UdoRecord,
  ValidationFinding,
  Verdict,
} from '../domain/types';
import { runValidation, type PriorYearAnomalyResult } from '../domain/engine';
import { scorePopulation } from '../domain/riskEngine';
import { canTransitionCampaign, transitionCampaign } from '../domain/campaign';

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
    dispositions: [],
    auditLog: [...run.audit, ...risk.audit], // AI actions; human actions append after
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
    };

/** Append an event to the immutable audit log (new array; no mutation). */
function appendAudit(log: AuditEvent[], event: AuditEvent): AuditEvent[] {
  return [...log, event];
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

    default:
      return state;
  }
}
