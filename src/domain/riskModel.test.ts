import { describe, expect, it } from 'vitest';

import { RISK_MODEL } from './riskModel';

describe('RISK_MODEL (single source of truth for Wave 5 scoring)', () => {
  it('has eight factor weights that sum to 100', () => {
    const weights = Object.values(RISK_MODEL.weights);
    expect(weights).toHaveLength(8);
    expect(weights.reduce((sum, w) => sum + w, 0)).toBe(100);
  });

  it('caps the evidence factor (R7) at its weight', () => {
    // R7 is the one factor whose per-item accrual is separate from its max;
    // the cap must never exceed the factor's weight or the total can drift > 100.
    expect(RISK_MODEL.r7.cap).toBe(RISK_MODEL.weights.evidence);
  });

  it('orders the band cutoffs CRITICAL > HIGH > MEDIUM > LOW', () => {
    const { critical, high, medium, low } = RISK_MODEL.bands;
    expect(critical).toBeGreaterThan(high);
    expect(high).toBeGreaterThan(medium);
    expect(medium).toBeGreaterThan(low);
    expect(low).toBe(0);
  });
});
