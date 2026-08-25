import { projectPlanAssuranceAnalysis, type PlanAssuranceRequiredActionV1 } from "../assurance/authority.js";
import type { PlanAssuranceProjectionV1 } from "../assurance/authority.js";
import { sha256DigestUtf8 } from "../model/sha256.js";
import type { Diagnostic } from "../model/diagnostics.js";
import type { PlanAssuranceHashKind, PlanAssuranceInspectionRequest } from "./target-assurance-inspection.js";
import { inspectPlanAssurance as inspectContract8PlanAssurance } from "./contract8-milestone-acceptance.js";
import { TARGET_GRAMMAR_6_CAPABILITY } from "../parser/document-parser.js";
import { parseTemporalScheduleSource, TEMPORAL_SCHEDULE_SOURCE_CAPABILITY } from "../temporal-schedule/source.js";
import { evaluateContract9PlanAssurance } from "./contract9-assurance-evaluate.js";
export { evaluateContract9PlanAssurance } from "./contract9-assurance-evaluate.js";

export interface Contract9PlanAssuranceResultV2 {
  readonly schemaVersion: "Perttool.PlanAssuranceResult.v2";
  readonly cliContractVersion: 9;
  readonly operation: PlanAssuranceInspectionRequest["operation"];
  readonly ok: boolean;
  readonly documentId: string | null;
  readonly grammarVersion: number | null;
  readonly sourceDigest: string;
  readonly selectedTaskIds: readonly string[];
  readonly taskId: string | null;
  readonly kind: PlanAssuranceHashKind | null;
  readonly selectedHash: string | null;
  readonly assurance: PlanAssuranceProjectionV1 | null;
  readonly diagnostics: readonly Diagnostic[];
  readonly diagnosticsTruncated: boolean;
}

function selectedProjection(value: PlanAssuranceProjectionV1, ids: readonly string[]): PlanAssuranceProjectionV1 {
  if (ids.length === 0) return value;
  const selected = new Set(ids);
  const filter = (values: readonly string[]) => Object.freeze(values.filter((id) => selected.has(id)));
  const actions: readonly PlanAssuranceRequiredActionV1[] = Object.freeze(value.requiredActions.flatMap((action) => {
    const affectedTaskIds = filter(action.affectedTaskIds);
    return affectedTaskIds.length === 0 ? [] : [Object.freeze({ ...action, affectedTaskIds })];
  }));
  return Object.freeze({ ...value, taskResults: Object.freeze(value.taskResults.filter(({ taskId }) => selected.has(taskId))),
    directMismatchTaskIds: filter(value.directMismatchTaskIds), inheritedMismatchTaskIds: filter(value.inheritedMismatchTaskIds),
    replanRequiredTaskIds: filter(value.replanRequiredTaskIds), activeAttentionRequiredTaskIds: filter(value.activeAttentionRequiredTaskIds),
    requiredActions: actions });
}

function inspectionDiagnostic(code: "PTASSURE-203" | "PTASSURE-302", message: string, taskId: string): Diagnostic {
  return Object.freeze({ code, severity: "error", message, entityId: taskId,
    helpTopic: "plan-assurance", data: Object.freeze({ task_id: taskId }) });
}

export function inspectContract9PlanAssurance(text: string, request: PlanAssuranceInspectionRequest): Contract9PlanAssuranceResultV2 {
  const temporal = parseTemporalScheduleSource(text, TEMPORAL_SCHEDULE_SOURCE_CAPABILITY);
  if (temporal.grammarVersion !== 8) {
    const legacy = inspectContract8PlanAssurance(text, request, TARGET_GRAMMAR_6_CAPABILITY);
    return Object.freeze({ ...legacy, schemaVersion: "Perttool.PlanAssuranceResult.v2", cliContractVersion: 9 });
  }
  const evaluation = evaluateContract9PlanAssurance(text);
  const common = { schemaVersion: "Perttool.PlanAssuranceResult.v2" as const, cliContractVersion: 9 as const,
    operation: request.operation, documentId: temporal.documentId, grammarVersion: 8, sourceDigest: sha256DigestUtf8(text) };
  if (evaluation === null) return Object.freeze({ ...common, ok: false, selectedTaskIds: Object.freeze([]), taskId: null,
    kind: null, selectedHash: null, assurance: null, diagnostics: Object.freeze(temporal.diagnostics as readonly Diagnostic[]),
    diagnosticsTruncated: temporal.diagnosticsTruncated });
  const projected = projectPlanAssuranceAnalysis(evaluation, []).assurance!;
  const requestedIds = request.operation === "plan-assurance.show" ? [...new Set(request.taskIds ?? [])] : [request.taskId];
  const known = new Set(projected.taskResults.map(({ taskId }) => taskId));
  const unknown = requestedIds.find((id) => !known.has(id));
  if (unknown !== undefined) return Object.freeze({ ...common, ok: false, selectedTaskIds: Object.freeze(requestedIds),
    taskId: request.operation === "plan-assurance.hash" ? request.taskId : null,
    kind: request.operation === "plan-assurance.hash" ? request.kind : null, selectedHash: null, assurance: null,
    diagnostics: Object.freeze([inspectionDiagnostic("PTASSURE-302", `task ${unknown} does not exist`, unknown)]), diagnosticsTruncated: false });
  const selectedTaskIds = Object.freeze(projected.taskResults.filter(({ taskId }) => requestedIds.length === 0 || requestedIds.includes(taskId)).map(({ taskId }) => taskId));
  const assurance = selectedProjection(projected, selectedTaskIds);
  if (request.operation === "plan-assurance.show") return Object.freeze({ ...common, ok: evaluation.ok, selectedTaskIds,
    taskId: null, kind: null, selectedHash: null, assurance, diagnostics: Object.freeze([]), diagnosticsTruncated: false });
  const task = assurance.taskResults[0]!;
  const selectedHash = request.kind === "contract" ? task.contractHash
    : request.kind === "computed-basis" ? task.computedBasisHash : task.exportedAssuranceHash;
  const diagnostics = selectedHash === null ? Object.freeze([inspectionDiagnostic("PTASSURE-203",
    `task ${request.taskId} has no available ${request.kind} hash`, request.taskId)]) : Object.freeze([]);
  return Object.freeze({ ...common, ok: selectedHash !== null, selectedTaskIds, taskId: request.taskId,
    kind: request.kind, selectedHash, assurance, diagnostics, diagnosticsTruncated: false });
}
