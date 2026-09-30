// R: Compose Plan Review resolution with the existing application batch planner.
import { MilestoneAcceptanceCandidateError } from "./contract8-milestone-acceptance.js";
import { planBatchMutation } from "./contract10-runtime.js";
import { createUnifiedDiff } from "../editing/unified-diff.js";
import { sha256DigestUtf8 } from "../model/sha256.js";
import { applyTextEdits, type TextEdit } from "../mutation/text-edits.js";
import { assessPlanReviewTaskLifecycle } from "../plan-review/lifecycle.js";
import { planReviewBaseText, scanPlanReviewDeclarationBlocks } from "../plan-review/source-lexical.js";
import { parsePlanReviewSource, PLAN_REVIEW_SOURCE_CAPABILITY } from "../plan-review/source.js";
import {
  planPlanReviewCreate,
  planPlanReviewResolve as planCoreResolve,
} from "../plan-review/mutation.js";
import type {
  PlanReviewComposedMutationResult,
  PlanReviewMutationCoreResult,
  PlanReviewMutationOptions,
} from "../plan-review/mutation-types.js";

export { planPlanReviewCreate };

/** Compose a normal Contract 10 batch over Grammar 10 and enforce request retention. */
export function planPlanReviewBatchMutation(
  text: string,
  input: Parameters<typeof planBatchMutation>[1],
  options: Parameters<typeof planBatchMutation>[2] = {},
) {
  const source = parsePlanReviewSource(text, PLAN_REVIEW_SOURCE_CAPABILITY);
  if (!source.ok || source.model === null) {
    throw new TypeError("a valid Grammar 10 Plan Review input is required");
  }
  const lower = planReviewBaseText(text, scanPlanReviewDeclarationBlocks(text));
  const planned = planBatchMutation(lower, input, options);
  return rebindPlanReviewBatchCandidate(text, planned, options);
}

function rebindPlanReviewBatchCandidate(
  text: string,
  planned: ReturnType<typeof planBatchMutation>,
  options: NonNullable<Parameters<typeof planBatchMutation>[2]>,
) {
  const originalDigest = sha256DigestUtf8(text);
  if (planned.updatedText === null) {
    return Object.freeze({ ...planned, originalDigest });
  }
  const versionOffset = text.indexOf("  version 10") + "  version 9".length;
  const lift = (offset: number) => offset >= versionOffset ? offset + 1 : offset;
  const edits: readonly TextEdit[] = Object.freeze(planned.edits.map((edit) =>
    Object.freeze({ ...edit, startOffset: lift(edit.startOffset),
      endOffset: lift(edit.endOffset) })));
  const candidate = applyTextEdits(text, edits);
  const lifecycle = assessPlanReviewTaskLifecycle(text, candidate, "ordinary");
  const checked = parsePlanReviewSource(candidate, PLAN_REVIEW_SOURCE_CAPABILITY);
  const diagnostics = Object.freeze([
    ...planned.diagnostics,
    ...lifecycle.diagnostics,
    ...checked.diagnostics,
  ]);
  const candidateValid = lifecycle.ok && checked.ok;
  const ok = planned.ok && candidateValid;
  const governance = planned.governance;
  return Object.freeze({
    ...planned,
    ok,
    originalDigest,
    updatedDigest: candidateValid ? sha256DigestUtf8(candidate) : null,
    updatedText: candidateValid ? candidate : null,
    changed: candidateValid && candidate !== text,
    diff: candidateValid ? createUnifiedDiff(text, candidate, {
      originalLabel: options.originalLabel ?? "original",
      updatedLabel: options.updatedLabel ?? "candidate",
    }) : null,
    edits: candidateValid ? edits : Object.freeze([]),
    diagnostics,
    diagnosticsTruncated: planned.diagnosticsTruncated || checked.diagnosticsTruncated,
    governance: governance === null ? null : Object.freeze({
      ...governance,
      sourceDigest: originalDigest,
    }),
  });
}

export function planPlanReviewResolve(
  text: string,
  input: unknown,
  options: PlanReviewMutationOptions = {},
): PlanReviewMutationCoreResult {
  return planCoreResolve(text, input, options, {
    composeBatch: (base, request, authority) => {
      try {
        return planBatchMutation(base, request, {
          governance: {
            intent: "persist",
            actor: authority.actor,
            acceptedByOwner: authority.acceptedOwners,
          },
        }) as PlanReviewComposedMutationResult;
      } catch (error) {
        if (!(error instanceof MilestoneAcceptanceCandidateError)) throw error;
        return Object.freeze({
          ok: false, changed: false, originalDigest: sha256DigestUtf8(base),
          updatedDigest: null, updatedText: null, edits: Object.freeze([]),
          diagnostics: error.diagnostics, diagnosticsTruncated: false,
        });
      }
    },
  });
}
