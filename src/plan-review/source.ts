import { milestoneAcceptanceBaseText } from "../milestone-acceptance/source.js";
import { canonicalizeEventDateTimeSourceToken } from "../model/calendar.js";
import {
  normalizeMaxDiagnostics,
  type Diagnostic,
  type SourceSpan,
} from "../model/diagnostics.js";
import { sourceValidationResult } from "../model/source-result.js";
import {
  planningPoolBaseText,
  scanPlanningDeclarationBlocks,
  declaredPlanningGrammarVersion,
} from "../planning-pool/source-lexical.js";
import {
  parsePlanningPoolSource,
  PLANNING_POOL_SOURCE_CAPABILITY,
} from "../planning-pool/source.js";
import {
  validateTargetGrammar6Document,
} from "../semantic/target-validator.js";
import { TARGET_GRAMMAR_6_CAPABILITY } from "../parser/document-parser.js";
import {
  scanTemporalDeclarationBlocks,
  sourceLineSpan,
  splitTemporalSourceLines,
  temporalScheduleBaseText,
} from "../temporal-schedule/source-lexical.js";
import { parseQuotedString } from "../temporal-schedule/source-values.js";
import {
  malformedPlanReviewHeaderLines,
  planReviewBaseText,
  planReviewFields,
  scanPlanReviewDeclarationBlocks,
  type PlanReviewDeclarationBlock,
  type PlanReviewFieldBlock,
} from "./source-lexical.js";
import type {
  PlanReviewOutcome,
  PlanReviewRequestSource,
  PlanReviewSourceCapability,
  PlanReviewSourceDiagnostic,
  PlanReviewSourceModel,
  PlanReviewSourceResult,
} from "./source-types.js";

export const PLAN_REVIEW_SOURCE_MODEL_VERSION = 1 as const;

export const PLAN_REVIEW_SOURCE_CAPABILITY: PlanReviewSourceCapability =
  Object.freeze({
    id: "perttool.target-grammar-10-plan-review-source",
    version: 1,
    grammarVersion: 10,
  });

export const PLAN_REVIEW_SOURCE_LIMITS = Object.freeze({
  sourceOrCandidateUtf8Bytes: 8_388_608,
  requests: 10_000,
  reasonUtf8Bytes: 16_384,
  resolutionReasonUtf8Bytes: 16_384,
  locatorUtf8Bytes: 8_192,
});

export const PLAN_REVIEW_REQUEST_FIELD_ORDER = Object.freeze([
  "model",
  "reason",
  "created_at",
  "created_by",
  "locator",
  "outcome",
  "resolved_at",
  "resolved_by",
  "resolution_reason",
  "reviewed_source_digest",
  "change_request_digest",
  "plan_basis_before",
  "plan_basis_after",
] as const);

const allowedFields = new Set<string>(PLAN_REVIEW_REQUEST_FIELD_ORDER);
const identifierPattern = /^[A-Za-z][A-Za-z0-9_-]*$/u;
const digestPattern = /^sha256:[0-9a-f]{64}$/u;

interface ParseContext {
  readonly text: string;
  readonly documentId: string;
  readonly diagnostics: Diagnostic[];
  readonly currentTaskIds: ReadonlySet<string>;
  readonly baseIds: ReadonlySet<string>;
}

const diagnostic = (
  code: "PTREV-101" | "PTREV-102" | "PTREV-103" | "PTREV-107",
  message: string,
  span: SourceSpan,
  entityId?: string,
): Diagnostic => Object.freeze({
  code, severity: "error" as const, message, span,
  ...(entityId === undefined ? {} : { entityId }),
  helpTopic: "syntax", data: Object.freeze({}),
});

function addDiagnostic(
  context: ParseContext,
  code: "PTREV-101" | "PTREV-102" | "PTREV-103" | "PTREV-107",
  message: string,
  span: SourceSpan,
  entityId?: string,
): void {
  context.diagnostics.push(diagnostic(code, message, span, entityId));
}

function fieldsNamed(
  block: PlanReviewDeclarationBlock,
  name: string,
): readonly PlanReviewFieldBlock[] {
  return planReviewFields(block).filter((field) => field.name === name);
}

function singleField(
  context: ParseContext,
  block: PlanReviewDeclarationBlock,
  name: string,
  required: boolean,
): PlanReviewFieldBlock | null {
  const values = fieldsNamed(block, name);
  if (values.length > 1) {
    addDiagnostic(
      context,
      "PTREV-101",
      `Duplicate plan_review_request.${name}`,
      values[1]!.span,
      block.id,
    );
  }
  if (required && values.length === 0) {
    addDiagnostic(
      context,
      "PTREV-101",
      `plan_review_request ${block.id} requires ${name}`,
      block.idSpan,
      block.id,
    );
  }
  return values[0] ?? null;
}

function stringValue(
  context: ParseContext,
  block: PlanReviewDeclarationBlock,
  field: PlanReviewFieldBlock | null,
  label: string,
  nonempty: boolean,
  maximum: number,
): string | null {
  if (field === null) return null;
  const value = parseQuotedString(field.rawValue);
  if (value === null || (nonempty && value.length === 0)) {
    addDiagnostic(context, "PTREV-101", `Invalid ${label}`, field.valueSpan, block.id);
    return null;
  }
  if (new TextEncoder().encode(value).byteLength > maximum) {
    addDiagnostic(context, "PTREV-103", `${label} exceeds ${maximum} UTF-8 bytes`, field.valueSpan, block.id);
  }
  return value;
}

function actorValue(
  context: ParseContext,
  block: PlanReviewDeclarationBlock,
  field: PlanReviewFieldBlock | null,
  label: string,
): string | null {
  if (field === null) return null;
  if (!identifierPattern.test(field.rawValue)) {
    addDiagnostic(context, "PTREV-101", `Invalid ${label}`, field.valueSpan, block.id);
    return null;
  }
  return field.rawValue;
}

function instantValue(
  context: ParseContext,
  block: PlanReviewDeclarationBlock,
  field: PlanReviewFieldBlock | null,
  label: string,
): string | null {
  if (field === null) return null;
  const value = canonicalizeEventDateTimeSourceToken(field.rawValue);
  if (value === null) {
    addDiagnostic(context, "PTREV-101", `Invalid ${label}`, field.valueSpan, block.id);
    return null;
  }
  return value;
}

function digestValue(
  context: ParseContext,
  block: PlanReviewDeclarationBlock,
  field: PlanReviewFieldBlock | null,
  label: string,
): string | null {
  if (field === null) return null;
  if (!digestPattern.test(field.rawValue)) {
    addDiagnostic(context, "PTREV-101", `Invalid ${label}`, field.valueSpan, block.id);
    return null;
  }
  return field.rawValue;
}

function validateFieldSurface(
  context: ParseContext,
  block: PlanReviewDeclarationBlock,
): void {
  const fields = planReviewFields(block);
  const covered = new Set(fields.map(({ line }) => line.start));
  for (const field of fields) {
    if (!allowedFields.has(field.name)) {
      addDiagnostic(
        context,
        "PTREV-101",
        `Unknown plan_review_request field ${field.name}`,
        field.span,
        block.id,
      );
    }
  }
  for (const line of block.lines) {
    if (covered.has(line.start) || line.text === "" || /^\s*#/u.test(line.text)) continue;
    addDiagnostic(
      context,
      "PTREV-101",
      "Invalid plan_review_request field or indentation",
      sourceLineSpan(line),
      block.id,
    );
  }
}

function expectedFieldOrder(
  outcome: PlanReviewOutcome | null,
  locator: boolean,
): readonly string[] {
  const prefix = ["model", "reason", "created_at", "created_by"];
  if (locator) prefix.push("locator");
  if (outcome === null) return prefix;
  const resolved = [
    "outcome",
    "resolved_at",
    "resolved_by",
    "resolution_reason",
    "reviewed_source_digest",
  ];
  if (outcome === "plan_changed") {
    resolved.push("change_request_digest", "plan_basis_before", "plan_basis_after");
  }
  return [...prefix, ...resolved];
}

interface ParsedResolution {
  readonly resolvedAt: string | null;
  readonly resolvedBy: string | null;
  readonly resolutionReason: string | null;
  readonly reviewedSourceDigest: string | null;
  readonly changeRequestDigest: string | null;
  readonly planBasisBefore: string | null;
  readonly planBasisAfter: string | null;
}

function parsedOutcome(
  context: ParseContext,
  block: PlanReviewDeclarationBlock,
  field: PlanReviewFieldBlock | null,
): PlanReviewOutcome | null {
  if (field?.rawValue === "plan_retained" || field?.rawValue === "plan_changed") {
    return field.rawValue;
  }
  if (field !== null) {
    addDiagnostic(context, "PTREV-101", "Invalid Plan Review outcome", field.valueSpan, block.id);
  }
  return null;
}

function parsedResolution(
  context: ParseContext,
  block: PlanReviewDeclarationBlock,
  outcome: PlanReviewOutcome | null,
): ParsedResolution {
  const resolved = outcome !== null;
  const changed = outcome === "plan_changed";
  const resolvedAtField = singleField(context, block, "resolved_at", resolved);
  const resolvedByField = singleField(context, block, "resolved_by", resolved);
  const reasonField = singleField(context, block, "resolution_reason", resolved);
  const reviewedField = singleField(context, block, "reviewed_source_digest", resolved);
  const changeField = singleField(context, block, "change_request_digest", changed);
  const beforeField = singleField(context, block, "plan_basis_before", changed);
  const afterField = singleField(context, block, "plan_basis_after", changed);
  const values = {
    resolvedAt: instantValue(context, block, resolvedAtField, "Plan Review resolved_at"),
    resolvedBy: actorValue(context, block, resolvedByField, "Plan Review resolved_by"),
    resolutionReason: stringValue(context, block, reasonField, "Plan Review resolution_reason", true, PLAN_REVIEW_SOURCE_LIMITS.resolutionReasonUtf8Bytes),
    reviewedSourceDigest: digestValue(context, block, reviewedField, "Plan Review reviewed_source_digest"),
    changeRequestDigest: digestValue(context, block, changeField, "Plan Review change_request_digest"),
    planBasisBefore: digestValue(context, block, beforeField, "Plan Review plan_basis_before"),
    planBasisAfter: digestValue(context, block, afterField, "Plan Review plan_basis_after"),
  };
  if (changed && values.planBasisBefore !== null && values.planBasisBefore === values.planBasisAfter) {
    addDiagnostic(context, "PTREV-107", "plan_changed requires different before and after Plan Review basis digests", afterField!.valueSpan, block.id);
  }
  return values;
}

function resolutionComplete(
  outcome: PlanReviewOutcome | null,
  value: ParsedResolution,
): boolean {
  if (outcome === null) return true;
  const resolution = value.resolvedAt !== null && value.resolvedBy !== null &&
    value.resolutionReason !== null && value.reviewedSourceDigest !== null;
  return outcome === "plan_retained" ? resolution : resolution &&
    value.changeRequestDigest !== null && value.planBasisBefore !== null && value.planBasisAfter !== null;
}

function parseRequest(
  context: ParseContext,
  block: PlanReviewDeclarationBlock,
): PlanReviewRequestSource | null {
  validateFieldSurface(context, block);
  const modelField = singleField(context, block, "model", true);
  const reasonField = singleField(context, block, "reason", true);
  const createdAtField = singleField(context, block, "created_at", true);
  const createdByField = singleField(context, block, "created_by", true);
  const locatorField = singleField(context, block, "locator", false);
  const outcomeField = singleField(context, block, "outcome", false);
  const outcome = parsedOutcome(context, block, outcomeField);
  if (modelField !== null && modelField.rawValue !== "1") {
    addDiagnostic(context, "PTREV-101", "Plan Review model must be 1", modelField.valueSpan, block.id);
  }
  const actualOrder = planReviewFields(block).map(({ name }) => name);
  const expectedOrder = expectedFieldOrder(outcome, locatorField !== null);
  if (
    actualOrder.length !== expectedOrder.length ||
    actualOrder.some((name, index) => name !== expectedOrder[index])
  ) {
    addDiagnostic(context, "PTREV-101", "Invalid Plan Review field set or canonical order", block.span, block.id);
  }

  const reason = stringValue(
    context,
    block,
    reasonField,
    "Plan Review reason",
    true,
    PLAN_REVIEW_SOURCE_LIMITS.reasonUtf8Bytes,
  );
  const createdAt = instantValue(context, block, createdAtField, "Plan Review created_at");
  const createdBy = actorValue(context, block, createdByField, "Plan Review created_by");
  const locator = stringValue(
    context,
    block,
    locatorField,
    "Plan Review locator",
    false,
    PLAN_REVIEW_SOURCE_LIMITS.locatorUtf8Bytes,
  );
  const resolution = parsedResolution(context, block, outcome);
  const current = context.currentTaskIds.has(block.taskId);
  if (outcome === null && !current) {
    addDiagnostic(
      context,
      "PTREV-102",
      `Open Plan Review request ${block.id} references unknown Task ${block.taskId}`,
      block.taskIdSpan,
      block.id,
    );
  }
  if (
    modelField?.rawValue !== "1" ||
    reason === null ||
    createdAt === null ||
    createdBy === null ||
    !resolutionComplete(outcome, resolution)
  ) return null;
  return Object.freeze({
    kind: "plan_review_request" as const,
    id: block.id,
    qualifiedId: `${context.documentId}::${block.id}`,
    taskId: block.taskId,
    qualifiedTaskId: `${context.documentId}::${block.taskId}`,
    taskReferenceState: current ? "current" as const : "historical" as const,
    model: 1 as const,
    reason,
    createdAt,
    createdBy,
    locator,
    outcome,
    ...resolution,
    span: block.span,
    idSpan: block.idSpan,
    taskIdSpan: block.taskIdSpan,
  });
}

function topLevelIds(text: string): ReadonlySet<string> {
  const result = new Set<string>();
  for (const line of splitTemporalSourceLines(text)) {
    if (/^\s/u.test(line.text) || /^#/u.test(line.text)) continue;
    const match = /^(?:\uFEFF)?[a-z_]+ ([A-Za-z][A-Za-z0-9_-]*)/u.exec(line.text);
    if (match !== null) result.add(match[1]!);
  }
  return result;
}

function currentTaskIds(text: string): ReadonlySet<string> {
  return new Set(splitTemporalSourceLines(text).flatMap((line) => {
    const match = /^task ([A-Za-z][A-Za-z0-9_-]*) /u.exec(line.text);
    return match === null ? [] : [match[1]!];
  }));
}

function validateIdentities(
  context: ParseContext,
  blocks: readonly PlanReviewDeclarationBlock[],
): void {
  const seen = new Set<string>();
  for (const block of blocks) {
    if (context.baseIds.has(block.id) || seen.has(block.id)) {
      addDiagnostic(context, "PTREV-101", `Duplicate Plan Review identity ${block.id}`, block.idSpan, block.id);
    }
    seen.add(block.id);
  }
}

function validateDeclarationPlacement(
  context: ParseContext,
  blocks: readonly PlanReviewDeclarationBlock[],
): void {
  const planning = scanPlanningDeclarationBlocks(context.text);
  const lastPlanning = planning.at(-1)?.span.end.offset ?? -1;
  const firstLater = splitTemporalSourceLines(context.text).find((line) =>
    /^(?:task_relation|plan_seal|task_outcome|assurance_receipt|milestone_criterion_set|milestone_acceptance_receipt|work_event)\b/u.test(line.text)
  )?.start ?? Number.POSITIVE_INFINITY;
  for (const block of blocks) {
    if (block.header.start < lastPlanning || block.header.start > firstLater) {
      addDiagnostic(
        context,
        "PTREV-101",
        "Plan Review declaration is outside its canonical declaration region",
        block.span,
        block.id,
      );
    }
  }
}

function strictBaseDocument(text: string) {
  const grammar8 = planningPoolBaseText(text, scanPlanningDeclarationBlocks(text));
  const grammar7 = temporalScheduleBaseText(grammar8, scanTemporalDeclarationBlocks(grammar8));
  return validateTargetGrammar6Document(
    milestoneAcceptanceBaseText(grammar7),
    TARGET_GRAMMAR_6_CAPABILITY,
    { maxDiagnostics: 1_000 },
  );
}

function result(
  grammarVersion: number | null,
  documentId: string | null,
  model: PlanReviewSourceModel | null,
  diagnostics: readonly Diagnostic[],
  maximum: number,
  inheritedTruncation = false,
): PlanReviewSourceResult {
  return sourceValidationResult<PlanReviewSourceModel, PlanReviewSourceDiagnostic>(
    grammarVersion,
    documentId,
    model,
    diagnostics,
    maximum,
    inheritedTruncation,
  );
}

function earlySourceResult(
  text: string,
  maximum: number,
): PlanReviewSourceResult | null {
  const grammarVersion = declaredPlanningGrammarVersion(text);
  if (Number.isSafeInteger(grammarVersion) && grammarVersion >= 1 && grammarVersion <= 9) {
    const legacy = parsePlanningPoolSource(text, PLANNING_POOL_SOURCE_CAPABILITY, { maxDiagnostics: maximum });
    return Object.freeze({ ...legacy, model: null }) as PlanReviewSourceResult;
  }
  const firstLine = splitTemporalSourceLines(text)[0];
  if (grammarVersion !== 10 || firstLine === undefined) {
    const diagnostics = firstLine === undefined ? [] : [diagnostic(
      "PTREV-101",
      "Plan Review source requires Grammar 1 through 10",
      sourceLineSpan(firstLine),
    )];
    return result(null, null, null, diagnostics, maximum);
  }
  if (new TextEncoder().encode(text).byteLength > PLAN_REVIEW_SOURCE_LIMITS.sourceOrCandidateUtf8Bytes) {
    return result(10, null, null, [diagnostic(
      "PTREV-103",
      "Plan Review source exceeds the byte limit",
      sourceLineSpan(firstLine),
    )], maximum);
  }
  return null;
}

export function parsePlanReviewSource(
  text: string,
  capability: PlanReviewSourceCapability,
  options: Readonly<{ maxDiagnostics?: number }> = {},
): PlanReviewSourceResult {
  if (capability !== PLAN_REVIEW_SOURCE_CAPABILITY) {
    throw new TypeError("the target Grammar 10 Plan Review source capability is required");
  }
  const maximum = normalizeMaxDiagnostics(options.maxDiagnostics);
  const early = earlySourceResult(text, maximum);
  if (early !== null) return early;
  const blocks = scanPlanReviewDeclarationBlocks(text);
  if (blocks.length > PLAN_REVIEW_SOURCE_LIMITS.requests) {
    return result(10, null, null, [diagnostic(
      "PTREV-103",
      `Plan Review request count ${blocks.length} exceeds ${PLAN_REVIEW_SOURCE_LIMITS.requests}`,
      blocks[PLAN_REVIEW_SOURCE_LIMITS.requests]!.span,
    )], maximum);
  }
  const lowerText = planReviewBaseText(text, blocks);
  const lower = parsePlanningPoolSource(lowerText, PLANNING_POOL_SOURCE_CAPABILITY, { maxDiagnostics: 1_000 });
  const diagnostics: Diagnostic[] = [...(lower.diagnostics as readonly Diagnostic[])];
  for (const line of malformedPlanReviewHeaderLines(text, blocks)) {
    diagnostics.push(diagnostic("PTREV-101", "Invalid Plan Review declaration header", sourceLineSpan(line)));
  }
  if (!lower.ok || lower.model === null || lower.documentId === null) {
    return result(10, lower.documentId, null, diagnostics, maximum, lower.diagnosticsTruncated);
  }
  const strict = strictBaseDocument(lowerText);
  diagnostics.push(...strict.diagnostics);
  if (!strict.ok || strict.validatedDocument === null) {
    return result(10, lower.documentId, null, diagnostics, maximum, strict.diagnosticsTruncated);
  }
  const context: ParseContext = {
    text,
    documentId: lower.documentId,
    diagnostics,
    currentTaskIds: currentTaskIds(lowerText),
    baseIds: topLevelIds(lowerText),
  };
  validateIdentities(context, blocks);
  validateDeclarationPlacement(context, blocks);
  const requests = blocks.map((block) => parseRequest(context, block))
    .filter((request): request is PlanReviewRequestSource => request !== null);
  const model: PlanReviewSourceModel = Object.freeze({
    schemaVersion: "Perttool.PlanReviewRequestModel.v1",
    modelVersion: PLAN_REVIEW_SOURCE_MODEL_VERSION,
    grammarVersion: 10,
    documentId: lower.documentId,
    qualifiedNamespace: lower.documentId,
    base: lower.model,
    baseDocument: strict.validatedDocument,
    requests: Object.freeze(requests),
  });
  return result(10, lower.documentId, model, diagnostics, maximum, lower.diagnosticsTruncated || strict.diagnosticsTruncated);
}

export function planReviewSourceModel(
  source: PlanReviewSourceResult,
): PlanReviewSourceModel {
  if (!source.ok || source.model === null) {
    throw new TypeError("a valid Grammar 10 Plan Review source result is required");
  }
  return source.model;
}
