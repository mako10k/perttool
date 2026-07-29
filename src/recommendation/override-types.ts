import type { Diagnostic } from "../model/diagnostics.js";
import type { RecommendationExpression } from "./explanation-types.js";
import type { RecommendationTier } from "./types.js";

export type OverrideTriggerCode =
  | "allowed_replaces_recommended"
  | "deferred_selected"
  | "discouraged_selected";

export type HumanOverrideReasonCode =
  | "human_priority_decision"
  | "external_commitment"
  | "incident_response"
  | "plan_correction_pending"
  | "resource_reallocation_pending"
  | "risk_acceptance"
  | "experiment"
  | "other_explicit_reason";

export type OverrideEvidenceKind =
  | "issue"
  | "commit"
  | "document"
  | "url"
  | "other";

export interface OverrideEvidenceReference {
  readonly kind: OverrideEvidenceKind;
  readonly value: string;
}

export interface OverrideActor {
  readonly kind: "human";
  readonly id: string;
  readonly authentication: "caller_asserted";
}

export interface OverrideRequest {
  readonly sourceSchemaVersion: "Perttool.NextResult.v5";
  readonly sourceDigest: string;
  readonly sourceResultDecisionId: string;
  readonly selectedTaskIds: readonly string[];
  readonly actor: OverrideActor;
  readonly decidedAt: string;
  readonly reasonCode: HumanOverrideReasonCode;
  readonly reasonText: string;
  readonly evidenceReferences: readonly OverrideEvidenceReference[];
  readonly acknowledgedNegativeFactReasonIds: readonly string[];
}

export interface OverrideDecisionSource {
  readonly schemaVersion: "Perttool.NextResult.v5";
  readonly toolVersion: string;
  readonly sourceDigest: string;
  readonly recommendationInterfaceVersion: 1;
  readonly rankingAlgorithmId:
    "perttool.recommendation-ranking.lexicographic-frontier";
  readonly rankingAlgorithmVersion: 1;
  readonly reasonTaxonomyVersion: "1.0";
  readonly explanationModelVersion: 1;
  readonly expressionVersion: 1;
  readonly descriptionRegistryVersion: 1;
  readonly resultDecisionId: string;
  readonly recommendedTaskIds: readonly string[];
  readonly capacityOverrides: readonly {
    readonly resourceId: string;
    readonly capacity: number;
  }[];
}

export interface OverrideReason {
  readonly code: HumanOverrideReasonCode;
  readonly text: string;
  readonly evidenceReferences: readonly OverrideEvidenceReference[];
}

export interface OverrideSelection {
  readonly selectedTaskIds: readonly string[];
  readonly retainedRecommendedTaskIds: readonly string[];
  readonly displacedRecommendedTaskIds: readonly string[];
  readonly selectedNonrecommendedTaskIds: readonly string[];
  readonly triggerCodes: readonly OverrideTriggerCode[];
}

export interface OverrideTaskDecision {
  readonly taskId: string;
  readonly normalDecisionId: string;
  readonly normalTier: RecommendationTier;
  readonly normalDecisiveStepId: string;
  readonly normalReasonOccurrenceIds: readonly string[];
  readonly normalComparisonIds: readonly string[];
  readonly overrideSelected: true;
  readonly triggerCodes: readonly OverrideTriggerCode[];
  readonly acknowledgedNegativeFactReasonIds: readonly string[];
}

export interface OverrideResourceWitness {
  readonly resourceId: string;
  readonly capacity: number;
  readonly activeUsage: number;
  readonly selectedUsage: number;
  readonly used: number;
  readonly availableAfterSelection: number;
  readonly selectedTaskIds: readonly string[];
}

export interface OverrideFeasibility {
  readonly selectedSetReference: {
    readonly kind: "derived_set";
    readonly id: "O";
  };
  readonly startFeasible: true;
  readonly activeTaskIds: readonly string[];
  readonly resourceWitnesses: readonly OverrideResourceWitness[];
  readonly expression: RecommendationExpression | null;
}

export interface HumanOverrideDecision {
  readonly overrideContractVersion: 1;
  readonly overrideId: string;
  readonly source: OverrideDecisionSource;
  readonly actor: OverrideActor;
  readonly decidedAt: string;
  readonly reason: OverrideReason;
  readonly selection: OverrideSelection;
  readonly taskDecisions: readonly OverrideTaskDecision[];
  readonly feasibility: OverrideFeasibility;
  readonly singleUse: true;
}

export type OverrideValidationResult =
  | {
      readonly schemaVersion: "Perttool.OverrideDecision.v1";
      readonly toolVersion: string;
      readonly operation: "recommendation.override.validate";
      readonly ok: true;
      readonly diagnostics: readonly [];
      readonly diagnosticsTruncated: false;
      readonly override: HumanOverrideDecision;
    }
  | {
      readonly schemaVersion: "Perttool.OverrideDecision.v1";
      readonly toolVersion: string;
      readonly operation: "recommendation.override.validate";
      readonly ok: false;
      readonly diagnostics: readonly Diagnostic[];
      readonly diagnosticsTruncated: false;
      readonly override: null;
    };
