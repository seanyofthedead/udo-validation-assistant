// UDO Detail + AI Findings — SPEC §7.4. Shows the record, linked evidence, and
// the AI finding (verdict, confidence, justification, cited rule, abstain note)
// plus the de-obligation flag and its reasons.

import { useAppState } from '../state';
import { useNavigation } from './navigation';
import { RiskBandChip, VerdictBadge, formatUsd, formatPct, drawdownRatio } from '../components';

export function Detail() {
  const { population, evidence, findings, deobFlags, rules, riskScores } = useAppState();
  const { selectedUdoId, inspect } = useNavigation();

  const udo = population.find((u) => u.id === selectedUdoId);
  const finding = findings.find((f) => f.udoId === selectedUdoId);
  const deob = deobFlags.find((d) => d.udoId === selectedUdoId);
  const udoEvidence = evidence.filter((e) => e.udoId === selectedUdoId);
  const citedRule = rules.find((r) => r.id === finding?.citedRuleId);
  const risk = riskScores.find((r) => r.udoId === selectedUdoId);

  return (
    <section aria-labelledby="detail-title">
      <h2 id="detail-title">UDO Detail</h2>

      <label className="picker">
        Select UDO
        <select value={selectedUdoId ?? ''} onChange={(e) => inspect(e.target.value)}>
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
        <p>Select a UDO to view its details.</p>
      ) : (
        <div className="detail-grid">
          <article aria-labelledby="record-title" className="panel">
            <h3 id="record-title">Obligation record</h3>
            <dl className="record">
              <dt>Component</dt>
              <dd>{udo.component}</dd>
              <dt>Vendor</dt>
              <dd>{udo.vendor}</dd>
              <dt>Description</dt>
              <dd>{udo.description}</dd>
              <dt>Funding type</dt>
              <dd>{udo.fundingType}</dd>
              <dt>Reported status</dt>
              <dd>{udo.reportedStatus}</dd>
              <dt>Obligated</dt>
              <dd>{formatUsd(udo.amountObligated)}</dd>
              <dt>Disbursed</dt>
              <dd>
                {formatUsd(udo.amountDisbursed)} (
                {formatPct(drawdownRatio(udo.amountObligated, udo.amountDisbursed))} drawn)
              </dd>
              <dt>Period of performance ends</dt>
              <dd>{udo.periodOfPerformanceEnd}</dd>
              <dt>Last activity</dt>
              <dd>{udo.lastActivityDate}</dd>
            </dl>

            <h3>Evidence</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Present</th>
                  <th className="num">Amount</th>
                  <th>Ref</th>
                </tr>
              </thead>
              <tbody>
                {udoEvidence.map((e, i) => (
                  <tr key={`${e.type}-${i}`}>
                    <td>{e.type}</td>
                    <td>{e.present ? 'Yes' : 'No'}</td>
                    <td className="num">{e.amount === undefined ? '—' : formatUsd(e.amount)}</td>
                    <td>{e.ref ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>

          <article aria-labelledby="finding-title" className="panel">
            <h3 id="finding-title">AI finding</h3>
            <p className="finding-verdict">
              <VerdictBadge verdict={finding.verdict} />{' '}
              <span className="confidence">confidence {formatPct(finding.confidence)}</span>
            </p>
            <p>
              <strong>QC cross-check:</strong>{' '}
              {finding.qcAgreed ? 'agreed' : 'disagreed (abstained)'}
            </p>
            <p>
              <strong>Cited rule:</strong>{' '}
              {citedRule ? `${citedRule.id} — ${citedRule.description}` : 'none (abstained)'}
            </p>
            <p className="justification">{finding.justification}</p>
            {finding.verdict === 'INSUFFICIENT_EVIDENCE' && (
              <p className="abstain-note" role="note">
                The assistant abstained rather than guess — this line needs analyst review.
              </p>
            )}

            <h3>De-obligation</h3>
            {deob && deob.candidate ? (
              <>
                <p>
                  <strong>Candidate</strong> — estimated recoverable{' '}
                  {formatUsd(deob.estimatedRecoverable)}.
                </p>
                <ul>
                  {deob.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p>Not a de-obligation candidate.</p>
            )}
          </article>

          {risk && (
            <article aria-labelledby="risk-title" className="panel">
              <h3 id="risk-title">Risk assessment</h3>
              <p className="finding-verdict">
                <RiskBandChip band={risk.band} />{' '}
                <span className="confidence">
                  risk score <strong data-risk-score={risk.score}>{risk.score}</strong> / 100
                </span>
              </p>
              <p>
                Every point is attributable to a factor below; the contributions sum to the score
                (SPEC §5.1).
              </p>
              <table className="data-table risk-factors">
                <thead>
                  <tr>
                    <th>Factor</th>
                    <th className="num">Points</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {risk.factors.map((f) => (
                    <tr key={f.name} data-factor={f.name}>
                      <td>{f.name}</td>
                      <td className="num" data-points={f.points}>
                        {f.points}
                      </td>
                      <td>{f.reason}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">Total</th>
                    <td className="num" data-total-score={risk.score}>
                      {risk.factors.reduce((sum, f) => sum + f.points, 0)}
                    </td>
                    <td>
                      Band <strong>{risk.band}</strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </article>
          )}
        </div>
      )}
    </section>
  );
}
