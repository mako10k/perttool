import {
  applyTextEdits,
  normalizeTextEdits,
  type TextEdit,
} from "./text-edits.js";

interface ValidatedSource<Model, SourceDiagnostic> {
  readonly ok: boolean;
  readonly documentId: string | null;
  readonly model: Model | null;
  readonly diagnostics: readonly SourceDiagnostic[];
  readonly diagnosticsTruncated: boolean;
}

export interface ValidatedSourceFormatResult<SourceDiagnostic> {
  readonly ok: boolean;
  readonly documentId: string | null;
  readonly changed: boolean;
  readonly formattedText: string | null;
  readonly edits: readonly TextEdit[];
  readonly diagnostics: readonly SourceDiagnostic[];
  readonly diagnosticsTruncated: boolean;
}

export interface ValidatedSourceMutationResult<SourceDiagnostic> {
  readonly ok: boolean;
  readonly documentId: string | null;
  readonly changed: boolean;
  readonly updatedText: string | null;
  readonly edits: readonly TextEdit[];
  readonly diagnostics: readonly SourceDiagnostic[];
  readonly diagnosticsTruncated: boolean;
}

export function formatValidatedSource<Model, SourceDiagnostic>(
  text: string,
  parse: (candidate: string) => ValidatedSource<Model, SourceDiagnostic>,
  ownedEdits: (model: Model) => readonly TextEdit[],
  label: string,
  invalidCandidateMessage: string,
): ValidatedSourceFormatResult<SourceDiagnostic> {
  const checked = parse(text);
  if (!checked.ok || checked.model === null) {
    return Object.freeze({
      ok: false,
      documentId: checked.documentId,
      changed: false,
      formattedText: null,
      edits: Object.freeze([]),
      diagnostics: checked.diagnostics,
      diagnosticsTruncated: checked.diagnosticsTruncated,
    });
  }
  const edits = normalizeTextEdits(text, ownedEdits(checked.model), label);
  const formattedText = applyTextEdits(text, edits);
  const repeated = parse(formattedText);
  if (!repeated.ok || repeated.model === null) {
    throw new Error(invalidCandidateMessage);
  }
  return Object.freeze({
    ok: true,
    documentId: checked.documentId,
    changed: formattedText !== text,
    formattedText,
    edits: Object.freeze(edits),
    diagnostics: checked.diagnostics,
    diagnosticsTruncated: checked.diagnosticsTruncated,
  });
}

export function planValidatedSourceMutation<Model, SourceDiagnostic>(
  text: string,
  requestedEdits: readonly TextEdit[],
  parse: (candidate: string) => ValidatedSource<Model, SourceDiagnostic>,
  label: string,
): ValidatedSourceMutationResult<SourceDiagnostic> {
  const original = parse(text);
  if (!original.ok || original.model === null) {
    return Object.freeze({
      ok: false,
      documentId: original.documentId,
      changed: false,
      updatedText: null,
      edits: Object.freeze([]),
      diagnostics: original.diagnostics,
      diagnosticsTruncated: original.diagnosticsTruncated,
    });
  }
  const edits = normalizeTextEdits(text, requestedEdits, label);
  const candidate = applyTextEdits(text, edits);
  const checked = parse(candidate);
  const valid = checked.ok && checked.model !== null;
  return Object.freeze({
    ok: valid,
    documentId: checked.documentId,
    changed: candidate !== text,
    updatedText: valid ? candidate : null,
    edits: valid ? Object.freeze(edits) : Object.freeze([]),
    diagnostics: checked.diagnostics,
    diagnosticsTruncated: checked.diagnosticsTruncated,
  });
}
