// High-Risk UDO Queue — SPEC §5.2 (Wave 5). Generalizes the Phase 1 queue from
// "Questionable + de-ob candidates" to "the whole population, ranked by risk."
// Each row shows the risk score, band chip, its top-3 contributing factors, the
// dollar, age, status, funding type, and verdict. Filterable by component, band,
// status, funding type, dollar range, and age; sortable by score / $ / age
// (default: score descending — the worklist analysts work top-down).

import { useMemo, useState } from 'react';
import { useAppState } from '../state';
import { useNavigation } from './navigation';
import { RiskBandChip, VerdictBadge, formatUsd, ageInDays } from '../components';
import type {
  Component,
  ReportedStatus,
  RiskBand,
  RiskFactor,
  UdoRecord,
  Verdict,
} from '../domain/types';

type SortKey = 'score' | 'obligated' | 'age';
type SortDir = 'asc' | 'desc';

const COMPONENTS: Component[] = ['USCG', 'TSA', 'FEMA', 'CBP', 'CISA'];
const STATUSES: ReportedStatus[] = ['OPEN_ACTIVE', 'OPEN_INACTIVE', 'PENDING_CLOSE', 'CLOSED'];
const BANDS: RiskBand[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

interface QueueRow {
  udoId: string;
  component: Component;
  vendor: string;
  reportedStatus: ReportedStatus;
  fundingType: string;
  amountObligated: number;
  ageDays: number;
  score: number;
  band: RiskBand;
  topFactors: RiskFactor[];
  verdict: Verdict;
}

/** The three highest-contributing factors (points > 0), score-ranked. */
function topThree(factors: RiskFactor[]): RiskFactor[] {
  return [...factors]
    .filter((f) => f.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 3);
}

export function HighRiskQueue() {
  const { population, findings, riskScores, asOfDate } = useAppState();
  const { inspect } = useNavigation();

  const [component, setComponent] = useState<Component | 'ALL'>('ALL');
  const [band, setBand] = useState<RiskBand | 'ALL'>('ALL');
  const [status, setStatus] = useState<ReportedStatus | 'ALL'>('ALL');
  const [fundingType, setFundingType] = useState<string>('ALL');
  const [minDollar, setMinDollar] = useState<string>('');
  const [maxDollar, setMaxDollar] = useState<string>('');
  const [minAge, setMinAge] = useState<string>('');
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const fundingTypes = useMemo(
    () => Array.from(new Set(population.map((u) => u.fundingType))).sort(),
    [population],
  );

  const allRows = useMemo<QueueRow[]>(() => {
    const udoById = new Map<string, UdoRecord>(population.map((u) => [u.id, u]));
    const verdictByUdo = new Map<string, Verdict>(findings.map((f) => [f.udoId, f.verdict]));
    // riskScores arrives sorted by score desc (scorePopulation); preserve that.
    return riskScores.flatMap((s) => {
      const u = udoById.get(s.udoId);
      if (!u) return [];
      return [
        {
          udoId: s.udoId,
          component: u.component,
          vendor: u.vendor,
          reportedStatus: u.reportedStatus,
          fundingType: u.fundingType,
          amountObligated: u.amountObligated,
          ageDays: ageInDays(u.obligationDate, asOfDate),
          score: s.score,
          band: s.band,
          topFactors: topThree(s.factors),
          verdict: verdictByUdo.get(s.udoId) ?? 'VALID',
        },
      ];
    });
  }, [population, findings, riskScores, asOfDate]);

  const rows = useMemo<QueueRow[]>(() => {
    const min = minDollar.trim() === '' ? null : Number(minDollar);
    const max = maxDollar.trim() === '' ? null : Number(maxDollar);
    const ageFloor = minAge.trim() === '' ? null : Number(minAge);

    const filtered = allRows.filter(
      (r) =>
        (component === 'ALL' || r.component === component) &&
        (band === 'ALL' || r.band === band) &&
        (status === 'ALL' || r.reportedStatus === status) &&
        (fundingType === 'ALL' || r.fundingType === fundingType) &&
        (min === null || r.amountObligated >= min) &&
        (max === null || r.amountObligated <= max) &&
        (ageFloor === null || r.ageDays >= ageFloor),
    );

    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const key =
        sortKey === 'score' ? 'score' : sortKey === 'obligated' ? 'amountObligated' : 'ageDays';
      const delta = (a[key] as number) - (b[key] as number);
      // Stable secondary sort by score desc keeps ties meaningful.
      return delta !== 0 ? dir * delta : b.score - a.score;
    });
  }, [
    allRows,
    component,
    band,
    status,
    fundingType,
    minDollar,
    maxDollar,
    minAge,
    sortKey,
    sortDir,
  ]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const ariaSort = (key: SortKey): 'ascending' | 'descending' | 'none' =>
    key === sortKey ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none';

  const sortCaret = (key: SortKey) => (key === sortKey ? (sortDir === 'asc' ? '▲' : '▼') : '');

  return (
    <section aria-labelledby="high-risk-title">
      <h2 id="high-risk-title">High-Risk Queue</h2>

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
          Risk band
          <select value={band} onChange={(e) => setBand(e.target.value as RiskBand | 'ALL')}>
            <option value="ALL">All</option>
            {BANDS.map((b) => (
              <option key={b} value={b}>
                {b}
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
        <label>
          Funding type
          <select value={fundingType} onChange={(e) => setFundingType(e.target.value)}>
            <option value="ALL">All</option>
            {fundingTypes.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <label>
          Obligated $ range
          <span className="range-inputs">
            <input
              type="number"
              aria-label="Minimum obligated dollars"
              placeholder="min"
              value={minDollar}
              onChange={(e) => setMinDollar(e.target.value)}
            />
            <input
              type="number"
              aria-label="Maximum obligated dollars"
              placeholder="max"
              value={maxDollar}
              onChange={(e) => setMaxDollar(e.target.value)}
            />
          </span>
        </label>
        <label>
          Min age (days)
          <input
            type="number"
            aria-label="Minimum age in days"
            placeholder="any"
            value={minAge}
            onChange={(e) => setMinAge(e.target.value)}
          />
        </label>
        <p className="filter-count" role="status">
          {rows.length} of {allRows.length} obligations
        </p>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>UDO</th>
            <th>Component</th>
            <th>Band</th>
            <th className="num" aria-sort={ariaSort('score')}>
              <button type="button" className="sort-button" onClick={() => toggleSort('score')}>
                Risk score {sortCaret('score')}
              </button>
            </th>
            <th>Top factors</th>
            <th>Status</th>
            <th>Funding</th>
            <th className="num" aria-sort={ariaSort('obligated')}>
              <button type="button" className="sort-button" onClick={() => toggleSort('obligated')}>
                Obligated {sortCaret('obligated')}
              </button>
            </th>
            <th className="num" aria-sort={ariaSort('age')}>
              <button type="button" className="sort-button" onClick={() => toggleSort('age')}>
                Age (days) {sortCaret('age')}
              </button>
            </th>
            <th>Verdict</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.udoId} data-udo-id={r.udoId} data-band={r.band}>
              <td>
                <button type="button" className="link-button" onClick={() => inspect(r.udoId)}>
                  {r.udoId}
                </button>
              </td>
              <td>{r.component}</td>
              <td>
                <RiskBandChip band={r.band} />
              </td>
              <td className="num score-cell" data-score={r.score}>
                {r.score}
              </td>
              <td>
                <span className="factor-list">
                  {r.topFactors.length === 0 ? (
                    <span className="factor-chip">No risk factors</span>
                  ) : (
                    r.topFactors.map((f) => (
                      <span key={f.name} className="factor-chip" title={f.reason}>
                        {f.name} ({f.points})
                      </span>
                    ))
                  )}
                </span>
              </td>
              <td>{r.reportedStatus}</td>
              <td>{r.fundingType}</td>
              <td className="num">{formatUsd(r.amountObligated)}</td>
              <td className="num">{r.ageDays}</td>
              <td>
                <VerdictBadge verdict={r.verdict} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
