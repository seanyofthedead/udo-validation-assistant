// Staleness forecast — SPEC §5.8 (Phase 4 → L5), the predictive step. An
// ADVISORY projection of how many obligations will newly go stale by the end of
// a horizon (default: next quarter). Documented method:
// docs/wave9-forecast-method.md.
//
// Same invariants as every other engine (see determinism.guard.test.ts): no
// React, and NO wall-clock / random — "now" is the explicit asOfDate and the
// horizon end is derived from it by pure calendar math (Date.UTC to parse, a
// pure days→civil-date algorithm to format; no Date constructor). The function is
// pure over (population, asOfDate, horizon), so an auditor can reproduce any
// projection and the build loop terminates.
//
// The signature anticipates a future model-backed implementation (AWS future
// state): the `method` label and `basis` string are the seam where a learned
// model would replace the aging heuristic without changing call sites or the
// explainability contract.

import type { Component, Forecast, ForecastDriver, ForecastHorizon, UdoRecord } from './types';
import { isStale } from './engine';

const DAY_MS = 86_400_000;

/** Default forecast window: one quarter ahead. */
export const DEFAULT_HORIZON_DAYS = 90;
export const DEFAULT_HORIZON_LABEL = 'next quarter';

/** Method label, mirrored in docs/wave9-forecast-method.md (bump together). */
export const FORECAST_METHOD = 'aging extrapolation v0.1';

/** ISO 'YYYY-MM-DD' → integer days since the Unix epoch (pure; Date.UTC only). */
function epochDaysFromIso(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
function pad4(n: number): string {
  return n.toString().padStart(4, '0');
}

/**
 * Integer days-since-epoch → ISO 'YYYY-MM-DD'. Howard Hinnant's civil-from-days
 * algorithm — a pure function of its argument, so it stays inside the
 * determinism guard (no Date constructor, no clock). Inverse of
 * epochDaysFromIso for any valid calendar date.
 */
function isoFromEpochDays(days: number): string {
  const z = days + 719_468;
  const era = Math.floor((z >= 0 ? z : z - 146_096) / 146_097);
  const doe = z - era * 146_097; // [0, 146096]
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36_524) - Math.floor(doe / 146_096)) / 365,
  ); // [0, 399]
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100)); // [0, 365]
  const mp = Math.floor((5 * doy + 2) / 153); // [0, 11]
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1; // [1, 31]
  const month = mp < 10 ? mp + 3 : mp - 9; // [1, 12]
  const year = month <= 2 ? y + 1 : y;
  return `${pad4(year)}-${pad2(month)}-${pad2(day)}`;
}

/** asOfDate + `days`, as an ISO date (pure calendar math). */
function addDays(iso: string, days: number): string {
  return isoFromEpochDays(epochDaysFromIso(iso) + days);
}

/**
 * Build a forecast horizon whose `endDate` is `asOfDate + days`. Exposed so the
 * console and tests share one definition of "next quarter."
 */
export function buildHorizon(
  asOfDate: string,
  days: number = DEFAULT_HORIZON_DAYS,
  label: string = DEFAULT_HORIZON_LABEL,
): ForecastHorizon {
  return { label, days, endDate: addDays(asOfDate, days) };
}

/**
 * SPEC §5.8 — project how many obligations will NEWLY go stale by the horizon
 * end. Pure aging extrapolation: hold each record's financials and activity flat
 * and advance the as-of date, then re-run the SPEC §8 staleness predicate
 * (`isStale`). A line counts when it is not stale today but is stale by the
 * horizon end (its PoP expires within the window, or its inactivity crosses 180
 * days within the window). Already-CLOSED lines are out of scope.
 *
 * `target` scopes the projection to one component or the whole DEPARTMENT; the
 * department projection equals the sum of the per-component projections (the
 * predicate partitions the population). Every projection carries its `method`,
 * its plain-language `basis`, and the per-line `drivers` (lineage), and is
 * rendered with a "Projection" badge so it is never mistaken for fact.
 */
export function forecastStaleObligations(
  population: UdoRecord[],
  asOfDate: string,
  horizon: ForecastHorizon = buildHorizon(asOfDate),
  target: Component | 'DEPARTMENT' = 'DEPARTMENT',
): Forecast {
  const scope =
    target === 'DEPARTMENT' ? population : population.filter((u) => u.component === target);

  const drivers: ForecastDriver[] = [];
  for (const udo of scope) {
    if (udo.reportedStatus === 'CLOSED') continue; // a closed line going stale is meaningless
    if (isStale(udo, asOfDate)) continue; // already stale — not a projection
    if (!isStale(udo, horizon.endDate)) continue; // stays non-stale through the horizon

    const expiresWithinWindow = udo.periodOfPerformanceEnd >= asOfDate;
    const reasonParts = [
      `Projected to go stale by ${horizon.endDate}:`,
      expiresWithinWindow
        ? `period of performance ends ${udo.periodOfPerformanceEnd} (within the horizon)`
        : `period of performance already ended ${udo.periodOfPerformanceEnd}`,
      `and last activity ${udo.lastActivityDate} crosses the 180-day inactivity threshold by then.`,
    ];
    drivers.push({
      udoId: udo.id,
      component: udo.component,
      estimatedRecoverable: udo.amountObligated - udo.amountDisbursed,
      reason: reasonParts.join(' '),
    });
  }

  const scopeLabel = target === 'DEPARTMENT' ? 'the department' : target;
  const basis =
    `${FORECAST_METHOD}: held drawdown and last-activity flat and advanced the as-of date from ` +
    `${asOfDate} to ${horizon.endDate} (${horizon.label}, ${horizon.days} days), then re-ran the ` +
    `SPEC §8 staleness predicate (expired period of performance + >180 days inactive) over ` +
    `${scopeLabel}. ${drivers.length} obligation(s) not stale today are projected to become ` +
    `stale by then.`;

  return {
    target,
    metric: 'STALE_OBLIGATIONS',
    projectedValue: drivers.length,
    horizon,
    method: FORECAST_METHOD,
    basis,
    drivers,
    asOfDate,
  };
}
