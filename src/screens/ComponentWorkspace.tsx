// Component Response Workspace — SPEC §5.4 (Phase 3, Wave 7). A component-scoped
// view of the lines HQ has assigned: for each line the FM concurs with the AI
// verdict, contests it, or proposes a corrected status, attaches a (mock)
// evidence reference, and submits to HQ. The mandatory-reason discipline mirrors
// a Phase 1 override: the Submit button stays disabled for a CONTEST/CORRECT
// until a reason is entered, and the store rejects a blank-reason response as a
// no-op even if a caller bypasses the button.

import { useMemo, useState } from 'react';
import { useAppState, useAppDispatch } from '../state';
import { VerdictBadge } from '../components';
import type { Component, ReportedStatus, ResponseAction } from '../domain/types';

const ACTIONS: ResponseAction[] = ['CONCUR', 'CONTEST', 'CORRECT'];
const STATUSES: ReportedStatus[] = ['OPEN_ACTIVE', 'OPEN_INACTIVE', 'PENDING_CLOSE', 'CLOSED'];

interface LineDraft {
  action: ResponseAction;
  correctedStatus: ReportedStatus;
  reason: string;
  evidence: string;
}

const EMPTY_DRAFT: LineDraft = {
  action: 'CONCUR',
  correctedStatus: 'CLOSED',
  reason: '',
  evidence: '',
};

/** A reason is mandatory unless the component simply concurs (SPEC §5.4). */
function needsReason(action: ResponseAction): boolean {
  return action !== 'CONCUR';
}

export function ComponentWorkspace() {
  const { assignments, population, findings, responses, asOfDate } = useAppState();
  const dispatch = useAppDispatch();

  // Only components that actually have assigned work are selectable.
  const componentsWithWork = useMemo(() => {
    const seen = new Set<Component>();
    for (const a of assignments) seen.add(a.component);
    return [...seen];
  }, [assignments]);

  const [picked, setPicked] = useState<Component | ''>('');
  const selected: Component | '' = picked || componentsWithWork[0] || '';

  const [drafts, setDrafts] = useState<Record<string, LineDraft>>({});
  const draftFor = (udoId: string): LineDraft => drafts[udoId] ?? EMPTY_DRAFT;
  const patchDraft = (udoId: string, patch: Partial<LineDraft>) =>
    setDrafts((prev) => ({ ...prev, [udoId]: { ...(prev[udoId] ?? EMPTY_DRAFT), ...patch } }));

  const recordById = useMemo(() => new Map(population.map((u) => [u.id, u])), [population]);
  const findingById = useMemo(() => new Map(findings.map((f) => [f.udoId, f])), [findings]);

  const myAssignments = assignments.filter((a) => a.component === selected);

  function responseFor(assignmentId: string, udoId: string) {
    return responses.find((r) => r.assignmentId === assignmentId && r.udoId === udoId);
  }

  function submit(assignmentId: string, udoId: string) {
    const d = draftFor(udoId);
    if (needsReason(d.action) && d.reason.trim() === '') return; // guarded; store also rejects
    dispatch({
      type: 'SUBMIT_RESPONSE',
      draft: {
        assignmentId,
        udoId,
        action: d.action,
        ...(d.action === 'CORRECT' ? { correctedStatus: d.correctedStatus } : {}),
        reason: d.reason,
        evidenceRefs: d.evidence.trim() ? [d.evidence.trim()] : [],
      },
      user: `fm@${(selected || 'component').toLowerCase()}.dhs.gov`,
      timestamp: `${asOfDate}T00:00:00.000Z`,
    });
  }

  return (
    <section aria-labelledby="workspace-title">
      <h2 id="workspace-title">Component Response Workspace</h2>

      {componentsWithWork.length === 0 ? (
        <p>No assignments yet. A campaign manager must launch a review with assignments first.</p>
      ) : (
        <>
          <label className="picker">
            Component
            <select
              aria-label="Component"
              value={selected}
              onChange={(e) => setPicked(e.target.value as Component)}
            >
              {componentsWithWork.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          {myAssignments.map((a) => (
            <article
              key={a.id}
              className="panel"
              aria-labelledby={`asg-${a.id}`}
              data-assignment-id={a.id}
            >
              <h3 id={`asg-${a.id}`}>
                {a.component} — due {a.dueDate}{' '}
                <span className="badge" data-assignment-state={a.state}>
                  {a.state}
                </span>
              </h3>
              <table className="data-table" aria-label={`Assigned lines ${a.id}`}>
                <thead>
                  <tr>
                    <th>Obligation</th>
                    <th>AI verdict</th>
                    <th>Response</th>
                    <th>Reason / evidence</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {a.udoIds.map((udoId) => {
                    const record = recordById.get(udoId);
                    const finding = findingById.get(udoId);
                    const d = draftFor(udoId);
                    const existing = responseFor(a.id, udoId);
                    const submitDisabled = needsReason(d.action) && d.reason.trim() === '';
                    return (
                      <tr key={udoId} data-udo-id={udoId}>
                        <td>
                          {udoId}
                          <br />
                          <span className="filter-count">{record?.vendor}</span>
                        </td>
                        <td>{finding ? <VerdictBadge verdict={finding.verdict} /> : '—'}</td>
                        <td>
                          <select
                            aria-label={`Response action for ${udoId}`}
                            value={d.action}
                            onChange={(e) =>
                              patchDraft(udoId, { action: e.target.value as ResponseAction })
                            }
                          >
                            {ACTIONS.map((act) => (
                              <option key={act} value={act}>
                                {act}
                              </option>
                            ))}
                          </select>
                          {d.action === 'CORRECT' && (
                            <select
                              aria-label={`Corrected status for ${udoId}`}
                              value={d.correctedStatus}
                              onChange={(e) =>
                                patchDraft(udoId, {
                                  correctedStatus: e.target.value as ReportedStatus,
                                })
                              }
                            >
                              {STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td>
                          {needsReason(d.action) && (
                            <textarea
                              aria-label={`Reason for ${udoId}`}
                              rows={2}
                              value={d.reason}
                              onChange={(e) => patchDraft(udoId, { reason: e.target.value })}
                              placeholder="Required for contest / correct"
                            />
                          )}
                          <input
                            aria-label={`Evidence reference for ${udoId}`}
                            value={d.evidence}
                            onChange={(e) => patchDraft(udoId, { evidence: e.target.value })}
                            placeholder="mock://upload/…"
                          />
                        </td>
                        <td data-response-state={existing?.state ?? ''} data-response-action={existing?.action ?? ''}>
                          {existing ? `${existing.state} · ${existing.action}` : 'No response'}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="primary-button"
                            aria-label={`Submit ${udoId}`}
                            disabled={submitDisabled}
                            onClick={() => submit(a.id, udoId)}
                          >
                            {existing ? 'Resubmit' : 'Submit to HQ'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </article>
          ))}
        </>
      )}
    </section>
  );
}
