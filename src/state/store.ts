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
  AuditEvent,
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

    default:
      return state;
  }
}
