// The SPEC §7 screens plus the Wave 5 Stale Obligation Explorer (SPEC §5.6), in
// nav order. Kept as data so the shell, the nav, and tests share one source of
// truth.

export type ScreenId =
  | 'dashboard'
  | 'inventory'
  | 'high-risk'
  | 'stale-explorer'
  | 'detail'
  | 'review'
  | 'reporting';

export interface ScreenMeta {
  id: ScreenId;
  label: string;
}

export const SCREENS: ScreenMeta[] = [
  { id: 'dashboard', label: 'Executive Dashboard' },
  { id: 'inventory', label: 'UDO Inventory' },
  { id: 'high-risk', label: 'High-Risk Queue' },
  { id: 'stale-explorer', label: 'Stale Obligation Explorer' },
  { id: 'detail', label: 'UDO Detail' },
  { id: 'review', label: 'Review Workspace' },
  { id: 'reporting', label: 'Reporting / Export' },
];
