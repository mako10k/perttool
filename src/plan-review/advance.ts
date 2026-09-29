// R: Plan canonical advance cleanup of pre-resolved Plan Review declarations.
import type { Diagnostic } from "../model/diagnostics.js";
import { applyTextEdits, normalizeTextEdits, type TextEdit } from "../mutation/text-edits.js";
import type { PlanningDestructiveRecord } from "../planning-pool/projection.js";
import {
  assessPlanningHistoryBaseline,
  type CanonicalComparableBlock,
  type PlanningHistoryGuard,
} from "../planning-pool/history-guard.js";
import type { AdvanceHistoryBaselineCapture } from "../history/git-probe.js";
import { assessPlanReviewTaskLifecycle } from "./lifecycle.js";
import { scanPlanReviewDeclarationBlocks } from "./source-lexical.js";
import {
  parsePlanReviewSource,
  PLAN_REVIEW_SOURCE_CAPABILITY,
} from "./source.js";

export interface PlanReviewAdvanceCleanup {
  readonly edits: readonly TextEdit[];
  readonly removedRequestIds: readonly string[];
  readonly destructiveRecords: readonly PlanningDestructiveRecord[];
}

export interface PlanReviewAdvanceCandidate {
  readonly ok: boolean;
  readonly updatedText: string | null;
  readonly edits: readonly TextEdit[];
  readonly removedRequestIds: readonly string[];
  readonly blockingRequestIds: readonly string[];
  readonly destructiveRecords: readonly PlanningDestructiveRecord[];
  readonly diagnostics: readonly Diagnostic[];
}

/** Compose these edits with the lower advance before validating the complete final candidate. */
export function planPlanReviewAdvanceCleanup(
  inputText: string,
  removedTaskIds: readonly string[],
): PlanReviewAdvanceCleanup {
  const input = parsePlanReviewSource(inputText, PLAN_REVIEW_SOURCE_CAPABILITY);
  if (!input.ok || input.model === null) {
    throw new TypeError("a valid Grammar 10 Plan Review input is required");
  }
  const removedTasks = new Set(removedTaskIds);
  const removable = new Set(input.model.requests
    .filter(({ outcome, taskId }) => outcome !== null && removedTasks.has(taskId))
    .map(({ id }) => id));
  const selected = scanPlanReviewDeclarationBlocks(inputText)
    .filter(({ id }) => removable.has(id));
  const edits = selected.map((block) => Object.freeze({
    startOffset: block.header.start,
    endOffset: block.lines.at(-1)?.end ?? block.header.end,
    replacement: "",
  }));
  const destructiveRecords = selected.map((block): PlanningDestructiveRecord =>
    Object.freeze({
      ownerClass: "canonical",
      entityKind: "plan_review_request",
      qualifiedId: `${input.model!.documentId}::${block.id}`,
      startOffset: block.header.start,
      endOffset: block.lines.at(-1)?.end ?? block.header.end,
    }));
  return Object.freeze({
    edits: Object.freeze(edits),
    removedRequestIds: Object.freeze(selected.map(({ id }) => id)),
    destructiveRecords: Object.freeze(destructiveRecords),
  });
}

/** Join lower canonical advance edits with request cleanup before any write gate. */
export function composePlanReviewAdvanceCandidate(
  inputText: string,
  lowerEdits: readonly TextEdit[],
  removedTaskIds: readonly string[],
): PlanReviewAdvanceCandidate {
  const cleanup = planPlanReviewAdvanceCleanup(inputText, removedTaskIds);
  const edits = normalizeTextEdits(inputText, [...lowerEdits, ...cleanup.edits],
    "Plan Review canonical advance");
  const candidate = applyTextEdits(inputText, edits);
  const lifecycle = assessPlanReviewTaskLifecycle(inputText, candidate, "advance");
  const checked = parsePlanReviewSource(candidate, PLAN_REVIEW_SOURCE_CAPABILITY);
  const valid = lifecycle.ok && checked.ok;
  return Object.freeze({
    ok: valid,
    updatedText: valid ? candidate : null,
    edits: valid ? edits : Object.freeze([]),
    removedRequestIds: valid ? cleanup.removedRequestIds : Object.freeze([]),
    blockingRequestIds: lifecycle.blockingRequestIds,
    destructiveRecords: valid ? cleanup.destructiveRecords : Object.freeze([]),
    diagnostics: Object.freeze([...lifecycle.diagnostics,
      ...checked.diagnostics as readonly Diagnostic[]]),
  });
}

/** Apply the existing exact HEAD/stage-0 record proof to removed requests. */
export function assessPlanReviewAdvanceHistory(
  inputText: string,
  candidate: PlanReviewAdvanceCandidate,
  baseline: AdvanceHistoryBaselineCapture,
  forceRequested = false,
): PlanningHistoryGuard {
  if (!candidate.ok || candidate.updatedText === null) {
    throw new TypeError("a valid Plan Review advance candidate is required");
  }
  return assessPlanningHistoryBaseline(
    inputText, candidate.destructiveRecords, baseline, forceRequested,
    (source): readonly CanonicalComparableBlock[] =>
      scanPlanReviewDeclarationBlocks(source).map((block) => Object.freeze({
        kind: "plan_review_request", id: block.id,
        startOffset: block.header.start,
        endOffset: block.lines.at(-1)?.end ?? block.header.end,
      })),
  );
}

export { assessPlanReviewTaskLifecycle };
