// Task 6.4 — assignment generation. Asserts the mechanism: every selected line
// lands in exactly one assignment under its owning component; components with no
// selected lines get no assignment; due dates resolve per-component with a
// default fallback; the partition is exhaustive and disjoint.

import { describe, it, expect } from 'vitest';
import { generateAssignments } from './assignment';
import { selectTopNByRisk } from './population';
import { scorePopulation } from './riskEngine';
import { runValidation } from './engine';
import { crgRules } from '../data/crgRules';
import { seedPopulation, seedEvidence, priorYearStats, AS_OF_DATE } from '../data/seed';
import type { Component } from './types';

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

const CAMPAIGN_ID = 'CMP-TEST-01';
const DEFAULT_DUE = '2026-07-31';

describe('generateAssignments', () => {
  it('partitions the selection into one assignment per owning component, exhaustively and disjointly', () => {
    const scores = rankedScores();
    const selected = selectTopNByRisk(scores, scores.length); // whole population
    const componentById = new Map(seedPopulation.map((u) => [u.id, u.component]));

    const assignments = generateAssignments(
      CAMPAIGN_ID,
      selected,
      seedPopulation,
      {},
      DEFAULT_DUE,
    );

    // Disjoint + exhaustive: the union of all assignment udoIds equals selection.
    const allAssigned = assignments.flatMap((a) => a.udoIds);
    expect(allAssigned.slice().sort()).toEqual(selected.slice().sort());
    expect(new Set(allAssigned).size).toBe(allAssigned.length); // no id in two assignments

    // Every line sits under its true owning component.
    for (const a of assignments) {
      for (const id of a.udoIds) expect(componentById.get(id)).toBe(a.component);
      expect(a.campaignId).toBe(CAMPAIGN_ID);
      expect(a.state).toBe('NOT_STARTED');
      expect(a.id).toBe(`${CAMPAIGN_ID}-${a.component}`);
    }
  });

  it('emits no assignment for a component with no selected lines', () => {
    const scores = rankedScores();
    const uscgOnly = scores.filter((s) => s.udoId.startsWith('UDO-USCG-')).map((s) => s.udoId);
    const assignments = generateAssignments(
      CAMPAIGN_ID,
      uscgOnly,
      seedPopulation,
      {},
      DEFAULT_DUE,
    );
    expect(assignments).toHaveLength(1);
    expect(assignments[0].component).toBe('USCG');
  });

  it('resolves due dates per component with a default fallback', () => {
    const scores = rankedScores();
    const selected = selectTopNByRisk(scores, scores.length);
    const perComponent: Partial<Record<Component, string>> = { USCG: '2026-07-15' };
    const assignments = generateAssignments(
      CAMPAIGN_ID,
      selected,
      seedPopulation,
      perComponent,
      DEFAULT_DUE,
    );
    for (const a of assignments) {
      expect(a.dueDate).toBe(a.component === 'USCG' ? '2026-07-15' : DEFAULT_DUE);
    }
  });

  it('preserves risk order within each assignment slice', () => {
    const scores = rankedScores();
    const selected = selectTopNByRisk(scores, scores.length);
    const rank = new Map(selected.map((id, i) => [id, i]));
    const assignments = generateAssignments(
      CAMPAIGN_ID,
      selected,
      seedPopulation,
      {},
      DEFAULT_DUE,
    );
    for (const a of assignments) {
      for (let i = 1; i < a.udoIds.length; i++) {
        expect(rank.get(a.udoIds[i - 1])!).toBeLessThan(rank.get(a.udoIds[i])!);
      }
    }
  });

  it('skips unknown ids not present in the population', () => {
    const scores = rankedScores();
    const selected = [scores[0].udoId, 'UDO-DOES-NOT-EXIST'];
    const assignments = generateAssignments(
      CAMPAIGN_ID,
      selected,
      seedPopulation,
      {},
      DEFAULT_DUE,
    );
    const allAssigned = assignments.flatMap((a) => a.udoIds);
    expect(allAssigned).toEqual([scores[0].udoId]);
  });

  it('is deterministic and orders assignments canonically by component', () => {
    const scores = rankedScores();
    const selected = selectTopNByRisk(scores, scores.length);
    const once = generateAssignments(CAMPAIGN_ID, selected, seedPopulation, {}, DEFAULT_DUE);
    const twice = generateAssignments(CAMPAIGN_ID, selected, seedPopulation, {}, DEFAULT_DUE);
    expect(once).toEqual(twice);
    const order: Component[] = ['USCG', 'TSA', 'FEMA', 'CBP', 'CISA'];
    const got = once.map((a) => a.component);
    const expected = order.filter((c) => got.includes(c));
    expect(got).toEqual(expected);
  });
});
