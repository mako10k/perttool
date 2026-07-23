import type { ResidualGraph } from "../analysis/graph.js";
import type { Diagnostic } from "../model/diagnostics.js";
import type { DurationUnit } from "../model/units.js";
import type {
  RecommendationRankingResult,
  RecommendationRankingRuleId,
  RecommendationTier,
} from "./types.js";

export type RecommendationEntityKind =
  | "project"
  | "task"
  | "milestone"
  | "gate"
  | "resource"
  | "policy_rule"
  | "ranking_factor"
  | "negative_fact_kind"
  | "derived_set";

export interface RecommendationEntityReference {
  readonly kind: RecommendationEntityKind;
  readonly id: string;
}

export type RecommendationScalarValue =
  | { readonly type: "boolean"; readonly value: boolean }
  | { readonly type: "integer"; readonly value: string }
  | {
      readonly type: "rational";
      readonly numerator: string;
      readonly denominator: string;
    }
  | {
      readonly type: "enum";
      readonly enumType: string;
      readonly value: string;
    }
  | {
      readonly type: "entity";
      readonly value: RecommendationEntityReference;
    };

export type RecommendationValue =
  | RecommendationScalarValue
  | {
      readonly type: "list";
      readonly itemType: string;
      readonly items: readonly RecommendationScalarValue[];
    }
  | {
      readonly type: "set";
      readonly itemType: string;
      readonly items: readonly RecommendationScalarValue[];
    }
  | {
      readonly type: "map";
      readonly keyType: string;
      readonly valueType: string;
      readonly entries: readonly {
        readonly key: RecommendationScalarValue;
        readonly value: RecommendationScalarValue;
      }[];
    };

export type RecommendationUnit =
  | { readonly kind: "duration"; readonly value: DurationUnit }
  | {
      readonly kind: "resource";
      readonly resource: RecommendationEntityReference;
    }
  | { readonly kind: "ratio" };

export type RecommendationProvenanceKind =
  | "document"
  | "precedence_analysis"
  | "ranking_algorithm"
  | "resource_snapshot"
  | "recommendation_model";

export interface RecommendationProvenance {
  readonly kind: RecommendationProvenanceKind;
  readonly sourceDigest: string;
  readonly entityReferences: readonly RecommendationEntityReference[];
  readonly producer: {
    readonly id: string;
    readonly version: string;
  };
  readonly sourceSpan: null;
}

export interface RecommendationFact {
  readonly id: string;
  readonly kind: string;
  readonly subject: RecommendationEntityReference;
  readonly value: RecommendationValue;
  readonly unit: RecommendationUnit | null;
  readonly provenance: RecommendationProvenance;
}

export type RecommendationRelation =
  | "equal"
  | "not_equal"
  | "less_than"
  | "less_or_equal"
  | "greater_than"
  | "greater_or_equal"
  | "contains";

export type RecommendationExpressionTerm =
  | { readonly kind: "fact"; readonly factId: string }
  | {
      readonly kind: "literal";
      readonly value: RecommendationValue;
      readonly unit: RecommendationUnit | null;
    };

export type RecommendationExpression =
  | {
      readonly kind: "compare";
      readonly left: RecommendationExpressionTerm;
      readonly relation: RecommendationRelation;
      readonly right: RecommendationExpressionTerm;
    }
  | {
      readonly kind: "all";
      readonly children: readonly RecommendationExpression[];
    }
  | {
      readonly kind: "any";
      readonly children: readonly RecommendationExpression[];
    };

export type RecommendationDecisionPhase =
  | "eligibility"
  | "negative_fact_filter"
  | "selection_horizon"
  | "candidate_ranking"
  | "resource_selection"
  | "set_membership"
  | "tier_classification";

export type RecommendationReasonEffect =
  | "supporting"
  | "opposing"
  | "blocking"
  | "neutral";

export type RecommendationDecisionRole =
  | "decisive"
  | "contributing"
  | "context";

export interface RecommendationDecisionStep {
  readonly id: string;
  readonly phase: RecommendationDecisionPhase;
  readonly rule: RecommendationEntityReference;
  readonly inputFactIds: readonly string[];
  readonly expression: RecommendationExpression;
  readonly result: boolean;
  readonly effect: RecommendationReasonEffect;
  readonly role: RecommendationDecisionRole;
  readonly reasonOccurrenceIds: readonly string[];
  readonly comparisonIds: readonly string[];
  readonly dependsOnStepIds: readonly string[];
}

export type RecommendationComparisonScope =
  | "ranking"
  | "selection_horizon"
  | "resource_selection"
  | "tier";

export interface RecommendationComparison {
  readonly id: string;
  readonly scope: RecommendationComparisonScope;
  readonly subjectTaskId: string;
  readonly alternativeTaskId: string | null;
  readonly winnerTaskId: string | null;
  readonly loserTaskId: string | null;
  readonly decisiveRule: RecommendationEntityReference;
  readonly decisiveExpression: RecommendationExpression;
  readonly priorTiedRuleIds: readonly RecommendationRankingRuleId[];
  readonly contributingRuleIds: readonly RecommendationRankingRuleId[];
  readonly factIds: readonly string[];
}

export type RecommendationReasonCode =
  | "task_ready"
  | "recommended_set_selected"
  | "recommended_set_not_selected"
  | "recommended_set_feasible"
  | "ranking_rule_supports_task"
  | "ranking_rule_opposes_task"
  | "ranking_rule_tied"
  | "recommended_set_addition_feasible"
  | "recommended_set_resource_conflict"
  | "policy_defers_start"
  | "modeled_negative_fact_applies";

export interface RecommendationReasonOccurrence {
  readonly id: string;
  readonly code: RecommendationReasonCode;
  readonly subject: RecommendationEntityReference;
  readonly effect: RecommendationReasonEffect;
  readonly role: RecommendationDecisionRole;
  readonly factIds: readonly string[];
  readonly emissionExpression: RecommendationExpression;
  readonly decisionStepId: string;
  readonly comparisonIds: readonly string[];
  readonly descriptionId: string | null;
}

export interface RecommendationDescriptionParameter {
  readonly name: string;
  readonly value: RecommendationValue;
  readonly unit: RecommendationUnit | null;
}

export interface RecommendationDescription {
  readonly id: string;
  readonly key: string;
  readonly registryVersion: 1;
  readonly parameters: readonly RecommendationDescriptionParameter[];
  readonly sourceReasonIds: readonly string[];
  readonly sourceComparisonIds: readonly string[];
  readonly locale: "en";
  readonly text: string;
  readonly renderStatus: "rendered";
}

export interface RecommendationResultDecision {
  readonly id: string;
  readonly action: "start";
  readonly recommendedTaskIds: readonly string[];
  readonly jointFeasibilityFactId: string;
  readonly stepIds: readonly string[];
  readonly reasonOccurrenceIds: readonly string[];
}

export interface RecommendationExplanationTaskDecision {
  readonly id: string;
  readonly subjectTaskId: string;
  readonly action: "start";
  readonly classification: "ready";
  readonly tier: RecommendationTier;
  readonly recommendedSetMember: boolean;
  readonly stepIds: readonly string[];
  readonly decisiveStepId: string;
  readonly reasonOccurrenceIds: readonly string[];
  readonly comparisonIds: readonly string[];
  readonly primaryHigherPriorityTaskId: string | null;
  readonly summaryDescriptionId: string;
  readonly descriptionIds: readonly string[];
}

export interface RecommendationAnalysis {
  readonly action: "start";
  readonly algorithm: {
    readonly id: "perttool.recommendation-ranking.lexicographic-frontier";
    readonly version: 1;
    readonly optimal: false;
  };
  readonly reasonTaxonomyVersion: "1.0";
  readonly explanationModelVersion: 1;
  readonly expressionVersion: 1;
  readonly descriptionRegistryVersion: 1;
  readonly descriptionLocale: "en";
  readonly sourceDigest: string;
  readonly recommendedTaskIds: readonly string[];
  readonly resultDecision: RecommendationResultDecision;
  readonly taskDecisions: readonly RecommendationExplanationTaskDecision[];
  readonly decisionSteps: readonly RecommendationDecisionStep[];
  readonly facts: readonly RecommendationFact[];
  readonly comparisons: readonly RecommendationComparison[];
  readonly reasonOccurrences: readonly RecommendationReasonOccurrence[];
  readonly descriptions: readonly RecommendationDescription[];
  readonly explanationStatus: {
    readonly level: "full";
    readonly complete: true;
    readonly decisiveChainComplete: true;
    readonly truncated: false;
    readonly omittedCounts: {
      readonly decisionSteps: 0;
      readonly facts: 0;
      readonly comparisons: 0;
      readonly reasonOccurrences: 0;
      readonly descriptions: 0;
    };
  };
}

export interface RecommendationExplanationInput {
  readonly graph: ResidualGraph;
  readonly ranking: RecommendationRankingResult;
  readonly sourceDigest: string;
}

export type RecommendationExplanationBuildResult =
  | {
      readonly ok: true;
      readonly analysis: RecommendationAnalysis;
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: false;
      readonly analysis: null;
      readonly diagnostics: readonly Diagnostic[];
    };
