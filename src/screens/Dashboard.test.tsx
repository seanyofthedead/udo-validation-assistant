// @vitest-environment jsdom
// Task 3.6 — Executive Dashboard: the three headline numbers match engine output.

import '../test/setup';
import { describe, it, expect, afterEach } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import { renderWithProviders } from '../test/renderWithProviders';
import { Dashboard } from './Dashboard';
import { runValidation } from '../domain/engine';
import { crgRules } from '../data/crgRules';
import { seedPopulation, seedEvidence, priorYearStats, AS_OF_DATE } from '../data/seed';

afterEach(cleanup);

// Independent recomputation straight from the engine to compare against the UI.
function expected() {
  const run = runValidation(seedPopulation, seedEvidence, crgRules, priorYearStats, AS_OF_DATE);
  const total = run.findings.length;
  const abstained = run.findings.filter((f) => f.verdict === 'INSUFFICIENT_EVIDENCE').length;
  const exceptions = run.findings.filter((f) => f.verdict !== 'VALID').length;
  const deobTotal = run.deobFlags
    .filter((d) => d.candidate)
    .reduce((s, d) => s + d.estimatedRecoverable, 0);
  return {
    coverage: `${Math.round(((total - abstained) / total) * 100)}%`,
    exceptions: String(exceptions),
    deobTotal,
  };
}

describe('Dashboard metrics', () => {
  it('shows coverage, exception count, and de-ob total matching the engine', () => {
    const e = expected();
    renderWithProviders(<Dashboard />);

    expect(screen.getByTestId('coverage')).toHaveTextContent(e.coverage); // 95%
    expect(screen.getByTestId('exception-count')).toHaveTextContent(e.exceptions); // 5
    // $6,870,000 — formatted with separators
    expect(screen.getByTestId('deob-total')).toHaveTextContent(e.deobTotal.toLocaleString('en-US'));
  });

  it('pins the concrete seed numbers', () => {
    renderWithProviders(<Dashboard />);
    expect(screen.getByTestId('coverage')).toHaveTextContent('95%');
    expect(screen.getByTestId('exception-count')).toHaveTextContent('5');
    expect(screen.getByTestId('deob-total')).toHaveTextContent('6,870,000');
  });
});
