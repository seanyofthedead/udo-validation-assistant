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
  UdoRecord,
  ValidationFinding,
  Verdict,
} from '../domain/types';
import { runValidation, type PriorYearAnomalyResult } from '../domain/engine';

export interface AppState {
  asOfDate: string;
  population: UdoRecord[];
  evidence: EvidenceItem[];
  rules: CrgRule[];
  priorStats: PriorYearStat[];
  findings: ValidationFinding[];
  deobFlags: DeobligationFlag[];
  anomalies: PriorYearAnomalyResult[];
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
  return {
    asOfDate: input.asOfDate,
    population: input.population,
    evidence: input.evidence,
    rules: input.rules,
    priorStats: input.priorStats,
    findings: run.findings,
    deobFlags: run.deobFlags,
    anomalies: run.anomalies,
    dispositions: [],
    auditLog: run.audit, // seeded with the AI's actions; human actions append after
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
      const event: AuditEvent = {
        timestamp: action.timestamp,
        actor: 'HUMAN',
        action: 'EXPORT',
        detail: `${action.user} exported ${action.artifact} as ${action.format}.`,
      };
      return { ...state, auditLog: appendAudit(state.auditLog, event) };
    }

    default:
      return state;
  }
}
