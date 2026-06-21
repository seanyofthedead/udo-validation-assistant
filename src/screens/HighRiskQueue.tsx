// High-Risk Queue — SPEC §7.3. The worklist: every QUESTIONABLE finding plus
// every de-obligation candidate, ranked by obligated $ descending. Clean VALID
// lines that are not de-ob candidates are excluded.

import { useMemo } from 'react';
import { useAppState } from '../state';
import { useNavigation } from './navigation';
import { VerdictBadge, formatUsd } from '../components';
import type { Verdict } from '../domain/types';

interface QueueRow {
  udoId: string;
  component: string;
  vendor: string;
  amountObligated: number;
  verdict: Verdict;
  questionable: boolean;
  deobCandidate: boolean;
  estimatedRecoverable: number;
}

export function HighRiskQueue() {
  const { population, findings, deobFlags } = useAppState();
  const { inspect } = useNavigation();

  const rows = useMemo<QueueRow[]>(() => {
    const verdictByUdo = new Map(findings.map((f) => [f.udoId, f.verdict]));
    const deobByUdo = new Map(deobFlags.map((d) => [d.udoId, d]));

    return population
      .map((u) => {
        const verdict = verdictByUdo.get(u.id) ?? 'VALID';
        const deob = deobByUdo.get(u.id);
        return {
          udoId: u.id,
          component: u.component,
          vendor: u.vendor,
          amountObligated: u.amountObligated,
          verdict,
          questionable: verdict === 'QUESTIONABLE',
          deobCandidate: deob?.candidate ?? false,
          estimatedRecoverable: deob?.estimatedRecoverable ?? 0,
        };
      })
      .filter((r) => r.questionable || r.deobCandidate)
      .sort((a, b) => b.amountObligated - a.amountObligated); // stable: ties keep population order
  }, [population, findings, deobFlags]);

  const totalRecoverable = rows.reduce((s, r) => s + r.estimatedRecoverable, 0);

  return (
    <section aria-labelledby="high-risk-title">
      <h2 id="high-risk-title">High-Risk Queue</h2>
      <p className="filter-count" role="status">
        {rows.length} high-risk obligations · {formatUsd(totalRecoverable)} potentially recoverable
      </p>

      <table className="data-table">
        <thead>
          <tr>
            <th>UDO</th>
            <th>Component</th>
            <th>Vendor</th>
            <th>Flags</th>
            <th>Verdict</th>
            <th className="num">Obligated</th>
            <th className="num">Recoverable</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.udoId} data-udo-id={r.udoId}>
              <td>
                <button type="button" className="link-button" onClick={() => inspect(r.udoId)}>
                  {r.udoId}
                </button>
              </td>
              <td>{r.component}</td>
              <td>{r.vendor}</td>
              <td>
                {r.questionable && <span className="tag">Questionable</span>}
                {r.deobCandidate && <span className="tag">De-ob candidate</span>}
              </td>
              <td>
                <VerdictBadge verdict={r.verdict} />
              </td>
              <td className="num">{formatUsd(r.amountObligated)}</td>
              <td className="num">{r.deobCandidate ? formatUsd(r.estimatedRecoverable) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
