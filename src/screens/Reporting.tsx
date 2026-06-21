// Reporting / Export — SPEC §7.6. CSV + JSON download buttons for each of the
// four artifacts, wired to the Wave 2.4 serializers. Every export is recorded on
// the audit trail (shown here as "Recent exports").

import { useAppState, useAppDispatch } from '../state';
import { ARTIFACT_LABELS, exportArtifact, type ArtifactKind, type ExportFormat } from '../export';

const EXPORTER = 'analyst@dhs.gov';
const ARTIFACTS: ArtifactKind[] = [
  'validated-population',
  'exceptions',
  'deobligation-shortlist',
  'audit-trail',
];
const FORMATS: ExportFormat[] = ['CSV', 'JSON'];

function nowIso(): string {
  return new Date().toISOString();
}

export function Reporting() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const exportEvents = state.auditLog.filter((e) => e.action === 'EXPORT');

  return (
    <section aria-labelledby="reporting-title">
      <h2 id="reporting-title">Reporting / Export</h2>
      <p>Download an evidenced, audit-trailed packet. Each export is recorded below.</p>

      <table className="data-table">
        <thead>
          <tr>
            <th>Artifact</th>
            <th>Download</th>
          </tr>
        </thead>
        <tbody>
          {ARTIFACTS.map((kind) => (
            <tr key={kind}>
              <td>{ARTIFACT_LABELS[kind]}</td>
              <td>
                {FORMATS.map((format) => (
                  <button
                    key={format}
                    type="button"
                    className="primary-button export-button"
                    aria-label={`Export ${ARTIFACT_LABELS[kind]} as ${format}`}
                    onClick={() =>
                      exportArtifact(kind, format, state, dispatch, {
                        user: EXPORTER,
                        timestamp: nowIso(),
                      })
                    }
                  >
                    {format}
                  </button>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Recent exports</h3>
      {exportEvents.length === 0 ? (
        <p>No exports yet.</p>
      ) : (
        <ul className="history" aria-label="Recent exports">
          {exportEvents.map((e, i) => (
            <li key={i}>{e.detail}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
