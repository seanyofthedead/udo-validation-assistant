// The SPEC §7 screens plus the Wave 5 Stale Obligation Explorer (SPEC §5.6), in
// nav order. Kept as data so the shell, the nav, and tests share one source of
// truth.

export type ScreenId =
  | 'dashboard'
  | 'portfolio'
  | 'inventory'
  | 'high-risk'
  | 'stale-explorer'
  | 'campaigns'
  | 'campaign-detail'
  | 'component-workspace'
  | 'tracker'
  | 'detail'
  | 'review'
  | 'reporting';

export interface ScreenMeta {
  id: ScreenId;
  label: string;
}

export const SCREENS: ScreenMeta[] = [
  { id: 'dashboard', label: 'Executive Dashboard' },
  { id: 'portfolio', label: 'Portfolio Command Center' },
  { id: 'inventory', label: 'UDO Inventory' },
  { id: 'high-risk', label: 'High-Risk Queue' },
  { id: 'stale-explorer', label: 'Stale Obligation Explorer' },
  { id: 'campaigns', label: 'Review Campaigns' },
  { id: 'component-workspace', label: 'Component Workspace' },
  { id: 'tracker', label: 'Escalations & De-Ob' },
  { id: 'detail', label: 'UDO Detail' },
  { id: 'review', label: 'Review Workspace' },
  { id: 'reporting', label: 'Reporting / Export' },
];

// 'campaign-detail' is reachable from the campaign list (openCampaign), not the
// top nav — it requires a selected campaign, like the UDO Detail deep-link.
