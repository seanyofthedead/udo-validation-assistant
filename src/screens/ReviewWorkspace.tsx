// Review Workspace — SPEC §7.5. Human-in-the-loop: confirm the AI verdict or
// override it. SPEC §10 — override requires a non-empty reason, so the Override
// button stays disabled until a reason is entered. Disposition history and the
// audit activity for the selected line are shown alongside.

import { useState } from 'react';
import { useAppState, useAppDispatch } from '../state';
import { useNavigation } from './navigation';
import { VerdictBadge } from '../components';
import type { ReviewDecision, Verdict } from '../domain/types';

const REVIEWER = 'analyst@dhs.gov';
const VERDICTS: Verdict[] = ['VALID', 'QUESTIONABLE', 'INSUFFICIENT_EVIDENCE'];

// Step 6 of the DHS HQ process — the reviewer's operational determination. Distinct
// from the AI's assessment verdict above: this says what HQ will DO with the line.
const DETERMINATIONS: { value: ReviewDecision; label: string }[] = [
  { value: 'VALID', label: 'Valid — keep open' },
  { value: 'LIQUIDATE', label: 'Liquidate — invoice/payment action' },
  { value: 'DEOBLIGATE', label: 'De-obligate — remove excess balance' },
  { value: 'CLOSEOUT', label: 'Closeout required — order complete' },
  { value: 'NEEDS_RESEARCH', label: 'Needs research — insufficient evidence' },
  { value: 'ESCALATE', label: 'Escalate — higher-level review' },
];

function nowIso(): string {
  return new Date().toISOString();
}

export function ReviewWorkspace() {
  const { population, findings, dispositions, auditLog } = useAppState();
  const dispatch = useAppDispatch();
  const { selectedUdoId, navigate } = useNavigation();

  const [overrideVerdict, setOverrideVerdict] = useState<Verdict>('VALID');
  const [reason, setReason] = useState('');
  const [decision, setDecision] = useState<ReviewDecision>('VALID');
  const [justification, setJustification] = useState('');

  const udo = population.find((u) => u.id === selectedUdoId);
  const finding = findings.find((f) => f.udoId === selectedUdoId);

  const udoDispositions = dispositions.filter((d) => d.udoId === selectedUdoId);
  const udoAudit = auditLog.filter((e) => e.udoId === selectedUdoId);
  const reasonValid = reason.trim() !== '';
  const justificationValid = justification.trim() !== '';

  function confirm() {
    if (!udo) return;
    dispatch({ type: 'CONFIRM', udoId: udo.id, user: REVIEWER, timestamp: nowIso() });
  }

  function submitOverride() {
    if (!udo || !reasonValid) return;
    dispatch({
      type: 'OVERRIDE',
      udoId: udo.id,
      overrideVerdict,
      reason: reason.trim(),
      user: REVIEWER,
      timestamp: nowIso(),
    });
    setReason('');
  }

  function recordDetermination() {
    if (!udo || !justificationValid) return;
    dispatch({
      type: 'RECORD_DETERMINATION',
      udoId: udo.id,
      decision,
      reason: justification.trim(),
      user: REVIEWER,
      timestamp: nowIso(),
    });
    setJustification('');
  }

  return (
    <section aria-labelledby="review-title">
      <h2 id="review-title">Review Workspace</h2>

      <label className="picker">
        Select UDO
        <select value={selectedUdoId ?? ''} onChange={(e) => navigate('review', e.target.value)}>
          <option value="" disabled>
            Choose an obligation…
          </option>
          {population.map((u) => (
            <option key={u.id} value={u.id}>
              {u.id} — {u.vendor}
            </option>
          ))}
        </select>
      </label>

      {!udo || !finding ? (
        <p>Select a UDO to review.</p>
      ) : (
        <div className="detail-grid">
          <article className="panel" aria-labelledby="disposition-title">
            <h3 id="disposition-title">Disposition</h3>
            <p>
              AI verdict: <VerdictBadge verdict={finding.verdict} />
            </p>

            <button type="button" onClick={confirm} className="primary-button">
              Confirm AI verdict
            </button>

            <fieldset className="override-form">
              <legend>Override</legend>
              <label>
                New verdict
                <select
                  value={overrideVerdict}
                  onChange={(e) => setOverrideVerdict(e.target.value as Verdict)}
                >
                  {VERDICTS.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Reason (required)
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  aria-describedby="reason-help"
                />
              </label>
              <p id="reason-help" className="filter-count">
                An override cannot be recorded without a reason.
              </p>
              <button
                type="button"
                onClick={submitOverride}
                disabled={!reasonValid}
                className="primary-button"
              >
                Record override
              </button>
            </fieldset>

            <fieldset className="override-form">
              <legend>Reviewer determination</legend>
              <p className="filter-count">
                The operational decision for this line — what HQ will do about it (step 6).
              </p>
              <label>
                Determination
                <select
                  value={decision}
                  onChange={(e) => setDecision(e.target.value as ReviewDecision)}
                >
                  {DETERMINATIONS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Justification (required)
                <textarea
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  rows={3}
                  aria-describedby="determination-help"
                />
              </label>
              <p id="determination-help" className="filter-count">
                A determination cannot be recorded without a justification.
              </p>
              <button
                type="button"
                onClick={recordDetermination}
                disabled={!justificationValid}
                className="primary-button"
              >
                Record determination
              </button>
            </fieldset>
          </article>

          <article className="panel" aria-labelledby="history-title">
            <h3 id="history-title">Disposition history</h3>
            {udoDispositions.length === 0 ? (
              <p>No dispositions yet for this obligation.</p>
            ) : (
              <ul className="history" aria-label="Disposition history list">
                {udoDispositions.map((d, i) => (
                  <li key={i}>
                    <strong>{d.action}</strong>
                    {d.action === 'OVERRIDE' && ` → ${d.overrideVerdict}`}
                    {d.action === 'DETERMINATION' && ` → ${d.reviewDecision}`} by {d.user}
                    {d.reason && <> — “{d.reason}”</>}
                  </li>
                ))}
              </ul>
            )}

            <h3>Activity (audit trail)</h3>
            <ul className="history" aria-label="Audit activity">
              {udoAudit.map((e, i) => (
                <li key={i}>
                  <span className="tag">{e.action}</span> {e.detail}
                </li>
              ))}
            </ul>
          </article>
        </div>
      )}
    </section>
  );
}
