import {
  limitDiagnostics,
  normalizeMaxDiagnostics,
  sortDiagnostics,
  type Diagnostic,
  type SourceSpan,
} from "../model/diagnostics.js";
import type { TargetGrammar6Capability } from "../parser/document-parser.js";
import type {
  PlanAssuranceProjectionV1,
  PlanAssuranceRequiredActionV1,
} from "../assurance/authority.js";
import type {
  PlanAssuranceCauseV1,
  PlanAssuranceTaskResultV1,
  Sha256Digest,
} from "../assurance/types.js";
import { TOOL_VERSION } from "../version.js";
import { analyzeTargetPlanAssuranceDocument } from "./target-assurance-analysis.js";

export const PLAN_ASSURANCE_RESULT_SCHEMA_VERSION =
  "Perttool.PlanAssuranceResult.v1" as const;
export const PLAN_ASSURANCE_INSPECTION_CLI_CONTRACT_VERSION = 7 as const;

export type PlanAssuranceHashKind =
  | "contract"
  | "computed-basis"
  | "exported";

export type PlanAssuranceInspectionRequest =
  | {
      readonly operation: "plan-assurance.show";
      readonly taskIds?: readonly string[];
    }
  | {
      readonly operation: "plan-assurance.hash";
      readonly taskId: string;
      readonly kind: PlanAssuranceHashKind;
    };

export interface TargetPlanAssuranceInspectionResultV1 {
  readonly schemaVersion: typeof PLAN_ASSURANCE_RESULT_SCHEMA_VERSION;
  readonly cliContractVersion:
    typeof PLAN_ASSURANCE_INSPECTION_CLI_CONTRACT_VERSION;
  readonly operation: PlanAssuranceInspectionRequest["operation"];
  readonly ok: boolean;
  readonly documentId: string | null;
  readonly grammarVersion: number | null;
  readonly sourceDigest: string;
  readonly selectedTaskIds: readonly string[];
  readonly taskId: string | null;
  readonly kind: PlanAssuranceHashKind | null;
  readonly selectedHash: Sha256Digest | null;
  readonly assurance: PlanAssuranceProjectionV1 | null;
  readonly diagnostics: readonly Diagnostic[];
  readonly diagnosticsTruncated: boolean;
}

const aggregateDiagnosticCodes = new Set([
  "PTASSURE-201",
  "PTASSURE-202",
  "PTASSURE-203",
  "PTASSURE-204",
]);

function assuranceDiagnostic(
  code: "PTASSURE-201" | "PTASSURE-202" | "PTASSURE-203" | "PTASSURE-204" | "PTASSURE-302",
  severity: "error" | "warning",
  message: string,
  entityId: string | null,
  data: Readonly<Record<string, unknown>> = {},
): Diagnostic {
  return Object.freeze({
    code,
    severity,
    message,
    ...(entityId === null ? {} : { entityId }),
    helpTopic: "plan-assurance",
    data: Object.freeze(data),
  });
}

function uniqueTaskIds(values: readonly string[]): readonly string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }
  return Object.freeze(result);
}

function validateRequest(request: PlanAssuranceInspectionRequest): void {
  if (request === null || typeof request !== "object") {
    throw new TypeError("plan assurance inspection request must be an object");
  }
  if (request.operation === "plan-assurance.show") {
    if (
      request.taskIds !== undefined &&
      (
        !Array.isArray(request.taskIds) ||
        request.taskIds.some((taskId) =>
          typeof taskId !== "string" || taskId.length === 0
        )
      )
    ) {
      throw new TypeError("show taskIds must contain nonempty task IDs");
    }
    return;
  }
  if (request.operation !== "plan-assurance.hash") {
    throw new TypeError("plan assurance inspection operation is unsupported");
  }
  if (typeof request.taskId !== "string" || request.taskId.length === 0) {
    throw new TypeError("hash taskId must be a nonempty task ID");
  }
  if (
    request.kind !== "contract" &&
    request.kind !== "computed-basis" &&
    request.kind !== "exported"
  ) {
    throw new TypeError(
      "hash kind must be contract, computed-basis, or exported",
    );
  }
}

function filteredActions(
  actions: readonly PlanAssuranceRequiredActionV1[],
  selected: ReadonlySet<string>,
): readonly PlanAssuranceRequiredActionV1[] {
  return Object.freeze(actions.flatMap((action) => {
    const affectedTaskIds = action.affectedTaskIds.filter((taskId) =>
      selected.has(taskId)
    );
    return affectedTaskIds.length === 0
      ? []
      : [Object.freeze({
          kind: action.kind,
          rootTaskIds: action.rootTaskIds,
          affectedTaskIds: Object.freeze(affectedTaskIds),
        })];
  }));
}

function filterProjection(
  projection: PlanAssuranceProjectionV1,
  selectedTaskIds: readonly string[],
): PlanAssuranceProjectionV1 {
  const selected = new Set(selectedTaskIds);
  const filterIds = (values: readonly string[]) =>
    Object.freeze(values.filter((taskId) => selected.has(taskId)));
  return Object.freeze({
    modelVersion: projection.modelVersion,
    hashModelVersion: projection.hashModelVersion,
    coverage: projection.coverage,
    taskResults: Object.freeze(projection.taskResults.filter(({ taskId }) =>
      selected.has(taskId)
    )),
    directMismatchTaskIds: filterIds(projection.directMismatchTaskIds),
    inheritedMismatchTaskIds: filterIds(projection.inheritedMismatchTaskIds),
    replanRequiredTaskIds: filterIds(projection.replanRequiredTaskIds),
    activeAttentionRequiredTaskIds: filterIds(
      projection.activeAttentionRequiredTaskIds,
    ),
    requiredActions: filteredActions(projection.requiredActions, selected),
  });
}

function projectionDiagnostics(
  projection: PlanAssuranceProjectionV1,
  includeUnavailableWarning: boolean,
): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  if (projection.coverage === "unsealed" || projection.coverage === "partial") {
    diagnostics.push(assuranceDiagnostic(
      "PTASSURE-201",
      "warning",
      "enabled plan assurance has an unsealed or partially sealed task set",
      null,
      { coverage: projection.coverage },
    ));
  }
  if (projection.replanRequiredTaskIds.length > 0) {
    diagnostics.push(assuranceDiagnostic(
      "PTASSURE-202",
      "warning",
      "accepted and computed planning bases differ",
      null,
      { task_ids: projection.replanRequiredTaskIds },
    ));
  }
  const unavailableTaskIds = projection.taskResults
    .filter(({ status }) => status === "unavailable")
    .map(({ taskId }) => taskId);
  if (includeUnavailableWarning && unavailableTaskIds.length > 0) {
    diagnostics.push(assuranceDiagnostic(
      "PTASSURE-203",
      "warning",
      "plan assurance is unavailable for one or more tasks",
      null,
      { task_ids: Object.freeze(unavailableTaskIds) },
    ));
  }
  if (projection.activeAttentionRequiredTaskIds.length > 0) {
    diagnostics.push(assuranceDiagnostic(
      "PTASSURE-204",
      "warning",
      "active work requires attention because its planning basis is no longer usable",
      null,
      { task_ids: projection.activeAttentionRequiredTaskIds },
    ));
  }
  return Object.freeze(diagnostics);
}

function selectedValue(
  result: PlanAssuranceTaskResultV1,
  kind: PlanAssuranceHashKind,
): Sha256Digest | null {
  return kind === "contract"
    ? result.contractHash
    : kind === "computed-basis"
    ? result.computedBasisHash
    : result.exportedAssuranceHash;
}

function limitedDiagnostics(
  diagnostics: readonly Diagnostic[],
  maximum: number,
  alreadyTruncated: boolean,
): Pick<TargetPlanAssuranceInspectionResultV1, "diagnostics" | "diagnosticsTruncated"> {
  const limited = limitDiagnostics(sortDiagnostics(diagnostics), maximum);
  return {
    diagnostics: Object.freeze(limited.diagnostics),
    diagnosticsTruncated: alreadyTruncated || limited.truncated,
  };
}

function limitedDiagnosticsWithLeading(
  leading: readonly Diagnostic[],
  remaining: readonly Diagnostic[],
  maximum: number,
  alreadyTruncated: boolean,
): Pick<TargetPlanAssuranceInspectionResultV1, "diagnostics" | "diagnosticsTruncated"> {
  const ordered = [
    ...sortDiagnostics(leading),
    ...sortDiagnostics(remaining),
  ];
  const limited = limitDiagnostics(ordered, maximum);
  return {
    diagnostics: Object.freeze(limited.diagnostics),
    diagnosticsTruncated: alreadyTruncated || limited.truncated,
  };
}

export function inspectTargetPlanAssurance(
  text: string,
  request: PlanAssuranceInspectionRequest,
  capability: TargetGrammar6Capability,
  options: { readonly maxDiagnostics?: number } = {},
): TargetPlanAssuranceInspectionResultV1 {
  validateRequest(request);
  const maximum = normalizeMaxDiagnostics(options.maxDiagnostics);
  const analyzed = analyzeTargetPlanAssuranceDocument(
    text,
    capability,
    { maxDiagnostics: maximum },
  );
  const common = {
    schemaVersion: PLAN_ASSURANCE_RESULT_SCHEMA_VERSION,
    cliContractVersion: PLAN_ASSURANCE_INSPECTION_CLI_CONTRACT_VERSION,
    operation: request.operation,
    documentId: analyzed.documentId,
    grammarVersion: analyzed.grammarVersion,
    sourceDigest: analyzed.sourceDigest,
  } as const;
  const requestTaskIds = request.operation === "plan-assurance.show"
    ? uniqueTaskIds(request.taskIds ?? [])
    : Object.freeze([request.taskId]);
  if (
    !analyzed.ok ||
    analyzed.analysis === null ||
    analyzed.analysis.assurance === null
  ) {
    return Object.freeze({
      ...common,
      ok: false,
      selectedTaskIds: requestTaskIds,
      taskId: request.operation === "plan-assurance.hash"
        ? request.taskId
        : null,
      kind: request.operation === "plan-assurance.hash" ? request.kind : null,
      selectedHash: null,
      assurance: null,
      diagnostics: analyzed.diagnostics,
      diagnosticsTruncated: analyzed.diagnosticsTruncated,
    });
  }

  const full = analyzed.analysis.assurance;
  const knownTaskIds = new Set(full.taskResults.map(({ taskId }) => taskId));
  const unknownTaskIds = requestTaskIds.filter((taskId) =>
    !knownTaskIds.has(taskId)
  );
  if (unknownTaskIds.length > 0) {
    const added = unknownTaskIds.map((taskId) => assuranceDiagnostic(
      "PTASSURE-302",
      "error",
      `task ${taskId} does not exist`,
      taskId,
      { task_id: taskId },
    ));
    const diagnostics = limitedDiagnosticsWithLeading(
      added,
      analyzed.diagnostics.filter(({ code }) =>
        !aggregateDiagnosticCodes.has(code)
      ),
      maximum,
      analyzed.diagnosticsTruncated,
    );
    return Object.freeze({
      ...common,
      ok: false,
      selectedTaskIds: requestTaskIds,
      taskId: request.operation === "plan-assurance.hash"
        ? request.taskId
        : null,
      kind: request.operation === "plan-assurance.hash" ? request.kind : null,
      selectedHash: null,
      assurance: null,
      ...diagnostics,
    });
  }

  const requested = new Set(requestTaskIds);
  const selectedTaskIds = Object.freeze(full.taskResults
    .filter(({ taskId }) => requestTaskIds.length === 0 || requested.has(taskId))
    .map(({ taskId }) => taskId));
  const assurance = requestTaskIds.length === 0
    ? full
    : filterProjection(full, selectedTaskIds);
  const baseDiagnostics = analyzed.diagnostics.filter(({ code }) =>
    !aggregateDiagnosticCodes.has(code)
  );
  if (request.operation === "plan-assurance.show") {
    const diagnostics = limitedDiagnostics(
      [...baseDiagnostics, ...projectionDiagnostics(assurance, true)],
      maximum,
      analyzed.diagnosticsTruncated,
    );
    return Object.freeze({
      ...common,
      ok: true,
      selectedTaskIds,
      taskId: null,
      kind: null,
      selectedHash: null,
      assurance,
      ...diagnostics,
    });
  }

  const taskResult = assurance.taskResults[0]!;
  const selectedHash = selectedValue(taskResult, request.kind);
  if (selectedHash === null) {
    const unavailable = assuranceDiagnostic(
      "PTASSURE-203",
      "error",
      `task ${request.taskId} has no available ${request.kind} hash`,
      request.taskId,
      { task_id: request.taskId, kind: request.kind },
    );
    const diagnostics = limitedDiagnosticsWithLeading(
      [unavailable],
      [...baseDiagnostics, ...projectionDiagnostics(assurance, false)],
      maximum,
      analyzed.diagnosticsTruncated,
    );
    return Object.freeze({
      ...common,
      ok: false,
      selectedTaskIds,
      taskId: request.taskId,
      kind: request.kind,
      selectedHash: null,
      assurance,
      ...diagnostics,
    });
  }
  const diagnostics = limitedDiagnostics(
    [...baseDiagnostics, ...projectionDiagnostics(assurance, true)],
    maximum,
    analyzed.diagnosticsTruncated,
  );
  return Object.freeze({
    ...common,
    ok: true,
    selectedTaskIds,
    taskId: request.taskId,
    kind: request.kind,
    selectedHash,
    assurance,
    ...diagnostics,
  });
}

function positionToJson(position: SourceSpan["start"]): {
  readonly offset: number;
  readonly line: number;
  readonly column: number;
} {
  return {
    offset: position.offset,
    line: position.line + 1,
    column: position.column + 1,
  };
}

function spanToJson(span: SourceSpan): Readonly<Record<string, unknown>> {
  return {
    start: positionToJson(span.start),
    end: positionToJson(span.end),
  };
}

function diagnosticToJson(
  diagnostic: Diagnostic,
): Readonly<Record<string, unknown>> {
  return {
    code: diagnostic.code,
    severity: diagnostic.severity,
    message: diagnostic.message,
    entity_id: diagnostic.entityId ?? null,
    span: diagnostic.span === undefined ? null : spanToJson(diagnostic.span),
    related: (diagnostic.related ?? []).map(({ message, span }) => ({
      message,
      span: spanToJson(span),
    })),
    help_topic: null,
    guide_topic: diagnostic.helpTopic ?? null,
    expected_syntax: diagnostic.expectedSyntax ?? null,
    fixes: [],
    data: diagnostic.data ?? {},
  };
}

function causeToJson(cause: PlanAssuranceCauseV1): Readonly<Record<string, unknown>> {
  return {
    kind: cause.kind,
    direct: cause.direct,
    root_task_id: cause.rootTaskId,
    affected_task_id: cause.affectedTaskId,
    path_task_ids: cause.pathTaskIds,
  };
}

function taskResultToJson(
  result: PlanAssuranceTaskResultV1,
): Readonly<Record<string, unknown>> {
  return {
    task_id: result.taskId,
    status: result.status,
    outcome_status: result.outcomeStatus,
    contract_hash: result.contractHash,
    computed_basis_hash: result.computedBasisHash,
    accepted_basis_hash: result.acceptedBasisHash,
    computed_inputs: result.computedInputs.map((input) => ({
      predecessor_task_id: input.predecessorTaskId,
      relation_mode: input.relationMode,
      assurance_hash: input.assuranceHash,
    })),
    exported_assurance_hash: result.exportedAssuranceHash,
    direct_causes: result.directCauses.map(causeToJson),
    inherited_causes: result.inheritedCauses.map(causeToJson),
  };
}

function assuranceToJson(
  assurance: PlanAssuranceProjectionV1 | null,
): Readonly<Record<string, unknown>> | null {
  if (assurance === null) return null;
  return {
    model_version: assurance.modelVersion,
    hash_model_version: assurance.hashModelVersion,
    coverage: assurance.coverage,
    task_results: assurance.taskResults.map(taskResultToJson),
    direct_mismatch_task_ids: assurance.directMismatchTaskIds,
    inherited_mismatch_task_ids: assurance.inheritedMismatchTaskIds,
    replan_required_task_ids: assurance.replanRequiredTaskIds,
    active_attention_required_task_ids:
      assurance.activeAttentionRequiredTaskIds,
    required_actions: assurance.requiredActions.map((action) => ({
      kind: action.kind,
      root_task_ids: action.rootTaskIds,
      affected_task_ids: action.affectedTaskIds,
    })),
  };
}

export function targetPlanAssuranceInspectionResultToJson(
  result: TargetPlanAssuranceInspectionResultV1,
  source: string,
): Readonly<Record<string, unknown>> {
  return {
    schema_version: result.schemaVersion,
    cli_contract_version: result.cliContractVersion,
    tool_version: TOOL_VERSION,
    operation: result.operation,
    ok: result.ok,
    document_id: result.documentId,
    source,
    source_digest: result.sourceDigest,
    diagnostics: result.diagnostics.map(diagnosticToJson),
    diagnostics_truncated: result.diagnosticsTruncated,
    grammar_version: result.grammarVersion,
    selected_task_ids: result.selectedTaskIds,
    task_id: result.taskId,
    kind: result.kind,
    selected_hash: result.selectedHash,
    assurance: assuranceToJson(result.assurance),
  };
}

export function serializeTargetPlanAssuranceInspectionResult(
  result: TargetPlanAssuranceInspectionResultV1,
  source: string,
): string {
  return `${JSON.stringify(targetPlanAssuranceInspectionResultToJson(
    result,
    source,
  ))}\n`;
}

function scalar(value: string | number | null): string {
  return value === null ? "-" : String(value);
}

export function renderTargetPlanAssuranceInspectionText(
  result: TargetPlanAssuranceInspectionResultV1,
): string {
  if (!result.ok) return "";
  if (result.operation === "plan-assurance.hash") {
    return result.selectedHash === null ? "" : `${result.selectedHash}\n`;
  }
  const assurance = result.assurance;
  if (assurance === null) return "";
  const lines = [
    `PLAN_ASSURANCE coverage=${scalar(assurance.coverage)} model=${
      scalar(assurance.modelVersion)
    } hash_model=${scalar(assurance.hashModelVersion)} selected=${
      result.selectedTaskIds.length === 0 ? "-" : result.selectedTaskIds.join(",")
    }`,
  ];
  for (const task of assurance.taskResults) {
    lines.push(
      `TASK task=${task.taskId} status=${task.status} outcome=${
        task.outcomeStatus
      } contract=${scalar(task.contractHash)} computed_basis=${
        scalar(task.computedBasisHash)
      } accepted_basis=${scalar(task.acceptedBasisHash)} exported=${
        scalar(task.exportedAssuranceHash)
      }`,
    );
    for (const cause of [...task.directCauses, ...task.inheritedCauses]) {
      lines.push(
        `CAUSE task=${task.taskId} kind=${cause.kind} direct=${
          cause.direct
        } root=${cause.rootTaskId} path=${cause.pathTaskIds.join(",")}`,
      );
    }
  }
  for (const action of assurance.requiredActions) {
    lines.push(
      `ACTION kind=${action.kind} roots=${
        action.rootTaskIds.length === 0 ? "-" : action.rootTaskIds.join(",")
      } affected=${
        action.affectedTaskIds.length === 0
          ? "-"
          : action.affectedTaskIds.join(",")
      }`,
    );
  }
  return `${lines.join("\n")}\n`;
}
