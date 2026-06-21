// Shared RTL helper: render a screen wrapped in the real app providers
// (AppProvider runs the seed validation once; NavProvider supplies navigation).

import type { ReactElement } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { AppProvider } from '../state';
import { NavProvider } from '../screens/navigation';
import type { ScreenId } from '../screens/registry';
import { crgRules, seedPopulation, seedEvidence, priorYearStats, AS_OF_DATE } from '../data';

export function renderWithProviders(
  ui: ReactElement,
  opts: { initialScreen?: ScreenId; initialUdoId?: string | null } & Omit<
    RenderOptions,
    'wrapper'
  > = {},
) {
  const { initialScreen, initialUdoId, ...renderOpts } = opts;
  return render(
    <AppProvider
      init={{
        population: seedPopulation,
        evidence: seedEvidence,
        rules: crgRules,
        priorStats: priorYearStats,
        asOfDate: AS_OF_DATE,
      }}
    >
      <NavProvider initialScreen={initialScreen} initialUdoId={initialUdoId}>
        {ui}
      </NavProvider>
    </AppProvider>,
    renderOpts,
  );
}
