// Executive Dashboard — SPEC §7.1. Three headline metrics over the validated
// population: coverage % (lines the assistant could assess, i.e. did not abstain
// on, over the total), exception count (verdict != VALID), and total estimated
// de-obligation $ across the candidate shortlist.

import { useMemo } from 'react';
import { useAppState } from '../state';
import { formatUsd, formatPct } from '../components';

export function Dashboard() {
  const { findings, deobFlags, anomalies } = useAppState();

  const metrics = useMemo(() => {
    const total = findings.length;
    const abstained = findings.filter((f) => f.verdict === 'INSUFFICIENT_EVIDENCE').length;
    const exceptions = findings.filter((f) => f.verdict !== 'VALID').length;
    const coverage = total > 0 ? (total - abstained) / total : 0;
    const deobTotal = deobFlags
      .filter((d) => d.candidate)
      .reduce((s, d) => s + d.estimatedRecoverable, 0);
    return { total, coverage, exceptions, deobTotal };
  }, [findings, deobFlags]);

  const flaggedComponents = anomalies.filter(
    (a) => a.populationShift || a.outlierUdoIds.length > 0,
  );

  return (
    <section aria-labelledby="dashboard-title">
      <h2 id="dashboard-title">Executive Dashboard</h2>

      <div className="stat-cards">
        <div className="stat-card">
          <span className="stat-label">Validation coverage</span>
          <span className="stat-value" data-testid="coverage">
            {formatPct(metrics.coverage)}
          </span>
          <span className="stat-sub">{metrics.total} obligations assessed</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Exceptions</span>
          <span className="stat-value" data-testid="exception-count">
            {metrics.exceptions}
          </span>
          <span className="stat-sub">questionable or abstained lines</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Potential de-obligation</span>
          <span className="stat-value" data-testid="deob-total">
            {formatUsd(metrics.deobTotal)}
          </span>
          <span className="stat-sub">across the candidate shortlist</span>
        </div>
      </div>

      {flaggedComponents.length > 0 && (
        <>
          <h3>Prior-year anomalies</h3>
          <ul className="history">
            {flaggedComponents.map((a) => (
              <li key={a.component}>
                <strong>{a.component}</strong>
                {a.populationShift && ' — population shift ≥50% vs prior year'}
                {a.outlierUdoIds.length > 0 && ` — outlier line(s): ${a.outlierUdoIds.join(', ')}`}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
