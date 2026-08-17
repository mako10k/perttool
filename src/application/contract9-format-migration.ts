import { createUnifiedDiff } from "../editing/unified-diff.js";
import { sha256DigestUtf8 } from "../model/sha256.js";
import { normalizeTextEdits, type TextEdit } from "../mutation/text-edits.js";
import { planTemporalConstraintMigration, TEMPORAL_CONSTRAINT_CAPABILITY } from "../temporal-schedule/constraint.js";
import { formatTemporalScheduleSource } from "../temporal-schedule/format.js";
import { TEMPORAL_SCHEDULE_SOURCE_CAPABILITY } from "../temporal-schedule/source.js";
import type { Diagnostic } from "../model/diagnostics.js";

export interface Contract9SourceCandidate {
  readonly ok: boolean; readonly documentId: string | null; readonly changed: boolean; readonly originalDigest: string;
  readonly updatedDigest: string | null; readonly updatedText: string | null; readonly diff: string | null;
  readonly edits: readonly TextEdit[]; readonly diagnostics: readonly Diagnostic[]; readonly diagnosticsTruncated: boolean;
}
function successfulCandidate(text: string, updatedText: string, edits: readonly TextEdit[], documentId: string | null,
  diagnostics: readonly Diagnostic[], diagnosticsTruncated: boolean): Contract9SourceCandidate {
  const originalDigest = sha256DigestUtf8(text);
  return Object.freeze({ ok: true, documentId, changed: updatedText !== text, originalDigest,
    updatedDigest: sha256DigestUtf8(updatedText), updatedText,
    diff: createUnifiedDiff(text, updatedText, { originalLabel: "original", updatedLabel: "candidate" }),
    edits: Object.freeze(edits), diagnostics: Object.freeze(diagnostics), diagnosticsTruncated });
}
function failedCandidate(text: string, documentId: string | null, diagnostics: readonly Diagnostic[],
  diagnosticsTruncated: boolean): Contract9SourceCandidate {
  return Object.freeze({ ok: false, documentId, changed: false, originalDigest: sha256DigestUtf8(text),
    updatedDigest: null, updatedText: null, diff: null, edits: Object.freeze([]),
    diagnostics: Object.freeze(diagnostics), diagnosticsTruncated });
}
export function planContract9Format(text: string): Contract9SourceCandidate {
  const formatted = formatTemporalScheduleSource(text, TEMPORAL_SCHEDULE_SOURCE_CAPABILITY);
  return !formatted.ok || formatted.formattedText === null
    ? failedCandidate(text, formatted.documentId, formatted.diagnostics as readonly Diagnostic[], formatted.diagnosticsTruncated)
    : successfulCandidate(text, formatted.formattedText, formatted.edits, formatted.documentId,
      formatted.diagnostics as readonly Diagnostic[], formatted.diagnosticsTruncated);
}
function migrationEdits(text: string, updatedText: string | null): readonly TextEdit[] {
  if (updatedText === null || updatedText === text) return Object.freeze([]);
  return normalizeTextEdits(text, [Object.freeze({ startOffset: 0, endOffset: text.length, replacement: updatedText })],
    "Grammar 8 migration");
}
function sourceEvidence(source: ReturnType<typeof planTemporalConstraintMigration>["source"]): Readonly<{
  documentId: string | null; diagnostics: readonly Diagnostic[]; diagnosticsTruncated: boolean;
}> {
  if (source === null) return Object.freeze({ documentId: null, diagnostics: Object.freeze([]), diagnosticsTruncated: false });
  return Object.freeze({ documentId: source.documentId, diagnostics: source.diagnostics as readonly Diagnostic[],
    diagnosticsTruncated: source.diagnosticsTruncated });
}
function migrationBase(text: string, migrated: ReturnType<typeof planTemporalConstraintMigration>,
  evidence: ReturnType<typeof sourceEvidence>, edits: readonly TextEdit[]): Contract9SourceCandidate {
  if (!migrated.ok || migrated.updatedText === null) {
    return failedCandidate(text, evidence.documentId, evidence.diagnostics, evidence.diagnosticsTruncated);
  }
  return successfulCandidate(text, migrated.updatedText, edits, evidence.documentId,
    evidence.diagnostics, evidence.diagnosticsTruncated);
}
export function planContract9GrammarMigration(text: string): Contract9SourceCandidate & Readonly<{ sourceGrammarVersion: number | null; targetGrammarVersion: number | null; migratedTaskIds: readonly string[]; requiredAction: string | null }> {
  const migrated = planTemporalConstraintMigration(text, TEMPORAL_CONSTRAINT_CAPABILITY);
  const updatedText = migrated.updatedText;
  const edits = migrationEdits(text, updatedText);
  const evidence = sourceEvidence(migrated.source);
  const base = migrationBase(text, migrated, evidence, edits);
  return Object.freeze({ ...base,
    sourceGrammarVersion: migrated.sourceGrammarVersion, targetGrammarVersion: migrated.targetGrammarVersion,
    migratedTaskIds: migrated.migratedTaskIds, requiredAction: migrated.requiredAction });
}
