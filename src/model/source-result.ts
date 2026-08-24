import {
  countDiagnostics,
  limitDiagnostics,
  sortDiagnostics,
  type Diagnostic,
  type DiagnosticCounts,
} from "./diagnostics.js";

export interface SourceValidationResult<Model, SourceDiagnostic> {
  readonly ok: boolean;
  readonly grammarVersion: number | null;
  readonly documentId: string | null;
  readonly model: Model | null;
  readonly diagnostics: readonly SourceDiagnostic[];
  readonly diagnosticCounts: DiagnosticCounts;
  readonly diagnosticsTruncated: boolean;
}

export function sourceValidationResult<Model, SourceDiagnostic>(
  grammarVersion: number | null,
  documentId: string | null,
  model: Model | null,
  diagnostics: readonly Diagnostic[],
  maximum: number,
  inheritedTruncation = false,
): SourceValidationResult<Model, SourceDiagnostic> {
  const sorted = sortDiagnostics(diagnostics);
  const limited = limitDiagnostics(sorted, maximum);
  const counts = countDiagnostics(sorted);
  return Object.freeze({
    ok: counts.errors === 0,
    grammarVersion,
    documentId,
    model: counts.errors === 0 ? model : null,
    diagnostics: Object.freeze(limited.diagnostics) as unknown as readonly SourceDiagnostic[],
    diagnosticCounts: Object.freeze(counts),
    diagnosticsTruncated: inheritedTruncation || limited.truncated,
  });
}
