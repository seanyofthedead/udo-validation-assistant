// Task 1.3 done-check: snapshot pins the fixture's structure and verdict mix.
//
// The engine lands in 1.4, so this test pins the *design* (SEED_DESIGN) — the
// intended per-record verdict/de-ob output the fixture is engineered to produce
// — and proves that design satisfies the SPEC §8 distribution. The 1.8
// integration test later re-derives verdicts with the real engine and asserts
// they match SEED_DESIGN, closing the loop between fixture and engine.

import { describe, it, expect } from 'vitest';
import type { Component, ReportedStatus, Verdict } from '../domain/types';
import { seedPopulation, seedEvidence, priorYearStats, SEED_DESIGN, AS_OF_DATE } from './seed';

function countBy<T extends string>(values: T[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of values) out[v] = (out[v] ?? 0) + 1;
  return out;
}

describe('seed population: structure', () => {
  it('has ~20 records across >=3 components', () => {
    expect(seedPopulation.length).toBe(20);
    const components = new Set(seedPopulation.map((u) => u.component));
    expect(components.size).toBeGreaterThanOrEqual(3);
  });

  it('uses a fixed as-of date (determinism)', () => {
    expect(AS_OF_DATE).toBe('2026-06-21');
  });

  it('gives every record a unique id', () => {
    const ids = new Set(seedPopulation.map((u) => u.id));
    expect(ids.size).toBe(seedPopulation.length);
  });

  it('every record has a design entry, and every design id is a real record', () => {
    const ids = new Set(seedPopulation.map((u) => u.id));
    for (const id of ids) expect(SEED_DESIGN[id], `missing design for ${id}`).toBeDefined();
    expect(Object.keys(SEED_DESIGN).length).toBe(seedPopulation.length);
  });

  it('every evidence row references a real record', () => {
    const ids = new Set(seedPopulation.map((u) => u.id));
    for (const e of seedEvidence)
      expect(ids.has(e.udoId), `dangling evidence ${e.udoId}`).toBe(true);
  });

  it('carries a prior-year stat per component, engineered for a FEMA population shift', () => {
    const components = new Set(seedPopulation.map((u) => u.component));
    for (const c of components) {
      expect(
        priorYearStats.find((s) => s.component === c),
        `missing prior stat for ${c}`,
      ).toBeDefined();
    }
    // FEMA: prior 10 lines vs current 4 -> 60% drop, trips the >=50% shift flag (1.7).
    const femaPrior = priorYearStats.find((s) => s.component === 'FEMA')!;
    const femaCurrent = seedPopulation.filter((u) => u.component === 'FEMA').length;
    const shift = Math.abs(femaCurrent - femaPrior.lineCount) / femaPrior.lineCount;
    expect(shift).toBeGreaterThanOrEqual(0.5);
  });

  it('pins the structural shape (component / status / totals)', () => {
    const byComponent = countBy(seedPopulation.map((u) => u.component as Component));
    const byStatus = countBy(seedPopulation.map((u) => u.reportedStatus as ReportedStatus));
    const totalObligated = seedPopulation.reduce((s, u) => s + u.amountObligated, 0);
    const totalDisbursed = seedPopulation.reduce((s, u) => s + u.amountDisbursed, 0);

    expect({
      byComponent,
      byStatus,
      totalObligated,
      totalDisbursed,
      evidenceRows: seedEvidence.length,
    }).toMatchInlineSnapshot(`
        {
          "byComponent": {
            "CBP": 4,
            "CISA": 3,
            "FEMA": 4,
            "TSA": 4,
            "USCG": 5,
          },
          "byStatus": {
            "CLOSED": 2,
            "OPEN_ACTIVE": 10,
            "OPEN_INACTIVE": 6,
            "PENDING_CLOSE": 2,
          },
          "evidenceRows": 59,
          "totalDisbursed": 4065000,
          "totalObligated": 13150000,
        }
      `);
  });
});

describe('seed design: satisfies the SPEC §8 verdict mix', () => {
  const verdicts = Object.values(SEED_DESIGN).map((d) => d.verdict as Verdict);
  const byVerdict = countBy(verdicts);

  it('pins the verdict-mix counts', () => {
    expect(byVerdict).toMatchInlineSnapshot(`
      {
        "INSUFFICIENT_EVIDENCE": 1,
        "QUESTIONABLE": 4,
        "VALID": 15,
      }
    `);
  });

  it('has several VALID lines', () => {
    expect(byVerdict.VALID).toBeGreaterThanOrEqual(5);
  });

  it('has >=3 QUESTIONABLE lines, each tripping a DIFFERENT contradiction', () => {
    const questionable = Object.values(SEED_DESIGN).filter((d) => d.verdict === 'QUESTIONABLE');
    expect(questionable.length).toBeGreaterThanOrEqual(3);
    const triggers = new Set(questionable.map((d) => d.trigger));
    expect(triggers.size).toBe(questionable.length); // all distinct
    expect(questionable.every((d) => d.trigger !== undefined)).toBe(true);
  });

  it('has exactly ONE INSUFFICIENT_EVIDENCE (abstain) line', () => {
    expect(byVerdict.INSUFFICIENT_EVIDENCE).toBe(1);
  });

  it('has >=3 de-obligation candidates, each with non-zero recoverable $', () => {
    const candidates = Object.values(SEED_DESIGN).filter((d) => d.deobCandidate);
    expect(candidates.length).toBeGreaterThanOrEqual(3);
    for (const c of candidates) expect(c.estimatedRecoverable).toBeGreaterThan(0);
  });

  it('pins the total de-obligation $ across the shortlist', () => {
    const total = Object.values(SEED_DESIGN).reduce((s, d) => s + d.estimatedRecoverable, 0);
    expect(total).toBe(540_000 + 900_000 + 630_000 + 4_800_000);
  });
});
