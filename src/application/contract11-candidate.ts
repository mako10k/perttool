// R: Rebind legacy candidate edits onto a Grammar 10 source and enforce request lifecycle validity.
import { createUnifiedDiff } from "../editing/unified-diff.js";
import type { Diagnostic } from "../model/diagnostics.js";
import { sha256DigestUtf8 } from "../model/sha256.js";
import { applyTextEdits, type TextEdit } from "../mutation/text-edits.js";
import { assessPlanReviewTaskLifecycle } from "../plan-review/lifecycle.js";
import { planReviewBaseText, scanPlanReviewDeclarationBlocks } from "../plan-review/source-lexical.js";
import { parsePlanReviewSource, PLAN_REVIEW_SOURCE_CAPABILITY } from "../plan-review/source.js";

interface Candidate {
  readonly ok: boolean;
  readonly changed: boolean;
  readonly originalDigest: string;
  readonly updatedDigest: string | null;
  readonly updatedText: string | null;
  readonly diff: string | null;
  readonly edits: readonly TextEdit[];
  readonly diagnostics: readonly Diagnostic[];
  readonly diagnosticsTruncated: boolean;
  readonly governance: Readonly<{ writeAuthorized: boolean; sourceDigest: string }> | null;
}

export function liftContract11Candidate<T extends Candidate>(
  text: string,
  planner: (baseText: string) => T,
  options: Readonly<{ originalLabel?: string; updatedLabel?: string }> = {},
): T {
  const source = parsePlanReviewSource(text, PLAN_REVIEW_SOURCE_CAPABILITY);
  if (source.grammarVersion !== 10 || !source.ok || source.model === null) {
    return planner(text);
  }
  const base = planReviewBaseText(text, scanPlanReviewDeclarationBlocks(text));
  const planned = planner(base);
  const originalDigest = sha256DigestUtf8(text);
  if (!planned.ok || planned.updatedText === null || planned.updatedDigest === null) {
    return Object.freeze({ ...planned, originalDigest, changed: false,
      updatedDigest: null, updatedText: null, diff: null, edits: Object.freeze([]) }) as T;
  }
  const versionOffset = text.indexOf("  version 10") + "  version 9".length;
  const lift = (offset: number) => offset >= versionOffset ? offset + 1 : offset;
  const edits = Object.freeze(planned.edits.map((edit) => Object.freeze({
    ...edit, startOffset: lift(edit.startOffset), endOffset: lift(edit.endOffset),
  })));
  const candidate = applyTextEdits(text, edits);
  const lifecycle = assessPlanReviewTaskLifecycle(text, candidate, "ordinary");
  const checked = parsePlanReviewSource(candidate, PLAN_REVIEW_SOURCE_CAPABILITY);
  const valid = lifecycle.ok && checked.ok;
  const diagnostics = Object.freeze([
    ...planned.diagnostics, ...lifecycle.diagnostics, ...checked.diagnostics,
  ]);
  const digest = valid ? sha256DigestUtf8(candidate) : null;
  const governance = planned.governance === null
    ? null
    : Object.freeze({ ...planned.governance, sourceDigest: originalDigest });
  return Object.freeze({
    ...planned, ok: planned.ok && valid, changed: valid && candidate !== text,
    originalDigest, updatedDigest: digest, updatedText: valid ? candidate : null,
    diff: valid ? createUnifiedDiff(text, candidate, {
      originalLabel: options.originalLabel ?? "original",
      updatedLabel: options.updatedLabel ?? "candidate",
    }) : null,
    edits: valid ? edits : Object.freeze([]), diagnostics,
    diagnosticsTruncated: planned.diagnosticsTruncated || checked.diagnosticsTruncated,
    governance,
  }) as T;
}
