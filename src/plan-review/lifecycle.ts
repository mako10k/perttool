// R: Enforce Plan Review request retention when Task identities change.
import type { Diagnostic } from "../model/diagnostics.js";
import { scanTemporalDeclarationBlocks } from "../temporal-schedule/source-lexical.js";
import {
  planReviewFields,
  scanPlanReviewDeclarationBlocks,
  type PlanReviewDeclarationBlock,
} from "./source-lexical.js";
import {
  parsePlanReviewSource,
  PLAN_REVIEW_SOURCE_CAPABILITY,
} from "./source.js";
import type { PlanReviewRequestSource } from "./source-types.js";

export interface PlanReviewLifecycleAssessment {
  readonly ok: boolean;
  readonly removedTaskIds: readonly string[];
  readonly removedRequestIds: readonly string[];
  readonly blockingRequestIds: readonly string[];
  readonly diagnostics: readonly Diagnostic[];
}

function declarationBytes(text: string, block: PlanReviewDeclarationBlock): string {
  return text.slice(block.header.start, block.lines.at(-1)?.end ?? block.header.end);
}

function outcome(block: PlanReviewDeclarationBlock): string | null {
  return planReviewFields(block).find(({ name }) => name === "outcome")?.rawValue ?? null;
}

function taskIds(text: string): ReadonlySet<string> {
  return new Set(scanTemporalDeclarationBlocks(text)
    .filter(({ kind }) => kind === "task").map(({ id }) => id));
}

function error(ids: readonly string[], message: string): Diagnostic {
  return Object.freeze({
    code: "PTREV-108",
    severity: "error" as const,
    message,
    helpTopic: "editing",
    data: Object.freeze({ request_ids: Object.freeze([...ids]) }),
  });
}

interface RequestInspection {
  readonly request: PlanReviewRequestSource;
  readonly inputText: string;
  readonly candidateText: string;
  readonly inputBlock: PlanReviewDeclarationBlock;
  readonly candidateBlock: PlanReviewDeclarationBlock | undefined;
  readonly removedTasks: ReadonlySet<string>;
  readonly mode: "ordinary" | "advance";
}

function inspectRequest(input: RequestInspection): "removed" | "blocked" | "altered" | "retained" {
  const { request, candidateBlock, removedTasks, mode } = input;
  if (candidateBlock === undefined) {
    return mode === "advance" && request.outcome !== null &&
      removedTasks.has(request.taskId) ? "removed" : "blocked";
  }
  if (request.outcome === null && removedTasks.has(request.taskId) &&
      outcome(candidateBlock) !== "plan_changed") return "blocked";
  if (mode === "ordinary" && request.outcome !== null &&
      declarationBytes(input.inputText, input.inputBlock) !==
      declarationBytes(input.candidateText, candidateBlock)) return "altered";
  return "retained";
}

/** Inspect a complete final candidate. The caller must also validate its full Grammar 10 source. */
export function assessPlanReviewTaskLifecycle(
  inputText: string,
  candidateText: string,
  mode: "ordinary" | "advance",
): PlanReviewLifecycleAssessment {
  const input = parsePlanReviewSource(inputText, PLAN_REVIEW_SOURCE_CAPABILITY);
  if (!input.ok || input.model === null) {
    throw new TypeError("a valid Grammar 10 Plan Review input is required");
  }
  const currentTasks = taskIds(candidateText);
  const removedTaskIds = [...taskIds(inputText)].filter((id) => !currentTasks.has(id));
  const removedTasks = new Set(removedTaskIds);
  const inputBlocks = new Map(scanPlanReviewDeclarationBlocks(inputText)
    .map((block) => [block.id, block]));
  const candidateBlocks = new Map(scanPlanReviewDeclarationBlocks(candidateText)
    .map((block) => [block.id, block]));
  const removedRequestIds: string[] = [];
  const blockingRequestIds: string[] = [];
  const alteredResolvedIds: string[] = [];

  for (const request of input.model.requests) {
    const state = inspectRequest({
      request, inputText, candidateText,
      inputBlock: inputBlocks.get(request.id)!,
      candidateBlock: candidateBlocks.get(request.id), removedTasks, mode,
    });
    if (state === "removed") removedRequestIds.push(request.id);
    if (state === "blocked") blockingRequestIds.push(request.id);
    if (state === "altered") alteredResolvedIds.push(request.id);
  }

  const diagnostics: Diagnostic[] = [];
  if (blockingRequestIds.length > 0) diagnostics.push(error(
    blockingRequestIds,
    `Task removal or request deletion would orphan Plan Review request(s): ${blockingRequestIds.join(", ")}`,
  ));
  if (alteredResolvedIds.length > 0) diagnostics.push(error(
    alteredResolvedIds,
    `Ordinary mutation changed resolved Plan Review declaration(s): ${alteredResolvedIds.join(", ")}`,
  ));
  return Object.freeze({
    ok: diagnostics.length === 0,
    removedTaskIds: Object.freeze(removedTaskIds),
    removedRequestIds: Object.freeze(removedRequestIds),
    blockingRequestIds: Object.freeze(blockingRequestIds),
    diagnostics: Object.freeze(diagnostics),
  });
}
