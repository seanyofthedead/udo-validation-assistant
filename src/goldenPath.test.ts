// Task 4.1 — golden-path acceptance test (SPEC §8), step for step, driving the
// store + engine + export with no UI:
//   1. load the seed population
//   2. validate -> the SPEC §8 verdict mix + a ranked de-ob shortlist with a $ total
//   3. an empty-reason override is rejected
//   4. an override with a reason is accepted
//   5. export the packet (CSV + JSON); the audit trail holds the AI verdicts,
//      the override (with reason), and the export event.

import { describe, it, expect } from 'vitest';
import { appReducer, createInitialState, type AppState } from './state/store';
import { buildExport, auditTrailTable, toCsv, toJson } from './export/serialize';
import { crgRules } from './data/crgRules';
import { seedPopulation, seedEvidence, priorYearStats, AS_OF_DATE } from './data/seed';

function load(): AppState {
  return createInitialState({
    population: seedPopulation,
    evidence: seedEvidence,
    rules: crgRules,
    priorStats: priorYearStats,
    asOfDate: AS_OF_DATE,
  });
}

function countBy(values: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of values) out[v] = (out[v] ?? 0) + 1;
  return out;
}

const TS = '2026-06-21T12:00:00.000Z';

describe('golden path (SPEC §8)', () => {
  it('runs load -> validate -> override-guard -> override -> export end to end', () => {
    // 1. Load.
    let state = load();
    expect(state.population.length).toBe(20);

    // 2. Validate: the SPEC §8 mix and a ranked de-ob shortlist with a $ total.
    const mix = countBy(state.findings.map((f) => f.verdict));
    expect(mix).toEqual({ VALID: 15, QUESTIONABLE: 4, INSUFFICIENT_EVIDENCE: 1 });

    const candidates = state.deobFlags.filter((d) => d.candidate);
    const ranked = [...candidates].sort((a, b) => b.estimatedRecoverable - a.estimatedRecoverable);
    expect(ranked.map((c) => c.udoId)).toEqual([
      'UDO-CISA-0003',
      'UDO-FEMA-0002',
      'UDO-CBP-0002',
      'UDO-USCG-0005',
    ]);
    const deobTotal = candidates.reduce((s, c) => s + c.estimatedRecoverable, 0);
    expect(deobTotal).toBe(6_870_000);

    // exactly one abstain, on a thin-evidence line
    const abstains = state.findings.filter((f) => f.verdict === 'INSUFFICIENT_EVIDENCE');
    expect(abstains).toHaveLength(1);
    expect(abstains[0].udoId).toBe('UDO-TSA-0003');

    // 3. Empty-reason override is rejected (no-op).
    const afterEmpty = appReducer(state, {
      type: 'OVERRIDE',
      udoId: 'UDO-USCG-0003',
      overrideVerdict: 'VALID',
      reason: '   ',
      user: 'analyst@dhs.gov',
      timestamp: TS,
    });
    expect(afterEmpty).toBe(state);
    expect(afterEmpty.dispositions).toHaveLength(0);

    // 4. Override with a reason is accepted.
    state = appReducer(state, {
      type: 'OVERRIDE',
      udoId: 'UDO-USCG-0003',
      overrideVerdict: 'VALID',
      reason: 'Vendor confirmed ongoing performance.',
      user: 'analyst@dhs.gov',
      timestamp: TS,
    });
    expect(state.dispositions).toHaveLength(1);
    expect(state.dispositions[0]).toMatchObject({
      udoId: 'UDO-USCG-0003',
      action: 'OVERRIDE',
      overrideVerdict: 'VALID',
      reason: 'Vendor confirmed ongoing performance.',
    });

    // 5. Export the packet (CSV + JSON) and record the export.
    const csv = buildExport('validated-population', 'CSV', state);
    const json = buildExport('validated-population', 'JSON', state);
    expect(csv.filename).toBe('validated-population.csv');
    expect(json.filename).toBe('validated-population.json');
    expect(JSON.parse(json.content)).toHaveLength(20);

    state = appReducer(state, {
      type: 'RECORD_EXPORT',
      artifact: 'validated population',
      format: 'CSV',
      user: 'analyst@dhs.gov',
      timestamp: TS,
    });

    // Audit trail holds the AI verdicts, the override (with reason), and the export.
    const actions = state.auditLog.map((e) => e.action);
    expect(actions).toContain('VALIDATE');
    expect(actions).toContain('OVERRIDE');
    expect(actions).toContain('EXPORT');

    const overrideEvent = state.auditLog.find((e) => e.action === 'OVERRIDE');
    expect(overrideEvent?.detail).toContain('Vendor confirmed ongoing performance.');

    // The exported audit trail (CSV + JSON) carries those same entries.
    const auditCsv = toCsv(auditTrailTable(state));
    expect(auditCsv).toContain('VALIDATE');
    expect(auditCsv).toContain('Vendor confirmed ongoing performance.');
    const auditJson = JSON.parse(toJson(auditTrailTable(state))) as { action: string }[];
    expect(auditJson.some((e) => e.action === 'EXPORT')).toBe(true);

    // Guardrail: the AI never auto-disposed — the only human disposition is ours.
    expect(state.dispositions).toHaveLength(1);
  });
});
