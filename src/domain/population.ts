// Campaign population selectors — SPEC §5.3 (Phase 3, Wave 6). A campaign's
// population can be chosen three ways: manually, by a saved filter, or as the
// "top N by risk." All three reuse the Wave 5 ranking: they consume the
// already-scored `riskScores` (sorted by score descending — the exact order the
// High-Risk Queue presents), so the population a manager scopes here is the same
// worklist the analyst sees. Pure and React-free; no clock/random.

import type { Component, ReportedStatus, RiskBand, RiskScore, UdoRecord } from './types';

/**
 * A reusable filter over the ranked population. Mirrors the High-Risk Queue's
 * filter dimensions that are computable from the record + its risk score (no
 * date math, so this stays clock-free). Every field is optional; an omitted
 * field does not constrain.
 */
export interface SavedFilter {
  component?: Component;
  band?: RiskBand;
  reportedStatus?: ReportedStatus;
  fundingType?: string;
  minObligated?: number;
  maxObligated?: number;
}

/** How a campaign's population is sourced. */
export type PopulationSource =
  | { kind: 'MANUAL'; udoIds: string[] }
  | { kind: 'TOP_N'; n: number }
  | { kind: 'SAVED_FILTER'; filter: SavedFilter };

/**
 * The top N UDO ids by risk. `riskScores` arrives sorted by score descending
 * (scorePopulation), so this is exactly the queue's top N. N is clamped to
 * [0, length]; a non-positive N selects nothing.
 */
export function selectTopNByRisk(riskScores: RiskScore[], n: number): string[] {
  if (n <= 0) return [];
  return riskScores.slice(0, n).map((s) => s.udoId);
}

/**
 * The given ids, restricted to ones that exist in the ranked population and
 * de-duplicated, returned in risk order (so a manual pick still presents
 * highest-risk-first, consistent with the other sources).
 */
export function selectManual(riskScores: RiskScore[], udoIds: string[]): string[] {
  const wanted = new Set(udoIds);
  return riskScores.filter((s) => wanted.has(s.udoId)).map((s) => s.udoId);
}

/** True iff the record + its score satisfy every set field of the filter. */
function matchesFilter(udo: UdoRecord, score: RiskScore, f: SavedFilter): boolean {
  return (
    (f.component === undefined || udo.component === f.component) &&
    (f.band === undefined || score.band === f.band) &&
    (f.reportedStatus === undefined || udo.reportedStatus === f.reportedStatus) &&
    (f.fundingType === undefined || udo.fundingType === f.fundingType) &&
    (f.minObligated === undefined || udo.amountObligated >= f.minObligated) &&
    (f.maxObligated === undefined || udo.amountObligated <= f.maxObligated)
  );
}

/** UDO ids matching the saved filter, in risk order (highest first). */
export function selectByFilter(
  riskScores: RiskScore[],
  population: UdoRecord[],
  filter: SavedFilter,
): string[] {
  const udoById = new Map(population.map((u) => [u.id, u]));
  return riskScores
    .filter((s) => {
      const u = udoById.get(s.udoId);
      return u !== undefined && matchesFilter(u, s, filter);
    })
    .map((s) => s.udoId);
}

/**
 * Resolve any PopulationSource to a list of UDO ids in risk order. One entry
 * point the campaign wizard can call regardless of how the manager chose to
 * scope the population.
 */
export function selectPopulation(
  source: PopulationSource,
  riskScores: RiskScore[],
  population: UdoRecord[],
): string[] {
  switch (source.kind) {
    case 'MANUAL':
      return selectManual(riskScores, source.udoIds);
    case 'TOP_N':
      return selectTopNByRisk(riskScores, source.n);
    case 'SAVED_FILTER':
      return selectByFilter(riskScores, population, source.filter);
  }
}
