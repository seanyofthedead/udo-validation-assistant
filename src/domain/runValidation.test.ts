// Task 1.8 — full-pipeline integration test over the seed. Asserts the SPEC §8
// verdict mix, reconciles every record against SEED_DESIGN (closing the loop
// the 1.3 fixture promised), and checks that audit events are produced.

import { describe, it, expect } from 'vitest';
import { runValidation } from './engine';
import { crgRules } from '../data/crgRules';
import {
  seedPopulation,
  seedEvidence,
  priorYearStats,
  SEED_DESIGN,
  AS_OF_DATE,
} from '../data/seed';
import type { Verdict } from './types';

function run() {
  return runValidation(seedPopulation, seedEvidence, crgRules, priorYearStats, AS_OF_DATE);
}

function countBy(values: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of values) out[v] = (out[v] ?? 0) + 1;
  return out;
}

describe('runValidation: SPEC §8 verdict mix', () => {
  it('produces several VALID, >=3 QUESTIONABLE, exactly one INSUFFICIENT_EVIDENCE', () => {
    const { findings } = run();
    const mix = countBy(findings.map((f) => f.verdict));
    expect(mix).toMatchInlineSnapshot(`
      {
        "INSUFFICIENT_EVIDENCE": 1,
        "QUESTIONABLE": 4,
        "VALID": 15,
      }
    `);
    expect(mix.VALID).toBeGreaterThanOrEqual(5);
    expect(mix.QUESTIONABLE).toBeGreaterThanOrEqual(3);
    expect(mix.INSUFFICIENT_EVIDENCE).toBe(1);
  });
});

describe('runValidation: reconciles the engine against SEED_DESIGN', () => {
  it('every record matches its designed verdict and cited rule', () => {
    const { findings } = run();
    const mismatches: string[] = [];
    for (const f of findings) {
      const design = SEED_DESIGN[f.udoId];
      if (f.verdict !== design.verdict)
        mismatches.push(`${f.udoId}: verdict ${f.verdict} != ${design.verdict}`);
      if ((f.citedRuleId ?? null) !== (design.citedRuleId ?? null))
        mismatches.push(`${f.udoId}: citedRule ${f.citedRuleId} != ${design.citedRuleId}`);
    }
    expect(mismatches).toEqual([]);
  });

  it('every QUESTIONABLE line cites a CRG rule and carries a justification', () => {
    const { findings } = run();
    for (const f of findings.filter((x) => x.verdict === 'QUESTIONABLE')) {
      expect(f.citedRuleId).toMatch(/^CRG-/);
      expect(f.justification.length).toBeGreaterThan(0);
    }
  });

  it('the abstaining line carries no cited rule (null)', () => {
    const { findings } = run();
    const abstains = findings.filter((f) => f.verdict === 'INSUFFICIENT_EVIDENCE');
    expect(abstains).toHaveLength(1);
    expect(abstains[0].citedRuleId).toBeNull();
  });
});

describe('runValidation: de-obligation shortlist', () => {
  it('matches the designed candidate set and total recoverable $', () => {
    const { deobFlags } = run();
    const candidates = deobFlags.filter((f) => f.candidate);
    const designedCandidates = Object.entries(SEED_DESIGN).filter(([, d]) => d.deobCandidate);

    expect(candidates.map((c) => c.udoId).sort()).toEqual(
      designedCandidates.map(([id]) => id).sort(),
    );
    const total = candidates.reduce((s, c) => s + c.estimatedRecoverable, 0);
    expect(total).toBe(540_000 + 900_000 + 630_000 + 4_800_000);
  });
});

describe('runValidation: anomalies + audit trail', () => {
  it('flags the FEMA population shift and the CISA outlier', () => {
    const { anomalies } = run();
    const fema = anomalies.find((a) => a.component === 'FEMA')!;
    const cisa = anomalies.find((a) => a.component === 'CISA')!;
    expect(fema.populationShift).toBe(true);
    expect(cisa.outlierUdoIds).toContain('UDO-CISA-0003');
  });

  it('emits one VALIDATE audit event per record plus de-ob and anomaly events', () => {
    const { audit, deobFlags } = run();
    const validateEvents = audit.filter((e) => e.action === 'VALIDATE');
    const deobEvents = audit.filter((e) => e.action === 'DEOBLIGATION_FLAG');
    expect(validateEvents).toHaveLength(seedPopulation.length);
    expect(deobEvents).toHaveLength(deobFlags.filter((f) => f.candidate).length);
    expect(audit.some((e) => e.action === 'PRIOR_YEAR_ANOMALY')).toBe(true);
    expect(audit.every((e) => e.actor === 'AI')).toBe(true);
    expect(audit.every((e) => e.timestamp === `${AS_OF_DATE}T00:00:00.000Z`)).toBe(true);
  });
});

describe('runValidation: determinism', () => {
  it('same inputs produce identical runs', () => {
    expect(run()).toEqual(run());
  });

  it('the verdict union is exhaustively covered by the run', () => {
    const { findings } = run();
    const seen = new Set<Verdict>(findings.map((f) => f.verdict));
    expect(seen).toEqual(new Set<Verdict>(['VALID', 'QUESTIONABLE', 'INSUFFICIENT_EVIDENCE']));
  });
});
