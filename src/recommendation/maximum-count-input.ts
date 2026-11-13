// R: Bind the exact dispatch input to full ranking, eligibility, source and resource evidence.
import { compareStableStrings } from "../model/diagnostics.js";
import type { Rational } from "../model/rational.js";
import { rfc8785Json } from "../model/rfc8785.js";
import { sha256DigestUtf8 } from "../model/sha256.js";
import { dispatchModelToJson } from "./maximum-count-json.js";
import { explainRecommendationCandidateComparison, rankRecommendationCandidates } from "./ranking.js";
import { selectMaximumCountTasks } from "./maximum-count.js";
import type { RecommendationRankingInput } from "./types.js";
import type { DispatchEligibility, DispatchRankGroup, DispatchSelectionEvidence } from "./maximum-count-contract.js";

function exact(value: Rational) {
  return Object.freeze({ numerator: String(value.numerator), denominator: String(value.denominator) });
}

export function buildMaximumCountEvidence(
  rankingInput: RecommendationRankingInput,
  sourceDigest: string,
  grammarVersion: number,
  eligibility: ReadonlyMap<string, DispatchEligibility>,
): DispatchSelectionEvidence {
  const ranking = rankRecommendationCandidates(rankingInput);
  const groups: { rankGroup: number; taskIds: string[]; rankKey: DispatchRankGroup["rankKey"] }[] = [];
  const candidates = ranking.candidates.map((candidate, index) => {
    const previous = ranking.candidates[index - 1];
    if (previous === undefined ||
      explainRecommendationCandidateComparison(previous, candidate).decisiveRuleId !== "task_id_tiebreak") {
      groups.push({ rankGroup: groups.length, taskIds: [], rankKey: Object.freeze({
        criticalClass: candidate.precedenceCriticalClass,
        precedenceTotalFloat: exact(candidate.precedenceTotalFloat),
        explicitPriority: candidate.explicitPriority,
        newReadyTaskCount: candidate.newReadyTaskCount,
        newSatisfiedGateCount: candidate.newSatisfiedGateCount,
        newReachedMilestoneCount: candidate.newReachedMilestoneCount,
        nextGateTaskDistance: candidate.nextGateTaskDistance,
        finishTaskDistance: candidate.finishTaskDistance,
        expectedDuration: exact(candidate.expectedDuration),
      }) });
    }
    const group = groups.at(-1)!;
    group.taskIds.push(candidate.taskId);
    const state = eligibility.get(candidate.taskId);
    if (state === undefined) throw new Error(`dispatch eligibility is missing for ${candidate.taskId}`);
    return Object.freeze({
      taskId: candidate.taskId, rankGroup: group.rankGroup,
      requirements: Object.freeze(candidate.requirements.map(({ resourceId, units }) => Object.freeze({ resourceId, units }))
        .sort((a, b) => compareStableStrings(a.resourceId, b.resourceId))),
      ...state,
    });
  });
  const graph = rankingInput.graph;
  const activeTasks = Object.freeze(graph.edges.filter((edge) => edge.kind === "task" && edge.status === "active")
    .map((edge) => Object.freeze({ taskId: edge.id,
      requirements: Object.freeze(edge.requirements.map(({ resourceId, units }) => Object.freeze({ resourceId, units }))
        .sort((a, b) => compareStableStrings(a.resourceId, b.resourceId))),
    })).sort((a, b) => compareStableStrings(a.taskId, b.taskId)));
  const selection = selectMaximumCountTasks({
    sourceDigest, activeTasks,
    capacities: [...graph.resources].map(([resourceId, resource]) => ({
      resourceId, units: rankingInput.appliedCapacities?.get(resourceId) ?? resource.capacity,
    })),
    candidates: candidates.map((candidate) => ({ ...candidate,
      eligibility: candidate.timeEligibility !== "eligible" ? "time_withheld"
        : candidate.assuranceEligibility !== "eligible" ? "assurance_withheld" : "eligible",
    })),
  });
  const input = Object.freeze({
    modelVersion: 1 as const, sourceDigest, grammarVersion, durationUnit: graph.durationUnit,
    criticalEpsilon: exact(graph.criticalEpsilon),
    capacityOverrides: Object.freeze([...rankingInput.appliedCapacities ?? []]
      .sort(([a], [b]) => compareStableStrings(a, b))
      .map(([resourceId, capacity]) => Object.freeze({ resourceId, capacity }))),
    resources: Object.freeze(selection.resources.map((resource) => Object.freeze({
      resourceId: resource.resourceId, capacity: resource.capacity, activeUsage: resource.activeUsage,
      activeTaskIds: Object.freeze(activeTasks.filter((task) => task.requirements.some((item) => item.resourceId === resource.resourceId))
        .map((task) => task.taskId)),
    }))),
    activeTasks, candidates: Object.freeze(candidates),
    rankGroups: Object.freeze(groups.map((group) => Object.freeze({ ...group, taskIds: Object.freeze(group.taskIds) }))),
  });
  return Object.freeze({
    modelVersion: 1, inputDigest: sha256DigestUtf8(rfc8785Json(dispatchModelToJson(input))), input,
    selectedTaskIds: selection.selectedTaskIds, maximumTaskCount: selection.maximumTaskCount,
    resources: selection.resources,
    boundaryGroups: Object.freeze(selection.boundaryGroups.map((group) => Object.freeze({ ...group,
      outsideSelectedTaskIds: Object.freeze(selection.selectedTaskIds.filter((id) => !group.selectedTaskIds.includes(id))),
    }))),
  });
}
