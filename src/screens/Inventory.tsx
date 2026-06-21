// UDO Inventory — SPEC §7.2. Full population table with filter (component,
// status) and sort (obligated $, age) and a verdict badge per row. Rows link to
// the Detail screen.

import { useMemo, useState } from 'react';
import { useAppState } from '../state';
import { useNavigation } from './navigation';
import { VerdictBadge, formatUsd, formatPct, ageInDays, drawdownRatio } from '../components';
import type { Component, ReportedStatus, Verdict } from '../domain/types';

type SortKey = 'obligated' | 'age';
type SortDir = 'asc' | 'desc';

const COMPONENTS: Component[] = ['USCG', 'TSA', 'FEMA', 'CBP', 'CISA'];
const STATUSES: ReportedStatus[] = ['OPEN_ACTIVE', 'OPEN_INACTIVE', 'PENDING_CLOSE', 'CLOSED'];

export function Inventory() {
  const { population, findings, asOfDate } = useAppState();
  const { inspect } = useNavigation();

  const [component, setComponent] = useState<Component | 'ALL'>('ALL');
  const [status, setStatus] = useState<ReportedStatus | 'ALL'>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('obligated');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const verdictByUdo = useMemo(() => {
    const map = new Map<string, Verdict>();
    for (const f of findings) map.set(f.udoId, f.verdict);
    return map;
  }, [findings]);

  const rows = useMemo(() => {
    const filtered = population.filter(
      (u) =>
        (component === 'ALL' || u.component === component) &&
        (status === 'ALL' || u.reportedStatus === status),
    );
    const sorted = [...filtered].sort((a, b) => {
      const av =
        sortKey === 'obligated' ? a.amountObligated : ageInDays(a.obligationDate, asOfDate);
      const bv =
        sortKey === 'obligated' ? b.amountObligated : ageInDays(b.obligationDate, asOfDate);
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return sorted;
  }, [population, component, status, sortKey, sortDir, asOfDate]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const ariaSort = (key: SortKey): 'ascending' | 'descending' | 'none' =>
    key === sortKey ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none';

  return (
    <section aria-labelledby="inventory-title">
      <h2 id="inventory-title">UDO Inventory</h2>

      <div className="filters">
        <label>
          Component
          <select
            value={component}
            onChange={(e) => setComponent(e.target.value as Component | 'ALL')}
          >
            <option value="ALL">All</option>
            {COMPONENTS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ReportedStatus | 'ALL')}
          >
            <option value="ALL">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <p className="filter-count" role="status">
          {rows.length} of {population.length} obligations
        </p>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>UDO</th>
            <th>Component</th>
            <th>Vendor</th>
            <th>Status</th>
            <th className="num" aria-sort={ariaSort('obligated')}>
              <button type="button" className="sort-button" onClick={() => toggleSort('obligated')}>
                Obligated {sortKey === 'obligated' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </button>
            </th>
            <th className="num">Drawdown</th>
            <th className="num" aria-sort={ariaSort('age')}>
              <button type="button" className="sort-button" onClick={() => toggleSort('age')}>
                Age (days) {sortKey === 'age' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </button>
            </th>
            <th>Verdict</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => {
            const verdict = verdictByUdo.get(u.id);
            return (
              <tr key={u.id} data-udo-id={u.id}>
                <td>
                  <button type="button" className="link-button" onClick={() => inspect(u.id)}>
                    {u.id}
                  </button>
                </td>
                <td>{u.component}</td>
                <td>{u.vendor}</td>
                <td>{u.reportedStatus}</td>
                <td className="num">{formatUsd(u.amountObligated)}</td>
                <td className="num">
                  {formatPct(drawdownRatio(u.amountObligated, u.amountDisbursed))}
                </td>
                <td className="num">{ageInDays(u.obligationDate, asOfDate)}</td>
                <td>{verdict ? <VerdictBadge verdict={verdict} /> : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
