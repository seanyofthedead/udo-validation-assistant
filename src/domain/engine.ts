// Pure validation engine — SPEC.md §6.
//
// SCAFFOLD ONLY: these are compiling stubs so imports resolve. The real logic
// lands in IMPLEMENTATION_PLAN.md Wave 1. Two invariants are enforced from day one:
//   1. No React imports here.
//   2. No wall-clock / random calls — determinism comes from the explicit
//      `asOfDate` argument (see determinism.guard.test.ts).
// The `void` statements mark stub parameters as intentionally unused.

import type {
  AuditEvent,
  Component,
  CrgRule,
  DeobligationFlag,
  EvidenceItem,
  PriorYearStat,
  UdoRecord,
  ValidationFinding,
} from './types';

/**
 * Engine output shapes. These are NOT part of the SPEC §5 data model (which
 * lives in ./types); they are the return contracts of the pure pipeline.
 */
export interface PriorYearAnomalyResult {
  component: Component;
  populationShift: boolean;
  outlierUdoIds: string[];
}

export interface ValidationRun {
  findings: ValidationFinding[];
  deobFlags: DeobligationFlag[];
  anomalies: PriorYearAnomalyResult[];
  audit: AuditEvent[];
}

const NOT_IMPLEMENTED = 'not implemented — see IMPLEMENTATION_PLAN.md Wave 1';

/** SPEC §6 — status verdict for a single UDO. */
export function validateStatus(
  udo: UdoRecord,
  evidence: EvidenceItem[],
  rules: CrgRule[],
  asOfDate: string,
): ValidationFinding {
  void udo;
  void evidence;
  void rules;
  void asOfDate;
  throw new Error(`validateStatus ${NOT_IMPLEMENTED}`);
}

/** SPEC §6 — independent QC re-derivation (creator + checker). */
export function qcCheck(
  finding: ValidationFinding,
  udo: UdoRecord,
  evidence: EvidenceItem[],
): ValidationFinding {
  void finding;
  void udo;
  void evidence;
  throw new Error(`qcCheck ${NOT_IMPLEMENTED}`);
}

/** SPEC §6 — de-obligation candidacy for a single UDO. */
export function flagDeobligation(udo: UdoRecord, asOfDate: string): DeobligationFlag {
  void udo;
  void asOfDate;
  throw new Error(`flagDeobligation ${NOT_IMPLEMENTED}`);
}

/** SPEC §6 — prior-year population shift + per-line outliers. */
export function priorYearAnomaly(
  component: Component,
  current: PriorYearStat,
  priorStats: PriorYearStat[],
): PriorYearAnomalyResult {
  void component;
  void current;
  void priorStats;
  throw new Error(`priorYearAnomaly ${NOT_IMPLEMENTED}`);
}

/** SPEC §6 / Plan 1.8 — full pipeline; emits one AuditEvent per AI action. */
export function runValidation(
  population: UdoRecord[],
  evidence: EvidenceItem[],
  rules: CrgRule[],
  priorStats: PriorYearStat[],
  asOfDate: string,
): ValidationRun {
  void population;
  void evidence;
  void rules;
  void priorStats;
  void asOfDate;
  throw new Error(`runValidation ${NOT_IMPLEMENTED}`);
}
