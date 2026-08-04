import {
  compareStableStrings,
  type Diagnostic,
} from "../model/diagnostics.js";
import type {
  PlanAssuranceEvaluationV1,
  PlanAssuranceOutcomeStatus,
  PlanAssuranceTaskResultV1,
  PlanAssuranceTaskStatus,
} from "./types.js";

export const PLAN_ASSURANCE_AUTHORITY_POLICY =
  "recommendation_v1_plus_release_gate_plus_plan_assurance_v1" as const;

const BASE_AUTHORITY_POLICY = "recommendation_v1_plus_release_gate" as const;
const RANKING_ALGORITHM_ID =
  "perttool.recommendation-ranking.lexicographic-frontier" as const;

export type PlanAssuranceRequiredActionKind =
  | "initial_seal"
  | "replan_and_reseal"
  | "restore_assurance_evidence";

export interface PlanAssuranceRequiredActionV1 {
  readonly kind: PlanAssuranceRequiredActionKind;
  readonly rootTaskIds: readonly string[];
  readonly affectedTaskIds: readonly string[];
}

export interface PlanAssuranceProjectionV1 {
  readonly modelVersion: number | null;
  readonly hashModelVersion: number | null;
  readonly coverage: PlanAssuranceEvaluationV1["coverage"];
  readonly taskResults: readonly PlanAssuranceTaskResultV1[];
  readonly directMismatchTaskIds: readonly string[];
  readonly inheritedMismatchTaskIds: readonly string[];
  readonly replanRequiredTaskIds: readonly string[];
  readonly activeAttentionRequiredTaskIds: readonly string[];
  readonly requiredActions: readonly PlanAssuranceRequiredActionV1[];
}

export interface PlanAssuranceStateCountsV1 {
  readonly task: Readonly<Record<PlanAssuranceTaskStatus, number>>;
  readonly outcome: Readonly<Record<PlanAssuranceOutcomeStatus, number>>;
}

export interface PlanAssuranceCheckCompositionV1 {
  readonly ok: boolean;
  readonly assurance: PlanAssuranceProjectionV1 | null;
  readonly stateCounts: PlanAssuranceStateCountsV1;
  readonly diagnostics: readonly Diagnostic[];
}

export interface PlanAssuranceAnalysisCompositionV1 {
  readonly ok: boolean;
  readonly assurance: PlanAssuranceProjectionV1 | null;
  readonly diagnostics: readonly Diagnostic[];
}

export interface PlanAssuranceBaseAuthorityInputV1 {
  readonly recommendationInterfaceVersion: number;
  readonly rankingAlgorithm: {
    readonly id: string;
    readonly version: number;
  };
  readonly reasonTaxonomyVersion: string;
  readonly explanationModelVersion: number;
  readonly expressionVersion: number;
  readonly descriptionRegistryVersion: number;
  readonly descriptionLocale: string;
  readonly temporalPolicy: string;
  readonly traceComplete: boolean;
  readonly diagnosticsTruncated: boolean;
  readonly rawRecommendedTaskIds: readonly string[];
  readonly temporalStartableRecommendedTaskIds: readonly string[];
}

export type PlanAssuranceAuthoritySafeStopReason =
  | "unknown_recommendation_interface"
  | "unknown_ranking_algorithm"
  | "unknown_recommendation_contract"
  | "unknown_temporal_authority_policy"
  | "incomplete_recommendation_trace"
  | "invalid_recommendation_authority"
  | "invalid_assurance_evaluation"
  | "unknown_assurance_model"
  | "missing_assurance_task_result";

export interface PlanAssuranceStartAuthorityV1 {
  readonly policy: typeof PLAN_ASSURANCE_AUTHORITY_POLICY;
  readonly complete: boolean;
  readonly recommendationAlgorithm: {
    readonly id: string;
    readonly version: number;
  };
  readonly rawRecommendedTaskIds: readonly string[];
  readonly temporalStartableRecommendedTaskIds: readonly string[];
  readonly assuranceEligibleTaskIds: readonly string[];
  readonly startableRecommendedTaskIds: readonly string[];
  readonly assuranceWithheldRecommendedTaskIds: readonly string[];
  readonly assuranceUnavailableRecommendedTaskIds: readonly string[];
  readonly safeStopReasons: readonly PlanAssuranceAuthoritySafeStopReason[];
}

export interface PlanAssuranceNextCompositionV1 {
  readonly ok: boolean;
  readonly assurance: PlanAssuranceProjectionV1 | null;
  readonly authority: PlanAssuranceStartAuthorityV1;
  readonly diagnostics: readonly Diagnostic[];
}

export interface PlanAssuranceMutationImpactCompositionV1 {
  readonly modelVersion: 1;
  readonly affectedTaskIds: readonly string[];
  readonly before: PlanAssuranceProjectionV1 | null;
  readonly after: PlanAssuranceProjectionV1 | null;
  readonly diagnostics: readonly Diagnostic[];
}

function sortedUnique(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort(compareStableStrings));
}

function taskIdsWithStatus(
  evaluation: PlanAssuranceEvaluationV1,
  status: PlanAssuranceTaskStatus,
): readonly string[] {
  return evaluation.taskResults
    .filter((result) => result.status === status)
    .map((result) => result.taskId);
}

function rootTaskIds(
  results: readonly PlanAssuranceTaskResultV1[],
): readonly string[] {
  return sortedUnique(results.flatMap((result) => [
    ...result.directCauses,
    ...result.inheritedCauses,
  ].map((cause) => cause.rootTaskId)));
}

function requiredActions(
  evaluation: PlanAssuranceEvaluationV1,
): readonly PlanAssuranceRequiredActionV1[] {
  const unsealed = taskIdsWithStatus(evaluation, "unsealed");
  const unavailable = taskIdsWithStatus(evaluation, "unavailable");
  const actions: PlanAssuranceRequiredActionV1[] = [];
  if (
    evaluation.coverage === "unsealed" &&
    unsealed.length === evaluation.taskResults.length
  ) {
    actions.push(Object.freeze({
      kind: "initial_seal" as const,
      rootTaskIds: Object.freeze([]),
      affectedTaskIds: sortedUnique(unsealed),
    }));
  } else {
    const affected = sortedUnique([
      ...evaluation.replanRequiredTaskIds,
      ...unsealed,
    ]);
    if (affected.length > 0) {
      const affectedSet = new Set(affected);
      const affectedResults = evaluation.taskResults.filter(({ taskId }) =>
        affectedSet.has(taskId)
      );
      const roots = sortedUnique([
        ...rootTaskIds(affectedResults),
        ...unsealed,
      ]);
      actions.push(Object.freeze({
        kind: "replan_and_reseal" as const,
        rootTaskIds: roots,
        affectedTaskIds: affected,
      }));
    }
  }
  if (unavailable.length > 0) {
    const unavailableSet = new Set(unavailable);
    const unavailableResults = evaluation.taskResults.filter(({ taskId }) =>
      unavailableSet.has(taskId)
    );
    const roots = rootTaskIds(unavailableResults);
    actions.push(Object.freeze({
      kind: "restore_assurance_evidence" as const,
      rootTaskIds: roots.length === 0 ? sortedUnique(unavailable) : roots,
      affectedTaskIds: sortedUnique(unavailable),
    }));
  }
  return Object.freeze(actions);
}

function projection(
  evaluation: PlanAssuranceEvaluationV1,
  activeTaskIds: readonly string[],
): PlanAssuranceProjectionV1 | null {
  if (!evaluation.ok || evaluation.coverage === null) return null;
  const active = new Set(activeTaskIds);
  const activeAttentionRequiredTaskIds = evaluation.taskResults
    .filter(({ taskId, status }) =>
      active.has(taskId) &&
      (status === "review_required" || status === "unavailable")
    )
    .map(({ taskId }) => taskId);
  return Object.freeze({
    modelVersion: evaluation.modelVersion,
    hashModelVersion: evaluation.hashModelVersion,
    coverage: evaluation.coverage,
    taskResults: evaluation.taskResults,
    directMismatchTaskIds: evaluation.directMismatchTaskIds,
    inheritedMismatchTaskIds: evaluation.inheritedMismatchTaskIds,
    replanRequiredTaskIds: evaluation.replanRequiredTaskIds,
    activeAttentionRequiredTaskIds:
      Object.freeze(activeAttentionRequiredTaskIds),
    requiredActions: requiredActions(evaluation),
  });
}

function assuranceDiagnostic(
  code: "PTASSURE-201" | "PTASSURE-202" | "PTASSURE-203" | "PTASSURE-204",
  message: string,
  data: Readonly<Record<string, unknown>>,
): Diagnostic {
  return Object.freeze({
    code,
    severity: "warning" as const,
    message,
    data,
    helpTopic: "plan-assurance",
  });
}

function evaluationDiagnostics(
  evaluation: PlanAssuranceEvaluationV1,
  projected: PlanAssuranceProjectionV1 | null,
): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = evaluation.diagnostics.map((item) =>
    Object.freeze({
      code: item.code,
      severity: "error" as const,
      message: item.message,
      ...(item.entityId === null ? {} : { entityId: item.entityId }),
      data: item.data,
      helpTopic: "plan-assurance",
    })
  );
  if (projected === null) return Object.freeze(diagnostics);
  if (
    projected.coverage === "unsealed" ||
    projected.coverage === "partial"
  ) {
    diagnostics.push(assuranceDiagnostic(
      "PTASSURE-201",
      "enabled plan assurance has an unsealed or partially sealed task set",
      { coverage: projected.coverage },
    ));
  }
  if (projected.replanRequiredTaskIds.length > 0) {
    diagnostics.push(assuranceDiagnostic(
      "PTASSURE-202",
      "accepted and computed planning bases differ",
      { task_ids: projected.replanRequiredTaskIds },
    ));
  }
  const unavailableTaskIds = projected.taskResults
    .filter(({ status }) => status === "unavailable")
    .map(({ taskId }) => taskId);
  if (unavailableTaskIds.length > 0) {
    diagnostics.push(assuranceDiagnostic(
      "PTASSURE-203",
      "plan assurance is unavailable for one or more tasks",
      { task_ids: unavailableTaskIds },
    ));
  }
  if (projected.activeAttentionRequiredTaskIds.length > 0) {
    diagnostics.push(assuranceDiagnostic(
      "PTASSURE-204",
      "active work requires attention because its planning basis is no longer usable",
      { task_ids: projected.activeAttentionRequiredTaskIds },
    ));
  }
  return Object.freeze(diagnostics);
}

function stateCounts(
  evaluation: PlanAssuranceEvaluationV1,
): PlanAssuranceStateCountsV1 {
  const task: Record<PlanAssuranceTaskStatus, number> = {
    not_applicable: 0,
    unsealed: 0,
    conditional: 0,
    verified: 0,
    review_required: 0,
    unavailable: 0,
  };
  const outcome: Record<PlanAssuranceOutcomeStatus, number> = {
    unfinished: 0,
    conformant: 0,
    changed: 0,
    unavailable: 0,
  };
  for (const result of evaluation.taskResults) {
    task[result.status] += 1;
    outcome[result.outcomeStatus] += 1;
  }
  return Object.freeze({
    task: Object.freeze(task),
    outcome: Object.freeze(outcome),
  });
}

export function projectPlanAssuranceCheck(
  evaluation: PlanAssuranceEvaluationV1,
  activeTaskIds: readonly string[] = [],
): PlanAssuranceCheckCompositionV1 {
  const assurance = projection(evaluation, activeTaskIds);
  return Object.freeze({
    ok: evaluation.ok,
    assurance,
    stateCounts: stateCounts(evaluation),
    diagnostics: evaluationDiagnostics(evaluation, assurance),
  });
}

export function projectPlanAssuranceAnalysis(
  evaluation: PlanAssuranceEvaluationV1,
  activeTaskIds: readonly string[] = [],
): PlanAssuranceAnalysisCompositionV1 {
  const assurance = projection(evaluation, activeTaskIds);
  return Object.freeze({
    ok: evaluation.ok,
    assurance,
    diagnostics: evaluationDiagnostics(evaluation, assurance),
  });
}

function hasDuplicates(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

function baseSafeStopReasons(
  input: PlanAssuranceBaseAuthorityInputV1,
  evaluation: PlanAssuranceEvaluationV1,
): readonly PlanAssuranceAuthoritySafeStopReason[] {
  const reasons: PlanAssuranceAuthoritySafeStopReason[] = [];
  if (input.recommendationInterfaceVersion !== 1) {
    reasons.push("unknown_recommendation_interface");
  }
  if (
    input.rankingAlgorithm.id !== RANKING_ALGORITHM_ID ||
    input.rankingAlgorithm.version !== 1
  ) {
    reasons.push("unknown_ranking_algorithm");
  }
  if (
    input.reasonTaxonomyVersion !== "1.0" ||
    input.explanationModelVersion !== 1 ||
    input.expressionVersion !== 1 ||
    input.descriptionRegistryVersion !== 1 ||
    input.descriptionLocale !== "en"
  ) {
    reasons.push("unknown_recommendation_contract");
  }
  if (input.temporalPolicy !== BASE_AUTHORITY_POLICY) {
    reasons.push("unknown_temporal_authority_policy");
  }
  if (!input.traceComplete || input.diagnosticsTruncated) {
    reasons.push("incomplete_recommendation_trace");
  }
  const raw = new Set(input.rawRecommendedTaskIds);
  if (
    hasDuplicates(input.rawRecommendedTaskIds) ||
    hasDuplicates(input.temporalStartableRecommendedTaskIds) ||
    input.temporalStartableRecommendedTaskIds.some((id) => !raw.has(id))
  ) {
    reasons.push("invalid_recommendation_authority");
  }
  if (!evaluation.ok || evaluation.coverage === null) {
    reasons.push("invalid_assurance_evaluation");
  }
  if (
    evaluation.modelVersion !== null &&
    (evaluation.modelVersion !== 1 || evaluation.hashModelVersion !== 1)
  ) {
    reasons.push("unknown_assurance_model");
  }
  const resultIds = new Set(evaluation.taskResults.map(({ taskId }) => taskId));
  if (
    input.temporalStartableRecommendedTaskIds.some((id) => !resultIds.has(id))
  ) {
    reasons.push("missing_assurance_task_result");
  }
  return Object.freeze([...new Set(reasons)]);
}

function authoritySafeStopDiagnostic(
  reasons: readonly PlanAssuranceAuthoritySafeStopReason[],
  taskIds: readonly string[],
): Diagnostic | null {
  return reasons.length === 0
    ? null
    : assuranceDiagnostic(
        "PTASSURE-203",
        "plan-assurance start authority is unavailable for an unknown or incomplete input",
        { reason_codes: reasons, task_ids: taskIds },
      );
}

export function composePlanAssuranceNextAuthority(
  evaluation: PlanAssuranceEvaluationV1,
  base: PlanAssuranceBaseAuthorityInputV1,
  activeTaskIds: readonly string[] = [],
): PlanAssuranceNextCompositionV1 {
  const assurance = projection(evaluation, activeTaskIds);
  const reasons = baseSafeStopReasons(base, evaluation);
  const complete = reasons.length === 0 && assurance !== null;
  const statusById = new Map(
    evaluation.taskResults.map((result) => [result.taskId, result.status]),
  );
  const eligible = complete
    ? evaluation.taskResults
        .filter(({ status }) =>
          status === "not_applicable" ||
          status === "conditional" ||
          status === "verified"
        )
        .map(({ taskId }) => taskId)
    : [];
  const eligibleSet = new Set(eligible);
  const startable = complete
    ? base.temporalStartableRecommendedTaskIds.filter((id) =>
        eligibleSet.has(id)
      )
    : [];
  const withheld = complete
    ? base.temporalStartableRecommendedTaskIds.filter((id) =>
        !eligibleSet.has(id)
      )
    : [...base.temporalStartableRecommendedTaskIds];
  const unavailable = complete
    ? withheld.filter((id) => statusById.get(id) === "unavailable")
    : [...base.temporalStartableRecommendedTaskIds];
  const authority = Object.freeze({
    policy: PLAN_ASSURANCE_AUTHORITY_POLICY,
    complete,
    recommendationAlgorithm: Object.freeze({
      id: base.rankingAlgorithm.id,
      version: base.rankingAlgorithm.version,
    }),
    rawRecommendedTaskIds: Object.freeze([...base.rawRecommendedTaskIds]),
    temporalStartableRecommendedTaskIds:
      Object.freeze([...base.temporalStartableRecommendedTaskIds]),
    assuranceEligibleTaskIds: Object.freeze(eligible),
    startableRecommendedTaskIds: Object.freeze(startable),
    assuranceWithheldRecommendedTaskIds: Object.freeze(withheld),
    assuranceUnavailableRecommendedTaskIds: Object.freeze(unavailable),
    safeStopReasons: reasons,
  });
  const diagnostics = [...evaluationDiagnostics(evaluation, assurance)];
  const safeStop = authoritySafeStopDiagnostic(
    reasons,
    base.temporalStartableRecommendedTaskIds,
  );
  if (safeStop !== null) diagnostics.push(safeStop);
  return Object.freeze({
    ok: evaluation.ok,
    assurance,
    authority,
    diagnostics: Object.freeze(diagnostics),
  });
}

export function composePlanAssuranceMutationImpact(
  affectedTaskIds: readonly string[],
  before: PlanAssuranceEvaluationV1,
  after: PlanAssuranceEvaluationV1,
  activeTaskIdsBefore: readonly string[] = [],
  activeTaskIdsAfter: readonly string[] = activeTaskIdsBefore,
): PlanAssuranceMutationImpactCompositionV1 {
  const beforeProjection = projection(before, activeTaskIdsBefore);
  const afterProjection = projection(after, activeTaskIdsAfter);
  return Object.freeze({
    modelVersion: 1 as const,
    affectedTaskIds: sortedUnique(affectedTaskIds),
    before: beforeProjection,
    after: afterProjection,
    diagnostics: evaluationDiagnostics(after, afterProjection),
  });
}
