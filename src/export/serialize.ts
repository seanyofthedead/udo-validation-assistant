// Export serializers — IMPLEMENTATION_PLAN.md 2.4 / SPEC §7.6. Pure functions
// that turn app state into the four exportable artifacts, each renderable as CSV
// or JSON: the validated population, the exception worklist, the de-obligation
// shortlist, and the full audit trail. The Blob download side effect lives in
// download.ts; everything here is deterministic and unit-testable.

import type { AppState } from '../state/store';
import type { AuditEvent, ValidationFinding } from '../domain/types';

export type ArtifactKind =
  | 'validated-population'
  | 'exceptions'
  | 'deobligation-shortlist'
  | 'audit-trail';

export type ExportFormat = 'CSV' | 'JSON';

/** A simple rectangular table: column headers + rows of primitive cells. */
export interface Table {
  headers: string[];
  rows: (string | number | boolean)[][];
}

export const ARTIFACT_LABELS: Record<ArtifactKind, string> = {
  'validated-population': 'validated population',
  exceptions: 'exception worklist',
  'deobligation-shortlist': 'de-obligation shortlist',
  'audit-trail': 'audit trail',
};

function findingByUdo(state: AppState): Map<string, ValidationFinding> {
  return new Map(state.findings.map((f) => [f.udoId, f]));
}

const POPULATION_HEADERS = [
  'udoId',
  'component',
  'vendor',
  'reportedStatus',
  'amountObligated',
  'amountDisbursed',
  'verdict',
  'confidence',
  'citedRuleId',
  'qcAgreed',
  'justification',
];

function populationRow(state: AppState, finding: ValidationFinding): (string | number | boolean)[] {
  const udo = state.population.find((u) => u.id === finding.udoId)!;
  return [
    udo.id,
    udo.component,
    udo.vendor,
    udo.reportedStatus,
    udo.amountObligated,
    udo.amountDisbursed,
    finding.verdict,
    finding.confidence,
    finding.citedRuleId ?? '',
    finding.qcAgreed,
    finding.justification,
  ];
}

/** Full population with its AI verdicts, in population order. */
export function validatedPopulationTable(state: AppState): Table {
  return {
    headers: POPULATION_HEADERS,
    rows: state.findings.map((f) => populationRow(state, f)),
  };
}

/** Exception worklist: everything the engine did not pass clean (verdict != VALID). */
export function exceptionsTable(state: AppState): Table {
  return {
    headers: POPULATION_HEADERS,
    rows: state.findings.filter((f) => f.verdict !== 'VALID').map((f) => populationRow(state, f)),
  };
}

/** De-obligation shortlist: candidates only, ranked by recoverable $ descending. */
export function deobShortlistTable(state: AppState): Table {
  const fByUdo = findingByUdo(state);
  const rows = state.deobFlags
    .filter((d) => d.candidate)
    .sort((a, b) => b.estimatedRecoverable - a.estimatedRecoverable)
    .map((d) => {
      const udo = state.population.find((u) => u.id === d.udoId)!;
      return [
        d.udoId,
        udo.component,
        udo.vendor,
        udo.amountObligated,
        udo.amountDisbursed,
        d.estimatedRecoverable,
        fByUdo.get(d.udoId)?.verdict ?? '',
        d.reasons.join(' | '),
      ];
    });
  return {
    headers: [
      'udoId',
      'component',
      'vendor',
      'amountObligated',
      'amountDisbursed',
      'estimatedRecoverable',
      'verdict',
      'reasons',
    ],
    rows,
  };
}

/** Full audit trail, in append order. */
export function auditTrailTable(state: AppState): Table {
  return {
    headers: ['timestamp', 'actor', 'action', 'udoId', 'detail'],
    rows: state.auditLog.map((e: AuditEvent) => [
      e.timestamp,
      e.actor,
      e.action,
      e.udoId ?? '',
      e.detail,
    ]),
  };
}

export function tableFor(kind: ArtifactKind, state: AppState): Table {
  switch (kind) {
    case 'validated-population':
      return validatedPopulationTable(state);
    case 'exceptions':
      return exceptionsTable(state);
    case 'deobligation-shortlist':
      return deobShortlistTable(state);
    case 'audit-trail':
      return auditTrailTable(state);
  }
}

/** Escape a single CSV cell per RFC 4180 (quote if it contains , " or newline). */
function csvCell(value: string | number | boolean): string {
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(table: Table): string {
  const lines = [table.headers, ...table.rows].map((row) => row.map(csvCell).join(','));
  return lines.join('\n');
}

/** JSON as an array of objects keyed by header (rows preserved in order). */
export function toJson(table: Table): string {
  const objects = table.rows.map((row) =>
    Object.fromEntries(table.headers.map((h, i) => [h, row[i]])),
  );
  return JSON.stringify(objects, null, 2);
}

export interface ExportPayload {
  filename: string;
  mime: string;
  content: string;
}

/** Build the downloadable payload for an artifact in the requested format. Pure. */
export function buildExport(
  kind: ArtifactKind,
  format: ExportFormat,
  state: AppState,
): ExportPayload {
  const table = tableFor(kind, state);
  if (format === 'CSV') {
    return { filename: `${kind}.csv`, mime: 'text/csv', content: toCsv(table) };
  }
  return { filename: `${kind}.json`, mime: 'application/json', content: toJson(table) };
}
