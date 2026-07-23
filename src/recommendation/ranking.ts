import type { AnalysisEdge } from "../analysis/graph.js";
import { compareStableStrings } from "../model/diagnostics.js";
import { fieldNamed } from "../model/syntax.js";
import { ZERO, compare } from "../model/rational.js";
import type {
  RecommendationCandidateComparison,
  RecommendationCandidateFacts,
  RecommendationCriticalClass,
  RecommendationDistance,
  RecommendationRankingInput,
  RecommendationRankingResult,
  RecommendationRankingRuleId,
  RecommendationResourceFact,
  RecommendationResourceFeasibility,
  RecommendationTaskDecision,
} from "./types.js";

export const RECOMMENDATION_RANKING_ALGORITHM_ID =
  "perttool.recommendation-ranking.lexicographic-frontier" as const;
export const RECOMMENDATION_RANKING_ALGORITHM_VERSION = 1 as const;

const rankingRules: readonly RecommendationRankingRuleId[] = [
  "critical_class",
  "lower_total_float",
  "higher_explicit_priority",
  "higher_new_ready_count",
  "higher_new_gate_count",
  "higher_new_milestone_count",
  "shorter_next_gate_distance",
  "shorter_finish_distance",
  "longer_expected_duration",
  "task_id_tiebreak",
];

const criticalClassRank: Readonly<Record<RecommendationCriticalClass, number>> = {
  driving: 0,
  near_critical: 1,
  non_critical: 2,
};

function ascendingNumber(left: number, right: number): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function descendingNumber(left: number, right: number): number {
  return left > right ? -1 : left < right ? 1 : 0;
}

function compareDistance(
  left: RecommendationDistance,
  right: RecommendationDistance,
): number {
  if (left === right) return 0;
  if (left === "infinity") return 1;
  if (right === "infinity") return -1;
  return ascendingNumber(left, right);
}

function compareRule(
  left: RecommendationCandidateFacts,
  right: RecommendationCandidateFacts,
  rule: RecommendationRankingRuleId,
): number {
  switch (rule) {
    case "critical_class":
      return ascendingNumber(
        criticalClassRank[left.precedenceCriticalClass],
        criticalClassRank[right.precedenceCriticalClass],
      );
    case "lower_total_float":
      return compare(left.precedenceTotalFloat, right.precedenceTotalFloat);
    case "higher_explicit_priority":
      return descendingNumber(left.explicitPriority, right.explicitPriority);
    case "higher_new_ready_count":
      return descendingNumber(left.newReadyTaskCount, right.newReadyTaskCount);
    case "higher_new_gate_count":
      return descendingNumber(
        left.newSatisfiedGateCount,
        right.newSatisfiedGateCount,
      );
    case "higher_new_milestone_count":
      return descendingNumber(
        left.newReachedMilestoneCount,
        right.newReachedMilestoneCount,
      );
    case "shorter_next_gate_distance":
      return compareDistance(
        left.nextGateTaskDistance,
        right.nextGateTaskDistance,
      );
    case "shorter_finish_distance":
      return ascendingNumber(left.finishTaskDistance, right.finishTaskDistance);
    case "longer_expected_duration":
      return compare(right.expectedDuration, left.expectedDuration);
    case "task_id_tiebreak":
      return compareStableStrings(left.taskId, right.taskId);
  }
}

export function compareRecommendationCandidates(
  left: RecommendationCandidateFacts,
  right: RecommendationCandidateFacts,
): number {
  for (const rule of rankingRules) {
    const result = compareRule(left, right, rule);
    if (result !== 0) return result;
  }
  return 0;
}

export function explainRecommendationCandidateComparison(
  left: RecommendationCandidateFacts,
  right: RecommendationCandidateFacts,
): RecommendationCandidateComparison {
  if (left.taskId === right.taskId) {
    throw new Error("recommendation comparison requires distinct task IDs");
  }
  const ruleResults = rankingRules.map((rule) => ({
    rule,
    result: compareRule(left, right, rule),
  }));
  const decisiveIndex = ruleResults.findIndex(({ result }) => result !== 0);
  if (decisiveIndex < 0) {
    throw new Error("complete recommendation order did not distinguish task IDs");
  }
  const decisive = ruleResults[decisiveIndex]!;
  const leftWins = decisive.result < 0;
  return {
    winnerTaskId: leftWins ? left.taskId : right.taskId,
    alternativeTaskId: leftWins ? right.taskId : left.taskId,
    decisiveRuleId: decisive.rule,
    priorTiedRuleIds: ruleResults
      .slice(0, decisiveIndex)
      .map(({ rule }) => rule),
    contributingRuleIds: ruleResults
      .slice(decisiveIndex + 1)
      .filter(({ result }) => result !== 0 && (result < 0) === leftWins)
      .map(({ rule }) => rule),
  };
}

function taskStatus(edge: AnalysisEdge): string {
  return edge.status ?? "planned";
}

function completionCounterfactual(
  input: RecommendationRankingInput,
  candidate: AnalysisEdge,
): Pick<
  RecommendationCandidateFacts,
  | "newReadyTaskIds"
  | "newReadyTaskCount"
  | "newSatisfiedGateIds"
  | "newSatisfiedGateCount"
  | "newReachedMilestoneIds"
  | "newReachedMilestoneCount"
> {
  const { document, effectiveReached } = input.graph;
  const milestones = document.declarations
    .filter((declaration) => declaration.kind === "milestone")
    .sort((left, right) => compareStableStrings(left.id, right.id));
  const edges = document.declarations
    .filter((declaration) => declaration.kind === "task" || declaration.kind === "gate")
    .sort((left, right) => compareStableStrings(left.id, right.id));
  const incoming = new Map(milestones.map(({ id }) => [id, [] as typeof edges[number][]]));
  for (const edge of edges) incoming.get(edge.to!)!.push(edge);
  const reached = new Set(effectiveReached);
  const satisfied = (edge: (typeof edges)[number]): boolean =>
    reached.has(edge.from!) &&
    (edge.kind === "gate" ||
      edge.id === candidate.id ||
      fieldNamed(edge, "status")?.value === "done");

  let changed = true;
  while (changed) {
    changed = false;
    for (const milestone of milestones) {
      if (reached.has(milestone.id)) continue;
      const edgesIn = incoming.get(milestone.id)!;
      if (edgesIn.length > 0 && edgesIn.every(satisfied)) {
        reached.add(milestone.id);
        changed = true;
      }
    }
  }

  const newlyReached = [...reached]
    .filter((id) => !effectiveReached.has(id))
    .sort(compareStableStrings);
  const newReadyTaskIds = edges
    .filter(
      (edge) =>
        edge.kind === "task" &&
        edge.id !== candidate.id &&
        (fieldNamed(edge, "status")?.value ?? "planned") === "planned" &&
        reached.has(edge.from!) &&
        !effectiveReached.has(edge.from!),
    )
    .map(({ id }) => id);
  const newSatisfiedGateIds = edges
    .filter(
      (edge) =>
        edge.kind === "gate" &&
        reached.has(edge.from!) &&
        !effectiveReached.has(edge.from!),
    )
    .map(({ id }) => id);
  return {
    newReadyTaskIds,
    newReadyTaskCount: newReadyTaskIds.length,
    newSatisfiedGateIds,
    newSatisfiedGateCount: newSatisfiedGateIds.length,
    newReachedMilestoneIds: newlyReached,
    newReachedMilestoneCount: newlyReached.length,
  };
}

function structuralDistances(input: RecommendationRankingInput): ReadonlyMap<
  string,
  { readonly finish: number; readonly nextGate: RecommendationDistance }
> {
  const { graph } = input;
  const result = new Map<
    string,
    { readonly finish: number; readonly nextGate: RecommendationDistance }
  >([[graph.finish, { finish: 0, nextGate: "infinity" }]]);
  for (const vertex of [...graph.topologicalOrder].reverse()) {
    if (vertex === graph.finish) continue;
    let finish: number | undefined;
    let nextGate: RecommendationDistance = "infinity";
    for (const edge of graph.outgoing.get(vertex)!) {
      const downstream = result.get(edge.target);
      if (downstream === undefined) {
        throw new Error(`recommendation distance missing downstream vertex ${edge.target}`);
      }
      const cost = edge.kind === "gate" || taskStatus(edge) === "done" ? 0 : 1;
      const finishCandidate = cost + downstream.finish;
      if (finish === undefined || finishCandidate < finish) finish = finishCandidate;
      const gateCandidate: RecommendationDistance =
        edge.kind === "gate"
          ? 0
          : downstream.nextGate === "infinity"
            ? "infinity"
            : cost + downstream.nextGate;
      if (compareDistance(gateCandidate, nextGate) < 0) nextGate = gateCandidate;
    }
    if (finish === undefined) {
      throw new Error(`recommendation finish distance missing path from ${vertex}`);
    }
    result.set(vertex, { finish, nextGate });
  }
  return result;
}

function criticalClass(
  totalFloat: RecommendationCandidateFacts["precedenceTotalFloat"],
  epsilon: RecommendationRankingInput["graph"]["criticalEpsilon"],
): RecommendationCriticalClass {
  if (compare(totalFloat, ZERO) === 0) return "driving";
  if (compare(totalFloat, epsilon) <= 0) return "near_critical";
  return "non_critical";
}

function candidateFacts(
  input: RecommendationRankingInput,
): readonly RecommendationCandidateFacts[] {
  const timingById = new Map(input.precedence.edges.map((timing) => [timing.id, timing]));
  const distances = structuralDistances(input);
  return input.graph.edges
    .filter(
      (edge) =>
        edge.kind === "task" &&
        edge.status === "planned" &&
        input.graph.effectiveReached.has(edge.source),
    )
    .map((edge): RecommendationCandidateFacts => {
      const timing = timingById.get(edge.id);
      if (timing === undefined) {
        throw new Error(`recommendation candidate ${edge.id} has no precedence timing`);
      }
      const distance = distances.get(edge.target);
      if (distance === undefined) {
        throw new Error(`recommendation candidate ${edge.id} has no structural distance`);
      }
      return {
        taskId: edge.id,
        precedenceTotalFloat: timing.totalFloat,
        precedenceCriticalClass: criticalClass(
          timing.totalFloat,
          input.graph.criticalEpsilon,
        ),
        explicitPriority: edge.priority,
        ...completionCounterfactual(input, edge),
        nextGateTaskDistance: distance.nextGate,
        finishTaskDistance: distance.finish,
        expectedDuration: edge.expected,
        requirements: [...edge.requirements]
          .sort((left, right) => compareStableStrings(left.resourceId, right.resourceId))
          .map(({ resourceId, units }) => ({ resourceId, units })),
      };
    })
    .sort(compareRecommendationCandidates);
}

function capacities(input: RecommendationRankingInput): ReadonlyMap<string, number> {
  const resolved = new Map(
    [...input.graph.resources]
      .sort(([left], [right]) => compareStableStrings(left, right))
      .map(([id, resource]) => [id, resource.capacity]),
  );
  for (const [id, capacity] of input.appliedCapacities ?? []) {
    if (!resolved.has(id)) throw new Error(`recommendation capacity resource ${id} is unknown`);
    if (!Number.isSafeInteger(capacity) || capacity < 0) {
      throw new Error(`recommendation capacity for ${id} is not a nonnegative safe integer`);
    }
    resolved.set(id, capacity);
  }
  return resolved;
}

interface ResourceSnapshot {
  readonly capacities: ReadonlyMap<string, number>;
  readonly activeUsage: ReadonlyMap<string, number>;
  readonly activeTaskIds: ReadonlyMap<string, readonly string[]>;
}

function resourceSnapshot(input: RecommendationRankingInput): ResourceSnapshot {
  const resolvedCapacities = capacities(input);
  const usage = new Map([...resolvedCapacities.keys()].map((id) => [id, 0]));
  const occupants = new Map(
    [...resolvedCapacities.keys()].map((id) => [id, [] as string[]]),
  );
  for (const edge of input.graph.edges) {
    if (edge.kind !== "task" || edge.status !== "active") continue;
    for (const requirement of edge.requirements) {
      usage.set(requirement.resourceId, usage.get(requirement.resourceId)! + requirement.units);
      occupants.get(requirement.resourceId)!.push(edge.id);
    }
  }
  for (const taskIds of occupants.values()) taskIds.sort(compareStableStrings);
  for (const [id, activeUsage] of usage) {
    if (activeUsage > resolvedCapacities.get(id)!) {
      throw new Error(`recommendation active usage exceeds capacity for ${id}`);
    }
  }
  return {
    capacities: resolvedCapacities,
    activeUsage: usage,
    activeTaskIds: occupants,
  };
}

function requirementFor(
  candidate: RecommendationCandidateFacts | undefined,
  resourceId: string,
): number {
  return candidate?.requirements.find((item) => item.resourceId === resourceId)?.units ?? 0;
}

function selectedUsageFor(
  selected: readonly RecommendationCandidateFacts[],
  resourceId: string,
): number {
  return selected.reduce((sum, candidate) => sum + requirementFor(candidate, resourceId), 0);
}

function feasibility(
  snapshot: ResourceSnapshot,
  selected: readonly RecommendationCandidateFacts[],
  candidate?: RecommendationCandidateFacts,
): RecommendationResourceFeasibility {
  const resources: RecommendationResourceFact[] = [...snapshot.capacities]
    .sort(([left], [right]) => compareStableStrings(left, right))
    .map(([resourceId, capacity]) => {
      const activeUsage = snapshot.activeUsage.get(resourceId)!;
      const selectedUsage = selectedUsageFor(selected, resourceId);
      const required = requirementFor(candidate, resourceId);
      const available = capacity - activeUsage - selectedUsage;
      const deficit = Math.max(0, required - available);
      return {
        resourceId,
        capacity,
        activeUsage,
        selectedUsage,
        required,
        available,
        deficit,
        activeTaskIds: snapshot.activeTaskIds.get(resourceId)!,
        selectedTaskIds: selected
          .filter((item) => requirementFor(item, resourceId) > 0)
          .map(({ taskId }) => taskId),
      };
    });
  return {
    feasible: resources.every(({ deficit }) => deficit === 0),
    resources,
  };
}

function blockerIds(
  resourceFacts: readonly RecommendationResourceFact[],
  field: "activeTaskIds" | "selectedTaskIds",
): readonly string[] {
  const result: string[] = [];
  for (const resource of resourceFacts) {
    if (resource.deficit === 0) continue;
    for (const taskId of resource[field]) {
      if (!result.includes(taskId)) result.push(taskId);
    }
  }
  return result;
}

function horizon(
  candidates: readonly RecommendationCandidateFacts[],
): readonly RecommendationCandidateFacts[] {
  const first = candidates[0];
  if (first === undefined) return [];
  if (
    first.precedenceCriticalClass === "driving" ||
    first.precedenceCriticalClass === "near_critical"
  ) {
    return candidates.filter(
      ({ precedenceCriticalClass }) =>
        precedenceCriticalClass === first.precedenceCriticalClass,
    );
  }
  return candidates.filter(
    ({ precedenceTotalFloat }) =>
      compare(precedenceTotalFloat, first.precedenceTotalFloat) === 0,
  );
}

export function rankRecommendationCandidates(
  input: RecommendationRankingInput,
): RecommendationRankingResult {
  const candidates = candidateFacts(input);
  const horizonCandidates = horizon(candidates);
  const horizonIds = new Set(horizonCandidates.map(({ taskId }) => taskId));
  const snapshot = resourceSnapshot(input);
  const selected: RecommendationCandidateFacts[] = [];
  const scanResults = new Map<
    string,
    { readonly scanIndex: number; readonly feasibility: RecommendationResourceFeasibility }
  >();
  for (const [scanIndex, candidate] of horizonCandidates.entries()) {
    const check = feasibility(snapshot, selected, candidate);
    scanResults.set(candidate.taskId, { scanIndex, feasibility: check });
    if (check.feasible) selected.push(candidate);
  }
  const selectedIds = new Set(selected.map(({ taskId }) => taskId));
  const jointFeasibility = feasibility(snapshot, selected);
  if (!jointFeasibility.feasible) {
    throw new Error("recommendation selected set is not jointly feasible");
  }
  const horizonFirst = horizonCandidates[0]?.taskId ?? null;
  const taskDecisions = candidates.map(
    (candidate, rankIndex): RecommendationTaskDecision => {
      const selectedMember = selectedIds.has(candidate.taskId);
      const horizonMember = horizonIds.has(candidate.taskId);
      const scan = scanResults.get(candidate.taskId);
      const tierFeasibility = selectedMember
        ? jointFeasibility
        : feasibility(snapshot, selected, candidate);
      const tier = selectedMember
        ? "recommended"
        : tierFeasibility.feasible
          ? "allowed"
          : "deferred";
      const selectionBlockers = scan?.feasibility.resources ?? [];
      const selectedBlockerTaskIds = selectedMember
        ? []
        : blockerIds(tierFeasibility.resources, "selectedTaskIds");
      const activeBlockerTaskIds = selectedMember
        ? []
        : blockerIds(tierFeasibility.resources, "activeTaskIds");
      const primaryHigherPriorityTaskId = selectedMember
        ? null
        : horizonMember
          ? (blockerIds(selectionBlockers, "selectedTaskIds")[0] ?? null)
          : horizonFirst;
      return {
        facts: candidate,
        rankIndex,
        horizonMember,
        selection: {
          evaluated: scan !== undefined,
          scanIndex: scan?.scanIndex ?? null,
          selected: selectedMember,
          feasibility: scan?.feasibility ?? null,
        },
        recommendedSetMember: selectedMember,
        tier,
        tierFeasibility,
        primaryHigherPriorityTaskId,
        selectedBlockerTaskIds,
        activeBlockerTaskIds,
      };
    },
  );
  return {
    algorithmId: RECOMMENDATION_RANKING_ALGORITHM_ID,
    algorithmVersion: RECOMMENDATION_RANKING_ALGORITHM_VERSION,
    optimal: false,
    candidates,
    horizonTaskIds: horizonCandidates.map(({ taskId }) => taskId),
    recommendedTaskIds: selected.map(({ taskId }) => taskId),
    jointFeasibility,
    taskDecisions,
  };
}
