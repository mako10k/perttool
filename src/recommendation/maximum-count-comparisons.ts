// R: Explain adjacent semantic ranking with existing typed facts and comparator rules.
import { explainRecommendationCandidateComparison } from "./ranking.js";
import type { RecommendationCandidateFacts, RecommendationRankingRuleId } from "./types.js";
import type { RecommendationFact } from "./explanation-types.js";
import type { DispatchComparison } from "./maximum-count-contract.js";
import { dispatchEntity } from "./maximum-count-records.js";

const rankFactByRule: Readonly<Record<RecommendationRankingRuleId, string>> = {
  critical_class: "precedence_critical_class", lower_total_float: "precedence_total_float",
  higher_explicit_priority: "explicit_priority", higher_new_ready_count: "new_ready_task_count",
  higher_new_gate_count: "new_satisfied_gate_count", higher_new_milestone_count: "new_reached_milestone_count",
  shorter_next_gate_distance: "next_gate_task_distance", shorter_finish_distance: "finish_task_distance",
  longer_expected_duration: "expected_duration", task_id_tiebreak: "task_id",
};
export const dispatchRankFactKinds = new Set(Object.values(rankFactByRule));

export function buildDispatchComparisons(candidates: readonly RecommendationCandidateFacts[],
  facts: readonly RecommendationFact[]): readonly DispatchComparison[] {
  const byTaskAndKind = new Map(facts.map((fact) => [`${fact.subject.id}/${fact.kind}`, fact.id]));
  const factId = (taskId: string, kind: string) => {
    const id = byTaskAndKind.get(`${taskId}/${kind}`);
    if (id === undefined) throw new Error(`missing dispatch rank fact ${taskId}/${kind}`);
    return id;
  };
  return Object.freeze(candidates.slice(1).map((alternative, index): DispatchComparison => {
    const subject = candidates[index]!;
    const comparison = explainRecommendationCandidateComparison(subject, alternative);
    const kind = rankFactByRule[comparison.decisiveRuleId];
    const winnerFact = factId(comparison.winnerTaskId, kind);
    const loserFact = factId(comparison.alternativeTaskId, kind);
    const descending = comparison.decisiveRuleId.startsWith("higher_") || comparison.decisiveRuleId === "longer_expected_duration";
    return Object.freeze<DispatchComparison>({
      id: `rec:comparison:candidate_ranking:${subject.taskId}:${alternative.taskId}:${comparison.decisiveRuleId}:0`,
      scope: "candidate_ranking", subjectTaskId: subject.taskId, alternativeTaskId: alternative.taskId,
      winnerTaskId: comparison.winnerTaskId, loserTaskId: comparison.alternativeTaskId,
      decisiveRule: dispatchEntity("policy_rule", comparison.decisiveRuleId),
      decisiveExpression: { kind: "compare", left: { kind: "fact", factId: winnerFact },
        relation: descending ? "greater_than" : "less_than", right: { kind: "fact", factId: loserFact } },
      priorTiedRuleIds: comparison.priorTiedRuleIds, contributingRuleIds: comparison.contributingRuleIds,
      factIds: Object.freeze(Object.values(rankFactByRule).flatMap((name) =>
        [factId(subject.taskId, name), factId(alternative.taskId, name)])),
    });
  }));
}
