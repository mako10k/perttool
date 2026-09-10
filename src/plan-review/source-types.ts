import type { DiagnosticCounts, SourceSpan } from "../model/diagnostics.js";
import type { TextEdit } from "../mutation/text-edits.js";
import type { PlanningPoolSourceModel } from "../planning-pool/source-types.js";
import type { TargetGrammar6ValidatedDocument } from "../semantic/target-validator.js";

export interface PlanReviewSourceCapability {
  readonly id: "perttool.target-grammar-10-plan-review-source";
  readonly version: 1;
  readonly grammarVersion: 10;
}

export type PlanReviewOutcome = "plan_retained" | "plan_changed";
export type PlanReviewTaskReferenceState = "current" | "historical";

export interface PlanReviewRequestSource {
  readonly kind: "plan_review_request";
  readonly id: string;
  readonly qualifiedId: string;
  readonly taskId: string;
  readonly qualifiedTaskId: string;
  readonly taskReferenceState: PlanReviewTaskReferenceState;
  readonly model: 1;
  readonly reason: string;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly locator: string | null;
  readonly outcome: PlanReviewOutcome | null;
  readonly resolvedAt: string | null;
  readonly resolvedBy: string | null;
  readonly resolutionReason: string | null;
  readonly reviewedSourceDigest: string | null;
  readonly changeRequestDigest: string | null;
  readonly planBasisBefore: string | null;
  readonly planBasisAfter: string | null;
  readonly span: SourceSpan;
  readonly idSpan: SourceSpan;
  readonly taskIdSpan: SourceSpan;
}

export interface PlanReviewSourceModel {
  readonly schemaVersion: "Perttool.PlanReviewRequestModel.v1";
  readonly modelVersion: 1;
  readonly grammarVersion: 10;
  readonly documentId: string;
  readonly qualifiedNamespace: string;
  readonly base: PlanningPoolSourceModel;
  readonly baseDocument: TargetGrammar6ValidatedDocument;
  readonly requests: readonly PlanReviewRequestSource[];
}

export interface PlanReviewSourceDiagnostic {
  readonly code: string;
  readonly severity: "error" | "warning" | "info";
  readonly message: string;
  readonly entityId?: string;
  readonly span?: SourceSpan;
  readonly data?: Readonly<Record<string, unknown>>;
}

export interface PlanReviewSourceResult {
  readonly ok: boolean;
  readonly grammarVersion: number | null;
  readonly documentId: string | null;
  readonly model: PlanReviewSourceModel | null;
  readonly diagnostics: readonly PlanReviewSourceDiagnostic[];
  readonly diagnosticCounts: DiagnosticCounts;
  readonly diagnosticsTruncated: boolean;
}

export interface PlanReviewFormatResult {
  readonly ok: boolean;
  readonly documentId: string | null;
  readonly changed: boolean;
  readonly formattedText: string | null;
  readonly edits: readonly TextEdit[];
  readonly diagnostics: readonly PlanReviewSourceDiagnostic[];
  readonly diagnosticsTruncated: boolean;
}

export interface PlanReviewProjectionV1 {
  readonly model_version: 1;
  readonly state: "clear" | "review_required";
  readonly open_request_ids: readonly string[];
  readonly required_actions: readonly ({
    readonly kind: "review_before_new_downstream_work";
    readonly request_ids: readonly string[];
  })[];
}
