// Task 1.4 — validateStatus() per SPEC §6. Covers VALID, each QUESTIONABLE
// trigger, both abstain paths, and the confidence formula with hand-computed
// expected values. Fixtures are minimal and inline so each branch is isolated.

import { describe, it, expect } from 'vitest';
import { validateStatus } from './engine';
import { crgRules } from '../data/crgRules';
import type { EvidenceItem, EvidenceType, ReportedStatus, UdoRecord } from './types';

const ASOF = '2026-06-21'; // asOf-90 = 2026-03-23, asOf-180 = 2025-12-23

function makeUdo(over: Partial<UdoRecord> = {}): UdoRecord {
  return {
    id: 'UDO-X',
    component: 'USCG',
    obligationNumber: 'OBL-X',
    vendor: 'Vendor X',
    description: 'Test obligation',
    fundingType: 'O&M',
    amountObligated: 100_000,
    amountDisbursed: 50_000, // drawdown 0.50
    reportedStatus: 'OPEN_ACTIVE',
    obligationDate: '2024-01-01',
    lastActivityDate: '2026-05-01', // recent
    periodOfPerformanceEnd: '2026-12-31', // not expired
    ...over,
  };
}

function ev(type: EvidenceType, amount?: number): EvidenceItem {
  return amount === undefined
    ? { udoId: 'UDO-X', type, present: true }
    : { udoId: 'UDO-X', type, present: true, amount };
}

function run(udo: UdoRecord, evidence: EvidenceItem[]) {
  return validateStatus(udo, evidence, crgRules, ASOF);
}

describe('validateStatus: VALID', () => {
  it('clean OPEN_ACTIVE line with full evidence -> VALID, confidence 1.0', () => {
    const f = run(makeUdo(), [ev('PO'), ev('INVOICE', 50_000), ev('GL')]);
    expect(f.verdict).toBe('VALID');
    expect(f.confidence).toBe(1.0);
    expect(f.citedRuleId).toBe('CRG-OPEN-ACTIVE-01');
    expect(f.qcAgreed).toBe(true);
  });
});

describe('validateStatus: QUESTIONABLE triggers (each in isolation)', () => {
  it('(a) OPEN_ACTIVE expired >90d and inactive >180d', () => {
    const udo = makeUdo({
      periodOfPerformanceEnd: '2025-09-30', // expired > 90d
      lastActivityDate: '2025-06-15', // inactive > 180d
    });
    const f = run(udo, [ev('PO'), ev('INVOICE', 50_000), ev('GL')]);
    expect(f.verdict).toBe('QUESTIONABLE');
    expect(f.citedRuleId).toBe('CRG-OPEN-ACTIVE-01');
    expect(f.justification).toMatch(/period of performance/i);
    expect(f.confidence).toBe(1.0); // metrics far from cutoffs -> no borderline penalty
  });

  it('(b) OPEN_ACTIVE but drawdown >= 0.98 (and lands a borderline penalty)', () => {
    const udo = makeUdo({ amountDisbursed: 99_000 }); // drawdown 0.99
    const f = run(udo, [ev('PO'), ev('INVOICE', 99_000), ev('GL')]);
    expect(f.verdict).toBe('QUESTIONABLE');
    expect(f.justification).toMatch(/fully disbursed/i);
    // |0.99 - 0.98| = 0.01 <= 0.02 -> 1 borderline metric -> 1.0 - 0.1 = 0.9
    expect(f.confidence).toBe(0.9);
  });

  it('(b) also fires for OPEN_INACTIVE fully drawn', () => {
    const udo = makeUdo({ reportedStatus: 'OPEN_INACTIVE', amountDisbursed: 100_000 });
    // OPEN_INACTIVE requires PO + GL.
    const f = run(udo, [ev('PO'), ev('GL'), ev('INVOICE', 100_000)]);
    expect(f.verdict).toBe('QUESTIONABLE');
    expect(f.citedRuleId).toBe('CRG-OPEN-INACTIVE-01');
  });

  it('(c) PENDING_CLOSE but drawdown < 0.50', () => {
    const udo = makeUdo({
      reportedStatus: 'PENDING_CLOSE',
      amountDisbursed: 25_000, // drawdown 0.25
      periodOfPerformanceEnd: '2026-05-01',
    });
    const f = run(udo, [ev('PO'), ev('INVOICE', 25_000), ev('RECEIPT')]);
    expect(f.verdict).toBe('QUESTIONABLE');
    expect(f.citedRuleId).toBe('CRG-PENDING-CLOSE-01');
    expect(f.justification).toMatch(/undisbursed/i);
    expect(f.confidence).toBe(1.0); // 0.25 is far from the 0.50 cutoff
  });

  it('(d) invoice evidence does not reconcile to disbursed', () => {
    const udo = makeUdo({ amountDisbursed: 50_000 });
    const f = run(udo, [ev('PO'), ev('INVOICE', 10_000), ev('GL')]); // 10k != 50k
    expect(f.verdict).toBe('QUESTIONABLE');
    expect(f.justification).toMatch(/do not reconcile/i);
    expect(f.confidence).toBe(1.0);
  });
});

describe('validateStatus: abstain (INSUFFICIENT_EVIDENCE)', () => {
  it('required evidence missing -> abstain, citedRuleId null, confidence 0.8', () => {
    // OPEN_ACTIVE requires PO + INVOICE; provide PO + GL (2 items, but INVOICE absent).
    const f = run(makeUdo(), [ev('PO'), ev('GL')]);
    expect(f.verdict).toBe('INSUFFICIENT_EVIDENCE');
    expect(f.citedRuleId).toBeNull();
    expect(f.justification).toMatch(/Required evidence missing: INVOICE/);
    // 1 missing required (-0.2), 2 present (no sparse penalty) -> 0.8
    expect(f.confidence).toBe(0.8);
  });

  it('fewer than 2 items present -> abstain, confidence 0.6', () => {
    const f = run(makeUdo(), [ev('PO')]); // only 1 item; INVOICE also missing
    expect(f.verdict).toBe('INSUFFICIENT_EVIDENCE');
    expect(f.justification).toMatch(/at least 2 required/i);
    // 1 missing required (-0.2) + 1 short of 2 items (-0.2) -> 0.6
    expect(f.confidence).toBe(0.6);
  });

  it('present:false evidence does not count toward the required set', () => {
    const evidence: EvidenceItem[] = [
      ev('PO'),
      { udoId: 'UDO-X', type: 'INVOICE', present: false },
    ];
    const f = run(makeUdo(), evidence);
    expect(f.verdict).toBe('INSUFFICIENT_EVIDENCE');
  });
});

describe('validateStatus: confidence borderline penalty on a VALID line', () => {
  it('drawdown just under the fully-drawn cutoff is borderline -> 0.9', () => {
    const udo = makeUdo({ amountDisbursed: 97_000 }); // drawdown 0.97, no contradiction
    const f = run(udo, [ev('PO'), ev('INVOICE', 97_000), ev('GL')]);
    expect(f.verdict).toBe('VALID');
    // |0.97 - 0.98| = 0.01 <= 0.02 -> borderline -> 1.0 - 0.1 = 0.9
    expect(f.confidence).toBe(0.9);
  });
});

describe('validateStatus: determinism', () => {
  it('same inputs produce identical findings', () => {
    const udo = makeUdo();
    const evidence = [ev('PO'), ev('INVOICE', 50_000), ev('GL')];
    expect(run(udo, evidence)).toEqual(run(udo, evidence));
  });

  it('abstains when no rule governs the reported status', () => {
    const f = validateStatus(
      makeUdo({ reportedStatus: 'OPEN_ACTIVE' }),
      [ev('PO'), ev('INVOICE', 50_000), ev('GL')],
      crgRules.filter((r) => r.appliesToStatus !== ('OPEN_ACTIVE' as ReportedStatus)),
      ASOF,
    );
    expect(f.verdict).toBe('INSUFFICIENT_EVIDENCE');
    expect(f.citedRuleId).toBeNull();
    expect(f.justification).toMatch(/No CRG rule governs/);
  });
});
