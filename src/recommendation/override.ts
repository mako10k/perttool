import { createHash } from "node:crypto";
import type { NextResultV4 } from "../application/contract4.js";
import type { NextTask } from "../application/next.js";
import type { TargetNextResultV4 } from "../application/target-temporal-analysis.js";
import type { Diagnostic, SourceSpan } from "../model/diagnostics.js";
import { compareStableStrings } from "../model/diagnostics.js";
import { fieldNamed } from "../model/syntax.js";
import type {
  RecommendationEntityReference,
  RecommendationExpression,
  RecommendationExpressionTerm,
  RecommendationScalarValue,
  RecommendationUnit,
  RecommendationValue,
} from "./explanation-types.js";
import { validateRecommendationAnalysis } from "./explanation-validation.js";
import type {
  HumanOverrideDecision,
  HumanOverrideReasonCode,
  OverrideEvidenceKind,
  OverrideEvidenceReference,
  OverrideFeasibility,
  OverrideRequest,
  OverrideResourceWitness,
  OverrideTaskDecision,
  OverrideTriggerCode,
  OverrideValidationResult,
} from "./override-types.js";
import { TOOL_VERSION } from "../version.js";

const overrideSchemaVersion = "Perttool.OverrideDecision.v1" as const;
const operation = "recommendation.override.validate" as const;
const sourceSchemaVersion = "Perttool.NextResult.v4" as const;
const digestPattern = /^sha256:[0-9a-f]{64}$/;
const overrideReasonCodes = new Set<HumanOverrideReasonCode>([
  "human_priority_decision",
  "external_commitment",
  "incident_response",
  "plan_correction_pending",
  "resource_reallocation_pending",
  "risk_acceptance",
  "experiment",
  "other_explicit_reason",
]);
const evidenceKinds = new Set<OverrideEvidenceKind>([
  "issue",
  "commit",
  "document",
  "url",
  "other",
]);

type OverrideDecisionPayload = Omit<HumanOverrideDecision, "overrideId">;

function failure(
  code: "PTOVR-101" | "PTOVR-102" | "PTOVR-103" | "PTOVR-104" | "PTOVR-105" | "PTOVR-106",
  message: string,
  data: Readonly<Record<string, unknown>> = {},
): OverrideValidationResult {
  return {
    schemaVersion: overrideSchemaVersion,
    toolVersion: TOOL_VERSION,
    operation,
    ok: false,
    diagnostics: [{
      code,
      severity: "error",
      message,
      data,
    }],
    diagnosticsTruncated: false,
    override: null,
  };
}

function byteCompare(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function sameMembers(
  left: readonly string[],
  right: readonly string[],
): boolean {
  if (left.length !== right.length) return false;
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  return (
    leftSet.size === left.length &&
    rightSet.size === right.length &&
    left.every((id) => rightSet.has(id))
  );
}

function validBoundedText(
  value: unknown,
  maximumBytes: number,
): value is string {
  return (
    typeof value === "string" &&
    value.isWellFormed() &&
    !value.includes("\0") &&
    Buffer.byteLength(value, "utf8") >= 1 &&
    Buffer.byteLength(value, "utf8") <= maximumBytes &&
    !/^\p{White_Space}/u.test(value) &&
    !/\p{White_Space}$/u.test(value)
  );
}

function validUtcSecond(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)
  ) {
    return false;
  }
  const milliseconds = Date.parse(value);
  return (
    Number.isFinite(milliseconds) &&
    new Date(milliseconds).toISOString() === `${value.slice(0, -1)}.000Z`
  );
}

function sourceContractError(
  source: NextResultV4,
  request: OverrideRequest,
): string | null {
  try {
    if (request.sourceSchemaVersion !== sourceSchemaVersion) {
      return `unsupported source schema ${String(request.sourceSchemaVersion)}`;
    }
    if (
      !source.ok ||
      source.recommendation === null ||
      source.diagnosticsTruncated ||
      source.schemaVersion !== sourceSchemaVersion ||
      source.temporal === null
    ) {
      return "source NextResult.v4 must be successful, untruncated, and include temporal authority";
    }
    const recommendation = source.recommendation;
    const authority = source.temporal.authority;
    if (
      recommendation.algorithm.id !==
        "perttool.recommendation-ranking.lexicographic-frontier" ||
      recommendation.algorithm.version !== 1 ||
      recommendation.algorithm.optimal !== false ||
      recommendation.reasonTaxonomyVersion !== "1.0" ||
      recommendation.explanationModelVersion !== 1 ||
      recommendation.expressionVersion !== 1 ||
      recommendation.descriptionRegistryVersion !== 1 ||
      recommendation.descriptionLocale !== "en" ||
      recommendation.explanationStatus.complete !== true ||
      recommendation.explanationStatus.decisiveChainComplete !== true ||
      recommendation.explanationStatus.truncated !== false ||
      authority.policy !== "recommendation_v1_plus_release_gate" ||
      authority.recommendationAlgorithm.id !== recommendation.algorithm.id ||
      authority.recommendationAlgorithm.version !==
        recommendation.algorithm.version ||
      authority.deadlineFactsUsedForRanking !== false
    ) {
      return "source recommendation uses unsupported or incomplete decisive semantics";
    }
    if (!digestPattern.test(recommendation.sourceDigest)) {
      return "source recommendation digest is not canonical SHA-256";
    }
    const invariantDiagnostics = validateRecommendationAnalysis(recommendation);
    if (invariantDiagnostics.length > 0) {
      return `source recommendation invariant failed with ${invariantDiagnostics[0]!.code}`;
    }
    const readyTasks = source.tasks
      .filter(({ classification }) => classification === "ready")
      .map(({ id }) => id);
    const decisionTasks = recommendation.taskDecisions.map(
      ({ subjectTaskId }) => subjectTaskId,
    );
    if (
      !sameMembers(source.groups.ready, readyTasks) ||
      !sameMembers(source.groups.ready, decisionTasks)
    ) {
      return "source ready tasks and recommendation decisions do not match";
    }
    const temporalTaskIds = source.temporal.tasks.map(({ taskId }) => taskId);
    const eligibleTaskIds = source.temporal.tasks
      .filter(({ timeEligibility }) => timeEligibility.state === "eligible")
      .map(({ taskId }) => taskId);
    const ineligibleTaskIds = source.temporal.tasks
      .filter(
        ({ timeEligibility }) =>
          timeEligibility.state === "not_yet_eligible",
      )
      .map(({ taskId }) => taskId);
    const unavailableTaskIds = source.temporal.tasks
      .filter(({ timeEligibility }) => timeEligibility.state === "unavailable")
      .map(({ taskId }) => taskId);
    if (
      new Set(temporalTaskIds).size !== temporalTaskIds.length ||
      !sameMembers(authority.timeEligibleTaskIds, eligibleTaskIds) ||
      !sameMembers(authority.timeIneligibleTaskIds, ineligibleTaskIds) ||
      !sameMembers(
        authority.timeEligibilityUnavailableTaskIds,
        unavailableTaskIds,
      ) ||
      source.groups.runnableNow.some(
        (taskId) => !authority.timeEligibleTaskIds.includes(taskId),
      )
    ) {
      return "source temporal eligibility authority is inconsistent";
    }
    const expectedStartable = recommendation.recommendedTaskIds.filter(
      (taskId) => source.groups.runnableNow.includes(taskId),
    );
    const expectedDelayed = recommendation.recommendedTaskIds.filter(
      (taskId) => authority.timeIneligibleTaskIds.includes(taskId),
    );
    const expectedUnavailable = recommendation.recommendedTaskIds.filter(
      (taskId) =>
        authority.timeEligibilityUnavailableTaskIds.includes(taskId),
    );
    if (
      !sameMembers(
        authority.startableRecommendedTaskIds,
        expectedStartable,
      ) ||
      !sameMembers(authority.delayedRecommendedTaskIds, expectedDelayed) ||
      !sameMembers(
        authority.unavailableRecommendedTaskIds,
        expectedUnavailable,
      )
    ) {
      return "source temporal start authority does not match the recommendation";
    }
    const declaredResources = new Set(
      source.document.declarations
        .filter(({ kind }) => kind === "resource")
        .map(({ id }) => id),
    );
    for (const [resourceId, capacity] of source.capacityOverrides) {
      if (
        !declaredResources.has(resourceId) ||
        !Number.isSafeInteger(capacity) ||
        capacity < 1
      ) {
        return "source capacity override is invalid";
      }
    }
    return null;
  } catch (error) {
    return `source recommendation cannot be validated: ${
      error instanceof Error ? error.message : String(error)
    }`;
  }
}

function canonicalEvidence(
  request: OverrideRequest,
): readonly OverrideEvidenceReference[] | null {
  if (
    !Array.isArray(request.evidenceReferences) ||
    request.evidenceReferences.length > 16
  ) {
    return null;
  }
  const byKey = new Map<string, OverrideEvidenceReference>();
  for (const reference of request.evidenceReferences) {
    if (
      reference === null ||
      typeof reference !== "object" ||
      !evidenceKinds.has(reference.kind) ||
      !validBoundedText(reference.value, 1024)
    ) {
      return null;
    }
    byKey.set(`${reference.kind}\0${reference.value}`, {
      kind: reference.kind,
      value: reference.value,
    });
  }
  return [...byKey.values()].sort(
    (left, right) =>
      compareStableStrings(left.kind, right.kind) ||
      byteCompare(left.value, right.value),
  );
}

function validHumanFields(
  request: OverrideRequest,
): {
  readonly evidence: readonly OverrideEvidenceReference[];
} | null {
  if (
    request.actor === null ||
    typeof request.actor !== "object" ||
    request.actor.kind !== "human" ||
    request.actor.authentication !== "caller_asserted" ||
    !validBoundedText(request.actor.id, 256) ||
    !validUtcSecond(request.decidedAt) ||
    !overrideReasonCodes.has(request.reasonCode) ||
    !validBoundedText(request.reasonText, 4096)
  ) {
    return null;
  }
  const evidence = canonicalEvidence(request);
  return evidence === null ? null : { evidence };
}

function triggerCodesForTier(
  tier: OverrideTaskDecision["normalTier"],
  displacesRecommended: boolean,
): readonly OverrideTriggerCode[] {
  const triggers: OverrideTriggerCode[] = [];
  if (tier === "allowed" && displacesRecommended) {
    triggers.push("allowed_replaces_recommended");
  }
  if (tier === "deferred") triggers.push("deferred_selected");
  if (tier === "discouraged") triggers.push("discouraged_selected");
  return triggers;
}

function declaredCapacities(
  source: TargetNextResultV4,
): ReadonlyMap<string, number> {
  const capacities = new Map<string, number>();
  for (const declaration of source.document.declarations) {
    if (declaration.kind !== "resource") continue;
    capacities.set(
      declaration.id,
      fieldNamed(declaration, "capacity")!.value as number,
    );
  }
  for (const [resourceId, capacity] of source.capacityOverrides) {
    capacities.set(resourceId, capacity);
  }
  return capacities;
}

function addTaskUsage(
  usage: Map<string, number>,
  capacities: ReadonlyMap<string, number>,
  task: NextTask,
  occupants?: Map<string, string[]>,
): void {
  for (const requirement of task.requirements) {
    if (!capacities.has(requirement.resourceId)) {
      throw new Error(
        `task ${task.id} references unknown resource ${requirement.resourceId}`,
      );
    }
    usage.set(
      requirement.resourceId,
      (usage.get(requirement.resourceId) ?? 0) + requirement.units,
    );
    if (occupants !== undefined) {
      const taskIds = occupants.get(requirement.resourceId) ?? [];
      taskIds.push(task.id);
      occupants.set(requirement.resourceId, taskIds);
    }
  }
}

function feasibilityExpression(
  witnesses: readonly OverrideResourceWitness[],
): RecommendationExpression | null {
  if (witnesses.length === 0) return null;
  return {
    kind: "all",
    children: witnesses.map((witness) => {
      const unit: RecommendationUnit = {
        kind: "resource",
        resource: { kind: "resource", id: witness.resourceId },
      };
      return {
        kind: "compare",
        left: {
          kind: "literal",
          value: { type: "integer", value: String(witness.used) },
          unit,
        },
        relation: "less_or_equal",
        right: {
          kind: "literal",
          value: { type: "integer", value: String(witness.capacity) },
          unit,
        },
      };
    }),
  };
}

function evaluateSelectedSet(
  source: TargetNextResultV4,
  selectedTaskIds: readonly string[],
): {
  readonly feasible: boolean;
  readonly result: OverrideFeasibility | null;
  readonly violatedResources: readonly string[];
} {
  const taskById = new Map(source.tasks.map((task) => [task.id, task]));
  const capacities = declaredCapacities(source);
  const activeTasks = source.tasks
    .filter(({ classification }) => classification === "active")
    .sort((left, right) => compareStableStrings(left.id, right.id));
  const selectedTasks = selectedTaskIds.map((id) => taskById.get(id)!);
  const activeUsage = new Map<string, number>();
  const selectedUsage = new Map<string, number>();
  const selectedOccupants = new Map<string, string[]>();
  for (const task of activeTasks) {
    addTaskUsage(activeUsage, capacities, task);
  }
  for (const task of selectedTasks) {
    addTaskUsage(selectedUsage, capacities, task, selectedOccupants);
  }
  const resourceIds = [...capacities.keys()]
    .filter(
      (id) =>
        (activeUsage.get(id) ?? 0) > 0 ||
        (selectedUsage.get(id) ?? 0) > 0,
    )
    .sort(compareStableStrings);
  const witnesses: OverrideResourceWitness[] = resourceIds.map((resourceId) => {
    const capacity = capacities.get(resourceId)!;
    const active = activeUsage.get(resourceId) ?? 0;
    const selected = selectedUsage.get(resourceId) ?? 0;
    const used = active + selected;
    return {
      resourceId,
      capacity,
      activeUsage: active,
      selectedUsage: selected,
      used,
      availableAfterSelection: capacity - used,
      selectedTaskIds: [...(selectedOccupants.get(resourceId) ?? [])],
    };
  });
  const violatedResources = witnesses
    .filter(({ used, capacity }) => used > capacity)
    .map(({ resourceId }) => resourceId);
  if (violatedResources.length > 0) {
    return { feasible: false, result: null, violatedResources };
  }
  return {
    feasible: true,
    result: {
      selectedSetReference: { kind: "derived_set", id: "O" },
      startFeasible: true,
      activeTaskIds: activeTasks.map(({ id }) => id),
      resourceWitnesses: witnesses,
      expression: feasibilityExpression(witnesses),
    },
    violatedResources: [],
  };
}

function negativeReasonIds(
  source: TargetNextResultV4,
  taskId: string,
): readonly string[] {
  const recommendation = source.recommendation!;
  const decision = recommendation.taskDecisions.find(
    ({ subjectTaskId }) => subjectTaskId === taskId,
  )!;
  const reasonById = new Map(
    recommendation.reasonOccurrences.map((reason) => [reason.id, reason]),
  );
  return decision.reasonOccurrenceIds.filter((id) => {
    const reason = reasonById.get(id);
    return (
      reason?.code === "modeled_negative_fact_applies" &&
      reason.role === "decisive"
    );
  });
}

function acknowledgementError(
  source: TargetNextResultV4,
  request: OverrideRequest,
  selectedTaskIds: readonly string[],
): string | null {
  if (
    !Array.isArray(request.acknowledgedNegativeFactReasonIds) ||
    request.acknowledgedNegativeFactReasonIds.some(
      (id) => typeof id !== "string",
    )
  ) {
    return "negative fact acknowledgement must be a list of reason IDs";
  }
  const provided = request.acknowledgedNegativeFactReasonIds;
  if (new Set(provided).size !== provided.length) {
    return "negative fact acknowledgement contains duplicate reason IDs";
  }
  const recommendation = source.recommendation!;
  const decisionByTask = new Map(
    recommendation.taskDecisions.map((decision) => [
      decision.subjectTaskId,
      decision,
    ]),
  );
  const expected = selectedTaskIds.flatMap((taskId) => {
    const decision = decisionByTask.get(taskId)!;
    if (decision.tier !== "discouraged") return [];
    const reasons = negativeReasonIds(source, taskId);
    if (reasons.length === 0) {
      throw new Error(
        `discouraged task ${taskId} has no decisive negative fact reason`,
      );
    }
    return reasons;
  });
  return sameMembers(provided, expected)
    ? null
    : "negative fact acknowledgement does not match selected discouraged tasks";
}

function taskDecisionReferences(
  source: TargetNextResultV4,
  selectedTaskIds: readonly string[],
  displacesRecommended: boolean,
): readonly OverrideTaskDecision[] {
  const decisionByTask = new Map(
    source.recommendation!.taskDecisions.map((decision) => [
      decision.subjectTaskId,
      decision,
    ]),
  );
  return selectedTaskIds.map((taskId) => {
    const normal = decisionByTask.get(taskId)!;
    return {
      taskId,
      normalDecisionId: normal.id,
      normalTier: normal.tier,
      normalDecisiveStepId: normal.decisiveStepId,
      normalReasonOccurrenceIds: normal.reasonOccurrenceIds,
      normalComparisonIds: normal.comparisonIds,
      overrideSelected: true,
      triggerCodes: triggerCodesForTier(
        normal.tier,
        displacesRecommended,
      ),
      acknowledgedNegativeFactReasonIds:
        normal.tier === "discouraged"
          ? negativeReasonIds(source, taskId)
          : [],
    };
  });
}

export function validateOverride(
  source: NextResultV4,
  request: OverrideRequest,
): OverrideValidationResult {
  const sourceError = sourceContractError(source, request);
  if (sourceError !== null) {
    return failure("PTOVR-101", sourceError);
  }
  const validatedSource = source as TargetNextResultV4;
  const recommendation = validatedSource.recommendation!;
  if (
    request.sourceDigest !== recommendation.sourceDigest ||
    request.sourceResultDecisionId !== recommendation.resultDecision.id
  ) {
    return failure(
      "PTOVR-102",
      "override request does not match the source digest and result decision",
    );
  }
  if (
    !Array.isArray(request.selectedTaskIds) ||
    request.selectedTaskIds.length === 0 ||
    request.selectedTaskIds.some((id) => typeof id !== "string") ||
    new Set(request.selectedTaskIds).size !== request.selectedTaskIds.length
  ) {
    return failure(
      "PTOVR-103",
      "selected_task_ids must contain unique ready task IDs",
    );
  }
  const selectedSet = new Set(request.selectedTaskIds);
  const readySet = new Set(validatedSource.groups.ready);
  const timeEligibleSet = new Set(
    validatedSource.temporal.authority.timeEligibleTaskIds,
  );
  const decisionByTask = new Map(
    recommendation.taskDecisions.map((decision) => [
      decision.subjectTaskId,
      decision,
    ]),
  );
  const invalidTaskIds = request.selectedTaskIds.filter(
    (id) =>
      !readySet.has(id) ||
      !timeEligibleSet.has(id) ||
      !decisionByTask.has(id),
  );
  if (invalidTaskIds.length > 0) {
    return failure(
      "PTOVR-103",
      "selected task is not an actual ready and time-eligible task with a normal decision",
      { task_ids: [...invalidTaskIds].sort(compareStableStrings) },
    );
  }
  const selectedTaskIds = recommendation.taskDecisions
    .map(({ subjectTaskId }) => subjectTaskId)
    .filter((id) => selectedSet.has(id));
  const recommendedSet = new Set(recommendation.recommendedTaskIds);
  const retainedRecommendedTaskIds = recommendation.recommendedTaskIds.filter(
    (id) => selectedSet.has(id),
  );
  const displacedRecommendedTaskIds =
    recommendation.recommendedTaskIds.filter((id) => !selectedSet.has(id));
  const selectedNonrecommendedTaskIds = selectedTaskIds.filter(
    (id) => !recommendedSet.has(id),
  );
  const displacesRecommended = displacedRecommendedTaskIds.length > 0;
  const eventTriggers: OverrideTriggerCode[] = [];
  if (
    displacesRecommended &&
    selectedTaskIds.some(
      (id) => decisionByTask.get(id)!.tier === "allowed",
    )
  ) {
    eventTriggers.push("allowed_replaces_recommended");
  }
  if (
    selectedTaskIds.some(
      (id) => decisionByTask.get(id)!.tier === "deferred",
    )
  ) {
    eventTriggers.push("deferred_selected");
  }
  if (
    selectedTaskIds.some(
      (id) => decisionByTask.get(id)!.tier === "discouraged",
    )
  ) {
    eventTriggers.push("discouraged_selected");
  }
  let feasibility: ReturnType<typeof evaluateSelectedSet>;
  try {
    feasibility = evaluateSelectedSet(validatedSource, selectedTaskIds);
  } catch (error) {
    return failure(
      "PTOVR-101",
      `source resource snapshot cannot be validated: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  if (!feasibility.feasible || feasibility.result === null) {
    return failure(
      "PTOVR-104",
      "selected task set is not feasible with active allocation and applied capacity",
      { resource_ids: feasibility.violatedResources },
    );
  }
  if (eventTriggers.length === 0) {
    return failure(
      "PTOVR-106",
      "selected task set is within normal recommendation authority",
    );
  }
  const human = validHumanFields(request);
  if (human === null) {
    return failure(
      "PTOVR-105",
      "actor, decision time, reason, or evidence is invalid",
    );
  }
  let acknowledgement: string | null;
  try {
    acknowledgement = acknowledgementError(
      validatedSource,
      request,
      selectedTaskIds,
    );
  } catch (error) {
    return failure(
      "PTOVR-101",
      `source negative fact trace cannot be validated: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  if (acknowledgement !== null) {
    return failure("PTOVR-105", acknowledgement);
  }
  const payload: OverrideDecisionPayload = {
    overrideContractVersion: 1,
    source: {
      schemaVersion: sourceSchemaVersion,
      toolVersion: TOOL_VERSION,
      sourceDigest: recommendation.sourceDigest,
      recommendationInterfaceVersion: 1,
      rankingAlgorithmId: recommendation.algorithm.id,
      rankingAlgorithmVersion: recommendation.algorithm.version,
      reasonTaxonomyVersion: recommendation.reasonTaxonomyVersion,
      explanationModelVersion: recommendation.explanationModelVersion,
      expressionVersion: recommendation.expressionVersion,
      descriptionRegistryVersion: recommendation.descriptionRegistryVersion,
      resultDecisionId: recommendation.resultDecision.id,
      recommendedTaskIds: recommendation.recommendedTaskIds,
      capacityOverrides: [...validatedSource.capacityOverrides]
        .sort(([left], [right]) => compareStableStrings(left, right))
        .map(([resourceId, capacity]) => ({ resourceId, capacity })),
    },
    actor: {
      kind: "human",
      id: request.actor.id,
      authentication: "caller_asserted",
    },
    decidedAt: request.decidedAt,
    reason: {
      code: request.reasonCode,
      text: request.reasonText,
      evidenceReferences: human.evidence,
    },
    selection: {
      selectedTaskIds,
      retainedRecommendedTaskIds,
      displacedRecommendedTaskIds,
      selectedNonrecommendedTaskIds,
      triggerCodes: eventTriggers,
    },
    taskDecisions: taskDecisionReferences(
      validatedSource,
      selectedTaskIds,
      displacesRecommended,
    ),
    feasibility: feasibility.result,
    singleUse: true,
  };
  const overrideId = `override:sha256:${
    createHash("sha256")
      .update(JSON.stringify(overrideDecisionPayloadJson(payload)), "utf8")
      .digest("hex")
  }`;
  const override: HumanOverrideDecision = {
    overrideContractVersion: 1,
    overrideId,
    source: payload.source,
    actor: payload.actor,
    decidedAt: payload.decidedAt,
    reason: payload.reason,
    selection: payload.selection,
    taskDecisions: payload.taskDecisions,
    feasibility: payload.feasibility,
    singleUse: true,
  };
  return {
    schemaVersion: overrideSchemaVersion,
    toolVersion: TOOL_VERSION,
    operation,
    ok: true,
    diagnostics: [],
    diagnosticsTruncated: false,
    override,
  };
}

function entityJson(
  value: RecommendationEntityReference,
): Readonly<Record<string, unknown>> {
  return { kind: value.kind, id: value.id };
}

function scalarValueJson(
  value: RecommendationScalarValue,
): Readonly<Record<string, unknown>> {
  switch (value.type) {
    case "boolean":
    case "integer":
      return { type: value.type, value: value.value };
    case "rational":
      return {
        type: value.type,
        numerator: value.numerator,
        denominator: value.denominator,
      };
    case "enum":
      return {
        type: value.type,
        enum_type: value.enumType,
        value: value.value,
      };
    case "entity":
      return { type: value.type, value: entityJson(value.value) };
  }
}

function valueJson(
  value: RecommendationValue,
): Readonly<Record<string, unknown>> {
  switch (value.type) {
    case "boolean":
    case "integer":
    case "rational":
    case "enum":
    case "entity":
      return scalarValueJson(value);
    case "list":
    case "set":
      return {
        type: value.type,
        item_type: value.itemType,
        items: value.items.map(scalarValueJson),
      };
    case "map":
      return {
        type: value.type,
        key_type: value.keyType,
        value_type: value.valueType,
        entries: value.entries.map(({ key, value: entryValue }) => ({
          key: scalarValueJson(key),
          value: scalarValueJson(entryValue),
        })),
      };
  }
}

function unitJson(
  unit: RecommendationUnit | null,
): Readonly<Record<string, unknown>> | null {
  if (unit === null) return null;
  switch (unit.kind) {
    case "duration":
      return { kind: unit.kind, value: unit.value };
    case "resource":
      return { kind: unit.kind, resource: entityJson(unit.resource) };
    case "ratio":
      return { kind: unit.kind };
  }
}

function expressionTermJson(
  term: RecommendationExpressionTerm,
): Readonly<Record<string, unknown>> {
  return term.kind === "fact"
    ? { kind: term.kind, fact_id: term.factId }
    : {
        kind: term.kind,
        value: valueJson(term.value),
        unit: unitJson(term.unit),
      };
}

function expressionJson(
  expression: RecommendationExpression,
): Readonly<Record<string, unknown>> {
  return expression.kind === "compare"
    ? {
        kind: expression.kind,
        left: expressionTermJson(expression.left),
        relation: expression.relation,
        right: expressionTermJson(expression.right),
      }
    : {
        kind: expression.kind,
        children: expression.children.map(expressionJson),
      };
}

function sourceJson(
  source: HumanOverrideDecision["source"],
): Readonly<Record<string, unknown>> {
  return {
    schema_version: source.schemaVersion,
    tool_version: source.toolVersion,
    source_digest: source.sourceDigest,
    recommendation_interface_version: source.recommendationInterfaceVersion,
    ranking_algorithm_id: source.rankingAlgorithmId,
    ranking_algorithm_version: source.rankingAlgorithmVersion,
    reason_taxonomy_version: source.reasonTaxonomyVersion,
    explanation_model_version: source.explanationModelVersion,
    expression_version: source.expressionVersion,
    description_registry_version: source.descriptionRegistryVersion,
    result_decision_id: source.resultDecisionId,
    recommended_task_ids: source.recommendedTaskIds,
    capacity_overrides: source.capacityOverrides.map(
      ({ resourceId, capacity }) => ({
        resource_id: resourceId,
        capacity,
      }),
    ),
  };
}

function actorJson(
  actor: HumanOverrideDecision["actor"],
): Readonly<Record<string, unknown>> {
  return {
    kind: actor.kind,
    id: actor.id,
    authentication: actor.authentication,
  };
}

function reasonJson(
  reason: HumanOverrideDecision["reason"],
): Readonly<Record<string, unknown>> {
  return {
    code: reason.code,
    text: reason.text,
    evidence_references: reason.evidenceReferences.map(({ kind, value }) => ({
      kind,
      value,
    })),
  };
}

function selectionJson(
  selection: HumanOverrideDecision["selection"],
): Readonly<Record<string, unknown>> {
  return {
    selected_task_ids: selection.selectedTaskIds,
    retained_recommended_task_ids: selection.retainedRecommendedTaskIds,
    displaced_recommended_task_ids: selection.displacedRecommendedTaskIds,
    selected_nonrecommended_task_ids:
      selection.selectedNonrecommendedTaskIds,
    trigger_codes: selection.triggerCodes,
  };
}

function taskDecisionJson(
  decision: OverrideTaskDecision,
): Readonly<Record<string, unknown>> {
  return {
    task_id: decision.taskId,
    normal_decision_id: decision.normalDecisionId,
    normal_tier: decision.normalTier,
    normal_decisive_step_id: decision.normalDecisiveStepId,
    normal_reason_occurrence_ids: decision.normalReasonOccurrenceIds,
    normal_comparison_ids: decision.normalComparisonIds,
    override_selected: decision.overrideSelected,
    trigger_codes: decision.triggerCodes,
    acknowledged_negative_fact_reason_ids:
      decision.acknowledgedNegativeFactReasonIds,
  };
}

function feasibilityJson(
  feasibility: OverrideFeasibility,
): Readonly<Record<string, unknown>> {
  return {
    selected_set_reference: {
      kind: feasibility.selectedSetReference.kind,
      id: feasibility.selectedSetReference.id,
    },
    start_feasible: feasibility.startFeasible,
    active_task_ids: feasibility.activeTaskIds,
    resource_witnesses: feasibility.resourceWitnesses.map((witness) => ({
      resource_id: witness.resourceId,
      capacity: witness.capacity,
      active_usage: witness.activeUsage,
      selected_usage: witness.selectedUsage,
      used: witness.used,
      available_after_selection: witness.availableAfterSelection,
      selected_task_ids: witness.selectedTaskIds,
    })),
    expression:
      feasibility.expression === null
        ? null
        : expressionJson(feasibility.expression),
  };
}

function overrideDecisionPayloadJson(
  decision: OverrideDecisionPayload,
): Readonly<Record<string, unknown>> {
  return {
    override_contract_version: decision.overrideContractVersion,
    source: sourceJson(decision.source),
    actor: actorJson(decision.actor),
    decided_at: decision.decidedAt,
    reason: reasonJson(decision.reason),
    selection: selectionJson(decision.selection),
    task_decisions: decision.taskDecisions.map(taskDecisionJson),
    feasibility: feasibilityJson(decision.feasibility),
    single_use: decision.singleUse,
  };
}

export function humanOverrideDecisionToJson(
  decision: HumanOverrideDecision,
): Readonly<Record<string, unknown>> {
  return {
    override_contract_version: decision.overrideContractVersion,
    override_id: decision.overrideId,
    source: sourceJson(decision.source),
    actor: actorJson(decision.actor),
    decided_at: decision.decidedAt,
    reason: reasonJson(decision.reason),
    selection: selectionJson(decision.selection),
    task_decisions: decision.taskDecisions.map(taskDecisionJson),
    feasibility: feasibilityJson(decision.feasibility),
    single_use: decision.singleUse,
  };
}

function jsonPosition(
  position: SourceSpan["start"],
): Readonly<Record<string, number>> {
  return {
    offset: position.offset,
    line: position.line + 1,
    column: position.column + 1,
  };
}

function jsonSpan(span: SourceSpan): Readonly<Record<string, unknown>> {
  return {
    start: jsonPosition(span.start),
    end: jsonPosition(span.end),
  };
}

function diagnosticJson(
  diagnostic: Diagnostic,
): Readonly<Record<string, unknown>> {
  return {
    code: diagnostic.code,
    severity: diagnostic.severity,
    message: diagnostic.message,
    entity_id: diagnostic.entityId ?? null,
    span: diagnostic.span === undefined ? null : jsonSpan(diagnostic.span),
    related: (diagnostic.related ?? []).map((related) => ({
      message: related.message,
      span: jsonSpan(related.span),
    })),
    help_topic: diagnostic.helpTopic ?? null,
    expected_syntax: diagnostic.expectedSyntax ?? null,
    fixes: [],
    data: diagnostic.data ?? {},
  };
}

export function overrideValidationResultToJson(
  result: OverrideValidationResult,
): Readonly<Record<string, unknown>> {
  return {
    schema_version: result.schemaVersion,
    tool_version: result.toolVersion,
    operation: result.operation,
    ok: result.ok,
    diagnostics: result.diagnostics.map(diagnosticJson),
    diagnostics_truncated: result.diagnosticsTruncated,
    override:
      result.override === null
        ? null
        : humanOverrideDecisionToJson(result.override),
  };
}

export function canonicalOverrideArtifact(
  result: OverrideValidationResult,
): string {
  return JSON.stringify(overrideValidationResultToJson(result));
}
