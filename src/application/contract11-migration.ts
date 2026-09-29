// R: Prepare lossless Grammar 9 to 10 migration with a single version-token edit.
import { createUnifiedDiff } from "../editing/unified-diff.js";
import { sha256DigestUtf8 } from "../model/sha256.js";
import { parsePlanningPoolSource, PLANNING_POOL_SOURCE_CAPABILITY } from "../planning-pool/source.js";
import { parsePlanReviewSource, PLAN_REVIEW_SOURCE_CAPABILITY } from "../plan-review/source.js";
import type { TextEdit } from "../mutation/text-edits.js";

export function planContract11GrammarMigration(text: string) {
  const source = parsePlanReviewSource(text, PLAN_REVIEW_SOURCE_CAPABILITY);
  const originalDigest = sha256DigestUtf8(text);
  const existing = source.grammarVersion === 10 && source.ok;
  const prior = source.grammarVersion === 9
    ? parsePlanningPoolSource(text, PLANNING_POOL_SOURCE_CAPABILITY)
    : null;
  const version = /^  version 9$/mu.exec(text);
  if (existing || (prior?.ok && version !== null)) {
    const edit: TextEdit | null = existing ? null : Object.freeze({
      startOffset: version!.index + "  version ".length,
      endOffset: version!.index + "  version 9".length,
      replacement: "10",
    });
    const candidateText = edit === null ? text
      : `${text.slice(0, edit.startOffset)}10${text.slice(edit.endOffset)}`;
    const checked = parsePlanReviewSource(candidateText, PLAN_REVIEW_SOURCE_CAPABILITY);
    if (!checked.ok) throw new Error("Grammar 10 migration candidate failed validation");
    return Object.freeze({
      ok: true, documentId: checked.documentId,
      sourceGrammarVersion: existing ? 10 : 9, targetGrammarVersion: 10,
      changed: edit !== null, candidateText, updatedText: candidateText,
      originalDigest, updatedDigest: sha256DigestUtf8(candidateText),
      diff: edit === null ? null : createUnifiedDiff(text, candidateText,
        { originalLabel: "original", updatedLabel: "candidate" }),
      edits: Object.freeze(edit === null ? [] : [edit]),
      migratedTaskIds: Object.freeze([]), requiredAction: null,
      diagnostics: checked.diagnostics, diagnosticsTruncated: checked.diagnosticsTruncated,
    });
  }
  return Object.freeze({
    ok: false, documentId: source.documentId,
    sourceGrammarVersion: source.grammarVersion, targetGrammarVersion: 10,
    changed: false, candidateText: null, updatedText: null,
    originalDigest, updatedDigest: null, diff: null,
    edits: Object.freeze([] as TextEdit[]),
    migratedTaskIds: Object.freeze([]), requiredAction: null,
    diagnostics: source.diagnostics, diagnosticsTruncated: source.diagnosticsTruncated,
  });
}
