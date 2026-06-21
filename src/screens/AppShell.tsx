// App shell — SPEC §7 nav across the six screens. Renders the header, the nav
// (real <button>s, keyboard-navigable), and the active screen. State comes from
// AppProvider (validation already ran once on load); navigation from NavProvider.

import { useAppState } from '../state';
import { SCREENS, type ScreenId } from './registry';
import { useNavigation } from './navigation';
import { Dashboard } from './Dashboard';
import { Inventory } from './Inventory';
import { HighRiskQueue } from './HighRiskQueue';
import { Detail } from './Detail';
import { ReviewWorkspace } from './ReviewWorkspace';
import { Reporting } from './Reporting';

const SCREEN_COMPONENTS: Record<ScreenId, () => React.JSX.Element> = {
  dashboard: Dashboard,
  inventory: Inventory,
  'high-risk': HighRiskQueue,
  detail: Detail,
  review: ReviewWorkspace,
  reporting: Reporting,
};

export function AppShell() {
  const { screen, navigate } = useNavigation();
  const { asOfDate } = useAppState();
  const Active = SCREEN_COMPONENTS[screen];

  return (
    <div className="app">
      <header className="app-header">
        <h1>UDO Validation Assistant</h1>
        <p className="app-subtitle">
          Independent second opinion on undelivered orders · as of {asOfDate}
        </p>
        <nav className="app-nav" aria-label="Screens">
          {SCREENS.map((s) => (
            <button
              key={s.id}
              type="button"
              className="nav-button"
              aria-current={s.id === screen ? 'page' : undefined}
              onClick={() => navigate(s.id)}
            >
              {s.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="app-main">
        <Active />
      </main>
    </div>
  );
}
