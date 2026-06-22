// Campaign Detail — SPEC §5.3 (Phase 3, Wave 6). Shows a campaign's scope and
// lifecycle state, a per-component assignment progress table, and overall
// completion. Lifecycle advances only by a deliberate action: each legal next
// state (from the pure state machine) gets a button that dispatches an audited
// TRANSITION_CAMPAIGN — the platform never auto-advances.

import { useAppState, useAppDispatch } from '../state';
import { useNavigation } from './navigation';
import { LEGAL_CAMPAIGN_TRANSITIONS } from '../domain';
import type { AssignmentState, CampaignState } from '../domain/types';

const MANAGER = 'manager@dhs.gov';

// Wave 6 has no per-line responses yet (those arrive in Wave 7), so progress is
// derived from the assignment's own state: a fresh assignment is 0%.
const PROGRESS: Record<AssignmentState, number> = {
  NOT_STARTED: 0,
  IN_PROGRESS: 50,
  COMPLETE: 100,
};

const TRANSITION_LABEL: Record<CampaignState, string> = {
  DRAFT: 'Return to draft',
  ACTIVE: 'Launch (activate)',
  CLOSING: 'Begin closing',
  CLOSED: 'Close campaign',
};

export function CampaignDetail() {
  const { campaigns, assignments, asOfDate } = useAppState();
  const dispatch = useAppDispatch();
  const { selectedCampaignId, navigate, inspect } = useNavigation();

  const campaign = campaigns.find((c) => c.id === selectedCampaignId);

  if (!campaign) {
    return (
      <section aria-labelledby="campaign-detail-title">
        <h2 id="campaign-detail-title">Campaign Detail</h2>
        <p>
          Select a campaign from the{' '}
          <button type="button" className="link-button" onClick={() => navigate('campaigns')}>
            Review Campaigns
          </button>{' '}
          list.
        </p>
      </section>
    );
  }

  const campaignAssignments = assignments.filter((a) => a.campaignId === campaign.id);
  const nextStates = LEGAL_CAMPAIGN_TRANSITIONS[campaign.state];

  // Overall completion, weighted by obligation count (0% while all NOT_STARTED).
  const totalLines = campaignAssignments.reduce((n, a) => n + a.udoIds.length, 0);
  const overall =
    totalLines === 0
      ? 0
      : Math.round(
          campaignAssignments.reduce((n, a) => n + PROGRESS[a.state] * a.udoIds.length, 0) /
            totalLines,
        );

  function transition(to: CampaignState) {
    dispatch({
      type: 'TRANSITION_CAMPAIGN',
      campaignId: campaign!.id,
      to,
      user: MANAGER,
      timestamp: `${asOfDate}T00:00:00.000Z`,
    });
  }

  return (
    <section aria-labelledby="campaign-detail-title">
      <h2 id="campaign-detail-title">{campaign.name}</h2>

      <article className="panel">
        <p className="finding-verdict">
          <span className="badge" data-state={campaign.state}>
            {campaign.state}
          </span>{' '}
          <span className="confidence" data-overall-progress={overall}>
            {overall}% complete
          </span>
        </p>
        <dl className="record">
          <dt>Period</dt>
          <dd>{campaign.period}</dd>
          <dt>Objective</dt>
          <dd>{campaign.objective}</dd>
          <dt>Created by</dt>
          <dd>{campaign.createdBy}</dd>
        </dl>

        <div className="filters" aria-label="Lifecycle actions">
          {nextStates.length === 0 ? (
            <p>This campaign is closed — no further transitions.</p>
          ) : (
            nextStates.map((to) => (
              <button
                key={to}
                type="button"
                className="primary-button"
                data-transition-to={to}
                onClick={() => transition(to)}
              >
                {TRANSITION_LABEL[to]}
              </button>
            ))
          )}
        </div>
      </article>

      <article className="panel" aria-labelledby="progress-title">
        <h3 id="progress-title">Per-component assignments</h3>
        <table className="data-table" aria-label="Assignment progress">
          <thead>
            <tr>
              <th>Component</th>
              <th className="num">Obligations</th>
              <th>Due date</th>
              <th>State</th>
              <th className="num">Progress</th>
            </tr>
          </thead>
          <tbody>
            {campaignAssignments.map((a) => (
              <tr key={a.id} data-component={a.component} data-assignment-state={a.state}>
                <td>{a.component}</td>
                <td className="num">{a.udoIds.length}</td>
                <td>{a.dueDate}</td>
                <td>{a.state}</td>
                <td className="num" data-progress={PROGRESS[a.state]}>
                  {PROGRESS[a.state]}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h4>Obligations in this campaign</h4>
        <ul className="history" aria-label="Campaign obligations">
          {campaignAssignments.flatMap((a) =>
            a.udoIds.map((udoId) => (
              <li key={udoId}>
                <button type="button" className="link-button" onClick={() => inspect(udoId)}>
                  {udoId}
                </button>{' '}
                <span className="tag">{a.component}</span>
              </li>
            )),
          )}
        </ul>
      </article>
    </section>
  );
}
