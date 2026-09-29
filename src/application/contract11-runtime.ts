// R: Expose Grammar 10 Plan Review reads through the existing application analysis contract.
import * as contract10 from "./contract10-runtime.js";
import { parsePlanReviewSource, PLAN_REVIEW_SOURCE_CAPABILITY } from "../plan-review/source.js";
import { planReviewBaseText, scanPlanReviewDeclarationBlocks } from "../plan-review/source-lexical.js";
import { projectPlanReviewState } from "../plan-review/projection.js";
import type { PlanReviewProjectionV1 } from "../plan-review/source-types.js";

export type Contract11NextResult = Omit<ReturnType<typeof contract10.selectNextTasks>, "schemaVersion"> & {
  readonly schemaVersion: "Perttool.NextResult.v9";
  readonly planReview: PlanReviewProjectionV1 | null;
};

function isGrammar10(text: string): boolean {
  return /^  version 10$/mu.test(text);
}

function baseText(text: string): string {
  return planReviewBaseText(text, scanPlanReviewDeclarationBlocks(text));
}

export function planReviewProjection(text: string): PlanReviewProjectionV1 | null {
  if (!isGrammar10(text)) return Object.freeze({
    model_version: 1, state: "clear", open_request_ids: Object.freeze([]),
    required_actions: Object.freeze([]),
  });
  const source = parsePlanReviewSource(text, PLAN_REVIEW_SOURCE_CAPABILITY);
  return source.ok && source.model !== null ? projectPlanReviewState(source.model) : null;
}

function reviewRead<Options extends Readonly<{ maxDiagnostics?: number }>, Result>(
  text: string,
  options: Options,
  read: (source: string, options: Options) => Result,
): Result {
  if (!isGrammar10(text)) return read(text, options);
  const source = parsePlanReviewSource(text, PLAN_REVIEW_SOURCE_CAPABILITY, options);
  const result = read(baseText(text), options) as Readonly<{
    ok: boolean;
    grammarVersion: number | null;
    documentId: string | null;
    diagnostics: readonly unknown[];
    diagnosticsTruncated: boolean;
  }>;
  return Object.freeze({
    ...result,
    grammarVersion: 10,
    documentId: source.documentId,
    ok: result.ok && source.ok,
    diagnostics: Object.freeze([...result.diagnostics, ...source.diagnostics]),
    diagnosticsTruncated: result.diagnosticsTruncated || source.diagnosticsTruncated,
  }) as unknown as Result;
}

export function checkDocument(
  text: string,
  options: Parameters<typeof contract10.checkDocument>[1] = {},
): ReturnType<typeof contract10.checkDocument> {
  if (!isGrammar10(text)) return contract10.checkDocument(text, options);
  const source = parsePlanReviewSource(text, PLAN_REVIEW_SOURCE_CAPABILITY, options);
  const merged = reviewRead(text, options, contract10.checkDocument);
  const counts = source.diagnostics.reduce((value, item) => ({
    errors: value.errors + Number(item.severity === "error"),
    warnings: value.warnings + Number(item.severity === "warning"),
  }), { errors: 0, warnings: 0 });
  return Object.freeze({
    ...merged,
    document: Object.freeze({ ...merged.document, text }),
    summary: Object.freeze({
      ...merged.summary,
      errors: merged.summary.errors + counts.errors,
      warnings: merged.summary.warnings + counts.warnings,
    }),
  });
}

export function analyzeDocument(
  text: string,
  options: Parameters<typeof contract10.analyzeDocument>[1] = {},
): ReturnType<typeof contract10.analyzeDocument> {
  return reviewRead(text, options, contract10.analyzeDocument);
}

export function selectNextTasks(
  text: string,
  options: Parameters<typeof contract10.selectNextTasks>[1] = {},
): Contract11NextResult {
  const result = reviewRead(text, options, contract10.selectNextTasks);
  return Object.freeze({
    ...result,
    schemaVersion: "Perttool.NextResult.v9",
    planReview: planReviewProjection(text),
  });
}
