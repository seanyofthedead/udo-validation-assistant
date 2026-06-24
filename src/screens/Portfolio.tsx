// Portfolio Command Center — SPEC §7 / Phase 4 (Wave 8). Leadership's
// department-wide view: headline KPIs, a per-component scorecard grid, campaign
// completion, and the de-obligation dollars rolled up. Every number is the pure
// engine output (buildPortfolioSummary) over the live store — read-only, no
// mutation. Drill-down from a KPI to its contributing lines arrives in Wave 8.4.

import { useMemo } from 'react';
import { useAppState } from '../state';
import { buildPortfolioSummary } from '../domain';
import { formatUsd, formatPct } from '../components';

export function Portfolio() {
  const state = useAppState();
  const { kpis, scorecards } = useMemo(() => buildPortfolioSummary(state), [state]);

  return (
    <section aria-labelledby="portfolio-title">
      <h2 id="portfolio-title">Portfolio Command Center</h2>
      <p className="screen-intro">
        Department-wide UDO health as of {kpis.asOfDate}. Every figure reconciles to its source
        records.
      </p>

      <div className="stat-cards">
        <div className="stat-card">
          <span className="stat-label">Review coverage</span>
          <span className="stat-value" data-testid="kpi-coverage">
            {formatPct(kpis.coverage)}
          </span>
          <span className="stat-sub" data-testid="kpi-reviewed">
            {kpis.reviewedCount} of {kpis.udoCount} lines reviewed
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Exceptions</span>
          <span className="stat-value" data-testid="kpi-exceptions">
            {kpis.exceptionCount}
          </span>
          <span className="stat-sub">lines with a non-VALID verdict</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Confirmed de-obligation</span>
          <span className="stat-value" data-testid="kpi-deob">
            {formatUsd(kpis.deobDollars)}
          </span>
          <span className="stat-sub">rolled up from confirmed opportunities</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Campaign completion</span>
          <span className="stat-value" data-testid="kpi-campaign-completion">
            {formatPct(kpis.campaignCompletion)}
          </span>
          <span className="stat-sub">assignments marked complete</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total obligated</span>
          <span className="stat-value" data-testid="kpi-total-obligated">
            {formatUsd(kpis.totalObligated)}
          </span>
          <span className="stat-sub">{kpis.udoCount} obligations under review</span>
        </div>
      </div>

      <h3>Component scorecards</h3>
      <table className="data-table" aria-label="Component scorecards">
        <thead>
          <tr>
            <th scope="col">Component</th>
            <th scope="col">UDOs</th>
            <th scope="col">Coverage</th>
            <th scope="col">Exceptions</th>
            <th scope="col">Confirmed de-ob</th>
            <th scope="col">Risk mix (C / H / M / L)</th>
          </tr>
        </thead>
        <tbody>
          {scorecards.map((s) => (
            <tr key={s.component} data-testid={`scorecard-${s.component}`}>
              <th scope="row">{s.component}</th>
              <td data-testid={`scorecard-${s.component}-udoCount`}>{s.udoCount}</td>
              <td data-testid={`scorecard-${s.component}-coverage`}>{formatPct(s.coverage)}</td>
              <td data-testid={`scorecard-${s.component}-exceptions`}>{s.exceptionCount}</td>
              <td data-testid={`scorecard-${s.component}-deob`}>{formatUsd(s.deobDollars)}</td>
              <td data-testid={`scorecard-${s.component}-riskmix`}>
                {s.riskMix.CRITICAL} / {s.riskMix.HIGH} / {s.riskMix.MEDIUM} / {s.riskMix.LOW}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {scorecards.length === 0 && <p>No obligations in the portfolio.</p>}
    </section>
  );
}
