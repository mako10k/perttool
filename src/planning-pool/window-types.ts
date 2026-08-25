import type { TextEdit } from "../mutation/text-edits.js";
import type { PlanningPoolSourceDiagnostic } from "./source-types.js";

export interface PlanningWindowCoreCapability {
  readonly id: "perttool.planning-window-core";
  readonly version: 1;
}

export interface PlanningWindowFinalFields {
  readonly title: string;
  readonly objective: string;
  readonly start: string | null;
  readonly end: string | null;
  readonly work_ids: readonly string[];
}

export interface PlanningExistingCarryOverTarget {
  readonly kind: "existing";
  readonly window_id: string;
}

export interface PlanningNewCarryOverTarget {
  readonly kind: "new";
  readonly window_id: string;
  readonly title: string;
  readonly objective: string;
  readonly start: string | null;
  readonly end: string | null;
}

export type PlanningCarryOverTarget =
  | PlanningExistingCarryOverTarget
  | PlanningNewCarryOverTarget;

export interface PlanningWindowCloseIntent {
  readonly window_id: string;
  readonly objective_disposition: "discard";
  readonly carry_over_work_ids: readonly string[];
  readonly carry_over_target: PlanningCarryOverTarget | null;
}

export interface PlanningWindowMutationRequest {
  readonly request_schema_version: "Perttool.WindowMutationRequest.v1";
  readonly source_digest: string;
  readonly operation: "add" | "set" | "close";
  readonly window_id: string;
  readonly final: PlanningWindowFinalFields | null;
  readonly objective_disposition: "discard" | null;
  readonly carry_over_work_ids: readonly string[];
  readonly carry_over_target: PlanningCarryOverTarget | null;
}

export interface PlanningPersistedWindowSelectionInput {
  readonly kind: "persisted";
  readonly window_id: string;
}

export interface PlanningAdHocWindowSelectionInput {
  readonly kind: "ad_hoc";
  readonly title: string | null;
  readonly objective: string | null;
  readonly start: string | null;
  readonly end: string | null;
  readonly work_ids: readonly string[];
}

export type PlanningWindowSelectionInput =
  | PlanningPersistedWindowSelectionInput
  | PlanningAdHocWindowSelectionInput;

export interface PlanningWindowSnapshot {
  readonly kind: "persisted" | "ad_hoc";
  readonly qualifiedId: string | null;
  readonly title: string | null;
  readonly objective: string | null;
  readonly start: string | null;
  readonly end: string | null;
  readonly workIds: readonly string[];
}

export interface PlanningWindowDependencyCoverage {
  readonly dependentWorkId: string;
  readonly prerequisiteWorkId: string;
  readonly covered: boolean;
}

export interface PlanningWindowMembershipOverlap {
  readonly windowId: string;
  readonly sharedWorkIds: readonly string[];
}

export interface PlanningWindowTemporalOverlap {
  readonly windowId: string;
  readonly state: "overlap" | "disjoint" | "unavailable";
  readonly intersectionStart: string | null;
  readonly intersectionEnd: string | null;
  readonly cause: "incomparable_temporal_kinds" | null;
}

export interface PlanningWindowSelectionResult {
  readonly ok: boolean;
  readonly documentId: string | null;
  readonly sourceDigest: string;
  readonly selection: PlanningWindowSnapshot | null;
  readonly orderedWorkIds: readonly string[];
  readonly dependencies: readonly PlanningWindowDependencyCoverage[];
  readonly membershipOverlaps: readonly PlanningWindowMembershipOverlap[];
  readonly temporalOverlaps: readonly PlanningWindowTemporalOverlap[];
  readonly diagnostics: readonly PlanningPoolSourceDiagnostic[];
}

export interface PlanningWindowCarryOverRecord {
  readonly workId: string;
  readonly targetWindowId: string;
  readonly status: "selected" | "already_selected";
}

export interface PlanningWindowCloseReport {
  readonly removedWindow: PlanningWindowSnapshot;
  readonly objectiveDisposition: "discard";
  readonly carryOver: readonly PlanningWindowCarryOverRecord[];
  readonly targetCreated: boolean;
}

export interface PlanningWindowDestructiveRecord {
  readonly ownerClass: "canonical";
  readonly entityKind: "window";
  readonly qualifiedId: string;
  readonly startOffset: number;
  readonly endOffset: number;
}

export interface PlanningWindowAuthorityImpact {
  readonly affectedScopes: readonly [];
  readonly ordinaryMaintenance: true;
  readonly userResponseRequired: false;
}

export interface PlanningWindowMutationAuditResult {
  readonly schemaVersion: "Perttool.PlanningMutationResult.v1";
  readonly windowCapability: "perttool.planning-window-core@1";
  readonly ok: boolean;
  readonly documentId: string | null;
  readonly sourceDigest: string;
  readonly normalizedRequest: PlanningWindowMutationRequest | null;
  readonly candidateDigest: string | null;
  readonly candidateText: string | null;
  readonly changed: boolean;
  readonly edits: readonly TextEdit[];
  readonly before: PlanningWindowSnapshot | null;
  readonly after: PlanningWindowSnapshot | null;
  readonly closeReport: PlanningWindowCloseReport | null;
  readonly destructiveRecords: readonly PlanningWindowDestructiveRecord[];
  readonly authorityImpact: PlanningWindowAuthorityImpact | null;
  readonly diagnostics: readonly PlanningPoolSourceDiagnostic[];
}
