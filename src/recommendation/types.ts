import type { ResidualGraph } from "../analysis/graph.js";
import type { PrecedenceResult } from "../analysis/precedence.js";
import type { Rational } from "../model/rational.js";

export type RecommendationCriticalClass =
  | "driving"
  | "near_critical"
  | "non_critical";

export type RecommendationTier =
  | "recommended"
  | "allowed"
  | "deferred"
  | "discouraged";

export type RecommendationDistance = number | "infinity";

export type RecommendationRankingRuleId =
  | "critical_class"
  | "lower_total_float"
  | "higher_explicit_priority"
  | "higher_new_ready_count"
  | "higher_new_gate_count"
  | "higher_new_milestone_count"
  | "shorter_next_gate_distance"
  | "shorter_finish_distance"
  | "longer_expected_duration"
  | "task_id_tiebreak";

export interface RecommendationRequirement {
  readonly resourceId: string;
  readonly units: number;
}

export interface RecommendationCandidateFacts {
  readonly taskId: string;
  readonly precedenceTotalFloat: Rational;
  readonly precedenceCriticalClass: RecommendationCriticalClass;
  readonly explicitPriority: number;
  readonly newReadyTaskIds: readonly string[];
  readonly newReadyTaskCount: number;
  readonly newSatisfiedGateIds: readonly string[];
  readonly newSatisfiedGateCount: number;
  readonly newReachedMilestoneIds: readonly string[];
  readonly newReachedMilestoneCount: number;
  readonly nextGateTaskDistance: RecommendationDistance;
  readonly finishTaskDistance: number;
  readonly expectedDuration: Rational;
  readonly requirements: readonly RecommendationRequirement[];
}

export interface RecommendationCandidateComparison {
  readonly winnerTaskId: string;
  readonly alternativeTaskId: string;
  readonly decisiveRuleId: RecommendationRankingRuleId;
  readonly priorTiedRuleIds: readonly RecommendationRankingRuleId[];
  readonly contributingRuleIds: readonly RecommendationRankingRuleId[];
}

export interface RecommendationResourceFact {
  readonly resourceId: string;
  readonly capacity: number;
  readonly activeUsage: number;
  readonly selectedUsage: number;
  readonly required: number;
  readonly available: number;
  readonly deficit: number;
  readonly activeTaskIds: readonly string[];
  readonly selectedTaskIds: readonly string[];
}

export interface RecommendationResourceFeasibility {
  readonly feasible: boolean;
  readonly resources: readonly RecommendationResourceFact[];
}

export interface RecommendationSelectionDecision {
  readonly evaluated: boolean;
  readonly scanIndex: number | null;
  readonly selected: boolean;
  readonly feasibility: RecommendationResourceFeasibility | null;
}

export interface RecommendationTaskDecision {
  readonly facts: RecommendationCandidateFacts;
  readonly rankIndex: number;
  readonly horizonMember: boolean;
  readonly selection: RecommendationSelectionDecision;
  readonly recommendedSetMember: boolean;
  readonly tier: RecommendationTier;
  readonly tierFeasibility: RecommendationResourceFeasibility;
  readonly primaryHigherPriorityTaskId: string | null;
  readonly selectedBlockerTaskIds: readonly string[];
  readonly activeBlockerTaskIds: readonly string[];
}

export interface RecommendationRankingInput {
  readonly graph: ResidualGraph;
  readonly precedence: PrecedenceResult;
  readonly appliedCapacities?: ReadonlyMap<string, number>;
}

export interface RecommendationRankingResult {
  readonly algorithmId: "perttool.recommendation-ranking.lexicographic-frontier";
  readonly algorithmVersion: 1;
  readonly optimal: false;
  readonly candidates: readonly RecommendationCandidateFacts[];
  readonly horizonTaskIds: readonly string[];
  readonly recommendedTaskIds: readonly string[];
  readonly jointFeasibility: RecommendationResourceFeasibility;
  readonly taskDecisions: readonly RecommendationTaskDecision[];
}
