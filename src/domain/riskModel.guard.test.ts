// Task 5.10 — single-source guard (scoring-model doc §6): no scoring number is
// hard-coded outside RISK_MODEL. The risk scorer (riskEngine.ts) must read every
// weight, threshold, point value, and band cutoff from RISK_MODEL — never inline
// a literal like `score >= 75` or `drawdown < 0.25`.
//
// Mechanism: strip comments and string/template literals from riskEngine.ts, then
// extract the remaining numeric literals (those that are NOT part of an
// identifier such as `r2` or `t1Days`). Every survivor must be a structural
// constant on the allowlist below — anything else is a smuggled scoring number
// and fails the guard. This is robust to reweighting: changing a value in
// RISK_MODEL never touches riskEngine.ts, so this test keeps passing.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const ENGINE = join(process.cwd(), 'src', 'domain', 'riskEngine.ts');

// Structural constants legitimately present in the scorer — none are scoring
// weights/thresholds/cutoffs (those live only in RISK_MODEL):
//   0   — reduce() seed, "not expired" (<= 0) comparison, point defaults
//   1   — Date.UTC month offset (m - 1) and the (1 - confidence) inversion
//   100 — percentage formatting (ratio * 100)
//   86400000 — milliseconds per day (DAY_MS)
const ALLOWED = new Set(['0', '1', '100', '86400000']);

/** Remove comments and string/template literals so only code numbers remain. */
function stripCommentsAndStrings(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ') // block comments
    .replace(/\/\/[^\n]*/g, ' ') // line comments
    .replace(/`(?:[^`\\]|\\.)*`/g, ' ') // template literals
    .replace(/'(?:[^'\\]|\\.)*'/g, ' ') // single-quoted strings
    .replace(/"(?:[^"\\]|\\.)*"/g, ' '); // double-quoted strings
}

/** Numeric literals not embedded in an identifier (so `r2`, `t1Days` are skipped). */
function numericLiterals(code: string): string[] {
  const matches = code.match(/(?<![\w.])\d[\d_]*(?:\.\d+)?/g) ?? [];
  return matches.map((m) => m.replace(/_/g, ''));
}

describe('no scoring number is hard-coded outside RISK_MODEL (task 5.10)', () => {
  const source = readFileSync(ENGINE, 'utf8');

  it('riskEngine.ts reads its values from RISK_MODEL', () => {
    expect(source).toMatch(/import\s*\{\s*RISK_MODEL\s*\}/);
    expect(source).toContain('RISK_MODEL.');
  });

  it('contains no numeric literal beyond the allowed structural constants', () => {
    const offenders = numericLiterals(stripCommentsAndStrings(source)).filter(
      (n) => !ALLOWED.has(n),
    );
    expect(offenders, `unexpected hard-coded number(s): ${offenders.join(', ')}`).toEqual([]);
  });

  it('the allowlist excludes every actual RISK_MODEL value (so none could hide in it)', () => {
    // Defense-in-depth: if a future edit widened ALLOWED to cover a real scoring
    // value, that value could be hard-coded undetected. Assert no RISK_MODEL
    // number (other than the genuine structural 0/1/100) is on the allowlist.
    const collect = (obj: unknown, out: number[] = []): number[] => {
      if (typeof obj === 'number') out.push(obj);
      else if (obj && typeof obj === 'object') for (const v of Object.values(obj)) collect(v, out);
      return out;
    };
    // Imported lazily to avoid a hard dependency in the strip logic above.

    return import('./riskModel').then(({ RISK_MODEL }) => {
      const modelValues = new Set(collect(RISK_MODEL).map(String));
      const structural = new Set(['0', '1', '100']); // also legitimately in the model
      for (const allowed of ALLOWED) {
        if (structural.has(allowed)) continue;
        expect(
          modelValues.has(allowed),
          `allowlist value ${allowed} collides with RISK_MODEL`,
        ).toBe(false);
      }
    });
  });
});
