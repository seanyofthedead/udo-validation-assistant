// Shared RTL helper: render a screen wrapped in the real app providers
// (AppProvider runs validation once; NavProvider supplies navigation). Defaults
// to the seed fixture; pass `init` to exercise tailored/edge populations.

import type { ReactElement } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { AppProvider } from '../state';
import { NavProvider } from '../screens/navigation';
import type { ScreenId } from '../screens/registry';
import type { InitInputs } from '../state/store';
import { crgRules, seedPopulation, seedEvidence, priorYearStats, AS_OF_DATE } from '../data';

const SEED_INIT: InitInputs = {
  population: seedPopulation,
  evidence: seedEvidence,
  rules: crgRules,
  priorStats: priorYearStats,
  asOfDate: AS_OF_DATE,
};

export function renderWithProviders(
  ui: ReactElement,
  opts: {
    initialScreen?: ScreenId;
    initialUdoId?: string | null;
    initialCampaignId?: string | null;
    init?: InitInputs;
  } & Omit<RenderOptions, 'wrapper'> = {},
) {
  const { initialScreen, initialUdoId, initialCampaignId, init = SEED_INIT, ...renderOpts } = opts;
  return render(
    <AppProvider init={init}>
      <NavProvider
        initialScreen={initialScreen}
        initialUdoId={initialUdoId}
        initialCampaignId={initialCampaignId}
      >
        {ui}
      </NavProvider>
    </AppProvider>,
    renderOpts,
  );
}
