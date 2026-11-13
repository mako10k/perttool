// R: Adapt existing full-frontier ranking facts to the exact count-first dispatch input.
import { selectMaximumCountTasks } from "./maximum-count.js";
import { explainRecommendationCandidateComparison, rankRecommendationCandidates } from "./ranking.js";
import type { RecommendationRankingInput } from "./types.js";
import type { DispatchCandidate, MaximumCountSelection } from "./maximum-count-types.js";

export interface MaximumCountEligibility {
  readonly sourceDigest: string;
  readonly tasks: ReadonlyMap<string, DispatchCandidate["eligibility"]>;
}

/** Eligibility must be computed for the same source snapshot by Application.
 * There is deliberately no default for missing eligibility: absence does not
 * establish either temporal or assurance eligibility for a ready candidate.
 */
export function selectMaximumCountFromRanking(
  input: RecommendationRankingInput,
  eligibility: MaximumCountEligibility,
): MaximumCountSelection {
  const ranking = rankRecommendationCandidates(input);
  let rankGroup = 0;
  const candidates = ranking.candidates.map((facts, index): DispatchCandidate => {
    const previous = ranking.candidates[index - 1];
    if (previous !== undefined &&
      explainRecommendationCandidateComparison(previous, facts).decisiveRuleId !== "task_id_tiebreak") {
      rankGroup++;
    }
    const state = eligibility.tasks.get(facts.taskId);
    if (state === undefined) throw new Error(`dispatch eligibility is missing for ${facts.taskId}`);
    return { taskId: facts.taskId, rankGroup, requirements: facts.requirements, eligibility: state };
  });
  return selectMaximumCountTasks({
    sourceDigest: eligibility.sourceDigest,
    candidates,
    capacities: [...input.graph.resources].map(([resourceId, resource]) => ({
      resourceId, units: input.appliedCapacities?.get(resourceId) ?? resource.capacity,
    })),
    activeTasks: input.graph.edges.filter((edge) => edge.kind === "task" && edge.status === "active")
      .map((edge) => ({ taskId: edge.id, requirements: edge.requirements })),
  });
}
