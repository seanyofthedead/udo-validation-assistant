// Task 6.3 — campaign population selectors. The headline guarantee (plan 6.3
// done-check): a "top N by risk" selection matches the High-Risk Queue's top N.
// The queue's default order IS scorePopulation's `riskScores` (score desc), so
// the test derives the expectation from that ranking rather than from literals,
// keeping it robust to reweighting.

import { describe, it, expect } from 'vitest';
import {
  selectTopNByRisk,
  selectManual,
  selectByFilter,
  selectPopulation,
} from './population';
import { scorePopulation } from './riskEngine';
import { runValidation } from './engine';
import { crgRules } from '../data/crgRules';
import { seedPopulation, seedEvidence, priorYearStats, AS_OF_DATE } from '../data/seed';

function rankedScores() {
  const run = runValidation(seedPopulation, seedEvidence, crgRules, priorYearStats, AS_OF_DATE);
  return scorePopulation(
    seedPopulation,
    run.findings,
    run.anomalies,
    seedEvidence,
    crgRules,
    AS_OF_DATE,
  ).scores;
}

describe('selectTopNByRisk (plan 6.3 done-check)', () => {
  it("matches the queue's top N — the head of the risk-ranked scores", () => {
    const scores = rankedScores();
    const n = 5;
    const expected = scores.slice(0, n).map((s) => s.udoId); // queue order = score desc
    expect(selectTopNByRisk(scores, n)).toEqual(expected);
  });

  it('selects strictly the highest-scoring lines (none outside the top N scores higher)', () => {
    const scores = rankedScores();
    const n = 8;
    const picked = new Set(selectTopNByRisk(scores, n));
    const minPickedScore = Math.min(
      ...scores.filter((s) => picked.has(s.udoId)).map((s) => s.score),
    );
    for (const s of scores) {
      if (!picked.has(s.udoId)) expect(s.score).toBeLessThanOrEqual(minPickedScore);
    }
  });

  it('clamps N: non-positive selects nothing, N ≥ size selects all', () => {
    const scores = rankedScores();
    expect(selectTopNByRisk(scores, 0)).toEqual([]);
    expect(selectTopNByRisk(scores, -3)).toEqual([]);
    expect(selectTopNByRisk(scores, scores.length + 10)).toHaveLength(scores.length);
  });
});

describe('selectManual', () => {
  it('keeps only existing ids, de-duplicates, and returns them in risk order', () => {
    const scores = rankedScores();
    const last = scores[scores.length - 1].udoId;
    const first = scores[0].udoId;
    // Request in reverse, with a dup and a bogus id.
    const picked = selectManual(scores, [last, first, last, 'UDO-DOES-NOT-EXIST']);
    expect(picked).toEqual([first, last]); // risk order, deduped, bogus dropped
  });
});

describe('selectByFilter', () => {
  it('selects only matching lines, in risk order', () => {
    const scores = rankedScores();
    const picked = selectByFilter(scores, seedPopulation, { component: 'USCG' });
    expect(picked.length).toBeGreaterThan(0);
    expect(picked.every((id) => id.startsWith('UDO-USCG-'))).toBe(true);
    // risk order preserved: scores are non-increasing across the selection
    const byId = new Map(scores.map((s) => [s.udoId, s.score]));
    for (let i = 1; i < picked.length; i++) {
      expect(byId.get(picked[i - 1])!).toBeGreaterThanOrEqual(byId.get(picked[i])!);
    }
  });

  it('combines fields conjunctively (component AND dollar floor)', () => {
    const scores = rankedScores();
    const floor = 1_000_000;
    const picked = selectByFilter(scores, seedPopulation, {
      component: 'USCG',
      minObligated: floor,
    });
    const udoById = new Map(seedPopulation.map((u) => [u.id, u]));
    for (const id of picked) {
      expect(udoById.get(id)!.component).toBe('USCG');
      expect(udoById.get(id)!.amountObligated).toBeGreaterThanOrEqual(floor);
    }
  });
});

describe('selectPopulation (one entry point per source kind)', () => {
  it('dispatches to the matching selector', () => {
    const scores = rankedScores();
    expect(selectPopulation({ kind: 'TOP_N', n: 3 }, scores, seedPopulation)).toEqual(
      selectTopNByRisk(scores, 3),
    );
    const ids = [scores[0].udoId];
    expect(selectPopulation({ kind: 'MANUAL', udoIds: ids }, scores, seedPopulation)).toEqual(
      selectManual(scores, ids),
    );
    expect(
      selectPopulation({ kind: 'SAVED_FILTER', filter: { band: 'CRITICAL' } }, scores, seedPopulation),
    ).toEqual(selectByFilter(scores, seedPopulation, { band: 'CRITICAL' }));
  });
});
