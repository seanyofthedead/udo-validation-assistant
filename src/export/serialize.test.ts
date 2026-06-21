// @vitest-environment jsdom
// Task 2.4 — serializer shape (headers + row counts) and the audited export.
// jsdom is needed because exportArtifact triggers a Blob download via the DOM.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validatedPopulationTable,
  exceptionsTable,
  deobShortlistTable,
  auditTrailTable,
  toCsv,
  toJson,
  buildExport,
} from './serialize';
import { exportArtifact } from './download';
import { appReducer, createInitialState, type AppState } from '../state/store';
import { crgRules } from '../data/crgRules';
import { seedPopulation, seedEvidence, priorYearStats, AS_OF_DATE } from '../data/seed';

function initialState(): AppState {
  return createInitialState({
    population: seedPopulation,
    evidence: seedEvidence,
    rules: crgRules,
    priorStats: priorYearStats,
    asOfDate: AS_OF_DATE,
  });
}

describe('serializer tables: headers + row counts', () => {
  const state = initialState();

  it('validated population has one row per record', () => {
    const t = validatedPopulationTable(state);
    expect(t.headers[0]).toBe('udoId');
    expect(t.headers).toContain('verdict');
    expect(t.rows).toHaveLength(seedPopulation.length);
  });

  it('exceptions worklist excludes VALID lines (5 exceptions over the seed)', () => {
    const t = exceptionsTable(state);
    const exceptionCount = state.findings.filter((f) => f.verdict !== 'VALID').length;
    expect(t.rows).toHaveLength(exceptionCount);
    expect(exceptionCount).toBe(5); // 4 QUESTIONABLE + 1 INSUFFICIENT_EVIDENCE
  });

  it('de-ob shortlist holds the candidates, ranked by recoverable $ desc', () => {
    const t = deobShortlistTable(state);
    expect(t.rows).toHaveLength(4);
    const recoverableCol = t.headers.indexOf('estimatedRecoverable');
    const amounts = t.rows.map((r) => Number(r[recoverableCol]));
    expect(amounts).toEqual([4_800_000, 900_000, 630_000, 540_000]);
  });

  it('audit trail has one row per audit event', () => {
    const t = auditTrailTable(state);
    expect(t.rows).toHaveLength(state.auditLog.length);
    expect(t.headers).toEqual(['timestamp', 'actor', 'action', 'udoId', 'detail']);
  });
});

describe('CSV + JSON encoding', () => {
  const state = initialState();

  it('CSV has a header line plus one line per row', () => {
    const t = validatedPopulationTable(state);
    const csv = toCsv(t);
    const lines = csv.split('\n');
    expect(lines[0]).toBe(t.headers.join(','));
    expect(lines).toHaveLength(t.rows.length + 1);
  });

  it('CSV quotes and escapes fields containing commas or quotes', () => {
    const csv = toCsv({
      headers: ['a', 'b'],
      rows: [
        ['plain', 'has, comma'],
        ['with "quote"', 'x'],
      ],
    });
    expect(csv).toContain('"has, comma"');
    expect(csv).toContain('"with ""quote"""');
  });

  it('JSON parses to an array of objects keyed by header', () => {
    const t = deobShortlistTable(state);
    const parsed = JSON.parse(toJson(t));
    expect(parsed).toHaveLength(t.rows.length);
    expect(Object.keys(parsed[0])).toEqual(t.headers);
  });

  it('buildExport sets filename + mime per format', () => {
    expect(buildExport('audit-trail', 'CSV', state)).toMatchObject({
      filename: 'audit-trail.csv',
      mime: 'text/csv',
    });
    expect(buildExport('audit-trail', 'JSON', state)).toMatchObject({
      filename: 'audit-trail.json',
      mime: 'application/json',
    });
  });
});

describe('exportArtifact: triggers download and audits the export', () => {
  beforeEach(() => {
    // jsdom does not implement object URLs or anchor navigation; stub them.
    Object.assign(URL, {
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  it('dispatches RECORD_EXPORT, and reducing it appends an EXPORT audit event', () => {
    const state = initialState();
    const dispatch = vi.fn();
    const payload = exportArtifact('deobligation-shortlist', 'CSV', state, dispatch, {
      user: 'analyst@dhs.gov',
      timestamp: '2026-06-21T12:00:00.000Z',
    });

    expect(payload.filename).toBe('deobligation-shortlist.csv');
    expect(dispatch).toHaveBeenCalledTimes(1);
    const action = dispatch.mock.calls[0][0];
    expect(action.type).toBe('RECORD_EXPORT');

    const after = appReducer(state, action);
    expect(after.auditLog.length).toBe(state.auditLog.length + 1);
    expect(after.auditLog[after.auditLog.length - 1]).toMatchObject({
      actor: 'HUMAN',
      action: 'EXPORT',
    });
  });
});
