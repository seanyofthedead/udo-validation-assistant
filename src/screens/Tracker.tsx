// Escalations & De-Obligation Tracker — SPEC §4 (Escalation Workflow) and §5.7
// (De-Obligation Opportunity Tracker), Phase 3 Wave 7. Two HQ-facing panels:
//   1. An escalation banner: re-evaluate (a deterministic, audited engine run)
//      and list every line needing attention now — overdue, contested, high-$,
//      or manually flagged — with its level and plain-language reason.
//   2. A de-ob opportunity list with its lifecycle: a human moves each candidate
//      Identified → Under Review → Confirmed/Rejected, with a MANDATORY reason on
//      the terminal disposition (the platform proposes; it never auto-posts).
// Confirmed recoverable dollars roll up at the top for leadership.

import { useState } from 'react';
import { useAppState, useAppDispatch } from '../state';
import { useNavigation } from './navigation';
import type { DeobState } from '../domain/types';

const ANALYST = 'analyst@dhs.gov';

function usd(amount: number): string {
  return `$${amount.toLocaleString('en-US')}`;
}

export function Tracker() {
  const { escalations, deobOpportunities, asOfDate } = useAppState();
  const dispatch = useAppDispatch();
  const { inspect } = useNavigation();

  // Per-opportunity disposition reason (only the terminal moves require one).
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const reasonFor = (udoId: string) => reasons[udoId] ?? '';
  const setReason = (udoId: string, value: string) =>
    setReasons((prev) => ({ ...prev, [udoId]: value }));

  const ts = `${asOfDate}T00:00:00.000Z`;

  function evaluate() {
    dispatch({ type: 'RAISE_ESCALATIONS', timestamp: ts });
  }

  function moveDeob(udoId: string, to: DeobState) {
    dispatch({ type: 'TRANSITION_DEOB', udoId, to, reason: reasonFor(udoId), user: ANALYST, timestamp: ts });
  }

  const confirmedDollars = deobOpportunities
    .filter((o) => o.state === 'CONFIRMED')
    .reduce((sum, o) => sum + o.estimatedRecoverable, 0);

  return (
    <section aria-labelledby="tracker-title">
      <h2 id="tracker-title">Escalations &amp; De-Obligation Tracker</h2>

      <article className="panel" aria-labelledby="escalations-title">
        <h3 id="escalations-title">Escalations</h3>
        <button type="button" className="primary-button" onClick={evaluate}>
          Re-evaluate escalations
        </button>
        {escalations.length === 0 ? (
          <p data-escalation-empty>No escalations as of {asOfDate}. Re-evaluate to refresh.</p>
        ) : (
          <ul className="history" aria-label="Escalation list">
            {escalations.map((e) => (
              <li key={e.id} data-trigger={e.trigger} data-target={e.target} data-level={e.level}>
                <span className="tag">{e.trigger}</span>{' '}
                <button type="button" className="link-button" onClick={() => inspect(e.target)}>
                  {e.target}
                </button>{' '}
                <span className="badge" data-level={e.level}>
                  L{e.level}
                </span>{' '}
                — {e.reason}
              </li>
            ))}
          </ul>
        )}
      </article>

      <article className="panel" aria-labelledby="deob-title">
        <h3 id="deob-title">De-obligation opportunities</h3>
        <p className="filter-count" role="status">
          {deobOpportunities.length} opportunity(ies) · {usd(confirmedDollars)} confirmed recoverable
        </p>
        {deobOpportunities.length === 0 ? (
          <p>No de-obligation opportunities identified.</p>
        ) : (
          <table className="data-table" aria-label="De-ob opportunities">
            <thead>
              <tr>
                <th>Obligation</th>
                <th className="num">Recoverable</th>
                <th>State</th>
                <th>Disposition</th>
              </tr>
            </thead>
            <tbody>
              {deobOpportunities.map((o) => {
                const reasonValid = reasonFor(o.udoId).trim() !== '';
                return (
                  <tr key={o.udoId} data-udo-id={o.udoId} data-deob-state={o.state}>
                    <td>
                      <button type="button" className="link-button" onClick={() => inspect(o.udoId)}>
                        {o.udoId}
                      </button>
                    </td>
                    <td className="num">{usd(o.estimatedRecoverable)}</td>
                    <td>
                      <span className="badge" data-state={o.state}>
                        {o.state}
                      </span>
                    </td>
                    <td>
                      {o.state === 'IDENTIFIED' && (
                        <button
                          type="button"
                          className="primary-button"
                          aria-label={`Begin review ${o.udoId}`}
                          onClick={() => moveDeob(o.udoId, 'UNDER_REVIEW')}
                        >
                          Begin review
                        </button>
                      )}
                      {o.state === 'UNDER_REVIEW' && (
                        <div className="filters">
                          <label>
                            Reason (required)
                            <textarea
                              aria-label={`De-ob reason for ${o.udoId}`}
                              rows={2}
                              value={reasonFor(o.udoId)}
                              onChange={(e) => setReason(o.udoId, e.target.value)}
                            />
                          </label>
                          <button
                            type="button"
                            className="primary-button"
                            aria-label={`Confirm de-ob ${o.udoId}`}
                            disabled={!reasonValid}
                            onClick={() => moveDeob(o.udoId, 'CONFIRMED')}
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            aria-label={`Reject de-ob ${o.udoId}`}
                            disabled={!reasonValid}
                            onClick={() => moveDeob(o.udoId, 'REJECTED')}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      {(o.state === 'CONFIRMED' || o.state === 'REJECTED') && o.disposition && (
                        <span data-disposition-reason>
                          {o.disposition.action} — “{o.disposition.reason}”
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </article>
    </section>
  );
}
