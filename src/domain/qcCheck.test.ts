// Task 1.5 — QC agent fail-safe. A contrived disagreement must force abstain and
// lower confidence; legitimate findings must pass through with qcAgreed = true.

import { describe, it, expect } from 'vitest';
import { qcCheck, validateStatus } from './engine';
import { crgRules } from '../data/crgRules';
import type { EvidenceItem, EvidenceType, UdoRecord, ValidationFinding } from './types';

const ASOF = '2026-06-21';

function makeUdo(over: Partial<UdoRecord> = {}): UdoRecord {
  return {
    id: 'UDO-X',
    component: 'USCG',
    obligationNumber: 'OBL-X',
    vendor: 'Vendor X',
    description: 'Test obligation',
    fundingType: 'O&M',
    amountObligated: 100_000,
    amountDisbursed: 50_000,
    reportedStatus: 'OPEN_ACTIVE',
    obligationDate: '2024-01-01',
    lastActivityDate: '2026-05-01',
    periodOfPerformanceEnd: '2026-12-31',
    ...over,
  };
}

function ev(type: EvidenceType, amount?: number): EvidenceItem {
  return amount === undefined
    ? { udoId: 'UDO-X', type, present: true }
    : { udoId: 'UDO-X', type, present: true, amount };
}

const validFinding: ValidationFinding = {
  udoId: 'UDO-X',
  verdict: 'VALID',
  confidence: 1.0,
  justification: 'Reported OPEN_ACTIVE is consistent.',
  citedRuleId: 'CRG-OPEN-ACTIVE-01',
  qcAgreed: true,
};

describe('qcCheck: agrees with legitimate findings', () => {
  it('leaves a genuinely VALID finding untouched (qcAgreed true)', () => {
    const udo = makeUdo();
    const evidence = [ev('PO'), ev('INVOICE', 50_000), ev('GL')];
    const out = qcCheck(validFinding, udo, evidence);
    expect(out.qcAgreed).toBe(true);
    expect(out.verdict).toBe('VALID');
    expect(out.confidence).toBe(1.0);
  });

  it('does not overturn a QUESTIONABLE finding', () => {
    const questionable: ValidationFinding = { ...validFinding, verdict: 'QUESTIONABLE' };
    // Even with thin evidence, the checker leaves a cautious verdict alone.
    const out = qcCheck(questionable, makeUdo(), [ev('PO')]);
    expect(out.qcAgreed).toBe(true);
    expect(out.verdict).toBe('QUESTIONABLE');
  });

  it('agrees with every finding produced over the seed-style happy path', () => {
    const udo = makeUdo();
    const evidence = [ev('PO'), ev('INVOICE', 50_000), ev('GL')];
    const finding = validateStatus(udo, evidence, crgRules, ASOF);
    const out = qcCheck(finding, udo, evidence);
    expect(out.qcAgreed).toBe(true);
    expect(out.verdict).toBe(finding.verdict);
  });
});

describe('qcCheck: fail-safe on disagreement', () => {
  it('forces abstain + lowers confidence when a VALID call rests on thin evidence', () => {
    // Contrived: a VALID finding, but the checker sees only one evidence item.
    const out = qcCheck(validFinding, makeUdo(), [ev('PO')]);
    expect(out.qcAgreed).toBe(false);
    expect(out.verdict).toBe('INSUFFICIENT_EVIDENCE');
    expect(out.confidence).toBeLessThan(validFinding.confidence);
    expect(out.confidence).toBe(0.5); // 1.0 * 0.5
    expect(out.citedRuleId).toBeNull();
    expect(out.justification).toMatch(/QC disagreed/);
  });

  it('forces abstain when a VALID call contradicts the financials (invoice mismatch)', () => {
    // disbursed 50k but invoice evidence totals 10k.
    const out = qcCheck(validFinding, makeUdo(), [ev('PO'), ev('INVOICE', 10_000), ev('GL')]);
    expect(out.qcAgreed).toBe(false);
    expect(out.verdict).toBe('INSUFFICIENT_EVIDENCE');
    expect(out.justification).toMatch(/reconcile/);
  });

  it('forces abstain when a VALID open line is actually fully drawn', () => {
    const udo = makeUdo({ amountDisbursed: 100_000 }); // drawdown 1.0
    const out = qcCheck(validFinding, udo, [ev('PO'), ev('INVOICE', 100_000), ev('GL')]);
    expect(out.qcAgreed).toBe(false);
    expect(out.verdict).toBe('INSUFFICIENT_EVIDENCE');
    expect(out.confidence).toBeLessThan(1.0);
  });
});
