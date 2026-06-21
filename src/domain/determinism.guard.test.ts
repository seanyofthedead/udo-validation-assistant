// Determinism guard — enforces SPEC.md §10 / CLAUDE.md "Determinism".
//
// The engine must be a pure function of its inputs. A wall-clock read
// (`Date.now()`, `new Date(`) or `Math.random()` inside src/domain would make
// results depend on when the code runs, breaking reproducible tests and the
// agent loop's ability to terminate. This test scans every NON-TEST source file
// under src/domain and fails if any forbidden token appears.
//
// Test files are excluded (this file itself names the forbidden tokens).

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const DOMAIN_DIR = join(process.cwd(), 'src', 'domain');

// Tokens that introduce non-determinism into engine logic.
const FORBIDDEN = ['Math.random', 'Date.now', 'new Date('];

function isTestFile(name: string): boolean {
  return name.includes('.test.') || name.includes('.spec.');
}

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectSourceFiles(full));
      continue;
    }
    const isSource = entry.endsWith('.ts') || entry.endsWith('.tsx');
    if (isSource && !isTestFile(entry)) out.push(full);
  }
  return out;
}

describe('determinism guard: src/domain stays pure', () => {
  const files = collectSourceFiles(DOMAIN_DIR);

  it('finds engine source files to scan', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s has no wall-clock or random calls', (file) => {
    const contents = readFileSync(file, 'utf8');
    for (const token of FORBIDDEN) {
      expect(contents.includes(token), `${token} found in ${file}`).toBe(false);
    }
  });
});
