// R: Define model-2 recommendation evidence and its complete selection commitment.
import type { DurationUnit } from "../model/units.js";
import type { RecommendationCandidateFacts } from "./types.js";
import type {
  RecommendationAnalysis as RecommendationAnalysisV1,
  RecommendationComparison,
  RecommendationDecisionStep,
  RecommendationDescription,
  RecommendationExplanationTaskDecision,
  RecommendationReasonOccurrence,
} from "./explanation-types.js";
import type { DispatchResourceBudget, DispatchActiveTask } from "./maximum-count-types.js";

export type DispatchTimeEligibility = "eligible" | "not_yet_eligible" | "unavailable";
export type DispatchAssuranceEligibility = "eligible" | "withheld" | "unavailable";
export interface DispatchEligibility {
  readonly timeEligibility: DispatchTimeEligibility;
  readonly assuranceEligibility: DispatchAssuranceEligibility;
}
export interface DispatchRankGroup {
  readonly rankGroup: number;
  readonly taskIds: readonly string[];
  readonly rankKey: {
    readonly criticalClass: RecommendationCandidateFacts["precedenceCriticalClass"];
    readonly precedenceTotalFloat: ExactDispatchRational;
    readonly explicitPriority: number;
    readonly newReadyTaskCount: number;
    readonly newSatisfiedGateCount: number;
    readonly newReachedMilestoneCount: number;
    readonly nextGateTaskDistance: number | "infinity";
    readonly finishTaskDistance: number;
    readonly expectedDuration: ExactDispatchRational;
  };
}
export interface ExactDispatchRational {
  readonly numerator: string;
  readonly denominator: string;
}
export interface DispatchSelectionInput {
  readonly modelVersion: 1;
  readonly sourceDigest: string;
  readonly grammarVersion: number;
  readonly durationUnit: DurationUnit;
  readonly criticalEpsilon: ExactDispatchRational;
  readonly capacityOverrides: readonly { readonly resourceId: string; readonly capacity: number }[];
  readonly resources: readonly {
    readonly resourceId: string;
    readonly capacity: number;
    readonly activeUsage: number;
    readonly activeTaskIds: readonly string[];
  }[];
  readonly activeTasks: readonly DispatchActiveTask[];
  readonly candidates: readonly (DispatchActiveTask & DispatchEligibility & { readonly rankGroup: number })[];
  readonly rankGroups: readonly DispatchRankGroup[];
}
export interface DispatchSelectionEvidence {
  readonly modelVersion: 1;
  readonly inputDigest: string;
  readonly input: DispatchSelectionInput;
  readonly selectedTaskIds: readonly string[];
  readonly maximumTaskCount: number;
  readonly resources: readonly DispatchResourceBudget[];
  readonly boundaryGroups: readonly {
    readonly rankGroup: number;
    readonly candidates: readonly DispatchActiveTask[];
    readonly selectedTaskIds: readonly string[];
    readonly unselectedTaskIds: readonly string[];
    readonly outsideSelectedTaskIds: readonly string[];
    readonly resources: readonly DispatchResourceBudget[];
  }[];
}
export type DispatchReasonCode =
  | "task_ready" | "recommended_set_selected" | "recommended_set_not_selected"
  | "recommended_set_feasible" | "ranking_rule_supports_task" | "ranking_rule_opposes_task"
  | "ranking_rule_tied" | "recommended_set_resource_conflict"
  | "time_eligible" | "time_ineligible" | "time_eligibility_unavailable"
  | "assurance_eligible" | "assurance_withheld" | "assurance_unavailable"
  | "maximum_task_count" | "rank_group_counts" | "task_id_tiebreak" | "boundary_group_capacity";
export type DispatchDecisionStep = Omit<RecommendationDecisionStep, "phase"> & {
  readonly phase: "eligibility" | "candidate_ranking" | "set_optimization" | "resource_selection"
    | "boundary_budget" | "set_membership" | "tier_classification";
};
export type DispatchReasonOccurrence = Omit<RecommendationReasonOccurrence, "code"> & { readonly code: DispatchReasonCode };
export type DispatchDescription = Omit<RecommendationDescription, "registryVersion"> & { readonly registryVersion: 2 };
export type DispatchTaskDecision = Omit<RecommendationExplanationTaskDecision, "tier" | "primaryHigherPriorityTaskId"> & {
  readonly tier: "recommended" | "deferred";
};
export type DispatchComparison = Omit<RecommendationComparison, "scope"> & { readonly scope: "candidate_ranking" };
export interface RecommendationAnalysisV2 extends Omit<RecommendationAnalysisV1,
  "algorithm" | "reasonTaxonomyVersion" | "explanationModelVersion" | "descriptionRegistryVersion"
  | "taskDecisions" | "decisionSteps" | "comparisons" | "reasonOccurrences" | "descriptions"> {
  readonly algorithm: {
    readonly id: "perttool.dispatch.maximum-count";
    readonly version: 1;
    readonly optimal: true;
    readonly optimalityScope: "task_count";
  };
  readonly reasonTaxonomyVersion: "2.0";
  readonly explanationModelVersion: 2;
  readonly descriptionRegistryVersion: 2;
  readonly taskDecisions: readonly DispatchTaskDecision[];
  readonly decisionSteps: readonly DispatchDecisionStep[];
  readonly comparisons: readonly DispatchComparison[];
  readonly reasonOccurrences: readonly DispatchReasonOccurrence[];
  readonly descriptions: readonly DispatchDescription[];
  readonly selection: DispatchSelectionEvidence;
}

export interface MaximumCountStartAuthority {
  readonly policy: "max_count_dispatch_v1_plus_release_gate_plus_plan_assurance_v1";
  readonly recommendationAlgorithm: { readonly id: "perttool.dispatch.maximum-count"; readonly version: 1 };
  readonly deadlineFactsUsedForRanking: false;
  readonly complete: boolean;
  readonly safeStopReasons: readonly import("../assurance/authority.js").PlanAssuranceAuthoritySafeStopReason[];
  readonly timeEligibleTaskIds: readonly string[];
  readonly timeIneligibleTaskIds: readonly string[];
  readonly timeEligibilityUnavailableTaskIds: readonly string[];
  readonly assuranceEligibleTaskIds: readonly string[];
  readonly eligibleTaskIds: readonly string[];
  readonly timeWithheldTaskIds: readonly string[];
  readonly assuranceWithheldTaskIds: readonly string[];
  readonly unavailableTaskIds: readonly string[];
  readonly startableRecommendedTaskIds: readonly string[];
}
