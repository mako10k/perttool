export const PLAN_ASSURANCE_MODEL_VERSION = 1 as const;
export const PLAN_ASSURANCE_HASH_MODEL_VERSION = 1 as const;

export type Sha256Digest = `sha256:${string}`;
export type PlanDependencyMode =
  | "both"
  | "execution_only"
  | "planning_only";
export type PlanningInputMode = Exclude<PlanDependencyMode, "execution_only">;

export interface CanonicalExactValueV1 {
  readonly numerator: string;
  readonly denominator: string;
  readonly unit: "day" | "hour" | "point";
}

export type CanonicalDurationOrEstimateV1 =
  | {
      readonly kind: "duration";
      readonly value: CanonicalExactValueV1;
    }
  | {
      readonly kind: "estimate";
      readonly optimistic: CanonicalExactValueV1;
      readonly mostLikely: CanonicalExactValueV1;
      readonly pessimistic: CanonicalExactValueV1;
    };

export type CanonicalCalendarValueV1 =
  | {
      readonly kind: "date";
      readonly year: number;
      readonly month: number;
      readonly day: number;
    }
  | {
      readonly kind: "date_time";
      readonly year: number;
      readonly month: number;
      readonly day: number;
      readonly hour: number;
      readonly minute: number;
      readonly second: {
        readonly numerator: string;
        readonly denominator: string;
      };
      readonly offsetMinutes: number;
    };

export interface CanonicalRequirementV1 {
  readonly resourceId: string;
  readonly units: number;
}

export interface TaskPlanContractV1 {
  readonly model: "Perttool.TaskPlanContract.v1";
  readonly taskId: string;
  readonly fromMilestoneId: string;
  readonly toMilestoneId: string;
  readonly title: string;
  readonly description: string | null;
  readonly durationOrEstimate: CanonicalDurationOrEstimateV1;
  readonly notBefore: CanonicalCalendarValueV1 | null;
  readonly deadline: CanonicalCalendarValueV1 | null;
  readonly priority: number;
  readonly requirements: readonly CanonicalRequirementV1[];
  readonly owner: string | null;
  readonly tags: readonly string[];
  readonly source: string | null;
}

export interface ExecutionTaskRelationV1 {
  readonly predecessorTaskId: string;
  readonly successorTaskId: string;
}

export interface PlanDependencyRelationV1 {
  readonly id: string;
  readonly predecessorTaskId: string;
  readonly successorTaskId: string;
  readonly mode: PlanDependencyMode;
  readonly reason: string | null;
}

export interface EffectivePlanDependencyV1 {
  readonly relationId: string | null;
  readonly predecessorTaskId: string;
  readonly successorTaskId: string;
  readonly mode: PlanDependencyMode;
  readonly explicit: boolean;
}

export interface AcceptedPlanningInputV1 {
  readonly predecessorTaskId: string;
  readonly relationMode: PlanningInputMode;
  readonly assuranceHash: Sha256Digest;
}

export interface TaskPlanSealV1 {
  readonly acceptedContractHash: Sha256Digest;
  readonly acceptedBasisHash: Sha256Digest;
  readonly acceptedInputs: readonly AcceptedPlanningInputV1[];
}

export interface TaskOutcomeEvidenceV1 {
  readonly modelVersion: number;
  readonly againstBasisHash: Sha256Digest;
  readonly status: "conformant" | "changed";
  readonly summary: string | null;
}

export interface TaskAssuranceInputV1 {
  readonly contract: TaskPlanContractV1;
  readonly lifecycle: "unfinished" | "completed";
  readonly seal: TaskPlanSealV1 | null;
  readonly outcome: TaskOutcomeEvidenceV1 | null;
}

export interface FrontierPlanningInputV1 {
  readonly producerTaskId: string;
  readonly consumerTaskId: string;
  readonly relationMode: PlanningInputMode;
  readonly assuranceHash: Sha256Digest | null;
}

export interface FrontierAssuranceReceiptContractV1 {
  readonly model: "Perttool.FrontierAssuranceReceipt.v1";
  readonly producerTaskId: string;
  readonly producerTaskContractHash: Sha256Digest;
  readonly producerAssuranceHash: Sha256Digest;
  readonly outcome: "conformant" | "changed";
  readonly consumers: readonly {
    readonly consumerTaskId: string;
    readonly relationMode: PlanningInputMode;
  }[];
  readonly sourceMilestoneId: string | null;
}

export interface PlanAssuranceInputV1 {
  readonly modelVersion: number | null;
  readonly hashModelVersion: number | null;
  readonly tasks: readonly TaskAssuranceInputV1[];
  readonly executionRelations: readonly ExecutionTaskRelationV1[];
  readonly explicitRelations: readonly PlanDependencyRelationV1[];
  readonly frontierInputs: readonly FrontierPlanningInputV1[];
}

export type PlanAssuranceCoverage =
  | "not_enabled"
  | "unsealed"
  | "partial"
  | "complete";

export type PlanAssuranceTaskStatus =
  | "not_applicable"
  | "unsealed"
  | "conditional"
  | "verified"
  | "review_required"
  | "unavailable";

export type PlanAssuranceOutcomeStatus =
  | "unfinished"
  | "conformant"
  | "changed"
  | "unavailable";

export type PlanAssuranceCauseKind =
  | "unknown_model"
  | "task_contract_changed"
  | "planning_relation_changed"
  | "predecessor_commitment_changed"
  | "predecessor_unavailable"
  | "frontier_commitment_changed"
  | "accepted_seal_inconsistent"
  | "outcome_missing"
  | "outcome_basis_mismatch"
  | "outcome_invalid"
  | "changed_outcome";

export interface PlanAssuranceCauseV1 {
  readonly kind: PlanAssuranceCauseKind;
  readonly direct: boolean;
  readonly rootTaskId: string;
  readonly affectedTaskId: string;
  readonly pathTaskIds: readonly string[];
}

export interface PlanAssuranceTaskResultV1 {
  readonly taskId: string;
  readonly status: PlanAssuranceTaskStatus;
  readonly outcomeStatus: PlanAssuranceOutcomeStatus;
  readonly contractHash: Sha256Digest | null;
  readonly computedBasisHash: Sha256Digest | null;
  readonly acceptedBasisHash: Sha256Digest | null;
  readonly computedInputs: readonly AcceptedPlanningInputV1[];
  readonly exportedAssuranceHash: Sha256Digest | null;
  readonly directCauses: readonly PlanAssuranceCauseV1[];
  readonly inheritedCauses: readonly PlanAssuranceCauseV1[];
}

export interface PlanAssuranceDiagnosticV1 {
  readonly code: "PTASSURE-101" | "PTASSURE-102";
  readonly message: string;
  readonly entityId: string | null;
  readonly data: Readonly<Record<string, unknown>>;
}

export interface PlanAssuranceEvaluationV1 {
  readonly ok: boolean;
  readonly modelVersion: number | null;
  readonly hashModelVersion: number | null;
  readonly coverage: PlanAssuranceCoverage | null;
  readonly effectiveDependencies: readonly EffectivePlanDependencyV1[];
  readonly taskResults: readonly PlanAssuranceTaskResultV1[];
  readonly directMismatchTaskIds: readonly string[];
  readonly inheritedMismatchTaskIds: readonly string[];
  readonly replanRequiredTaskIds: readonly string[];
  readonly unavailableTaskIds: readonly string[];
  readonly diagnostics: readonly PlanAssuranceDiagnosticV1[];
}
