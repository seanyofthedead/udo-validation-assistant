// App root — composes the data providers around the screen shell.
// runValidation executes exactly once, inside AppProvider's reducer init.

import { AppProvider } from './state';
import { AppShell, NavProvider } from './screens';
import { crgRules, seedPopulation, seedEvidence, priorYearStats, AS_OF_DATE } from './data';

export default function App() {
  return (
    <AppProvider
      init={{
        population: seedPopulation,
        evidence: seedEvidence,
        rules: crgRules,
        priorStats: priorYearStats,
        asOfDate: AS_OF_DATE,
      }}
    >
      <NavProvider>
        <AppShell />
      </NavProvider>
    </AppProvider>
  );
}
