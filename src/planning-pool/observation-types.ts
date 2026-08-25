import type { ActualsCoverage, TaskLifecycleState } from "../actuals/lifecycle.js";
import type { CriterionAcceptanceResultV1, MilestoneAcceptanceState } from "../milestone-acceptance/evaluate.js";
import type { PlanningPoolSourceDiagnostic } from "./source-types.js";
import type { PlanningWindowSelectionInput, PlanningWindowSnapshot, PlanningWindowTemporalOverlap } from "./window-types.js";

export interface PlanningObservationCoreCapability {
  readonly id: "perttool.planning-observation-core";
  readonly version: 1;
}

export type PlanningObservationEvidenceState =
  | "complete"
  | "incomplete"
  | "unavailable";

export interface PlanningObservationExecutionContext {
  readonly source_digest: string;
  readonly evidence_state: PlanningObservationEvidenceState;
  readonly recommended_task_ids: readonly string[];
  readonly startable_task_ids: readonly string[];
}

export interface PlanningPoolSelectionInput {
  readonly kind: "pool";
}

export interface PlanningWorkSelectionInput {
  readonly kind: "work";
  readonly work_ids: readonly string[];
}

export type PlanningObservationSelectionInput =
  | PlanningPoolSelectionInput
  | PlanningWorkSelectionInput
  | PlanningWindowSelectionInput;

export type PlanningCloseDisposition =
  | "carried_over"
  | "retained_backlog"
  | "archive_requested";

export interface PlanningCloseDispositionInput {
  readonly work_id: string;
  readonly disposition: PlanningCloseDisposition;
}

export interface PlanningObservationRequest {
  readonly request_schema_version: "Perttool.PlanningObservationRequest.v1";
  readonly source_digest: string;
  readonly selection: PlanningObservationSelectionInput;
  readonly observation_at: string | null;
  readonly close_dispositions: readonly PlanningCloseDispositionInput[];
}

export interface PlanningObservationEvidenceBasis {
  readonly mode: "current";
  readonly state: PlanningObservationEvidenceState;
  readonly sourceDigest: string;
  readonly historyRequested: false;
}

export interface PlanningTaskObservation {
  readonly taskId: string;
  readonly status: TaskLifecycleState;
  readonly actualsCoverage: ActualsCoverage;
  readonly workEventIds: readonly string[];
  readonly complete: boolean;
  readonly attribution: "exclusive" | "non_exclusive";
}

export interface PlanningMilestoneObservation {
  readonly milestoneId: string;
  readonly closure: "unreached" | "reached";
  readonly acceptance: MilestoneAcceptanceState;
  readonly criteria: readonly CriterionAcceptanceResultV1[];
  readonly evidenceComplete: boolean;
  readonly attribution: "exclusive" | "non_exclusive";
}

export interface PlanningRefinementObservation {
  readonly residualDescriptionPresent: boolean;
  readonly eventIds: readonly string[];
  readonly activityIds: readonly string[];
  readonly milestoneLinkIds: readonly string[];
  readonly taskLinkIds: readonly string[];
  readonly uncoveredDependencyIds: readonly string[];
}

export interface PlanningExecutionObservation {
  readonly state: "complete" | "partial" | "uncovered" | "unknown" | "unavailable";
  readonly activityObligationIds: readonly string[];
  readonly unprojectedActivityIds: readonly string[];
  readonly tasks: readonly PlanningTaskObservation[];
}

export interface PlanningOutcomeObservation {
  readonly state: PlanningObservationEvidenceState;
  readonly milestones: readonly PlanningMilestoneObservation[];
}

export interface PlanningOrganizationObservation {
  readonly globalRank: number;
  readonly dependencyIds: readonly string[];
  readonly dependentIds: readonly string[];
  readonly dependencyCycleIds: readonly string[];
  readonly windowIds: readonly string[];
  readonly traceUseful: boolean;
  readonly archiveable: boolean;
}

export interface PlanningWorkObservation {
  readonly workId: string;
  readonly title: string;
  readonly refinement: PlanningRefinementObservation;
  readonly execution: PlanningExecutionObservation;
  readonly outcome: PlanningOutcomeObservation;
  readonly organization: PlanningOrganizationObservation;
  readonly closeDisposition: PlanningCloseDisposition | "not_applicable";
}

export interface PlanningWindowTemporalPosition {
  readonly state: "before" | "inside" | "after" | "unbounded" | "unavailable";
  readonly observationValue: string | null;
  readonly source: "request" | "project_as_of" | null;
  readonly cause: "missing_observation_value" | "incomparable_temporal_kinds" | null;
}

export interface PlanningWindowObservation {
  readonly window: PlanningWindowSnapshot;
  readonly objective: string | null;
  readonly temporalPosition: PlanningWindowTemporalPosition;
  readonly temporalOverlaps: readonly PlanningWindowTemporalOverlap[];
  readonly selectedExecution: "complete" | "partial" | "uncovered" | "unknown" | "unavailable";
}

export interface PlanningMembershipOccurrence {
  readonly windowId: string;
  readonly workId: string;
  readonly selected: boolean;
}

export interface PlanningObservationAggregates {
  readonly uniqueWorkIds: readonly string[];
  readonly uniqueTaskIds: readonly string[];
  readonly uniqueMilestoneIds: readonly string[];
  readonly uniqueWorkEventIds: readonly string[];
  readonly completedTaskIds: readonly string[];
  readonly acceptedMilestoneIds: readonly string[];
  readonly membershipOccurrenceCount: number;
}

export interface PlanningGlobalExecutionObservation {
  readonly evidenceState: PlanningObservationEvidenceState;
  readonly recommendedTaskIds: readonly string[];
  readonly startableTaskIds: readonly string[];
}

export interface PlanningPoolObservationResult {
  readonly schemaVersion: "Perttool.PlanningPoolResult.v1";
  readonly observationCapability: "perttool.planning-observation-core@1";
  readonly operation: "observe";
  readonly ok: boolean;
  readonly documentId: string | null;
  readonly sourceDigest: string;
  readonly normalizedRequest: PlanningObservationRequest | null;
  readonly evidence: PlanningObservationEvidenceBasis;
  readonly selectedWorkOrder: readonly string[];
  readonly works: readonly PlanningWorkObservation[];
  readonly window: PlanningWindowObservation | null;
  readonly membershipOccurrences: readonly PlanningMembershipOccurrence[];
  readonly aggregates: PlanningObservationAggregates;
  readonly globalExecution: PlanningGlobalExecutionObservation;
  readonly diagnostics: readonly PlanningPoolSourceDiagnostic[];
}
