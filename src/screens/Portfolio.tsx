// Portfolio Command Center — SPEC §7 / Phase 4 (Wave 8). Leadership's
// department-wide view: headline KPIs, a per-component scorecard grid, campaign
// completion, and the de-obligation dollars rolled up. Every number is the pure
// engine output (buildPortfolioSummary) over the live store — read-only, no
// mutation.
//
// Drill-down (Wave 8.4): the exception counts are clickable. Clicking the
// department exception KPI, or a component's exception cell, opens the EXACT
// contributing lines (non-VALID verdicts in that scope) — and each line carries
// its own audit trail, so a KPI traces all the way down to the recorded events
// (lineage: KPI → component → line → audit).

import { useMemo, useState } from 'react';
import { useAppState } from '../state';
import { buildPortfolioSummary } from '../domain';
import type { Component } from '../domain';
import { formatUsd, formatPct } from '../components';

type DrillScope = Component | 'ALL';

export function Portfolio() {
  const state = useAppState();
  const { population, findings, auditLog } = state;
  const { kpis, scorecards } = useMemo(() => buildPortfolioSummary(state), [state]);

  // Which exception bucket is being drilled into (null = none open).
  const [drill, setDrill] = useState<DrillScope | null>(null);

  const verdictById = useMemo(() => new Map(findings.map((f) => [f.udoId, f.verdict])), [findings]);

  // The EXACT lines behind an exception count: non-VALID verdicts in `scope`,
  // in population order (deterministic). This is the drill-down contract — it
  // must equal the count shown in the KPI / scorecard cell.
  const exceptionLines = useMemo(() => {
    if (drill === null) return [];
    return population.filter((u) => {
      if (drill !== 'ALL' && u.component !== drill) return false;
      const verdict = verdictById.get(u.id);
      return verdict !== undefined && verdict !== 'VALID';
    });
  }, [drill, population, verdictById]);

  const drillLabel = drill === 'ALL' ? 'department-wide' : drill;

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
          <button
            type="button"
            className="stat-value stat-drill"
            data-testid="kpi-exceptions"
            aria-label="Drill into all exception lines"
            onClick={() => setDrill('ALL')}
          >
            {kpis.exceptionCount}
          </button>
          <span className="stat-sub">lines with a non-VALID verdict — click to drill</span>
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
              <td data-testid={`scorecard-${s.component}-exceptions`}>
                <button
                  type="button"
                  className="cell-drill"
                  aria-label={`Drill into ${s.component} exception lines`}
                  onClick={() => setDrill(s.component)}
                >
                  {s.exceptionCount}
                </button>
              </td>
              <td data-testid={`scorecard-${s.component}-deob`}>{formatUsd(s.deobDollars)}</td>
              <td data-testid={`scorecard-${s.component}-riskmix`}>
                {s.riskMix.CRITICAL} / {s.riskMix.HIGH} / {s.riskMix.MEDIUM} / {s.riskMix.LOW}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {scorecards.length === 0 && <p>No obligations in the portfolio.</p>}

      {drill !== null && (
        <section
          className="panel drill-panel"
          data-testid="drill-panel"
          aria-labelledby="drill-title"
        >
          <h3 id="drill-title">
            Exception lines — {drillLabel} ({exceptionLines.length})
          </h3>
          <button type="button" onClick={() => setDrill(null)}>
            Close
          </button>
          {exceptionLines.length === 0 ? (
            <p>No exception lines in this scope.</p>
          ) : (
            <ul className="drill-lines" aria-label="Contributing exception lines">
              {exceptionLines.map((u) => {
                const events = auditLog.filter((e) => e.udoId === u.id);
                return (
                  <li key={u.id} data-testid="drill-line" data-udo-id={u.id}>
                    <strong>{u.id}</strong> — {u.component} · {verdictById.get(u.id)} ·{' '}
                    {formatUsd(u.amountObligated)}
                    <ul className="drill-audit" aria-label={`Audit trail for ${u.id}`}>
                      {events.map((e, i) => (
                        <li key={i} data-testid="drill-audit-event">
                          <span className="audit-actor">{e.actor}</span>{' '}
                          <span className="audit-action">{e.action}</span> — {e.detail}
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </section>
  );
}
