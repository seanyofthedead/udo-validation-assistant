import { describe, expect, it } from 'vitest';

import { runValidation } from './engine';
import { scorePopulation } from './riskEngine';
import { crgRules } from '../data/crgRules';
import { AS_OF_DATE, priorYearStats, seedEvidence, seedPopulation } from '../data/seed';

/** Score the seed population end-to-end through the real validation pipeline. */
function scoreSeed() {
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

describe('scorePopulation — ranked scores + audit', () => {
  it('returns one score per UDO', () => {
    const { scores } = scoreSeed();
    expect(scores).toHaveLength(seedPopulation.length);
    expect(new Set(scores.map((s) => s.udoId)).size).toBe(seedPopulation.length);
  });

  it('sorts by score descending (deterministic tie-break on udoId)', () => {
    const { scores } = scoreSeed();
    for (let i = 1; i < scores.length; i++) {
      const prev = scores[i - 1];
      const cur = scores[i];
      expect(prev.score).toBeGreaterThanOrEqual(cur.score);
      if (prev.score === cur.score) {
        expect(prev.udoId.localeCompare(cur.udoId)).toBeLessThan(0);
      }
    }
  });

  it('emits exactly one immutable RISK_SCORE audit event per run', () => {
    const { scores, audit } = scoreSeed();
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actor: 'AI', action: 'RISK_SCORE' });
    // The summary reflects the run: total count and the band tally.
    expect(audit[0].detail).toContain(`Scored ${scores.length} UDO(s)`);
    expect(audit[0].timestamp).toBe(`${AS_OF_DATE}T00:00:00.000Z`);
  });

  it('every score sums its factor points (attribution holds across the population)', () => {
    const { scores } = scoreSeed();
    for (const s of scores) {
      expect(s.score).toBe(s.factors.reduce((sum, f) => sum + f.points, 0));
    }
  });

  it('is deterministic across repeated runs', () => {
    expect(scoreSeed()).toEqual(scoreSeed());
  });
});
