// Task 1.2 done-check: a CRG rule exists for each ReportedStatus.

import { describe, it, expect } from 'vitest';
import { crgRules, ruleForStatus, ALL_REPORTED_STATUSES } from './crgRules';

describe('crgRules: one rule per ReportedStatus', () => {
  it('has exactly one rule for every reported status', () => {
    for (const status of ALL_REPORTED_STATUSES) {
      const matches = crgRules.filter((r) => r.appliesToStatus === status);
      expect(matches, `expected exactly one rule for ${status}`).toHaveLength(1);
    }
  });

  it('covers no statuses beyond the four in SPEC §5', () => {
    expect(crgRules).toHaveLength(ALL_REPORTED_STATUSES.length);
    for (const rule of crgRules) {
      expect(ALL_REPORTED_STATUSES).toContain(rule.appliesToStatus);
    }
  });

  it('gives every rule a unique id, required evidence, and a description', () => {
    const ids = new Set<string>();
    for (const rule of crgRules) {
      expect(rule.id).toMatch(/^CRG-/);
      expect(ids.has(rule.id), `duplicate rule id ${rule.id}`).toBe(false);
      ids.add(rule.id);
      expect(rule.requiredEvidence.length).toBeGreaterThan(0);
      expect(rule.description.trim().length).toBeGreaterThan(0);
    }
  });

  it('ruleForStatus resolves the governing rule', () => {
    expect(ruleForStatus('OPEN_ACTIVE')?.id).toBe('CRG-OPEN-ACTIVE-01');
    expect(ruleForStatus('CLOSED')?.id).toBe('CRG-CLOSED-01');
  });
});
