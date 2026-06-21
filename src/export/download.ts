// Blob download side effect + export orchestrator. Separated from serialize.ts
// so the serializers stay pure. exportArtifact() builds the payload, triggers a
// browser download, and dispatches a RECORD_EXPORT so the action is audited.

import type { Dispatch } from 'react';
import type { AppAction, AppState } from '../state/store';
import {
  ARTIFACT_LABELS,
  buildExport,
  type ArtifactKind,
  type ExportFormat,
  type ExportPayload,
} from './serialize';

/** Trigger a client-side file download for an already-built payload. */
export function triggerDownload(payload: ExportPayload): void {
  const blob = new Blob([payload.content], { type: payload.mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = payload.filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * Build + download an artifact and audit the export. The timestamp is passed in
 * (no clock read here) so callers stay deterministic. Returns the payload.
 */
export function exportArtifact(
  kind: ArtifactKind,
  format: ExportFormat,
  state: AppState,
  dispatch: Dispatch<AppAction>,
  opts: { user: string; timestamp: string },
): ExportPayload {
  const payload = buildExport(kind, format, state);
  triggerDownload(payload);
  dispatch({
    type: 'RECORD_EXPORT',
    artifact: ARTIFACT_LABELS[kind],
    format,
    user: opts.user,
    timestamp: opts.timestamp,
  });
  return payload;
}
