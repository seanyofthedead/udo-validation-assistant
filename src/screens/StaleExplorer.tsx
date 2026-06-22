// Stale Obligation Explorer — SPEC §5.6 (Wave 5). A focused, investigative view
// over the de-obligation candidates surfaced by the Phase 1 `flagDeobligation`
// engine: aging buckets (days past period-of-performance end), an expired-PoP
// filter, a low-drawdown filter, and sorting by recoverable dollars. Wraps the
// existing engine output (deobFlags in state) — no new scoring logic here.

import { useMemo, useState } from 'react';
import { useAppState } from '../state';
import { useNavigation } from './navigation';
import { formatUsd, formatPct, ageInDays, drawdownRatio } from '../components';

// A "low drawdown" obligation has spent little of its money — the de-obligation
// signal. Mirrors the Phase 1 de-ob engine's notion; a UI threshold, not a
// risk-scoring weight (those live only in RISK_MODEL).
const LOW_DRAWDOWN = 0.25;

type AgingBucket = 'Not expired' | '1–90 days' | '91–365 days' | 'Over 365 days';

const BUCKET_ORDER: AgingBucket[] = ['Not expired', '1–90 days', '91–365 days', 'Over 365 days'];

function agingBucket(daysPastPoP: number): AgingBucket {
  if (daysPastPoP <= 0) return 'Not expired';
  if (daysPastPoP <= 90) return '1–90 days';
  if (daysPastPoP <= 365) return '91–365 days';
  return 'Over 365 days';
}

interface ExplorerRow {
  udoId: string;
  component: string;
  vendor: string;
  amountObligated: number;
  drawdown: number;
  daysPastPoP: number;
  bucket: AgingBucket;
  expired: boolean;
  lowDrawdown: boolean;
  candidate: boolean;
  recoverable: number;
}

export function StaleExplorer() {
  const { population, deobFlags, asOfDate } = useAppState();
  const { inspect } = useNavigation();

  const [expiredOnly, setExpiredOnly] = useState(false);
  const [lowDrawdownOnly, setLowDrawdownOnly] = useState(false);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const allRows = useMemo<ExplorerRow[]>(() => {
    const deobByUdo = new Map(deobFlags.map((d) => [d.udoId, d]));
    return population.map((u) => {
      const daysPastPoP = ageInDays(u.periodOfPerformanceEnd, asOfDate);
      const dd = drawdownRatio(u.amountObligated, u.amountDisbursed);
      const deob = deobByUdo.get(u.id);
      return {
        udoId: u.id,
        component: u.component,
        vendor: u.vendor,
        amountObligated: u.amountObligated,
        drawdown: dd,
        daysPastPoP,
        bucket: agingBucket(daysPastPoP),
        expired: daysPastPoP > 0,
        lowDrawdown: dd < LOW_DRAWDOWN,
        candidate: deob?.candidate ?? false,
        recoverable: deob?.estimatedRecoverable ?? 0,
      };
    });
  }, [population, deobFlags, asOfDate]);

  const bucketCounts = useMemo(() => {
    const counts: Record<AgingBucket, number> = {
      'Not expired': 0,
      '1–90 days': 0,
      '91–365 days': 0,
      'Over 365 days': 0,
    };
    for (const r of allRows) counts[r.bucket]++;
    return counts;
  }, [allRows]);

  const rows = useMemo<ExplorerRow[]>(() => {
    const filtered = allRows.filter(
      (r) => (!expiredOnly || r.expired) && (!lowDrawdownOnly || r.lowDrawdown),
    );
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort(
      (a, b) => dir * (a.recoverable - b.recoverable) || a.udoId.localeCompare(b.udoId),
    );
  }, [allRows, expiredOnly, lowDrawdownOnly, sortDir]);

  const totalRecoverable = rows.reduce((s, r) => s + r.recoverable, 0);

  return (
    <section aria-labelledby="stale-title">
      <h2 id="stale-title">Stale Obligation Explorer</h2>

      <div className="stat-cards" aria-label="Aging buckets (days past period of performance)">
        {BUCKET_ORDER.map((b) => (
          <div className="stat-card" key={b} data-bucket={b}>
            <span className="stat-label">{b}</span>
            <span className="stat-value">{bucketCounts[b]}</span>
          </div>
        ))}
      </div>

      <div className="filters">
        <label>
          <input
            type="checkbox"
            checked={expiredOnly}
            onChange={(e) => setExpiredOnly(e.target.checked)}
          />{' '}
          Expired PoP only
        </label>
        <label>
          <input
            type="checkbox"
            checked={lowDrawdownOnly}
            onChange={(e) => setLowDrawdownOnly(e.target.checked)}
          />{' '}
          Low drawdown only (&lt; {formatPct(LOW_DRAWDOWN)})
        </label>
        <p className="filter-count" role="status">
          {rows.length} of {allRows.length} obligations · {formatUsd(totalRecoverable)} recoverable
        </p>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>UDO</th>
            <th>Component</th>
            <th>Vendor</th>
            <th className="num">Obligated</th>
            <th className="num">Drawdown</th>
            <th className="num">Days past PoP</th>
            <th>Aging bucket</th>
            <th>De-ob</th>
            <th className="num" aria-sort={sortDir === 'asc' ? 'ascending' : 'descending'}>
              <button
                type="button"
                className="sort-button"
                onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
              >
                Recoverable {sortDir === 'asc' ? '▲' : '▼'}
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.udoId} data-udo-id={r.udoId} data-bucket={r.bucket}>
              <td>
                <button type="button" className="link-button" onClick={() => inspect(r.udoId)}>
                  {r.udoId}
                </button>
              </td>
              <td>{r.component}</td>
              <td>{r.vendor}</td>
              <td className="num">{formatUsd(r.amountObligated)}</td>
              <td className="num">{formatPct(r.drawdown)}</td>
              <td className="num">{r.daysPastPoP > 0 ? r.daysPastPoP : '—'}</td>
              <td>{r.bucket}</td>
              <td>{r.candidate ? <span className="tag">Candidate</span> : '—'}</td>
              <td className="num" data-recoverable={r.recoverable}>
                {r.recoverable > 0 ? formatUsd(r.recoverable) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
