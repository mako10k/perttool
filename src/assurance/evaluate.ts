import { compareStableStrings } from "../model/diagnostics.js";
import {
  hashTaskOutcomeCommitment,
  hashTaskPlanBasis,
  hashTaskPlanContract,
  isSha256Digest,
} from "./canonical.js";
import {
  PLAN_ASSURANCE_HASH_MODEL_VERSION,
  PLAN_ASSURANCE_MODEL_VERSION,
} from "./types.js";
import type {
  AcceptedPlanningInputV1,
  EffectivePlanDependencyV1,
  PlanAssuranceCauseV1,
  PlanAssuranceCoverage,
  PlanAssuranceDiagnosticV1,
  PlanAssuranceEvaluationV1,
  PlanAssuranceInputV1,
  PlanAssuranceOutcomeStatus,
  PlanAssuranceTaskResultV1,
  PlanAssuranceTaskStatus,
  PlanDependencyRelationV1,
  PlanningInputMode,
  Sha256Digest,
  TaskAssuranceInputV1,
} from "./types.js";

interface DerivedRelations {
  readonly effective: readonly EffectivePlanDependencyV1[];
  readonly planning: readonly EffectivePlanDependencyV1[];
  readonly diagnostics: readonly PlanAssuranceDiagnosticV1[];
}

interface CurrentPlanningInput {
  readonly predecessorTaskId: string;
  readonly relationMode: PlanningInputMode;
  readonly assuranceHash: Sha256Digest | null;
}

function diagnostic(
  code: PlanAssuranceDiagnosticV1["code"],
  message: string,
  entityId: string | null,
  data: Readonly<Record<string, unknown>> = {},
): PlanAssuranceDiagnosticV1 {
  return { code, message, entityId, data };
}

function pairKey(predecessorTaskId: string, successorTaskId: string): string {
  return `${predecessorTaskId}\u0000${successorTaskId}`;
}

function relationOrder(
  left: EffectivePlanDependencyV1,
  right: EffectivePlanDependencyV1,
): number {
  return (
    compareStableStrings(left.successorTaskId, right.successorTaskId) ||
    compareStableStrings(left.predecessorTaskId, right.predecessorTaskId) ||
    compareStableStrings(left.mode, right.mode) ||
    compareStableStrings(left.relationId ?? "", right.relationId ?? "")
  );
}

function validateExplicitRelation(
  relation: PlanDependencyRelationV1,
  executionPairs: ReadonlySet<string>,
): string | null {
  if (
    relation.mode !== "both" &&
    relation.mode !== "execution_only" &&
    relation.mode !== "planning_only"
  ) {
    return "planning relation has an unknown mode";
  }
  const key = pairKey(
    relation.predecessorTaskId,
    relation.successorTaskId,
  );
  const hasExecution = executionPairs.has(key);
  if (relation.mode === "planning_only" && hasExecution) {
    return "planning_only relation duplicates a projected execution relation";
  }
  if (relation.mode !== "planning_only" && !hasExecution) {
    return `${relation.mode} relation has no projected execution relation`;
  }
  if (
    relation.mode !== "both" &&
    (relation.reason === null || relation.reason.length === 0)
  ) {
    return `${relation.mode} relation requires a nonempty reason`;
  }
  return null;
}

function deriveRelations(
  input: PlanAssuranceInputV1,
  taskIds: ReadonlySet<string>,
): DerivedRelations {
  const diagnostics: PlanAssuranceDiagnosticV1[] = [];
  const executionPairs = new Set<string>();
  for (const relation of input.executionRelations) {
    const key = pairKey(
      relation.predecessorTaskId,
      relation.successorTaskId,
    );
    if (
      relation.predecessorTaskId === relation.successorTaskId ||
      !taskIds.has(relation.predecessorTaskId) ||
      !taskIds.has(relation.successorTaskId) ||
      executionPairs.has(key)
    ) {
      diagnostics.push(diagnostic(
        "PTASSURE-101",
        "execution relation must have distinct current tasks and be unique",
        relation.successorTaskId,
        {
          predecessor_task_id: relation.predecessorTaskId,
          successor_task_id: relation.successorTaskId,
        },
      ));
      continue;
    }
    executionPairs.add(key);
  }

  const explicitByPair = new Map<string, PlanDependencyRelationV1>();
  const relationIds = new Set<string>();
  for (const relation of input.explicitRelations) {
    const key = pairKey(
      relation.predecessorTaskId,
      relation.successorTaskId,
    );
    const invalid = validateExplicitRelation(relation, executionPairs);
    if (
      relation.predecessorTaskId === relation.successorTaskId ||
      relation.id.length === 0 ||
      !taskIds.has(relation.predecessorTaskId) ||
      !taskIds.has(relation.successorTaskId) ||
      relationIds.has(relation.id) ||
      explicitByPair.has(key) ||
      invalid !== null
    ) {
      diagnostics.push(diagnostic(
        "PTASSURE-101",
        invalid ?? "explicit planning relation is invalid or duplicated",
        relation.id,
        {
          predecessor_task_id: relation.predecessorTaskId,
          successor_task_id: relation.successorTaskId,
          mode: relation.mode,
        },
      ));
      continue;
    }
    relationIds.add(relation.id);
    explicitByPair.set(key, relation);
  }

  if (diagnostics.length > 0) {
    return { effective: [], planning: [], diagnostics };
  }

  const effective: EffectivePlanDependencyV1[] = [];
  for (const relation of input.executionRelations) {
    const explicit = explicitByPair.get(pairKey(
      relation.predecessorTaskId,
      relation.successorTaskId,
    ));
    effective.push({
      relationId: explicit?.id ?? null,
      predecessorTaskId: relation.predecessorTaskId,
      successorTaskId: relation.successorTaskId,
      mode: explicit?.mode ?? "both",
      explicit: explicit !== undefined,
    });
  }
  for (const relation of input.explicitRelations) {
    if (relation.mode !== "planning_only") continue;
    effective.push({
      relationId: relation.id,
      predecessorTaskId: relation.predecessorTaskId,
      successorTaskId: relation.successorTaskId,
      mode: relation.mode,
      explicit: true,
    });
  }
  effective.sort(relationOrder);
  return {
    effective,
    planning: effective.filter(({ mode }) => mode !== "execution_only"),
    diagnostics,
  };
}

function cycleWitness(
  taskIds: readonly string[],
  planning: readonly EffectivePlanDependencyV1[],
): readonly string[] | null {
  const successors = new Map(taskIds.map((id) => [id, [] as string[]]));
  for (const relation of planning) {
    successors.get(relation.predecessorTaskId)!.push(relation.successorTaskId);
  }
  for (const values of successors.values()) values.sort(compareStableStrings);

  const state = new Map<string, "visiting" | "visited">();
  const stack: string[] = [];
  let found: readonly string[] | null = null;
  const visit = (taskId: string): void => {
    if (found !== null) return;
    state.set(taskId, "visiting");
    stack.push(taskId);
    for (const successor of successors.get(taskId)!) {
      if (state.get(successor) === "visiting") {
        const start = stack.indexOf(successor);
        found = [...stack.slice(start), successor];
        return;
      }
      if (state.get(successor) === undefined) visit(successor);
    }
    stack.pop();
    state.set(taskId, "visited");
  };
  for (const taskId of [...taskIds].sort(compareStableStrings)) {
    if (state.get(taskId) === undefined) visit(taskId);
  }
  return found;
}

function topologicalOrder(
  taskIds: readonly string[],
  planning: readonly EffectivePlanDependencyV1[],
): readonly string[] {
  const indegree = new Map(taskIds.map((id) => [id, 0]));
  const successors = new Map(taskIds.map((id) => [id, [] as string[]]));
  for (const relation of planning) {
    indegree.set(
      relation.successorTaskId,
      indegree.get(relation.successorTaskId)! + 1,
    );
    successors.get(relation.predecessorTaskId)!.push(relation.successorTaskId);
  }
  for (const values of successors.values()) values.sort(compareStableStrings);
  const ready = taskIds
    .filter((id) => indegree.get(id) === 0)
    .sort(compareStableStrings);
  const ordered: string[] = [];
  while (ready.length > 0) {
    const current = ready.shift()!;
    ordered.push(current);
    for (const successor of successors.get(current)!) {
      const next = indegree.get(successor)! - 1;
      indegree.set(successor, next);
      if (next === 0) {
        ready.push(successor);
        ready.sort(compareStableStrings);
      }
    }
  }
  return ordered;
}

function coverageFor(
  tasks: readonly TaskAssuranceInputV1[],
  frontierInputs: PlanAssuranceInputV1["frontierInputs"],
): PlanAssuranceCoverage {
  if (tasks.length === 0) return "complete";
  const sealed = tasks.filter(({ seal }) => seal !== null).length;
  if (sealed === 0) return "unsealed";
  if (
    sealed < tasks.length ||
    frontierInputs.some(({ assuranceHash }) => assuranceHash === null)
  ) return "partial";
  return "complete";
}

function causeOrder(
  left: PlanAssuranceCauseV1,
  right: PlanAssuranceCauseV1,
): number {
  return (
    compareStableStrings(left.rootTaskId, right.rootTaskId) ||
    compareStableStrings(left.pathTaskIds.join("\u0000"), right.pathTaskIds.join("\u0000")) ||
    compareStableStrings(left.kind, right.kind)
  );
}

function uniqueCauses(
  causes: readonly PlanAssuranceCauseV1[],
): readonly PlanAssuranceCauseV1[] {
  const byKey = new Map<string, PlanAssuranceCauseV1>();
  for (const cause of causes) {
    const key = [cause.kind, cause.direct, ...cause.pathTaskIds].join("\u0000");
    byKey.set(key, cause);
  }
  return [...byKey.values()].sort(causeOrder);
}

function directCause(
  kind: PlanAssuranceCauseV1["kind"],
  taskId: string,
): PlanAssuranceCauseV1 {
  return {
    kind,
    direct: true,
    rootTaskId: taskId,
    affectedTaskId: taskId,
    pathTaskIds: [taskId],
  };
}

function inheritedCause(
  kind: PlanAssuranceCauseV1["kind"],
  rootTaskId: string,
  affectedTaskId: string,
  pathTaskIds: readonly string[],
): PlanAssuranceCauseV1 {
  return {
    kind,
    direct: false,
    rootTaskId,
    affectedTaskId,
    pathTaskIds,
  };
}

function unavailableResult(
  taskId: string,
  acceptedBasisHash: Sha256Digest | null,
  cause: PlanAssuranceCauseV1,
): PlanAssuranceTaskResultV1 {
  return {
    taskId,
    status: "unavailable",
    outcomeStatus: "unavailable",
    contractHash: null,
    computedBasisHash: null,
    acceptedBasisHash,
    computedInputs: [],
    exportedAssuranceHash: null,
    directCauses: cause.direct ? [cause] : [],
    inheritedCauses: cause.direct ? [] : [cause],
  };
}

function compareSealComponents(
  taskId: string,
  seal: NonNullable<TaskAssuranceInputV1["seal"]>,
  contractHash: Sha256Digest,
  currentInputs: readonly CurrentPlanningInput[],
  predecessorResults: ReadonlyMap<string, PlanAssuranceTaskResultV1>,
): {
  readonly consistent: boolean;
  readonly direct: readonly PlanAssuranceCauseV1[];
  readonly inherited: readonly PlanAssuranceCauseV1[];
} {
  if (
    !isSha256Digest(seal.acceptedContractHash) ||
    !isSha256Digest(seal.acceptedBasisHash) ||
    seal.acceptedInputs.some(({ assuranceHash }) => !isSha256Digest(assuranceHash))
  ) {
    return {
      consistent: false,
      direct: [directCause("accepted_seal_inconsistent", taskId)],
      inherited: [],
    };
  }
  let reproduced: Sha256Digest;
  try {
    reproduced = hashTaskPlanBasis(
      seal.acceptedContractHash,
      seal.acceptedInputs,
    );
  } catch {
    return {
      consistent: false,
      direct: [directCause("accepted_seal_inconsistent", taskId)],
      inherited: [],
    };
  }
  if (reproduced !== seal.acceptedBasisHash) {
    return {
      consistent: false,
      direct: [directCause("accepted_seal_inconsistent", taskId)],
      inherited: [],
    };
  }

  const direct: PlanAssuranceCauseV1[] = [];
  const inherited: PlanAssuranceCauseV1[] = [];
  if (seal.acceptedContractHash !== contractHash) {
    direct.push(directCause("task_contract_changed", taskId));
  }
  const acceptedByPredecessor = new Map(
    seal.acceptedInputs.map((item) => [item.predecessorTaskId, item] as const),
  );
  const currentByPredecessor = new Map(
    currentInputs.map((item) => [item.predecessorTaskId, item] as const),
  );
  const predecessorIds = [...new Set([
    ...acceptedByPredecessor.keys(),
    ...currentByPredecessor.keys(),
  ])].sort(compareStableStrings);
  for (const predecessorTaskId of predecessorIds) {
    const accepted = acceptedByPredecessor.get(predecessorTaskId);
    const current = currentByPredecessor.get(predecessorTaskId);
    if (
      accepted === undefined ||
      current === undefined ||
      accepted.relationMode !== current.relationMode
    ) {
      direct.push(directCause("planning_relation_changed", taskId));
      continue;
    }
    if (
      current.assuranceHash === null ||
      accepted.assuranceHash === current.assuranceHash
    ) continue;
    const predecessor = predecessorResults.get(predecessorTaskId);
    const predecessorCauses = predecessor === undefined
      ? []
      : [...predecessor.directCauses, ...predecessor.inheritedCauses];
    if (predecessorCauses.length === 0) {
      inherited.push(inheritedCause(
        predecessor?.outcomeStatus === "changed"
          ? "changed_outcome"
          : predecessor === undefined
          ? "frontier_commitment_changed"
          : "predecessor_commitment_changed",
        predecessorTaskId,
        taskId,
        [predecessorTaskId, taskId],
      ));
    } else {
      inherited.push(...predecessorCauses.map((cause) => inheritedCause(
        cause.kind,
        cause.rootTaskId,
        taskId,
        [...cause.pathTaskIds, taskId],
      )));
    }
  }
  return {
    consistent: true,
    direct: uniqueCauses(direct),
    inherited: uniqueCauses(inherited),
  };
}

function failure(
  input: PlanAssuranceInputV1,
  diagnostics: readonly PlanAssuranceDiagnosticV1[],
): PlanAssuranceEvaluationV1 {
  return {
    ok: false,
    modelVersion: input.modelVersion,
    hashModelVersion: input.hashModelVersion,
    coverage: null,
    effectiveDependencies: [],
    taskResults: [],
    directMismatchTaskIds: [],
    inheritedMismatchTaskIds: [],
    replanRequiredTaskIds: [],
    unavailableTaskIds: [],
    diagnostics,
  };
}

function supportedAssuranceModel(input: PlanAssuranceInputV1): boolean {
  if (input.modelVersion !== PLAN_ASSURANCE_MODEL_VERSION) return false;
  if (input.hashModelVersion !== PLAN_ASSURANCE_HASH_MODEL_VERSION && input.hashModelVersion !== 2) return false;
  const contractModel = input.hashModelVersion === 1
    ? "Perttool.TaskPlanContract.v1" : "Perttool.TaskPlanContract.v2";
  return input.tasks.every(({ contract }) => contract.model === contractModel);
}

export function evaluatePlanAssurance(
  input: PlanAssuranceInputV1,
): PlanAssuranceEvaluationV1 {
  const tasksById = new Map<string, TaskAssuranceInputV1>();
  const diagnostics: PlanAssuranceDiagnosticV1[] = [];
  for (const task of input.tasks) {
    const taskId = task.contract.taskId;
    if (taskId.length === 0 || tasksById.has(taskId)) {
      diagnostics.push(diagnostic(
        "PTASSURE-101",
        "task assurance input IDs must be nonempty and unique",
        taskId,
      ));
    } else {
      tasksById.set(taskId, task);
    }
    if (task.lifecycle !== "unfinished" && task.lifecycle !== "completed") {
      diagnostics.push(diagnostic(
        "PTASSURE-101",
        "task assurance lifecycle must be unfinished or completed",
        taskId,
      ));
    }
    if (task.lifecycle === "unfinished" && task.outcome !== null) {
      diagnostics.push(diagnostic(
        "PTASSURE-101",
        "unfinished task cannot carry completion outcome evidence",
        taskId,
      ));
    }
  }
  if (diagnostics.length > 0) return failure(input, diagnostics);

  const taskIds = [...tasksById.keys()].sort(compareStableStrings);
  const relations = deriveRelations(input, new Set(taskIds));
  if (relations.diagnostics.length > 0) {
    return failure(input, relations.diagnostics);
  }
  const cycle = cycleWitness(taskIds, relations.planning);
  if (cycle !== null) {
    return failure(input, [diagnostic(
      "PTASSURE-102",
      `planning dependency cycle: ${cycle.join(" -> ")}`,
      cycle[0] ?? null,
      { cycle_task_ids: cycle },
    )]);
  }

  const frontierByConsumer = new Map<string, typeof input.frontierInputs>();
  const frontierKeys = new Set<string>();
  for (const frontier of input.frontierInputs) {
    const key = pairKey(frontier.producerTaskId, frontier.consumerTaskId);
    const invalid =
      frontier.producerTaskId === frontier.consumerTaskId ||
      frontier.producerTaskId.length === 0 ||
      tasksById.has(frontier.producerTaskId) ||
      !tasksById.has(frontier.consumerTaskId) ||
      frontierKeys.has(key) ||
      (frontier.relationMode !== "both" &&
        frontier.relationMode !== "planning_only") ||
      (frontier.assuranceHash !== null &&
        !isSha256Digest(frontier.assuranceHash));
    if (invalid) {
      diagnostics.push(diagnostic(
        "PTASSURE-101",
        "frontier planning input is invalid or duplicated",
        frontier.consumerTaskId,
        {
          producer_task_id: frontier.producerTaskId,
          consumer_task_id: frontier.consumerTaskId,
        },
      ));
      continue;
    }
    frontierKeys.add(key);
    frontierByConsumer.set(frontier.consumerTaskId, [
      ...(frontierByConsumer.get(frontier.consumerTaskId) ?? []),
      frontier,
    ]);
  }
  if (diagnostics.length > 0) return failure(input, diagnostics);

  if (
    input.modelVersion === null &&
    input.hashModelVersion === null &&
    (
      input.explicitRelations.length > 0 ||
      input.frontierInputs.length > 0 ||
      input.tasks.some(({ seal, outcome }) => seal !== null || outcome !== null)
    )
  ) {
    return failure(input, [diagnostic(
      "PTASSURE-101",
      "assurance records require the project model fields",
      null,
    )]);
  }
  if (input.modelVersion === null && input.hashModelVersion === null) {
    return {
      ok: true,
      modelVersion: null,
      hashModelVersion: null,
      coverage: "not_enabled",
      effectiveDependencies: relations.effective,
      taskResults: taskIds.map((taskId) => ({
        taskId,
        status: "not_applicable",
        outcomeStatus: tasksById.get(taskId)!.lifecycle === "completed"
          ? "unavailable"
          : "unfinished",
        contractHash: null,
        computedBasisHash: null,
        acceptedBasisHash: tasksById.get(taskId)!.seal?.acceptedBasisHash ?? null,
        computedInputs: [],
        exportedAssuranceHash: null,
        directCauses: [],
        inheritedCauses: [],
      })),
      directMismatchTaskIds: [],
      inheritedMismatchTaskIds: [],
      replanRequiredTaskIds: [],
      unavailableTaskIds: [],
      diagnostics: [],
    };
  }
  if ((input.modelVersion === null) !== (input.hashModelVersion === null)) {
    return failure(input, [diagnostic(
      "PTASSURE-101",
      "plan assurance model and hash model must be enabled as a pair",
      null,
    )]);
  }
  if (
    input.modelVersion !== null &&
    (
      !Number.isSafeInteger(input.modelVersion) ||
      input.modelVersion <= 0 ||
      !Number.isSafeInteger(input.hashModelVersion) ||
      input.hashModelVersion! <= 0
    )
  ) {
    return failure(input, [diagnostic(
      "PTASSURE-101",
      "assurance model identities must be positive integers",
      null,
    )]);
  }

  const coverage = coverageFor(input.tasks, input.frontierInputs);
  if (!supportedAssuranceModel(input)) {
    const taskResults = taskIds.map((taskId) => unavailableResult(
      taskId,
      tasksById.get(taskId)!.seal?.acceptedBasisHash ?? null,
      directCause("unknown_model", taskId),
    ));
    return {
      ok: true,
      modelVersion: input.modelVersion,
      hashModelVersion: input.hashModelVersion,
      coverage,
      effectiveDependencies: relations.effective,
      taskResults,
      directMismatchTaskIds: [],
      inheritedMismatchTaskIds: [],
      replanRequiredTaskIds: [],
      unavailableTaskIds: taskIds,
      diagnostics: [],
    };
  }

  const contractHashes = new Map<string, Sha256Digest>();
  for (const taskId of taskIds) {
    try {
      contractHashes.set(
        taskId,
        hashTaskPlanContract(tasksById.get(taskId)!.contract),
      );
    } catch (error) {
      diagnostics.push(diagnostic(
        "PTASSURE-101",
        error instanceof Error ? error.message : "invalid task plan contract",
        taskId,
      ));
    }
  }
  if (diagnostics.length > 0) return failure(input, diagnostics);

  const incoming = new Map(taskIds.map((id) => [
    id,
    [] as EffectivePlanDependencyV1[],
  ]));
  for (const relation of relations.planning) {
    incoming.get(relation.successorTaskId)!.push(relation);
  }
  for (const values of incoming.values()) values.sort(relationOrder);

  const results = new Map<string, PlanAssuranceTaskResultV1>();
  for (const taskId of topologicalOrder(taskIds, relations.planning)) {
    const task = tasksById.get(taskId)!;
    const contractHash = contractHashes.get(taskId)!;
    const currentInputDescriptors: CurrentPlanningInput[] = [];
    const unavailablePredecessors: string[] = [];
    for (const relation of incoming.get(taskId)!) {
      const predecessor = results.get(relation.predecessorTaskId)!;
      if (predecessor.exportedAssuranceHash === null) {
        unavailablePredecessors.push(relation.predecessorTaskId);
      }
      currentInputDescriptors.push({
        predecessorTaskId: relation.predecessorTaskId,
        relationMode: relation.mode as PlanningInputMode,
        assuranceHash: predecessor.exportedAssuranceHash,
      });
    }
    for (const frontier of frontierByConsumer.get(taskId) ?? []) {
      if (frontier.assuranceHash === null) {
        unavailablePredecessors.push(frontier.producerTaskId);
      }
      currentInputDescriptors.push({
        predecessorTaskId: frontier.producerTaskId,
        relationMode: frontier.relationMode,
        assuranceHash: frontier.assuranceHash,
      });
    }
    currentInputDescriptors.sort((left, right) =>
      compareStableStrings(left.predecessorTaskId, right.predecessorTaskId)
    );
    if (
      currentInputDescriptors.some(
        (item, index) =>
          index > 0 &&
          currentInputDescriptors[index - 1]!.predecessorTaskId ===
            item.predecessorTaskId,
      )
    ) {
      return failure(input, [diagnostic(
        "PTASSURE-101",
        "task has duplicate current planning predecessor commitments",
        taskId,
      )]);
    }
    const currentInputs: AcceptedPlanningInputV1[] = currentInputDescriptors
      .filter((item): item is AcceptedPlanningInputV1 =>
        item.assuranceHash !== null
      );

    const computedBasisHash = unavailablePredecessors.length === 0
      ? hashTaskPlanBasis(contractHash, currentInputs)
      : null;
    const seal = task.seal;
    const acceptedBasisHash = seal?.acceptedBasisHash ?? null;
    let directCauses: readonly PlanAssuranceCauseV1[] = [];
    let inheritedCauses: readonly PlanAssuranceCauseV1[] = [];
    let sealConsistent = true;
    if (seal !== null) {
      const comparison = compareSealComponents(
        taskId,
        seal,
        contractHash,
        currentInputDescriptors,
        results,
      );
      sealConsistent = comparison.consistent;
      directCauses = comparison.direct;
      inheritedCauses = comparison.inherited;
    }
    if (unavailablePredecessors.length > 0) {
      inheritedCauses = uniqueCauses([
        ...inheritedCauses,
        ...unavailablePredecessors.flatMap((predecessorTaskId) => {
          const predecessor = results.get(predecessorTaskId);
          const predecessorCauses = predecessor === undefined
            ? []
            : [...predecessor.directCauses, ...predecessor.inheritedCauses];
          return predecessorCauses.length === 0
            ? [inheritedCause(
                "predecessor_unavailable",
                predecessorTaskId,
                taskId,
                [predecessorTaskId, taskId],
              )]
            : predecessorCauses.map((cause) => inheritedCause(
                cause.kind,
                cause.rootTaskId,
                taskId,
                [...cause.pathTaskIds, taskId],
              ));
        }),
      ]);
    }

    let outcomeStatus: PlanAssuranceOutcomeStatus = task.lifecycle === "completed"
      ? "unavailable"
      : "unfinished";
    let exportedAssuranceHash: Sha256Digest | null =
      task.lifecycle === "unfinished" ? computedBasisHash : null;
    let outcomeUnavailableCause: PlanAssuranceCauseV1 | null = null;
    if (task.lifecycle === "completed") {
      const outcome = task.outcome;
      if (outcome === null) {
        outcomeUnavailableCause = directCause("outcome_missing", taskId);
      } else if (
        outcome.modelVersion !== 1 ||
        !isSha256Digest(outcome.againstBasisHash) ||
        (outcome.status !== "conformant" && outcome.status !== "changed") ||
        (outcome.summary !== null && typeof outcome.summary !== "string") ||
        (outcome.status === "conformant" && outcome.summary !== null) ||
        (outcome.status === "changed" &&
          (outcome.summary === null || outcome.summary.length === 0))
      ) {
        outcomeUnavailableCause = directCause("outcome_invalid", taskId);
      } else if (
        computedBasisHash === null ||
        acceptedBasisHash === null ||
        outcome.againstBasisHash !== computedBasisHash ||
        outcome.againstBasisHash !== acceptedBasisHash
      ) {
        outcomeUnavailableCause = directCause("outcome_basis_mismatch", taskId);
      } else if (outcome.status === "conformant") {
        outcomeStatus = "conformant";
        exportedAssuranceHash = computedBasisHash;
      } else {
        try {
          exportedAssuranceHash = hashTaskOutcomeCommitment(
            taskId,
            outcome.againstBasisHash,
            outcome.summary!,
          );
          outcomeStatus = "changed";
        } catch {
          exportedAssuranceHash = null;
          outcomeUnavailableCause = directCause("outcome_invalid", taskId);
        }
      }
    }
    if (outcomeUnavailableCause !== null) {
      directCauses = uniqueCauses([...directCauses, outcomeUnavailableCause]);
    }

    let status: PlanAssuranceTaskStatus;
    if (seal === null) {
      status = "unsealed";
    } else if (!sealConsistent) {
      status = "unavailable";
      exportedAssuranceHash = null;
    } else if (computedBasisHash === null) {
      status = "unavailable";
      exportedAssuranceHash = null;
    } else if (
      directCauses.some(({ kind }) =>
        kind === "task_contract_changed" ||
        kind === "planning_relation_changed"
      ) ||
      inheritedCauses.some(({ kind }) => kind !== "predecessor_unavailable") ||
      acceptedBasisHash !== computedBasisHash
    ) {
      status = "review_required";
    } else if (outcomeUnavailableCause !== null) {
      status = "unavailable";
      exportedAssuranceHash = null;
    } else {
      const hasUnfinishedPredecessor = incoming.get(taskId)!.some((relation) =>
        tasksById.get(relation.predecessorTaskId)!.lifecycle === "unfinished"
      );
      status = task.lifecycle === "unfinished" && hasUnfinishedPredecessor
        ? "conditional"
        : "verified";
    }

    results.set(taskId, {
      taskId,
      status,
      outcomeStatus,
      contractHash,
      computedBasisHash,
      acceptedBasisHash,
      computedInputs: currentInputs,
      exportedAssuranceHash,
      directCauses: uniqueCauses(directCauses),
      inheritedCauses: uniqueCauses(inheritedCauses),
    });
  }

  const taskResults = taskIds.map((taskId) => results.get(taskId)!);
  return {
    ok: true,
    modelVersion: input.modelVersion,
    hashModelVersion: input.hashModelVersion,
    coverage,
    effectiveDependencies: relations.effective,
    taskResults,
    directMismatchTaskIds: taskResults
      .filter(({ directCauses }) => directCauses.some(({ kind }) =>
        kind === "task_contract_changed" ||
        kind === "planning_relation_changed"
      ))
      .map(({ taskId }) => taskId),
    inheritedMismatchTaskIds: taskResults
      .filter(({ status, inheritedCauses }) =>
        status === "review_required" && inheritedCauses.length > 0
      )
      .map(({ taskId }) => taskId),
    replanRequiredTaskIds: taskResults
      .filter(({ status }) => status === "review_required")
      .map(({ taskId }) => taskId),
    unavailableTaskIds: taskResults
      .filter(({ status }) => status === "unavailable")
      .map(({ taskId }) => taskId),
    diagnostics: [],
  };
}

export function sealTaskResult(
  result: PlanAssuranceTaskResultV1,
): NonNullable<TaskAssuranceInputV1["seal"]> {
  if (result.contractHash === null || result.computedBasisHash === null) {
    throw new Error(`task ${result.taskId} has no sealable computed basis`);
  }
  return {
    acceptedContractHash: result.contractHash,
    acceptedBasisHash: result.computedBasisHash,
    acceptedInputs: result.computedInputs,
  };
}
