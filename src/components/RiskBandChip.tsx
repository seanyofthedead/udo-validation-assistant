// Risk band chip — Wave 5 UI. LOW green, MEDIUM yellow, HIGH orange,
// CRITICAL red, mirroring the verdict-badge pattern. Severity reads at a glance.

import type { RiskBand } from '../domain/types';

const LABEL: Record<RiskBand, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

const CLASS: Record<RiskBand, string> = {
  LOW: 'badge band-low',
  MEDIUM: 'badge band-medium',
  HIGH: 'badge band-high',
  CRITICAL: 'badge band-critical',
};

export function RiskBandChip({ band }: { band: RiskBand }) {
  return (
    <span className={CLASS[band]} data-band={band}>
      {LABEL[band]}
    </span>
  );
}
