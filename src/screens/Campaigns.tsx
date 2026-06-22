// Review Campaigns — SPEC §5.3 (Phase 3, Wave 6). Lists existing campaigns with
// their lifecycle state and hosts the create wizard: name, objective, period, a
// population source (top-N by risk / saved filter / manual — all reusing the
// Wave 5 ranking), and a default due date. The wizard previews the per-component
// assignments live, then records the campaign as DRAFT (the platform never
// auto-advances state — launching is a separate, deliberate action on the
// campaign detail screen).

import { useMemo, useState } from 'react';
import { useAppState, useAppDispatch } from '../state';
import { useNavigation } from './navigation';
import {
  selectPopulation,
  generateAssignments,
  type PopulationSource,
  type SavedFilter,
} from '../domain';
import type { Component, RiskBand } from '../domain/types';

// No auth in the MVP — the campaign manager is a fixed actor (cf. ReviewWorkspace).
const MANAGER = 'manager@dhs.gov';

const COMPONENTS: Component[] = ['USCG', 'TSA', 'FEMA', 'CBP', 'CISA'];
const BANDS: RiskBand[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

type SourceKind = 'TOP_N' | 'SAVED_FILTER' | 'MANUAL';

/** Next campaign id, derived from the count so it is deterministic in tests. */
function nextCampaignId(count: number): string {
  return `CMP-${(count + 1).toString().padStart(2, '0')}`;
}

export function Campaigns() {
  const { campaigns, assignments, riskScores, population, asOfDate } = useAppState();
  const dispatch = useAppDispatch();
  const { openCampaign } = useNavigation();

  const [name, setName] = useState('');
  const [objective, setObjective] = useState('');
  const [period, setPeriod] = useState('');
  const [sourceKind, setSourceKind] = useState<SourceKind>('TOP_N');
  const [topN, setTopN] = useState('10');
  const [filterComponent, setFilterComponent] = useState<Component | 'ALL'>('ALL');
  const [filterBand, setFilterBand] = useState<RiskBand | 'ALL'>('ALL');
  const [manualIds, setManualIds] = useState<string[]>([]);
  const [defaultDueDate, setDefaultDueDate] = useState('2026-07-31');
  const [perComponentDue, setPerComponentDue] = useState<Partial<Record<Component, string>>>({});

  const id = nextCampaignId(campaigns.length);

  // Resolve the chosen source to a list of UDO ids (risk-ranked).
  const selectedUdoIds = useMemo<string[]>(() => {
    const source: PopulationSource =
      sourceKind === 'TOP_N'
        ? { kind: 'TOP_N', n: Number(topN) || 0 }
        : sourceKind === 'MANUAL'
          ? { kind: 'MANUAL', udoIds: manualIds }
          : {
              kind: 'SAVED_FILTER',
              filter: {
                ...(filterComponent !== 'ALL' ? { component: filterComponent } : {}),
                ...(filterBand !== 'ALL' ? { band: filterBand } : {}),
              } as SavedFilter,
            };
    return selectPopulation(source, riskScores, population);
  }, [sourceKind, topN, manualIds, filterComponent, filterBand, riskScores, population]);

  // Live preview of the per-component assignment split.
  const preview = useMemo(
    () => generateAssignments(id, selectedUdoIds, population, perComponentDue, defaultDueDate),
    [id, selectedUdoIds, population, perComponentDue, defaultDueDate],
  );

  const canCreate = name.trim() !== '' && period.trim() !== '' && preview.length > 0;

  function createCampaign() {
    if (!canCreate) return;
    dispatch({
      type: 'CREATE_CAMPAIGN',
      campaign: {
        id,
        name: name.trim(),
        objective: objective.trim(),
        period: period.trim(),
        state: 'DRAFT',
        createdBy: MANAGER,
        createdAt: `${asOfDate}T00:00:00.000Z`,
      },
      assignments: preview,
    });
    openCampaign(id);
  }

  const assignmentCountByCampaign = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of assignments) counts.set(a.campaignId, (counts.get(a.campaignId) ?? 0) + 1);
    return counts;
  }, [assignments]);

  return (
    <section aria-labelledby="campaigns-title">
      <h2 id="campaigns-title">Review Campaigns</h2>

      <article className="panel" aria-labelledby="create-title">
        <h3 id="create-title">Create a campaign</h3>
        <div className="filters">
          <label>
            Campaign name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Q3 UDO Review" />
          </label>
          <label>
            Period
            <input
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder="Q3 FY2026"
            />
          </label>
          <label>
            Objective
            <input
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="Review the highest-risk open obligations"
            />
          </label>
          <label>
            Population source
            <select value={sourceKind} onChange={(e) => setSourceKind(e.target.value as SourceKind)}>
              <option value="TOP_N">Top N by risk</option>
              <option value="SAVED_FILTER">Saved filter</option>
              <option value="MANUAL">Manual</option>
            </select>
          </label>

          {sourceKind === 'TOP_N' && (
            <label>
              Top N by risk
              <input
                type="number"
                aria-label="Top N by risk"
                value={topN}
                onChange={(e) => setTopN(e.target.value)}
              />
            </label>
          )}
          {sourceKind === 'SAVED_FILTER' && (
            <>
              <label>
                Filter: component
                <select
                  value={filterComponent}
                  onChange={(e) => setFilterComponent(e.target.value as Component | 'ALL')}
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
                Filter: risk band
                <select
                  value={filterBand}
                  onChange={(e) => setFilterBand(e.target.value as RiskBand | 'ALL')}
                >
                  <option value="ALL">All</option>
                  {BANDS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          {sourceKind === 'MANUAL' && (
            <label>
              Select obligations
              <select
                multiple
                value={manualIds}
                onChange={(e) =>
                  setManualIds(Array.from(e.target.selectedOptions, (o) => o.value))
                }
              >
                {population.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.id} — {u.vendor}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label>
            Default due date
            <input
              type="date"
              value={defaultDueDate}
              onChange={(e) => setDefaultDueDate(e.target.value)}
            />
          </label>
        </div>

        <h4>Assignment preview</h4>
        <p className="filter-count" role="status">
          {selectedUdoIds.length} obligation(s) across {preview.length} assignment(s)
        </p>
        {preview.length === 0 ? (
          <p>Choose a population that selects at least one obligation.</p>
        ) : (
          <table className="data-table" aria-label="Assignment preview">
            <thead>
              <tr>
                <th>Component</th>
                <th className="num">Obligations</th>
                <th>Due date</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((a) => (
                <tr key={a.component} data-component={a.component}>
                  <td>{a.component}</td>
                  <td className="num" data-count={a.udoIds.length}>
                    {a.udoIds.length}
                  </td>
                  <td>
                    <input
                      type="date"
                      aria-label={`Due date for ${a.component}`}
                      value={a.dueDate}
                      onChange={(e) =>
                        setPerComponentDue((prev) => ({ ...prev, [a.component]: e.target.value }))
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <button
          type="button"
          className="primary-button"
          onClick={createCampaign}
          disabled={!canCreate}
        >
          Create campaign
        </button>
      </article>

      <article className="panel" aria-labelledby="list-title">
        <h3 id="list-title">Campaigns</h3>
        {campaigns.length === 0 ? (
          <p>No campaigns yet. Create one above to scope a review.</p>
        ) : (
          <table className="data-table" aria-label="Campaign list">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Period</th>
                <th>State</th>
                <th className="num">Assignments</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} data-campaign-id={c.id} data-state={c.state}>
                  <td>{c.name}</td>
                  <td>{c.period}</td>
                  <td>
                    <span className="badge" data-state={c.state}>
                      {c.state}
                    </span>
                  </td>
                  <td className="num">{assignmentCountByCampaign.get(c.id) ?? 0}</td>
                  <td>
                    <button type="button" className="link-button" onClick={() => openCampaign(c.id)}>
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>
    </section>
  );
}
