// App shell — SPEC §7 nav across the six screens. Renders the header, the nav
// (real <button>s, keyboard-navigable), and the active screen. State comes from
// AppProvider (validation already ran once on load); navigation from NavProvider.

import { useAppState } from '../state';
import { SCREENS, type ScreenId } from './registry';
import { useNavigation } from './navigation';
import { UdoProcessMap } from './UdoProcessMap';
import { Dashboard } from './Dashboard';
import { Portfolio } from './Portfolio';
import { CommandCenter } from './CommandCenter';
import { Inventory } from './Inventory';
import { HighRiskQueue } from './HighRiskQueue';
import { StaleExplorer } from './StaleExplorer';
import { Campaigns } from './Campaigns';
import { CampaignDetail } from './CampaignDetail';
import { ComponentWorkspace } from './ComponentWorkspace';
import { Tracker } from './Tracker';
import { Detail } from './Detail';
import { ReviewWorkspace } from './ReviewWorkspace';
import { Reporting } from './Reporting';

const SCREEN_COMPONENTS: Record<ScreenId, () => React.JSX.Element> = {
  process: UdoProcessMap,
  dashboard: Dashboard,
  portfolio: Portfolio,
  'command-center': CommandCenter,
  inventory: Inventory,
  'high-risk': HighRiskQueue,
  'stale-explorer': StaleExplorer,
  campaigns: Campaigns,
  'campaign-detail': CampaignDetail,
  'component-workspace': ComponentWorkspace,
  tracker: Tracker,
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
        <h1>DHS HQ UDO Review Platform</h1>
        <p className="app-subtitle">
          Headquarters-led, risk-based review of undelivered orders · validation assistant · as of{' '}
          {asOfDate}
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
