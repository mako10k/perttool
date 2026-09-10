import { createUnifiedDiff } from "../editing/unified-diff.js";
import { governanceMetadataFromDocument } from "../governance/source.js";
import {
  limitDiagnostics,
  normalizeMaxDiagnostics,
  sortDiagnostics,
  type Diagnostic,
} from "../model/diagnostics.js";
import { sha256DigestUtf8 } from "../model/sha256.js";
import {
  applyTextEdits,
  normalizeTextEdits,
  type TextEdit,
} from "../mutation/text-edits.js";
import { splitTemporalSourceLines } from "../temporal-schedule/source-lexical.js";
import { evaluatePlanReviewAuthority } from "./authority.js";
import { digestPlanReviewBasis, projectPlanReviewBasis } from "./basis.js";
import type {
  NormalizedPlanReviewCreateRequestV1,
  NormalizedPlanReviewResolveRequestV1,
  PlanReviewComposedMutationResult,
  PlanReviewMutationCoreResult,
  PlanReviewMutationDependencies,
  PlanReviewMutationOptions,
  PlanReviewMutationPlanBasis,
} from "./mutation-types.js";
import {
  normalizePlanReviewCreateRequest,
  normalizePlanReviewResolveRequest,
} from "./request.js";
import { projectPlanReviewState } from "./projection.js";
import {
  planReviewBaseText,
  scanPlanReviewDeclarationBlocks,
} from "./source-lexical.js";
import {
  parsePlanReviewSource,
  PLAN_REVIEW_SOURCE_CAPABILITY,
} from "./source.js";
import type {
  PlanReviewProjectionV1,
  PlanReviewRequestSource,
  PlanReviewSourceModel,
} from "./source-types.js";

const emptyBasis: PlanReviewMutationPlanBasis = Object.freeze({
  status: "unchanged",
  beforeDigest: null,
  afterDigest: null,
});

function diagnostic(
  code: "PTREV-104" | "PTREV-105" | "PTREV-106" | "PTREV-107" | "PTREV-109",
  message: string,
  data: Readonly<Record<string, unknown>> = {},
): Diagnostic {
  return Object.freeze({
    code,
    severity: "error" as const,
    message,
    helpTopic: "editing",
    data: Object.freeze(data),
  });
}

function failure(
  operation: "create" | "resolve",
  text: string,
  documentId: string | null,
  diagnostics: readonly Diagnostic[],
  options: PlanReviewMutationOptions,
  details: Partial<Pick<PlanReviewMutationCoreResult,
    "requestBefore" | "projectionBefore" | "planReviewAuthority" | "composedMutation">> = {},
): PlanReviewMutationCoreResult {
  const limited = limitDiagnostics(
    sortDiagnostics(diagnostics),
    normalizeMaxDiagnostics(options.maxDiagnostics),
  );
  return Object.freeze({
    operation,
    ok: false,
    documentId,
    changed: false,
    originalDigest: sha256DigestUtf8(text),
    updatedDigest: null,
    updatedText: null,
    diff: null,
    edits: Object.freeze([]),
    requestBefore: details.requestBefore ?? null,
    requestAfter: null,
    projectionBefore: details.projectionBefore ?? null,
    projectionAfter: null,
    planBasis: emptyBasis,
    planReviewAuthority: details.planReviewAuthority ?? null,
    composedMutation: details.composedMutation ?? null,
    diagnostics: limited.diagnostics,
    diagnosticsTruncated: limited.truncated,
  });
}

interface SuccessfulInput {
  readonly operation: "create" | "resolve";
  readonly text: string;
  readonly candidate: string;
  readonly edits: readonly TextEdit[];
  readonly before: PlanReviewSourceModel;
  readonly after: PlanReviewSourceModel;
  readonly requestBefore: PlanReviewRequestSource | null;
  readonly requestAfter: PlanReviewRequestSource;
  readonly planBasis: PlanReviewMutationPlanBasis;
  readonly authority: PlanReviewMutationCoreResult["planReviewAuthority"];
  readonly composedMutation: PlanReviewComposedMutationResult | null;
  readonly diagnostics: readonly Diagnostic[];
  readonly options: PlanReviewMutationOptions;
}

function successful(input: SuccessfulInput): PlanReviewMutationCoreResult {
  const { operation, text, candidate, edits, before, after, requestBefore,
    requestAfter, planBasis, authority, composedMutation, diagnostics, options } = input;
  const limited = limitDiagnostics(
    sortDiagnostics(diagnostics),
    normalizeMaxDiagnostics(options.maxDiagnostics),
  );
  return Object.freeze({
    operation,
    ok: !limited.diagnostics.some(({ severity }) => severity === "error"),
    documentId: before.documentId,
    changed: candidate !== text,
    originalDigest: sha256DigestUtf8(text),
    updatedDigest: sha256DigestUtf8(candidate),
    updatedText: candidate,
    diff: candidate === text ? null : createUnifiedDiff(text, candidate, {
      originalLabel: options.originalLabel ?? "original",
      updatedLabel: options.updatedLabel ?? "candidate",
    }),
    edits,
    requestBefore,
    requestAfter,
    projectionBefore: projectPlanReviewState(before),
    projectionAfter: projectPlanReviewState(after),
    planBasis,
    planReviewAuthority: authority,
    composedMutation,
    diagnostics: limited.diagnostics,
    diagnosticsTruncated: limited.truncated,
  });
}

function validSource(
  operation: "create" | "resolve",
  text: string,
  options: PlanReviewMutationOptions,
): { readonly model: PlanReviewSourceModel } | PlanReviewMutationCoreResult {
  const source = parsePlanReviewSource(text, PLAN_REVIEW_SOURCE_CAPABILITY, options);
  if (!source.ok || source.model === null || source.grammarVersion !== 10) {
    return failure(
      operation,
      text,
      source.documentId,
      source.diagnostics as readonly Diagnostic[],
      options,
    );
  }
  if (
    options.expectedDigest !== undefined &&
    options.expectedDigest !== sha256DigestUtf8(text)
  ) {
    return failure(operation, text, source.documentId, [diagnostic(
      "PTREV-106",
      "Plan Review source binding is stale",
      { cause: "expected_digest_mismatch" },
    )], options);
  }
  return Object.freeze({ model: source.model });
}

function lineEnding(text: string): "\n" | "\r\n" {
  return text.includes("\r\n") ? "\r\n" : "\n";
}

function serializedOpen(request: NormalizedPlanReviewCreateRequestV1, eol: string): string {
  return [
    `plan_review_request ${request.requestId} ${request.taskId}:`,
    "  model 1",
    `  reason ${JSON.stringify(request.reason)}`,
    `  created_at ${request.createdAt}`,
    `  created_by ${request.actor}`,
    ...(request.locator === null ? [] : [`  locator ${JSON.stringify(request.locator)}`]),
  ].join(eol);
}

function createInsertion(text: string, requestId: string, declaration: string): TextEdit {
  const blocks = scanPlanReviewDeclarationBlocks(text);
  const nextRequest = blocks.find(({ id }) => id.localeCompare(requestId, "en") > 0);
  const firstLater = splitTemporalSourceLines(text).find((line) =>
    /^(?:task_relation|plan_seal|task_outcome|assurance_receipt|milestone_criterion_set|milestone_acceptance_receipt|work_event)\b/u.test(line.text)
  );
  const offset = nextRequest?.header.start ?? firstLater?.start ?? text.length;
  const eol = lineEnding(text);
  const prefix = offset > 0 && !text.slice(0, offset).endsWith(`${eol}${eol}`) ? eol : "";
  const suffix = offset === text.length
    ? (text.endsWith(eol) ? eol : `${eol}${eol}`)
    : "";
  return Object.freeze({
    startOffset: offset,
    endOffset: offset,
    replacement: `${prefix}${declaration}${eol}${suffix}`,
  });
}

function requestNamed(model: PlanReviewSourceModel, id: string): PlanReviewRequestSource | null {
  return model.requests.find((request) => request.id === id) ?? null;
}

function exactCreateReplay(
  stored: PlanReviewRequestSource,
  request: NormalizedPlanReviewCreateRequestV1,
): boolean {
  return stored.taskId === request.taskId && stored.reason === request.reason &&
    stored.createdAt === request.createdAt && stored.createdBy === request.actor &&
    stored.locator === request.locator;
}

function replayResult(
  operation: "create" | "resolve",
  text: string,
  model: PlanReviewSourceModel,
  stored: PlanReviewRequestSource,
): PlanReviewMutationCoreResult {
  const digest = sha256DigestUtf8(text);
  const projection = projectPlanReviewState(model);
  return Object.freeze({
    operation,
    ok: true,
    documentId: model.documentId,
    changed: false,
    originalDigest: digest,
    updatedDigest: digest,
    updatedText: text,
    diff: null,
    edits: Object.freeze([]),
    requestBefore: stored,
    requestAfter: stored,
    projectionBefore: projection,
    projectionAfter: projection,
    planBasis: emptyBasis,
    planReviewAuthority: null,
    composedMutation: null,
    diagnostics: Object.freeze([]),
    diagnosticsTruncated: false,
  });
}

export function planPlanReviewCreate(
  text: string,
  input: unknown,
  options: PlanReviewMutationOptions = {},
): PlanReviewMutationCoreResult {
  const checked = validSource("create", text, options);
  if (!("model" in checked)) return checked;
  const normalized = normalizePlanReviewCreateRequest(input);
  if (!normalized.ok || normalized.request === null) {
    return failure("create", text, checked.model.documentId, normalized.diagnostics, options,
      { projectionBefore: projectPlanReviewState(checked.model) });
  }
  const existing = requestNamed(checked.model, normalized.request.requestId);
  if (existing !== null) {
    return exactCreateReplay(existing, normalized.request)
      ? replayResult("create", text, checked.model, existing)
      : failure("create", text, checked.model.documentId, [diagnostic(
          "PTREV-105",
          "Plan Review request identity already has different normalized content",
          { request_id: normalized.request.requestId },
        )], options, { requestBefore: existing, projectionBefore: projectPlanReviewState(checked.model) });
  }
  const edit = createInsertion(
    text,
    normalized.request.requestId,
    serializedOpen(normalized.request, lineEnding(text)),
  );
  const edits = normalizeTextEdits(text, [edit], "Plan Review create");
  const candidate = applyTextEdits(text, edits);
  const after = parsePlanReviewSource(candidate, PLAN_REVIEW_SOURCE_CAPABILITY, options);
  if (!after.ok || after.model === null) {
    return failure("create", text, checked.model.documentId,
      after.diagnostics as readonly Diagnostic[], options,
      { projectionBefore: projectPlanReviewState(checked.model) });
  }
  const created = requestNamed(after.model, normalized.request.requestId);
  if (created === null) throw new Error("Plan Review create candidate lost its request");
  return successful({
    operation: "create", text, candidate, edits, before: checked.model,
    after: after.model, requestBefore: null, requestAfter: created,
    planBasis: emptyBasis, authority: null, composedMutation: null,
    diagnostics: [], options,
  });
}

function exactResolveReplay(
  stored: PlanReviewRequestSource,
  request: NormalizedPlanReviewResolveRequestV1,
): boolean {
  return stored.outcome === request.outcome && stored.resolvedAt === request.resolvedAt &&
    stored.resolvedBy === request.actor && stored.resolutionReason === request.resolutionReason &&
    stored.changeRequestDigest === request.changeRequestDigest;
}

const defaultDependencies: PlanReviewMutationDependencies = Object.freeze({
  composeBatch: () => {
    throw new TypeError("Plan Review plan_changed composition requires an Application batch planner");
  },
});

function reboundComposedMutation(
  result: PlanReviewComposedMutationResult,
  text: string,
  candidate: string,
): PlanReviewComposedMutationResult {
  const sourceDigest = sha256DigestUtf8(text);
  const governance = result["governance"];
  return Object.freeze({
    ...result,
    originalDigest: sourceDigest,
    updatedDigest: sha256DigestUtf8(candidate),
    updatedText: candidate,
    diff: createUnifiedDiff(text, candidate, {
      originalLabel: "original",
      updatedLabel: "candidate",
    }),
    ...(governance === null || typeof governance !== "object"
      ? {}
      : { governance: Object.freeze({
          ...(governance as Readonly<Record<string, unknown>>),
          sourceDigest,
        }) }),
  });
}

function liftGrammar9EditsToGrammar10(
  text: string,
  edits: readonly TextEdit[],
): readonly TextEdit[] {
  const versionStart = text.indexOf("  version 10");
  if (versionStart < 0) {
    throw new Error("Grammar 10 source lost its version field");
  }
  const baseBoundary = versionStart + "  version 9".length;
  const lift = (offset: number) => offset >= baseBoundary ? offset + 1 : offset;
  return Object.freeze(edits.map((edit) => Object.freeze({
    ...edit,
    startOffset: lift(edit.startOffset),
    endOffset: lift(edit.endOffset),
  })));
}

function resolutionEdit(
  stored: PlanReviewRequestSource,
  request: NormalizedPlanReviewResolveRequestV1,
  reviewedSourceDigest: string,
  beforeBasis: string,
  afterBasis: string,
  eol: string,
): TextEdit {
  const fields = [
    `  outcome ${request.outcome}`,
    `  resolved_at ${request.resolvedAt}`,
    `  resolved_by ${request.actor}`,
    `  resolution_reason ${JSON.stringify(request.resolutionReason)}`,
    `  reviewed_source_digest ${reviewedSourceDigest}`,
    ...(request.outcome === "plan_changed" ? [
      `  change_request_digest ${request.changeRequestDigest}`,
      `  plan_basis_before ${beforeBasis}`,
      `  plan_basis_after ${afterBasis}`,
    ] : []),
  ];
  return Object.freeze({
    startOffset: stored.span.end.offset,
    endOffset: stored.span.end.offset,
    replacement: `${eol}${fields.join(eol)}`,
  });
}

interface ResolveContext {
  readonly text: string;
  readonly options: PlanReviewMutationOptions;
  readonly model: PlanReviewSourceModel;
  readonly projectionBefore: PlanReviewProjectionV1;
  readonly request: NormalizedPlanReviewResolveRequestV1;
  readonly stored: PlanReviewRequestSource;
}

function prepareResolve(
  text: string,
  input: unknown,
  options: PlanReviewMutationOptions,
): ResolveContext | PlanReviewMutationCoreResult {
  const checked = validSource("resolve", text, options);
  if (!("model" in checked)) return checked;
  const projectionBefore = projectPlanReviewState(checked.model);
  const normalized = normalizePlanReviewResolveRequest(input);
  if (!normalized.ok || normalized.request === null) {
    return failure("resolve", text, checked.model.documentId,
      normalized.diagnostics, options, { projectionBefore });
  }
  const stored = requestNamed(checked.model, normalized.request.requestId);
  if (stored === null) {
    return failure("resolve", text, checked.model.documentId, [diagnostic(
      "PTREV-104", "Plan Review request does not exist",
      { request_id: normalized.request.requestId },
    )], options, { projectionBefore });
  }
  if (stored.outcome !== null) {
    return exactResolveReplay(stored, normalized.request)
      ? replayResult("resolve", text, checked.model, stored)
      : failure("resolve", text, checked.model.documentId, [diagnostic(
          "PTREV-105", "Plan Review resolution replay does not match stored evidence",
          { request_id: stored.id },
        )], options, { requestBefore: stored, projectionBefore });
  }
  return Object.freeze({
    text, options, model: checked.model, projectionBefore,
    request: normalized.request, stored,
  });
}

interface ResolutionComposition {
  readonly planCandidate: string;
  readonly planEdits: readonly TextEdit[];
  readonly composed: PlanReviewComposedMutationResult | null;
}

function composeResolutionPlan(
  context: ResolveContext,
  dependencies: PlanReviewMutationDependencies,
): ResolutionComposition | PlanReviewMutationCoreResult {
  if (context.request.outcome === "plan_retained") {
    return Object.freeze({
      planCandidate: context.text,
      planEdits: Object.freeze([]),
      composed: null,
    });
  }
  if (context.request.request === null) {
    throw new Error("normalized plan_changed request lost its batch");
  }
  const base = planReviewBaseText(
    context.text,
    scanPlanReviewDeclarationBlocks(context.text),
  );
  const planned = dependencies.composeBatch(base, context.request.request, {
    actor: context.request.actor,
    acceptedOwners: context.request.acceptedOwners,
  });
  const guarded = planned.ok && planned.changed && planned.updatedText !== null &&
    planned.updatedDigest !== null &&
    !planned.diagnostics.some(({ severity }) => severity === "error");
  if (!guarded) {
    return failure("resolve", context.text, context.model.documentId, [
      ...planned.diagnostics,
      diagnostic("PTREV-109",
        "composed Plan Review plan mutation did not satisfy every independent guard",
        { request_id: context.stored.id }),
    ], context.options, {
      requestBefore: context.stored,
      projectionBefore: context.projectionBefore,
      composedMutation: planned,
    });
  }
  const planEdits = liftGrammar9EditsToGrammar10(context.text, planned.edits);
  const planCandidate = applyTextEdits(context.text, planEdits);
  return Object.freeze({
    planCandidate,
    planEdits,
    composed: reboundComposedMutation(planned, context.text, planCandidate),
  });
}

interface ResolutionBasis {
  readonly beforeDigest: string;
  readonly afterDigest: string;
  readonly projection: PlanReviewMutationPlanBasis;
}

function evaluateResolutionBasis(
  context: ResolveContext,
  composition: ResolutionComposition,
): ResolutionBasis | PlanReviewMutationCoreResult {
  const beforeDigest = digestPlanReviewBasis(projectPlanReviewBasis(context.model));
  const probeRequest: NormalizedPlanReviewResolveRequestV1 =
    context.request.outcome === "plan_changed"
      ? Object.freeze({
          ...context.request,
          outcome: "plan_retained" as const,
          request: null,
          canonicalChangeRequest: null,
          changeRequestDigest: null,
        })
      : context.request;
  const probeEdit = resolutionEdit(
    context.stored,
    probeRequest,
    sha256DigestUtf8(composition.planCandidate),
    beforeDigest,
    beforeDigest,
    lineEnding(context.text),
  );
  const probeEdits = normalizeTextEdits(
    context.text,
    [...composition.planEdits, probeEdit],
    "Plan Review basis probe",
  );
  const probe = parsePlanReviewSource(
    applyTextEdits(context.text, probeEdits),
    PLAN_REVIEW_SOURCE_CAPABILITY,
    context.options,
  );
  if (probe.model === null) {
    return failure("resolve", context.text, context.model.documentId, [diagnostic(
      "PTREV-109", "complete Plan Review candidate basis is unavailable",
      { request_id: context.stored.id },
    )], context.options, {
      requestBefore: context.stored,
      projectionBefore: context.projectionBefore,
      composedMutation: composition.composed,
    });
  }
  const afterDigest = digestPlanReviewBasis(projectPlanReviewBasis(probe.model));
  const changed = beforeDigest !== afterDigest;
  if (changed !== (context.request.outcome === "plan_changed")) {
    return failure("resolve", context.text, context.model.documentId, [diagnostic(
      "PTREV-107",
      context.request.outcome === "plan_retained"
        ? "plan_retained requires an unchanged Plan Review basis"
        : "plan_changed requires a changed Plan Review basis",
      { request_id: context.stored.id, before: beforeDigest, after: afterDigest },
    )], context.options, {
      requestBefore: context.stored,
      projectionBefore: context.projectionBefore,
      composedMutation: composition.composed,
    });
  }
  return Object.freeze({
    beforeDigest,
    afterDigest,
    projection: changed
      ? Object.freeze({ status: "changed", beforeDigest, afterDigest })
      : emptyBasis,
  });
}

function finalizeResolution(
  context: ResolveContext,
  composition: ResolutionComposition,
  basis: ResolutionBasis,
): PlanReviewMutationCoreResult {
  const finalEdit = resolutionEdit(
    context.stored,
    context.request,
    sha256DigestUtf8(composition.planCandidate),
    basis.beforeDigest,
    basis.afterDigest,
    lineEnding(context.text),
  );
  const edits = normalizeTextEdits(
    context.text,
    [...composition.planEdits, finalEdit],
    "Plan Review complete resolution",
  );
  const candidate = applyTextEdits(context.text, edits);
  const after = parsePlanReviewSource(
    candidate,
    PLAN_REVIEW_SOURCE_CAPABILITY,
    context.options,
  );
  if (!after.ok || after.model === null) {
    return failure("resolve", context.text, context.model.documentId,
      after.diagnostics as readonly Diagnostic[], context.options, {
        requestBefore: context.stored,
        projectionBefore: context.projectionBefore,
        composedMutation: composition.composed,
      });
  }
  const authority = evaluatePlanReviewAuthority(
    context.stored.id,
    sha256DigestUtf8(context.text),
    sha256DigestUtf8(candidate),
    context.request.actor,
    context.request.acceptedOwners,
    governanceMetadataFromDocument(context.model.baseDocument.document).effective,
  );
  if (!authority.authorized) {
    return failure("resolve", context.text, context.model.documentId, [diagnostic(
      "PTREV-106", "Plan Review resolution authority was not established",
      { request_id: context.stored.id, required_owner: authority.effective_dag_owner },
    )], context.options, {
      requestBefore: context.stored,
      projectionBefore: context.projectionBefore,
      planReviewAuthority: authority,
      composedMutation: composition.composed,
    });
  }
  const resolved = requestNamed(after.model, context.stored.id);
  if (resolved === null) {
    throw new Error("Plan Review resolution candidate lost its request");
  }
  return successful({
    operation: "resolve",
    text: context.text,
    candidate,
    edits,
    before: context.model,
    after: after.model,
    requestBefore: context.stored,
    requestAfter: resolved,
    planBasis: basis.projection,
    authority,
    composedMutation: composition.composed,
    diagnostics: composition.composed?.diagnostics ?? [],
    options: context.options,
  });
}

export function planPlanReviewResolve(
  text: string,
  input: unknown,
  options: PlanReviewMutationOptions = {},
  dependencies: PlanReviewMutationDependencies = defaultDependencies,
): PlanReviewMutationCoreResult {
  const prepared = prepareResolve(text, input, options);
  if ("operation" in prepared) return prepared;
  const composition = composeResolutionPlan(prepared, dependencies);
  if ("operation" in composition) return composition;
  const basis = evaluateResolutionBasis(prepared, composition);
  if ("operation" in basis) return basis;
  return finalizeResolution(prepared, composition, basis);
}
