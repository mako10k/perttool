import type { Diagnostic } from "../model/diagnostics.js";
import type { BatchMutation } from "../mutation/types.js";
import type { TextEdit } from "../mutation/text-edits.js";
import type { PlanReviewProjectionV1, PlanReviewRequestSource } from "./source-types.js";

export const PLAN_REVIEW_CREATE_REQUEST_ID =
  "Perttool.PlanReviewCreateRequest.v1" as const;
export const PLAN_REVIEW_RESOLVE_REQUEST_ID =
  "Perttool.PlanReviewResolveRequest.v1" as const;
export const PLAN_REVIEW_AUTHORITY_ID =
  "Perttool.PlanReviewAuthorityDecision.v1" as const;

export interface PlanReviewCreateRequestV1 {
  readonly schemaVersion: typeof PLAN_REVIEW_CREATE_REQUEST_ID;
  readonly requestId: string;
  readonly taskId: string;
  readonly reason: string;
  readonly createdAt: string;
  readonly actor: string;
  readonly locator?: string;
}

export interface PlanReviewResolveRequestV1 {
  readonly schemaVersion: typeof PLAN_REVIEW_RESOLVE_REQUEST_ID;
  readonly requestId: string;
  readonly outcome: "plan_retained" | "plan_changed";
  readonly resolvedAt: string;
  readonly actor: string;
  readonly resolutionReason: string;
  readonly acceptedOwners?: readonly string[];
  readonly request?: BatchMutation;
}

export interface NormalizedPlanReviewCreateRequestV1
  extends Omit<PlanReviewCreateRequestV1, "locator"> {
  readonly locator: string | null;
}

export interface NormalizedPlanReviewResolveRequestV1
  extends Omit<PlanReviewResolveRequestV1, "acceptedOwners" | "request"> {
  readonly acceptedOwners: readonly string[];
  readonly request: BatchMutation | null;
  readonly canonicalChangeRequest: string | null;
  readonly changeRequestDigest: string | null;
}

export interface PlanReviewAuthorityDecisionV1 {
  readonly model_version: 1;
  readonly request_id: string;
  readonly source_digest: string;
  readonly candidate_digest: string;
  readonly actor: string;
  readonly effective_dag_owner: string;
  readonly effective_dag_delegates: readonly string[];
  readonly actor_direct: boolean;
  readonly owner_confirmation_required: boolean;
  readonly owner_confirmation_satisfied: boolean;
  readonly authorized: boolean;
}

export interface PlanReviewComposedMutationResult {
  readonly ok: boolean;
  readonly changed: boolean;
  readonly originalDigest: string;
  readonly updatedDigest: string | null;
  readonly updatedText: string | null;
  readonly edits: readonly TextEdit[];
  readonly diagnostics: readonly Diagnostic[];
  readonly diagnosticsTruncated: boolean;
  readonly [field: string]: unknown;
}

export interface PlanReviewMutationPlanBasis {
  readonly status: "unchanged" | "changed";
  readonly beforeDigest: string | null;
  readonly afterDigest: string | null;
}

export interface PlanReviewMutationCoreResult {
  readonly operation: "create" | "resolve";
  readonly ok: boolean;
  readonly documentId: string | null;
  readonly changed: boolean;
  readonly originalDigest: string;
  readonly updatedDigest: string | null;
  readonly updatedText: string | null;
  readonly diff: string | null;
  readonly edits: readonly TextEdit[];
  readonly requestBefore: PlanReviewRequestSource | null;
  readonly requestAfter: PlanReviewRequestSource | null;
  readonly projectionBefore: PlanReviewProjectionV1 | null;
  readonly projectionAfter: PlanReviewProjectionV1 | null;
  readonly planBasis: PlanReviewMutationPlanBasis;
  readonly planReviewAuthority: PlanReviewAuthorityDecisionV1 | null;
  readonly composedMutation: PlanReviewComposedMutationResult | null;
  readonly diagnostics: readonly Diagnostic[];
  readonly diagnosticsTruncated: boolean;
}

export interface PlanReviewMutationOptions {
  readonly originalLabel?: string;
  readonly updatedLabel?: string;
  readonly expectedDigest?: string;
  readonly maxDiagnostics?: number;
}

export interface PlanReviewMutationDependencies {
  readonly composeBatch: (
    text: string,
    request: BatchMutation,
    authority: Readonly<{
      actor: string;
      acceptedOwners: readonly string[];
    }>,
  ) => PlanReviewComposedMutationResult;
}

export type PlanReviewPersistenceRequest =
  | {
      readonly mode: "in_place";
      readonly target: string;
      readonly expectedDigest?: string;
    }
  | {
      readonly mode: "out";
      readonly source: string;
      readonly target: string;
      readonly fileMode?: number;
    };

export interface PlanReviewWriteProjection {
  readonly mode: "in_place" | "out";
  readonly target: string;
  readonly written: boolean;
}
