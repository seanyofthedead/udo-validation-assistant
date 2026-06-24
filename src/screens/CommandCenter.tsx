// Enterprise Command Center — SPEC §7 / §5.8 (Phase 4 → L5). Leadership's
// cross-component oversight console: a heatmap that surfaces where each metric
// spikes, the top movers since the prior snapshot, and (Wave 9.5) an advisory
// forecast panel. Every current-state number is the pure engine output
// (buildCrossComponentAnalytics over buildPortfolioSummary) — read-only.
//
// The time series is two real, recomputed snapshots: the live portfolio now and
// a recomputed portfolio two quarters back (snapshotPortfolioAt). Movers are the
// change between them; the heatmap reflects the latest.

import { useMemo } from 'react';
import { useAppState } from '../state';
import { useNavigation } from './navigation';
import {
  buildCrossComponentAnalytics,
  buildHorizon,
  buildPortfolioSummary,
  forecastStaleObligations,
  snapshotPortfolioAt,
} from '../domain';
import type { Component, HeatmapMetric, PortfolioSnapshot } from '../domain';
import { formatUsd } from '../components';

// How far back the comparison snapshot sits (for the top-movers baseline).
const PRIOR_WINDOW_DAYS = 180;
const PRIOR_WINDOW_LABEL = 'two quarters ago';

// Heatmap rows, in display order, with their human labels.
const METRIC_ROWS: { metric: HeatmapMetric; label: string }[] = [
  { metric: 'exceptions', label: 'Exceptions' },
  { metric: 'critical', label: 'Critical risk' },
  { metric: 'projectedStale', label: 'Projected stale (next qtr)' },
];

export function CommandCenter() {
  const state = useAppState();
  const { inspect } = useNavigation();
  const { asOfDate, population, evidence, rules, priorStats } = state;

  const { analytics, components, forecast } = useMemo(() => {
    const summary = buildPortfolioSummary(state);
    const currentSnapshot: PortfolioSnapshot = { asOfDate, summary };

    // A real earlier snapshot recomputed by the same engines (pure date math).
    const priorDate = buildHorizon(asOfDate, -PRIOR_WINDOW_DAYS).endDate;
    const priorSnapshot = snapshotPortfolioAt(
      { population, evidence, rules, priorStats },
      priorDate,
    );

    const present = summary.scorecards.map((s) => s.component);
    const horizon = buildHorizon(asOfDate);
    const forecasts = present.map((c) =>
      forecastStaleObligations(population, asOfDate, horizon, c),
    );

    return {
      analytics: buildCrossComponentAnalytics({
        snapshots: [priorSnapshot, currentSnapshot],
        forecasts,
      }),
      components: present,
      // Department-wide staleness projection for the forecast panel (Wave 9.5).
      forecast: forecastStaleObligations(population, asOfDate, horizon, 'DEPARTMENT'),
    };
  }, [state, asOfDate, population, evidence, rules, priorStats]);

  const cellFor = (metric: HeatmapMetric, component: Component) =>
    analytics.heatmap.find((h) => h.metric === metric && h.component === component);

  return (
    <section aria-labelledby="command-center-title">
      <h2 id="command-center-title">Enterprise Command Center</h2>
      <p className="screen-intro">
        Cross-component oversight as of {asOfDate}. The heatmap shows where each metric spikes; top
        movers compare to {PRIOR_WINDOW_LABEL}. Current-state figures reconcile to the portfolio
        scorecards.
      </p>

      <h3>Cross-component heatmap</h3>
      <table className="data-table heatmap" aria-label="Cross-component heatmap">
        <thead>
          <tr>
            <th scope="col">Metric</th>
            {components.map((c) => (
              <th scope="col" key={c}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {METRIC_ROWS.map(({ metric, label }) => (
            <tr key={metric} data-testid={`heat-row-${metric}`}>
              <th scope="row">{label}</th>
              {components.map((c) => {
                const cell = cellFor(metric, c);
                const value = cell?.value ?? 0;
                const isSpike = cell?.isSpike ?? false;
                return (
                  <td
                    key={c}
                    data-testid={`heat-${metric}-${c}`}
                    data-spike={isSpike ? 'true' : undefined}
                    className={isSpike ? 'heat-cell heat-spike' : 'heat-cell'}
                    style={{
                      // Intensity drives a subtle background so the spike reads at a glance.
                      backgroundColor: `rgba(180, 30, 30, ${(cell?.intensity ?? 0) * 0.5})`,
                    }}
                    aria-label={
                      isSpike ? `${c} ${label} spike: ${value}` : `${c} ${label}: ${value}`
                    }
                  >
                    {value}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Top movers vs {PRIOR_WINDOW_LABEL}</h3>
      {analytics.topMovers.length === 0 ? (
        <p data-testid="no-movers">No component moved since {PRIOR_WINDOW_LABEL}.</p>
      ) : (
        <table className="data-table" aria-label="Top movers">
          <thead>
            <tr>
              <th scope="col">Component</th>
              <th scope="col">Metric</th>
              <th scope="col">Then</th>
              <th scope="col">Now</th>
              <th scope="col">Change</th>
            </tr>
          </thead>
          <tbody>
            {analytics.topMovers.map((m) => (
              <tr key={m.component} data-testid={`mover-${m.component}`}>
                <th scope="row">{m.component}</th>
                <td>{m.metric}</td>
                <td>{m.from}</td>
                <td>{m.to}</td>
                <td data-testid={`mover-${m.component}-delta`}>
                  {m.delta > 0 ? `▲ +${m.delta}` : `▼ ${m.delta}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <section
        className="panel forecast-panel"
        data-testid="forecast-panel"
        aria-labelledby="forecast-title"
      >
        <h3 id="forecast-title">
          Staleness forecast{' '}
          <span className="badge badge-projection" data-testid="forecast-badge">
            Projection
          </span>
        </h3>

        {/* Advisory only — ALWAYS labeled a projection and ALWAYS carrying its basis
            (SPEC §5.8), so it can never be mistaken for an observed fact. */}
        <p className="forecast-headline" data-testid="forecast-projection">
          <strong>{forecast.projectedValue}</strong> obligation(s) across the department are
          projected to go stale by {forecast.horizon.endDate} ({forecast.horizon.label}).
        </p>
        <p className="forecast-basis" data-testid="forecast-basis">
          <span className="forecast-basis-label">Basis:</span> {forecast.basis}
        </p>
        <p className="forecast-method" data-testid="forecast-method">
          Method: {forecast.method}. This is an advisory projection — the platform never auto-acts
          on it.
        </p>

        {forecast.drivers.length === 0 ? (
          <p data-testid="forecast-no-drivers">
            No obligation is projected to newly go stale within this horizon.
          </p>
        ) : (
          <>
            <h4>Lines driving the projection</h4>
            <ul className="forecast-drivers" aria-label="Lines driving the projection">
              {forecast.drivers.map((d) => (
                <li key={d.udoId} data-testid={`forecast-driver-${d.udoId}`} data-udo-id={d.udoId}>
                  <button
                    type="button"
                    className="link-button"
                    aria-label={`Drill to ${d.udoId}`}
                    onClick={() => inspect(d.udoId)}
                  >
                    {d.udoId}
                  </button>{' '}
                  — {d.component} · {formatUsd(d.estimatedRecoverable)} recoverable ·{' '}
                  <span className="driver-reason">{d.reason}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </section>
  );
}
