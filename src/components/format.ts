// Presentational formatting helpers. UI layer (not src/domain), so wall-clock is
// permitted in principle — but these stay pure functions of their arguments so
// component tests are deterministic.

const DAY_MS = 86_400_000;

function toEpochMs(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** USD with thousands separators, no cents. */
export function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

/** A 0..1 ratio as a whole-number percentage. */
export function formatPct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

/** Whole days between an ISO date and the as-of date (negative if in the future). */
export function ageInDays(fromIso: string, asOfIso: string): number {
  return Math.floor((toEpochMs(asOfIso) - toEpochMs(fromIso)) / DAY_MS);
}

/** Drawdown ratio for display (0 when nothing obligated). */
export function drawdownRatio(amountObligated: number, amountDisbursed: number): number {
  return amountObligated > 0 ? amountDisbursed / amountObligated : 0;
}
