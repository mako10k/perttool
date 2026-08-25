import type {
  HistoricalGitEvidenceCauseRecord,
  HistoricalGitEvidenceLimits,
  HistoricalGitEvidenceStatus,
} from "../history/git-probe.js";
import type {
  PlanningObservationExecutionContext,
  PlanningObservationRequest,
  PlanningPoolObservationResult,
} from "./observation-types.js";
import type { PlanningPoolSourceDiagnostic } from "./source-types.js";

export interface PlanningHistoryCoreCapability {
  readonly id: "perttool.planning-history-core";
  readonly version: 1;
}

export interface PlanningHistoricalExecutionEntry {
  readonly commit_id: string;
  readonly execution: PlanningObservationExecutionContext;
}

export interface PlanningHistoricalExecutionContexts {
  readonly current: PlanningObservationExecutionContext;
  readonly historical: readonly PlanningHistoricalExecutionEntry[];
}

export type PlanningHistoricalState =
  | "complete"
  | "incomplete"
  | "unavailable";

export type PlanningHistoricalAxisState =
  | "complete"
  | "unknown"
  | "unavailable";

export interface PlanningHistoricalAxisStates {
  readonly refinement: PlanningHistoricalAxisState;
  readonly execution: PlanningHistoricalAxisState;
  readonly outcome: PlanningHistoricalAxisState;
  readonly organization: PlanningHistoricalAxisState;
  readonly temporal: PlanningHistoricalAxisState;
  readonly closeDisposition: PlanningHistoricalAxisState;
}

export type PlanningHistoricalSourceValidity =
  | "planning_valid"
  | "planning_absent"
  | "source_missing"
  | "source_invalid"
  | "source_binding_invalid";

export type PlanningHistoricalSelectionState =
  | "observed"
  | "absent"
  | "unavailable";

export interface PlanningHistoricalEvidenceBasis {
  readonly mode: "historical";
  readonly state: PlanningHistoricalState;
  readonly ancestryProfile: "first_parent";
  readonly repositoryId: string | null;
  readonly repositoryRelativePath: string | null;
  readonly repositoryReadSnapshotId: string | null;
  readonly requestedEndpoint: string;
  readonly resolvedEndpoint: string | null;
  readonly requestedLowerBoundary: string | null;
  readonly resolvedLowerBoundary: string | null;
  readonly currentSourceDigest: string;
  readonly limits: HistoricalGitEvidenceLimits;
  readonly causes: readonly HistoricalGitEvidenceCauseRecord[];
  readonly continuityQualified: boolean;
  readonly forcedLossDistinguishable: false;
}

export interface PlanningHistoricalSnapshotBasis {
  readonly repositoryId: string;
  readonly repositoryRelativePath: string;
  readonly repositoryReadSnapshotId: string;
  readonly commitId: string;
  readonly parentCommitIds: readonly string[];
  readonly blobId: string | null;
  readonly sourceDigest: string | null;
  readonly recordedAt: string | null;
  readonly isMergeCommit: boolean;
  readonly isEndpoint: boolean;
  readonly isLowerBoundary: boolean;
}

export interface PlanningHistoricalSnapshotObservation {
  readonly basis: PlanningHistoricalSnapshotBasis;
  readonly validity: PlanningHistoricalSourceValidity;
  readonly documentId: string | null;
  readonly selectionState: PlanningHistoricalSelectionState;
  readonly observation: PlanningPoolObservationResult | null;
  readonly globalExecutionEvidence: "complete" | "incomplete" | "unavailable";
  readonly diagnosticCodes: readonly string[];
}

export interface PlanningCurrentObservationAuthority {
  readonly state: "observed" | "selection_absent" | "unavailable";
  readonly sourceDigest: string;
  readonly observation: PlanningPoolObservationResult | null;
  readonly overridesHistoricalFacts: true;
}

export interface PlanningHistoricalSemanticEpoch {
  readonly ordinal: number;
  readonly firstObservedCommitId: string;
  readonly lastObservedCommitId: string;
  readonly valueDigest: string;
}

export type PlanningHistoricalOccurrenceEnd =
  | "current_endpoint"
  | "removed"
  | "gap"
  | "historical_endpoint";

export interface PlanningHistoricalWorkOccurrence {
  readonly occurrenceId: string;
  readonly workId: string;
  readonly firstObservedCommitId: string;
  readonly lastObservedCommitId: string;
  readonly retiredAtCommitId: string | null;
  readonly endedBy: PlanningHistoricalOccurrenceEnd;
  readonly observedCommitIds: readonly string[];
  readonly semanticEpochs: readonly PlanningHistoricalSemanticEpoch[];
}

export interface PlanningHistoricalWindowOccurrence {
  readonly occurrenceId: string;
  readonly windowId: string;
  readonly firstObservedCommitId: string;
  readonly lastObservedCommitId: string;
  readonly retiredAtCommitId: string | null;
  readonly endedBy: PlanningHistoricalOccurrenceEnd;
  readonly observedCommitIds: readonly string[];
  readonly semanticEpochs: readonly PlanningHistoricalSemanticEpoch[];
}

export type PlanningHistoricalRelationKind =
  | "work_event"
  | "work_activity"
  | "work_milestone_projection"
  | "work_task_projection"
  | "work_dependency"
  | "window_membership";

export interface PlanningHistoricalRelationOccurrence {
  readonly occurrenceId: string;
  readonly kind: PlanningHistoricalRelationKind;
  readonly ownerId: string;
  readonly targetId: string;
  readonly firstObservedCommitId: string;
  readonly lastObservedCommitId: string;
  readonly retiredAtCommitId: string | null;
  readonly endedBy: PlanningHistoricalOccurrenceEnd;
  readonly observedCommitIds: readonly string[];
  readonly factEpochs: readonly PlanningHistoricalSemanticEpoch[];
}

export interface PlanningHistoricalWindowCloseObservation {
  readonly windowId: string;
  readonly fromCommitId: string;
  readonly toCommitId: string;
  readonly memberWorkIds: readonly string[];
  readonly carriedOver: readonly {
    readonly workId: string;
    readonly targetWindowId: string;
  }[];
  readonly unrecordedDispositionWorkIds: readonly string[];
  readonly exactMutationRequestAvailable: false;
}

export type PlanningHistoricalTransitionKind =
  | "baseline"
  | "representation"
  | "planning_change"
  | "contraction"
  | "window_close"
  | "canonical_advance"
  | "gap";

export interface PlanningHistoricalTransition {
  readonly fromCommitId: string | null;
  readonly toCommitId: string;
  readonly kind: PlanningHistoricalTransitionKind;
  readonly sourceChanged: boolean;
  readonly semanticChanged: boolean;
  readonly addedWorkIds: readonly string[];
  readonly removedWorkIds: readonly string[];
  readonly addedWindowIds: readonly string[];
  readonly removedWindowIds: readonly string[];
  readonly addedRelationKeys: readonly string[];
  readonly removedRelationKeys: readonly string[];
  readonly removedTaskIds: readonly string[];
  readonly removedMilestoneIds: readonly string[];
  readonly strictCanonicalAdvance: boolean;
  readonly continuity: "continuous" | "gap";
}

export interface PlanningHistoricalGap {
  readonly commitId: string;
  readonly cause:
    | "planning_absent"
    | "source_missing"
    | "source_invalid"
    | "source_binding_invalid"
    | "project_discontinuity"
    | "missing_or_forced_loss";
  readonly axisStates: PlanningHistoricalAxisStates;
}

export interface PlanningHistoricalLineage {
  readonly projectId: string;
  readonly workOccurrences: readonly PlanningHistoricalWorkOccurrence[];
  readonly windowOccurrences: readonly PlanningHistoricalWindowOccurrence[];
  readonly relationOccurrences: readonly PlanningHistoricalRelationOccurrence[];
  readonly transitions: readonly PlanningHistoricalTransition[];
  readonly windowCloses: readonly PlanningHistoricalWindowCloseObservation[];
  readonly gaps: readonly PlanningHistoricalGap[];
  readonly ambiguousIdentityIds: readonly string[];
}

export interface PlanningPoolHistoricalObservationResult {
  readonly schemaVersion: "Perttool.PlanningPoolResult.v1";
  readonly historyCapability: "perttool.planning-history-core@1";
  readonly operation: "observe_history";
  readonly ok: boolean;
  readonly documentId: string | null;
  readonly sourceDigest: string;
  readonly normalizedRequest: PlanningObservationRequest | null;
  readonly current: PlanningCurrentObservationAuthority;
  readonly evidence: PlanningHistoricalEvidenceBasis;
  readonly axisStates: PlanningHistoricalAxisStates;
  readonly snapshots: readonly PlanningHistoricalSnapshotObservation[];
  readonly lineage: PlanningHistoricalLineage | null;
  readonly diagnostics: readonly PlanningPoolSourceDiagnostic[];
}

export type PlanningHistoricalEvidenceStatus = HistoricalGitEvidenceStatus;
