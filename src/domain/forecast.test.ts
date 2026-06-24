// Task 9.2 — the staleness forecast is deterministic and reproduces its
// documented method (docs/wave9-forecast-method.md) on the seed.
//
// The test does NOT hard-code a count (which would drift as the seed evolves):
// it re-derives the projected set INDEPENDENTLY by the documented rule — a
// non-CLOSED line that is `!isStale(asOfDate) && isStale(horizonEnd)` — and
// asserts the engine matches it exactly. It also pins determinism (two calls are
// identical), the pure horizon date math, and the DEPARTMENT = Σ components
// partition property.

import { describe, it, expect } from 'vitest';
import { buildHorizon, forecastStaleObligations, FORECAST_METHOD } from './forecast';
import { isStale } from './engine';
import type { Component } from './types';
import { seedPopulation, AS_OF_DATE } from '../data';

const COMPONENTS: Component[] = ['USCG', 'TSA', 'FEMA', 'CBP', 'CISA'];
const horizon = buildHorizon(AS_OF_DATE);

// Independent re-derivation of the documented rule over the seed.
const expectedNewlyStale = seedPopulation
  .filter((u) => u.reportedStatus !== 'CLOSED')
  .filter((u) => !isStale(u, AS_OF_DATE) && isStale(u, horizon.endDate))
  .map((u) => u.id);

describe('buildHorizon: pure calendar math (no clock)', () => {
  it('advances the as-of date by the horizon length', () => {
    // 2026-06-21 + 90 days = 2026-09-19 (June 30 is +9; +31 Jul; +31 Aug; +19).
    expect(buildHorizon('2026-06-21', 90).endDate).toBe('2026-09-19');
  });

  it('rolls across a year boundary correctly', () => {
    expect(buildHorizon('2026-12-01', 60).endDate).toBe('2027-01-30');
  });

  it('handles a leap-year February', () => {
    expect(buildHorizon('2024-02-28', 1).endDate).toBe('2024-02-29');
  });

  it('defaults to a 90-day "next quarter" horizon', () => {
    const h = buildHorizon('2026-06-21');
    expect(h.days).toBe(90);
    expect(h.label).toBe('next quarter');
    expect(h.endDate).toBe('2026-09-19');
  });
});

describe('forecastStaleObligations: reproduces the documented method on the seed', () => {
  it('projects exactly the independently-derived newly-stale set', () => {
    const f = forecastStaleObligations(seedPopulation, AS_OF_DATE, horizon);
    expect(f.drivers.map((d) => d.udoId)).toEqual(expectedNewlyStale);
    expect(f.projectedValue).toBe(expectedNewlyStale.length);
  });

  it('the seed yields a non-empty projection (the demo has a driver to show)', () => {
    expect(expectedNewlyStale.length).toBeGreaterThan(0);
  });

  it('excludes lines that are ALREADY stale today (projects only NEW staleness)', () => {
    const f = forecastStaleObligations(seedPopulation, AS_OF_DATE, horizon);
    for (const d of f.drivers) {
      const udo = seedPopulation.find((u) => u.id === d.udoId)!;
      expect(isStale(udo, AS_OF_DATE)).toBe(false);
    }
  });

  it('never projects a CLOSED obligation', () => {
    const f = forecastStaleObligations(seedPopulation, AS_OF_DATE, horizon);
    for (const d of f.drivers) {
      const udo = seedPopulation.find((u) => u.id === d.udoId)!;
      expect(udo.reportedStatus).not.toBe('CLOSED');
    }
  });

  it('each driver carries recoverable dollars and an explainable reason (lineage)', () => {
    const f = forecastStaleObligations(seedPopulation, AS_OF_DATE, horizon);
    for (const d of f.drivers) {
      const udo = seedPopulation.find((u) => u.id === d.udoId)!;
      expect(d.estimatedRecoverable).toBe(udo.amountObligated - udo.amountDisbursed);
      expect(d.reason).toContain(horizon.endDate);
    }
  });

  it('is labeled a projection with a documented method and a basis stating its inputs', () => {
    const f = forecastStaleObligations(seedPopulation, AS_OF_DATE, horizon);
    expect(f.metric).toBe('STALE_OBLIGATIONS');
    expect(f.method).toBe(FORECAST_METHOD);
    expect(f.basis).toContain(AS_OF_DATE);
    expect(f.basis).toContain(horizon.endDate);
  });

  it('is deterministic — two runs over the same inputs are identical', () => {
    const a = forecastStaleObligations(seedPopulation, AS_OF_DATE, horizon);
    const b = forecastStaleObligations(seedPopulation, AS_OF_DATE, horizon);
    expect(a).toEqual(b);
  });

  it('DEPARTMENT projection equals the sum of the per-component projections', () => {
    const dept = forecastStaleObligations(seedPopulation, AS_OF_DATE, horizon, 'DEPARTMENT');
    const summed = COMPONENTS.reduce(
      (n, c) => n + forecastStaleObligations(seedPopulation, AS_OF_DATE, horizon, c).projectedValue,
      0,
    );
    expect(summed).toBe(dept.projectedValue);
  });

  it('a per-component projection only contains that component’s lines', () => {
    for (const c of COMPONENTS) {
      const f = forecastStaleObligations(seedPopulation, AS_OF_DATE, horizon, c);
      for (const d of f.drivers) expect(d.component).toBe(c);
      expect(f.target).toBe(c);
    }
  });
});
