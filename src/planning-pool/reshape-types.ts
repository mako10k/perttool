import type { TextEdit } from "../mutation/text-edits.js";
import type { PlanningPoolSourceDiagnostic } from "./source-types.js";

export interface PlanningReshapeCoreCapability {
  readonly id: "perttool.planning-reshape-core";
  readonly version: 1;
  readonly normalizationContract: "perttool.planning-reshape-normalization@1";
}

export type PlanningReshapeIntent =
  | "reshape"
  | "project"
  | "defer"
  | "archive"
  | "composite";

export interface PlanningReshapeCreatedWork {
  readonly work_id: string;
  readonly title: string;
  readonly insert_after_work_id: string | null;
}

export interface PlanningReshapeExistingOrigin {
  readonly kind: "existing";
  readonly work_id: string;
  readonly start_utf16: number;
  readonly end_utf16: number;
  readonly source_text: string;
}

export interface PlanningReshapeCreatedOrigin {
  readonly kind: "created";
  readonly source_text: string;
  readonly asserted_new_meaning: true;
}

export type PlanningReshapeElementOrigin =
  | PlanningReshapeExistingOrigin
  | PlanningReshapeCreatedOrigin;

export interface PlanningReshapeWorkDestination {
  readonly kind: "work";
  readonly work_id: string;
  readonly position: number;
  readonly text: string;
}

export interface PlanningReshapeDiscardDestination {
  readonly kind: "discard";
  readonly reason?: string;
}

export type PlanningReshapeElementDestination =
  | PlanningReshapeWorkDestination
  | PlanningReshapeDiscardDestination;

export interface PlanningReshapeSemanticElement {
  readonly element_id: string;
  readonly origin: PlanningReshapeElementOrigin;
  readonly destination: PlanningReshapeElementDestination;
}

export interface PlanningEntityDisposition {
  readonly entity_kind: "event" | "activity";
  readonly entity_id: string;
  readonly action: "retain" | "create" | "project" | "defer" | "discard";
  readonly reason?: string;
}

export interface PlanningAssociationDisposition {
  readonly entity_kind: "event" | "activity";
  readonly entity_id: string;
  readonly origin_work_id: string | null;
  readonly destination_work_id: string | null;
}

export interface PlanningProjectionLinkDisposition {
  readonly strict_kind: "milestone" | "task";
  readonly strict_id: string;
  readonly origin_work_id: string | null;
  readonly destination_work_id: string | null;
}

export interface PlanningDependencyDisposition {
  readonly dependent_work_id: string;
  readonly prerequisite_work_id: string;
  readonly action: "retain" | "rebind" | "represented" | "no_longer_required";
  readonly final_dependent_work_id?: string;
  readonly final_prerequisite_work_id?: string;
  readonly represented_by?: readonly string[];
  readonly reason?: string;
}

export interface PlanningWindowMembershipDisposition {
  readonly window_id: string;
  readonly origin_work_id: string;
  readonly destination_work_id: string | null;
}

export interface PlanningResidualDescriptionAction {
  readonly work_id: string;
  readonly text: string;
}

export interface PlanningReshapeRequest {
  readonly request_schema_version: "Perttool.PlanningReshapeRequest.v1";
  readonly normalization_contract: "perttool.planning-reshape-normalization@1";
  readonly source_digest: string;
  readonly intent: PlanningReshapeIntent;
  readonly affected_work_ids: readonly string[];
  readonly created_works: readonly PlanningReshapeCreatedWork[];
  readonly removed_work_ids: readonly string[];
  readonly semantic_elements: readonly PlanningReshapeSemanticElement[];
  readonly planning_entity_dispositions: readonly PlanningEntityDisposition[];
  readonly association_dispositions: readonly PlanningAssociationDisposition[];
  readonly projection_link_dispositions: readonly PlanningProjectionLinkDisposition[];
  readonly dependency_dispositions: readonly PlanningDependencyDisposition[];
  readonly window_membership_dispositions: readonly PlanningWindowMembershipDisposition[];
  readonly final_work_order: readonly string[];
  readonly add_residual_description: readonly PlanningResidualDescriptionAction[];
  readonly strict_fragment: null;
  readonly window_close: null;
}

export interface PlanningReshapeNormalizationResult {
  readonly ok: boolean;
  readonly request: PlanningReshapeRequest | null;
  readonly canonicalUtf8: string | null;
  readonly preflightHash: string | null;
  readonly diagnostics: readonly PlanningPoolSourceDiagnostic[];
}

export interface PlanningReshapeDescriptionRow {
  readonly workId: string;
  readonly description: string;
  readonly elementIds: readonly string[];
}

export interface PlanningReshapeBinding {
  readonly normalizationContract: "perttool.planning-reshape-normalization@1";
  readonly preflightHash: string;
  readonly sourceDigest: string;
  readonly candidateDigest: string;
}

export interface PlanningReshapeAuthorityImpact {
  readonly affectedScopes: readonly ["dag"];
  readonly requiredOwner: string | null;
  readonly userResponseRequired: boolean;
}

export interface PlanningReshapeAuditResult {
  readonly ok: boolean;
  readonly documentId: string | null;
  readonly sourceDigest: string;
  readonly normalizedRequest: PlanningReshapeRequest | null;
  readonly canonicalRequestUtf8: string | null;
  readonly preflightHash: string | null;
  readonly candidateDigest: string | null;
  readonly candidateText: string | null;
  readonly changed: boolean;
  readonly edits: readonly TextEdit[];
  readonly beforeDescriptions: readonly PlanningReshapeDescriptionRow[];
  readonly afterDescriptions: readonly PlanningReshapeDescriptionRow[];
  readonly diagnostics: readonly PlanningPoolSourceDiagnostic[];
}

export interface PlanningReshapePreflightResult extends PlanningReshapeAuditResult {
  readonly schemaVersion: "Perttool.PlanningReshapePreflightResult.v1";
  readonly preflightToken: string | null;
  readonly tokenExpiresAt: string | null;
  readonly authorityImpact: PlanningReshapeAuthorityImpact | null;
}

export interface PlanningReshapeApplyPreparationResult extends PlanningReshapeAuditResult {
  readonly schemaVersion: "Perttool.PlanningMutationResult.v1";
  readonly preflightTokenValidated: boolean;
  readonly authorityImpact: PlanningReshapeAuthorityImpact | null;
}

export type PlanningReshapeTokenState = "unused" | "committing" | "consumed";

export interface PlanningReshapeTokenSnapshot {
  readonly tokenDigest: string;
  readonly binding: PlanningReshapeBinding;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly state: PlanningReshapeTokenState;
}

export interface PlanningReshapeTokenIssue {
  readonly token: string;
  readonly expiresAt: string;
}

export interface PlanningReshapeTokenDecision {
  readonly ok: boolean;
  readonly state: PlanningReshapeTokenState | "unknown" | "expired" | "mismatch";
  readonly recovered: boolean;
  readonly completed: boolean;
}
