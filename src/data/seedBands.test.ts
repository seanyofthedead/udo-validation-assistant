// Task 5.6 — the scored seed population must span all four risk bands.
//
// Asserts the Wave 5 acceptance criteria (≥1 CRITICAL, ≥2 HIGH, a non-empty LOW
// band) and snapshot-pins the full band mix so a future seed/weight change that
// collapses the spread is caught. The counts come from the real validation +
// risk pipeline, so this also guards that scoreRisk + scorePopulation stay wired
// to the seed.

import { describe, expect, it } from 'vitest';

import { runValidation } from '../domain/engine';
import { scorePopulation } from '../domain/riskEngine';
import type { RiskBand } from '../domain/types';
import { crgRules } from './crgRules';
import { AS_OF_DATE, priorYearStats, seedEvidence, seedPopulation } from './seed';

function scoredSeed() {
  const run = runValidation(seedPopulation, seedEvidence, crgRules, priorYearStats, AS_OF_DATE);
  return scorePopulation(
    seedPopulation,
    run.findings,
    run.anomalies,
    seedEvidence,
    crgRules,
    AS_OF_DATE,
  );
}

function bandCounts(): Record<RiskBand, number> {
  const counts: Record<RiskBand, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const s of scoredSeed().scores) counts[s.band]++;
  return counts;
}

describe('seed risk band spread (Wave 5 acceptance)', () => {
  it('spans all four bands', () => {
    const counts = bandCounts();
    for (const band of ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as RiskBand[]) {
      expect(counts[band], `band ${band} should be non-empty`).toBeGreaterThan(0);
    }
  });

  it('meets the documented minimums: ≥1 CRITICAL, ≥2 HIGH, non-empty LOW', () => {
    const counts = bandCounts();
    expect(counts.CRITICAL).toBeGreaterThanOrEqual(1);
    expect(counts.HIGH).toBeGreaterThanOrEqual(2);
    expect(counts.LOW).toBeGreaterThan(0);
  });

  it('pins the band mix (snapshot)', () => {
    expect(bandCounts()).toMatchInlineSnapshot(`
      {
        "CRITICAL": 1,
        "HIGH": 2,
        "LOW": 10,
        "MEDIUM": 7,
      }
    `);
  });

  it('band counts sum to the population size', () => {
    const counts = bandCounts();
    const total = counts.CRITICAL + counts.HIGH + counts.MEDIUM + counts.LOW;
    expect(total).toBe(seedPopulation.length);
  });
});
