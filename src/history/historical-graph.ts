import { validateStoredLifecycleState } from "../actuals/lifecycle.js";
import { planTargetPlanAssuranceAdvance } from "../assurance/advance.js";
import { canonicalJson } from "../assurance/canonical.js";
import { evaluatePlanAssurance } from "../assurance/evaluate.js";
import { projectPlanAssuranceInput } from "../assurance/source.js";
import { sha256Digest } from "../model/sha256.js";
import { TARGET_GRAMMAR_6_CAPABILITY } from "../parser/document-parser.js";
import {
  validateTargetGrammar6Document,
  type TargetGrammar5ValidatedDocument,
} from "../semantic/target-validator.js";
import type {
  HistoricalGitEvidenceCause,
  HistoricalGitEvidenceResult,
  HistoricalGitInspectionSnapshot,
} from "./git-probe.js";
import {
  HISTORICAL_TRANSITION_MODEL_VERSION,
  projectHistoricalTransitionModel,
  projectHistoricalTransitionSequence,
  type HistoricalCanonicalAdvanceCandidateV1,
  type HistoricalEntityKind,
  type HistoricalEntityValueEpochV1,
  type HistoricalGateSemanticV1,
  type HistoricalMilestoneSemanticV1,
  type HistoricalResourceSemanticV1,
  type HistoricalTaskSemanticV1,
  type HistoricalTransitionClassificationV1,
  type HistoricalTransitionProjectionV1,
  type HistoricalTransitionSemanticModelV1,
  type HistoricalWorkEventSemanticV1,
} from "./historical-transition.js";

export const HISTORICAL_DAG_MODEL_VERSION = 1 as const;
export const HISTORICAL_DAG_MODEL_ID = "Perttool.HistoricalDagModel.v1" as const;
export const HISTORICAL_CANONICAL_ADVANCE_PLANNER_VERSION =
  "perttool.canonical-advance.v1" as const;

export const HISTORICAL_LINEAR_CORE_LIMITS = Object.freeze({
  entityValueEpochs: 100_000,
  transitionRecords: 2_047,
  renderedGraphOccurrences: 20_000,
  historicalSourceBindings: 100_000,
});

export type HistoricalSourceValidityV1 =
  | "source_missing"
  | "source_invalid"
  | "grammar_unsupported"
  | "syntax_invalid"
  | "semantic_invalid"
  | "semantic_valid";

export type HistoricalAssuranceObservationV1 =
  | "verified"
  | "withheld"
  | "not_enabled"
  | "unavailable";

export type HistoricalLinearStatusV1 =
  | "complete"
  | "incomplete"
  | "unavailable";

export type HistoricalLinearCauseV1 =
  | "no_repository"
  | "no_head"
  | "unknown_revision"
  | "ambiguous_revision"
  | "non_commit_revision"
  | "endpoint_path_missing"
  | "lower_path_missing"
  | "lower_not_first_parent_ancestor"
  | "shallow_origin"
  | "unsupported_object_format"
  | "object_read_failed"
  | "repository_race"
  | "source_missing"
  | "source_invalid"
  | "grammar_unsupported"
  | "syntax_invalid"
  | "semantic_invalid"
  | "assurance_withheld"
  | "event_payload_changed"
  | "identity_ambiguous"
  | "ambiguous_edit"
  | "noncanonical_removal"
  | "topology_conflict"
  | "lineage_cycle"
  | "hard_limit";

export type HistoricalLinearLimitNameV1 =
  keyof typeof HISTORICAL_LINEAR_CORE_LIMITS;

export interface HistoricalLinearCoreLimitsV1 {
  readonly entityValueEpochs: number;
  readonly transitionRecords: number;
  readonly renderedGraphOccurrences: number;
  readonly historicalSourceBindings: number;
}

export interface HistoricalLinearCauseRecordV1 {
  readonly cause: HistoricalLinearCauseV1;
  readonly commit_id: string | null;
  readonly subject:
    | "evidence"
    | "snapshot"
    | "assurance"
    | "transition"
    | "lineage"
    | "limit";
  readonly limit: HistoricalLinearLimitNameV1 | null;
  readonly actual: number | null;
}

export interface HistoricalSourceBindingV1 {
  readonly repository_id: string;
  readonly repository_relative_path: string;
  readonly commit_id: string;
  readonly blob_id: string;
  readonly source_digest: string;
  readonly range: {
    readonly start: {
      readonly offset: number;
      readonly line: number;
      readonly column: number;
    };
    readonly end: {
      readonly offset: number;
      readonly line: number;
      readonly column: number;
    };
  };
  readonly declaration_kind: string;
  readonly source_id: string;
  readonly owner_path: string;
}

type HistoricalEntitySemanticV1 =
  | HistoricalMilestoneSemanticV1
  | HistoricalTaskSemanticV1
  | HistoricalGateSemanticV1
  | HistoricalResourceSemanticV1;

export interface HistoricalGraphOccurrenceV1 {
  readonly entity_kind: HistoricalEntityKind;
  readonly source_id: string;
  readonly occurrence_id: string | null;
  readonly value_epoch_ordinal: number | null;
  readonly semantic: HistoricalEntitySemanticV1;
  readonly from_occurrence_id: string | null;
  readonly to_occurrence_id: string | null;
  readonly first_observed_commit_id: string;
  readonly last_observed_commit_id: string;
  readonly retired_at_commit_id: string | null;
}

export interface HistoricalSnapshotGraphV1 {
  readonly project_id: string;
  readonly semantic_digest: string;
  readonly topology_epoch_id: string | null;
  readonly occurrences: readonly HistoricalGraphOccurrenceV1[];
}

export interface HistoricalCheckpointV1 {
  readonly commit_id: string;
  readonly parent_commit_ids: readonly string[];
  readonly blob_id: string;
  readonly source_digest: string;
  readonly recorded_at: string | null;
  readonly is_merge_commit: boolean;
  readonly segment_ordinal: number;
  readonly assurance: HistoricalAssuranceObservationV1;
  readonly semantic_digest: string;
  readonly transition: HistoricalTransitionClassificationV1;
  readonly graph: HistoricalSnapshotGraphV1;
  readonly source_bindings: readonly HistoricalSourceBindingV1[];
}

export interface HistoricalTimelineEntryV1 {
  readonly commit_id: string;
  readonly parent_commit_ids: readonly string[];
  readonly blob_id: string | null;
  readonly source_digest: string | null;
  readonly recorded_at: string | null;
  readonly is_merge_commit: boolean;
  readonly validity: HistoricalSourceValidityV1;
  readonly assurance: HistoricalAssuranceObservationV1;
  readonly segment_ordinal: number | null;
  readonly semantic_digest: string | null;
  readonly topology_epoch_id: string | null;
  readonly transition: HistoricalTransitionClassificationV1 | null;
  readonly graph: HistoricalSnapshotGraphV1 | null;
  readonly diagnostic_codes: readonly string[];
}

export interface HistoricalTimelineSegmentV1 {
  readonly ordinal: number;
  readonly first_commit_id: string;
  readonly last_commit_id: string;
  readonly checkpoint_commit_ids: readonly string[];
}

export interface HistoricalTimelineV1 {
  readonly entries: readonly HistoricalTimelineEntryV1[];
  readonly segments: readonly HistoricalTimelineSegmentV1[];
}

export interface HistoricalFrozenWorkEventV1 {
  readonly id: string;
  readonly task_occurrence_id: string;
  readonly first_observed_commit_id: string;
  readonly last_observed_commit_id: string;
  readonly event: HistoricalWorkEventSemanticV1;
}

export interface HistoricalCanonicalAdvanceProofV1 {
  readonly from_commit_id: string;
  readonly to_commit_id: string;
  readonly from_blob_id: string;
  readonly to_blob_id: string;
  readonly from_source_digest: string;
  readonly to_source_digest: string;
  readonly planner_version: typeof HISTORICAL_CANONICAL_ADVANCE_PLANNER_VERSION;
  readonly candidate_semantic_digest: string;
  readonly removed_occurrence_ids: readonly string[];
  readonly retained_occurrence_ids: readonly string[];
  readonly removed_task_ids: readonly string[];
  readonly removed_gate_ids: readonly string[];
  readonly removed_milestone_ids: readonly string[];
  readonly removed_work_event_ids: readonly string[];
  readonly removed_assurance_record_ids: readonly string[];
  readonly state_changed_milestone_ids: readonly string[];
}

export interface HistoricalLineageV1 {
  readonly project_id: string;
  readonly endpoint_checkpoint_id: string;
  readonly occurrences: readonly HistoricalGraphOccurrenceV1[];
  readonly current_occurrence_ids: readonly string[];
  readonly retired_occurrence_ids: readonly string[];
  readonly frozen_work_events: readonly HistoricalFrozenWorkEventV1[];
  readonly canonical_advance_proofs:
    readonly HistoricalCanonicalAdvanceProofV1[];
}

export interface HistoricalLinearCoreOptionsV1 {
  readonly snapshotCommitId?: string;
  readonly limits?: Partial<HistoricalLinearCoreLimitsV1>;
}

export interface HistoricalLinearCoreResultV1 {
  readonly model: typeof HISTORICAL_DAG_MODEL_ID;
  readonly model_version: typeof HISTORICAL_DAG_MODEL_VERSION;
  readonly transition_model_version:
    typeof HISTORICAL_TRANSITION_MODEL_VERSION;
  readonly status: HistoricalLinearStatusV1;
  readonly ancestry_profile: "first_parent";
  readonly evidence_status: HistoricalGitEvidenceResult["status"];
  readonly repository_id: string | null;
  readonly repository_relative_path: string | null;
  readonly repository_read_snapshot_id: string | null;
  readonly requested_endpoint: string;
  readonly resolved_endpoint: string | null;
  readonly requested_lower_boundary: string | null;
  readonly resolved_lower_boundary: string | null;
  readonly effective_checkpoint_id: string | null;
  readonly selected_snapshot_commit_id: string;
  readonly selected_snapshot: HistoricalCheckpointV1 | null;
  readonly checkpoints: readonly HistoricalCheckpointV1[];
  readonly lineage: HistoricalLineageV1 | null;
  readonly timeline: HistoricalTimelineV1 | null;
  readonly causes: readonly HistoricalLinearCauseRecordV1[];
  readonly limits: HistoricalLinearCoreLimitsV1;
}

interface ProcessedSnapshot {
  readonly evidence: HistoricalGitInspectionSnapshot;
  readonly validity: HistoricalSourceValidityV1;
  readonly assurance: HistoricalAssuranceObservationV1;
  readonly text: string | null;
  readonly projection: HistoricalTransitionProjectionV1 | null;
  readonly diagnosticCodes: readonly string[];
  readonly segmentOrdinal: number | null;
}

interface CanonicalAdvanceAttempt {
  readonly candidate: HistoricalCanonicalAdvanceCandidateV1;
  readonly summary: NonNullable<ReturnType<
    typeof planTargetPlanAssuranceAdvance
  >["advance"]>;
  readonly summaryVerified: boolean;
}

interface OccurrenceState {
  readonly occurrence: HistoricalGraphOccurrenceV1;
  readonly current: boolean;
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value as Record<string, unknown>)) {
    deepFreeze(child);
  }
  return Object.freeze(value);
}

function compareUnicodeScalars(left: string, right: string): number {
  const leftScalars = Array.from(left, (value) => value.codePointAt(0)!);
  const rightScalars = Array.from(right, (value) => value.codePointAt(0)!);
  const common = Math.min(leftScalars.length, rightScalars.length);
  for (let index = 0; index < common; index += 1) {
    const difference = leftScalars[index]! - rightScalars[index]!;
    if (difference !== 0) return difference;
  }
  return leftScalars.length - rightScalars.length;
}

function sorted(values: Iterable<string>): readonly string[] {
  return [...new Set(values)].sort(compareUnicodeScalars);
}

function sameStrings(
  left: readonly string[],
  right: readonly string[],
): boolean {
  const normalizedLeft = sorted(left);
  const normalizedRight = sorted(right);
  return normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

function removedIds<T extends { readonly id: string }>(
  before: readonly T[],
  after: readonly T[],
): readonly string[] {
  const retained = new Set(after.map(({ id }) => id));
  return sorted(before.map(({ id }) => id).filter((id) => !retained.has(id)));
}

function normalizeLimits(
  overrides: Partial<HistoricalLinearCoreLimitsV1> | undefined,
): HistoricalLinearCoreLimitsV1 {
  const limits = {
    ...HISTORICAL_LINEAR_CORE_LIMITS,
    ...overrides,
  };
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`historical linear limit ${name} is invalid`);
    }
  }
  return Object.freeze(limits);
}

function mapEvidenceCause(
  cause: HistoricalGitEvidenceCause,
): HistoricalLinearCauseV1 {
  if (cause === "ambiguous_path") return "source_invalid";
  if (cause === "target_changed") return "repository_race";
  return cause;
}

function causeRecord(
  cause: HistoricalLinearCauseV1,
  subject: HistoricalLinearCauseRecordV1["subject"],
  commitId: string | null = null,
  limit: HistoricalLinearLimitNameV1 | null = null,
  actual: number | null = null,
): HistoricalLinearCauseRecordV1 {
  return { cause, commit_id: commitId, subject, limit, actual };
}

function causeKey(cause: HistoricalLinearCauseRecordV1): string {
  return [
    cause.cause,
    cause.commit_id ?? "",
    cause.subject,
    cause.limit ?? "",
    cause.actual?.toString() ?? "",
  ].join("\u0000");
}

function uniqueCauses(
  causes: readonly HistoricalLinearCauseRecordV1[],
): readonly HistoricalLinearCauseRecordV1[] {
  const byKey = new Map<string, HistoricalLinearCauseRecordV1>();
  for (const cause of causes) {
    const key = causeKey(cause);
    if (!byKey.has(key)) byKey.set(key, cause);
  }
  return [...byKey.values()];
}

function classifyAssurance(
  projection: HistoricalTransitionProjectionV1,
  validated: Parameters<typeof projectPlanAssuranceInput>[0],
): HistoricalAssuranceObservationV1 {
  const evaluation = evaluatePlanAssurance(projectPlanAssuranceInput(validated));
  if (!evaluation.ok || evaluation.coverage === null) return "unavailable";
  if (evaluation.coverage === "not_enabled") return "not_enabled";
  if (
    evaluation.unavailableTaskIds.length > 0 ||
    projection.semantic.plan_seals.some(({ accepted_basis }) =>
      accepted_basis.length === 0
    )
  ) return "unavailable";
  if (
    evaluation.coverage !== "complete" ||
    evaluation.replanRequiredTaskIds.length > 0 ||
    evaluation.directMismatchTaskIds.length > 0 ||
    evaluation.inheritedMismatchTaskIds.length > 0
  ) return "withheld";
  return "verified";
}

function processSnapshot(
  snapshot: HistoricalGitInspectionSnapshot,
): Omit<ProcessedSnapshot, "segmentOrdinal"> {
  if (
    snapshot.blobId === null || snapshot.source === null ||
    snapshot.sourceDigest === null
  ) {
    return {
      evidence: snapshot,
      validity: "source_missing",
      assurance: "unavailable",
      text: null,
      projection: null,
      diagnosticCodes: [],
    };
  }
  if (sha256Digest(snapshot.source) !== snapshot.sourceDigest) {
    return {
      evidence: snapshot,
      validity: "source_invalid",
      assurance: "unavailable",
      text: null,
      projection: null,
      diagnosticCodes: [],
    };
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: true,
    }).decode(snapshot.source);
  } catch {
    return {
      evidence: snapshot,
      validity: "source_invalid",
      assurance: "unavailable",
      text: null,
      projection: null,
      diagnosticCodes: [],
    };
  }
  const checked = validateTargetGrammar6Document(
    text,
    TARGET_GRAMMAR_6_CAPABILITY,
  );
  const diagnosticCodes = checked.diagnostics.map(({ code }) => code);
  if (
    checked.grammarVersion !== null &&
    ![1, 2, 3, 4, 5, 6].includes(checked.grammarVersion)
  ) {
    return {
      evidence: snapshot,
      validity: "grammar_unsupported",
      assurance: "unavailable",
      text,
      projection: null,
      diagnosticCodes,
    };
  }
  if (checked.parseFailed) {
    return {
      evidence: snapshot,
      validity: "syntax_invalid",
      assurance: "unavailable",
      text,
      projection: null,
      diagnosticCodes,
    };
  }
  if (!checked.ok || checked.validatedDocument === null) {
    return {
      evidence: snapshot,
      validity: "semantic_invalid",
      assurance: "unavailable",
      text,
      projection: null,
      diagnosticCodes,
    };
  }
  const lifecycleDiagnostics = validateStoredLifecycleState(
    checked.validatedDocument as unknown as TargetGrammar5ValidatedDocument,
  );
  if (lifecycleDiagnostics.length > 0) {
    return {
      evidence: snapshot,
      validity: "semantic_invalid",
      assurance: "unavailable",
      text,
      projection: null,
      diagnosticCodes: [
        ...diagnosticCodes,
        ...lifecycleDiagnostics.map(({ code }) => code),
      ],
    };
  }
  const projection = projectHistoricalTransitionModel(
    checked.validatedDocument,
  );
  return {
    evidence: snapshot,
    validity: "semantic_valid",
    assurance: classifyAssurance(projection, checked.validatedDocument),
    text,
    projection,
    diagnosticCodes,
  };
}

function semanticRecords(
  semantic: HistoricalTransitionSemanticModelV1,
): readonly {
  readonly kind: HistoricalEntityKind;
  readonly id: string;
  readonly semantic: HistoricalEntitySemanticV1;
  readonly fromId: string | null;
  readonly toId: string | null;
}[] {
  return [
    ...semantic.milestones.map((value) => ({
      kind: "milestone" as const,
      id: value.id,
      semantic: value,
      fromId: null,
      toId: null,
    })),
    ...semantic.tasks.map((value) => ({
      kind: "task" as const,
      id: value.id,
      semantic: value,
      fromId: value.from_milestone_id,
      toId: value.to_milestone_id,
    })),
    ...semantic.gates.map((value) => ({
      kind: "gate" as const,
      id: value.id,
      semantic: value,
      fromId: value.from_milestone_id,
      toId: value.to_milestone_id,
    })),
    ...semantic.resources.map((value) => ({
      kind: "resource" as const,
      id: value.id,
      semantic: value,
      fromId: null,
      toId: null,
    })),
  ];
}

function epochKey(kind: HistoricalEntityKind, id: string): string {
  return `${kind}\u0000${id}`;
}

function graphFor(
  commitId: string,
  projection: HistoricalTransitionProjectionV1,
  epochs: readonly HistoricalEntityValueEpochV1[],
  topologyEpochId: string | null,
  previousByOccurrence: ReadonlyMap<string, HistoricalGraphOccurrenceV1>,
): HistoricalSnapshotGraphV1 {
  const epochByKey = new Map(
    epochs.map((epoch) => [
      epochKey(epoch.entity_kind, epoch.source_id),
      epoch,
    ] as const),
  );
  const occurrenceByEntity = new Map<string, string | null>();
  for (const epoch of epochs) {
    occurrenceByEntity.set(
      epochKey(epoch.entity_kind, epoch.source_id),
      epoch.occurrence_id,
    );
  }
  const occurrences = semanticRecords(projection.semantic).map((record) => {
    const epoch = epochByKey.get(epochKey(record.kind, record.id));
    if (epoch === undefined) {
      throw new Error("historical sequence omitted an entity epoch");
    }
    const previous = epoch.occurrence_id === null
      ? undefined
      : previousByOccurrence.get(epoch.occurrence_id);
    return {
      entity_kind: record.kind,
      source_id: record.id,
      occurrence_id: epoch.occurrence_id,
      value_epoch_ordinal: epoch.value_epoch_ordinal,
      semantic: record.semantic,
      from_occurrence_id: record.fromId === null
        ? null
        : occurrenceByEntity.get(epochKey("milestone", record.fromId)) ?? null,
      to_occurrence_id: record.toId === null
        ? null
        : occurrenceByEntity.get(epochKey("milestone", record.toId)) ?? null,
      first_observed_commit_id:
        previous?.first_observed_commit_id ?? commitId,
      last_observed_commit_id: commitId,
      retired_at_commit_id: null,
    } satisfies HistoricalGraphOccurrenceV1;
  });
  occurrences.sort((left, right) =>
    ["milestone", "task", "gate", "resource"].indexOf(left.entity_kind) -
      ["milestone", "task", "gate", "resource"].indexOf(right.entity_kind) ||
    compareUnicodeScalars(left.source_id, right.source_id)
  );
  return deepFreeze({
    project_id: projection.semantic.project.id,
    semantic_digest: projection.semantic_digest,
    topology_epoch_id: topologyEpochId,
    occurrences,
  });
}

function cloneRange(range: HistoricalSourceBindingV1["range"]):
HistoricalSourceBindingV1["range"] {
  return {
    start: { ...range.start },
    end: { ...range.end },
  };
}

function sourceBindings(
  snapshot: HistoricalGitInspectionSnapshot,
  projection: HistoricalTransitionProjectionV1,
): readonly HistoricalSourceBindingV1[] {
  if (
    snapshot.blobId === null || snapshot.sourceDigest === null
  ) return [];
  const common = {
    repository_id: snapshot.repositoryId,
    repository_relative_path: snapshot.repositoryRelativePath,
    commit_id: snapshot.commitId,
    blob_id: snapshot.blobId,
    source_digest: snapshot.sourceDigest,
  };
  const bindings: HistoricalSourceBindingV1[] = [];
  for (const declaration of projection.source_fidelity.declarations) {
    bindings.push({
      ...common,
      range: cloneRange(declaration.range),
      declaration_kind: declaration.kind,
      source_id: declaration.id,
      owner_path: declaration.id,
    });
    for (const field of declaration.fields) {
      bindings.push({
        ...common,
        range: cloneRange(field.range),
        declaration_kind: declaration.kind,
        source_id: declaration.id,
        owner_path: `${declaration.id}.${field.name}[${field.ordinal}]`,
      });
      for (const child of field.child_ranges) {
        bindings.push({
          ...common,
          range: cloneRange(child.range),
          declaration_kind: declaration.kind,
          source_id: declaration.id,
          owner_path:
            `${declaration.id}.${field.name}[${field.ordinal}].${child.name}[${child.ordinal}]`,
        });
      }
    }
  }
  return deepFreeze(bindings);
}

function countSourceBindings(
  projection: HistoricalTransitionProjectionV1,
): number {
  return projection.source_fidelity.declarations.reduce(
    (declarationTotal, declaration) =>
      declarationTotal + 1 + declaration.fields.reduce(
        (fieldTotal, field) => fieldTotal + 1 + field.child_ranges.length,
        0,
      ),
    0,
  );
}

function removedAssuranceIds(
  before: HistoricalTransitionSemanticModelV1,
  after: HistoricalTransitionSemanticModelV1,
): readonly string[] {
  return sorted([
    ...before.plan_seals
      .map(({ task_id }) => task_id)
      .filter((id) => !after.plan_seals.some(({ task_id }) => task_id === id)),
    ...removedIds(before.task_outcomes, after.task_outcomes),
    ...removedIds(before.assurance_receipts, after.assurance_receipts),
  ]);
}

function stateChangedMilestones(
  before: HistoricalTransitionSemanticModelV1,
  after: HistoricalTransitionSemanticModelV1,
): readonly string[] {
  const beforeById = new Map(before.milestones.map((value) => [value.id, value]));
  return sorted(after.milestones
    .filter((value) => beforeById.get(value.id)?.state !== value.state)
    .map(({ id }) => id));
}

function canonicalAdvanceAttempt(
  previousText: string,
  previous: HistoricalTransitionProjectionV1,
  current: HistoricalTransitionProjectionV1,
): CanonicalAdvanceAttempt | null {
  const result = planTargetPlanAssuranceAdvance(
    previousText,
    TARGET_GRAMMAR_6_CAPABILITY,
    { governance: { intent: "preview" } },
  );
  if (
    !result.ok || !result.changed || result.updatedText === null ||
    result.advance === null || result.assuranceGuard?.status === "blocked"
  ) return null;
  const checked = validateTargetGrammar6Document(
    result.updatedText,
    TARGET_GRAMMAR_6_CAPABILITY,
  );
  if (!checked.ok || checked.validatedDocument === null) return null;
  const candidateProjection = projectHistoricalTransitionModel(
    checked.validatedDocument,
  );
  const beforeSemantic = previous.semantic;
  const afterSemantic = current.semantic;
  const summaryVerified =
    candidateProjection.semantic_digest === current.semantic_digest &&
    sameStrings(
      result.advance.removedTaskIds,
      removedIds(beforeSemantic.tasks, afterSemantic.tasks),
    ) &&
    sameStrings(
      result.advance.removedGateIds,
      removedIds(beforeSemantic.gates, afterSemantic.gates),
    ) &&
    sameStrings(
      result.advance.removedMilestoneIds,
      removedIds(beforeSemantic.milestones, afterSemantic.milestones),
    ) &&
    sameStrings(
      result.advance.removedWorkEventIds,
      removedIds(beforeSemantic.work_events, afterSemantic.work_events),
    ) &&
    sameStrings(
      result.advance.removedAssuranceRecordIds,
      removedAssuranceIds(beforeSemantic, afterSemantic),
    ) &&
    sameStrings(
      result.advance.stateChangedMilestoneIds,
      stateChangedMilestones(beforeSemantic, afterSemantic),
    );
  return {
    candidate: {
      planner_version: HISTORICAL_CANONICAL_ADVANCE_PLANNER_VERSION,
      base_semantic_digest: previous.semantic_digest,
      candidate: candidateProjection,
      complete: summaryVerified,
      force_requested: false,
      owner_assertion_used: false,
      repository_proof_assumed: false,
      persistence_assumed: false,
    },
    summary: result.advance,
    summaryVerified,
  };
}

function evidenceBindingValid(evidence: HistoricalGitEvidenceResult): boolean {
  if (evidence.status === "unavailable") return true;
  if (
    evidence.objectFormat === null || evidence.repositoryId === null ||
    evidence.repositoryReadSnapshotId === null ||
    evidence.repositoryRelativePath === null ||
    evidence.resolvedEndpoint === null || evidence.snapshots.length === 0 ||
    evidence.inspectedCommitIds.length !== evidence.snapshots.length
  ) return false;
  const seen = new Set<string>();
  for (const [index, snapshot] of evidence.snapshots.entries()) {
    if (
      seen.has(snapshot.commitId) ||
      evidence.inspectedCommitIds[index] !== snapshot.commitId ||
      snapshot.modelVersion !== 1 ||
      snapshot.objectFormat !== evidence.objectFormat ||
      snapshot.repositoryId !== evidence.repositoryId ||
      snapshot.repositoryReadSnapshotId !== evidence.repositoryReadSnapshotId ||
      snapshot.repositoryRelativePath !== evidence.repositoryRelativePath ||
      (snapshot.source === null) !== (snapshot.sourceDigest === null) ||
      (snapshot.source === null) !== (snapshot.blobId === null) ||
      (snapshot.source !== null &&
        sha256Digest(snapshot.source) !== snapshot.sourceDigest)
    ) return false;
    seen.add(snapshot.commitId);
  }
  const endpoint = evidence.snapshots.at(-1)!;
  return endpoint.commitId === evidence.resolvedEndpoint && endpoint.isEndpoint;
}

function emptyResult(
  evidence: HistoricalGitEvidenceResult,
  limits: HistoricalLinearCoreLimitsV1,
  selectedSnapshotCommitId: string,
  causes: readonly HistoricalLinearCauseRecordV1[],
): HistoricalLinearCoreResultV1 {
  return deepFreeze({
    model: HISTORICAL_DAG_MODEL_ID,
    model_version: HISTORICAL_DAG_MODEL_VERSION,
    transition_model_version: HISTORICAL_TRANSITION_MODEL_VERSION,
    status: "unavailable",
    ancestry_profile: "first_parent",
    evidence_status: evidence.status,
    repository_id: evidence.repositoryId,
    repository_relative_path: evidence.repositoryRelativePath,
    repository_read_snapshot_id: evidence.repositoryReadSnapshotId,
    requested_endpoint: evidence.requestedEndpoint,
    resolved_endpoint: evidence.resolvedEndpoint,
    requested_lower_boundary: evidence.requestedLowerBoundary,
    resolved_lower_boundary: evidence.resolvedLowerBoundary,
    effective_checkpoint_id: null,
    selected_snapshot_commit_id: selectedSnapshotCommitId,
    selected_snapshot: null,
    checkpoints: [],
    lineage: null,
    timeline: null,
    causes: uniqueCauses(causes),
    limits,
  });
}

function outputLimitResult(
  evidence: HistoricalGitEvidenceResult,
  limits: HistoricalLinearCoreLimitsV1,
  selectedSnapshotCommitId: string,
  effectiveCheckpointId: string | null,
  causes: readonly HistoricalLinearCauseRecordV1[],
): HistoricalLinearCoreResultV1 {
  return deepFreeze({
    model: HISTORICAL_DAG_MODEL_ID,
    model_version: HISTORICAL_DAG_MODEL_VERSION,
    transition_model_version: HISTORICAL_TRANSITION_MODEL_VERSION,
    status: "incomplete",
    ancestry_profile: "first_parent",
    evidence_status: evidence.status,
    repository_id: evidence.repositoryId,
    repository_relative_path: evidence.repositoryRelativePath,
    repository_read_snapshot_id: evidence.repositoryReadSnapshotId,
    requested_endpoint: evidence.requestedEndpoint,
    resolved_endpoint: evidence.resolvedEndpoint,
    requested_lower_boundary: evidence.requestedLowerBoundary,
    resolved_lower_boundary: evidence.resolvedLowerBoundary,
    effective_checkpoint_id: effectiveCheckpointId,
    selected_snapshot_commit_id: selectedSnapshotCommitId,
    selected_snapshot: null,
    checkpoints: [],
    lineage: null,
    timeline: null,
    causes: uniqueCauses(causes),
    limits,
  });
}

function topologyClosedAndAcyclic(
  occurrences: readonly HistoricalGraphOccurrenceV1[],
): "closed" | "topology_conflict" | "lineage_cycle" {
  const milestones = new Set(
    occurrences
      .filter(({ entity_kind }) => entity_kind === "milestone")
      .map(({ occurrence_id }) => occurrence_id)
      .filter((id): id is string => id !== null),
  );
  const edges = occurrences.filter(({ entity_kind }) =>
    entity_kind === "task" || entity_kind === "gate"
  );
  if (edges.some((edge) =>
    edge.occurrence_id === null || edge.from_occurrence_id === null ||
    edge.to_occurrence_id === null ||
    !milestones.has(edge.from_occurrence_id) ||
    !milestones.has(edge.to_occurrence_id)
  )) return "topology_conflict";
  const indegree = new Map([...milestones].map((id) => [id, 0]));
  const outgoing = new Map([...milestones].map((id) => [id, [] as string[]]));
  for (const edge of edges) {
    const from = edge.from_occurrence_id!;
    const to = edge.to_occurrence_id!;
    outgoing.get(from)!.push(to);
    indegree.set(to, indegree.get(to)! + 1);
  }
  const ready = [...milestones]
    .filter((id) => indegree.get(id) === 0)
    .sort(compareUnicodeScalars);
  let visited = 0;
  while (ready.length > 0) {
    const id = ready.shift()!;
    visited += 1;
    for (const successor of outgoing.get(id)!.sort(compareUnicodeScalars)) {
      const next = indegree.get(successor)! - 1;
      indegree.set(successor, next);
      if (next === 0) {
        ready.push(successor);
        ready.sort(compareUnicodeScalars);
      }
    }
  }
  return visited === milestones.size ? "closed" : "lineage_cycle";
}

function occurrenceIds(
  graph: HistoricalSnapshotGraphV1,
): ReadonlySet<string> {
  return new Set(graph.occurrences
    .map(({ occurrence_id }) => occurrence_id)
    .filter((id): id is string => id !== null));
}

export function reconstructHistoricalLinearHistory(
  evidence: HistoricalGitEvidenceResult,
  options: HistoricalLinearCoreOptionsV1 = {},
): HistoricalLinearCoreResultV1 {
  const limits = normalizeLimits(options.limits);
  const selectedSnapshotCommitId = options.snapshotCommitId ??
    evidence.resolvedEndpoint ?? evidence.requestedEndpoint;
  const evidenceCauses = evidence.causes.map(({ cause, commitId }) =>
    causeRecord(mapEvidenceCause(cause), "evidence", commitId)
  );
  if (evidence.status === "unavailable") {
    return emptyResult(evidence, limits, selectedSnapshotCommitId, evidenceCauses);
  }
  if (!evidenceBindingValid(evidence)) {
    return emptyResult(evidence, limits, selectedSnapshotCommitId, [
      ...evidenceCauses,
      causeRecord("repository_race", "evidence"),
    ]);
  }
  if (!evidence.inspectedCommitIds.includes(selectedSnapshotCommitId)) {
    return emptyResult(evidence, limits, selectedSnapshotCommitId, [
      ...evidenceCauses,
      causeRecord("unknown_revision", "evidence", selectedSnapshotCommitId),
    ]);
  }

  const initial = evidence.snapshots.map(processSnapshot);
  let segmentOrdinal = 0;
  let previousWasValid = false;
  const processed: ProcessedSnapshot[] = initial.map((snapshot) => {
    const valid = snapshot.validity === "semantic_valid";
    if (valid && !previousWasValid) segmentOrdinal += 1;
    previousWasValid = valid;
    return {
      ...snapshot,
      segmentOrdinal: valid ? segmentOrdinal : null,
    };
  });

  const causes: HistoricalLinearCauseRecordV1[] = [...evidenceCauses];
  for (const snapshot of processed) {
    if (snapshot.validity !== "semantic_valid") {
      causes.push(causeRecord(
        snapshot.validity,
        "snapshot",
        snapshot.evidence.commitId,
      ));
    } else if (
      snapshot.assurance === "withheld" ||
      snapshot.assurance === "unavailable"
    ) {
      causes.push(causeRecord(
        "assurance_withheld",
        "assurance",
        snapshot.evidence.commitId,
      ));
    }
  }

  const valid = processed.filter((snapshot): snapshot is ProcessedSnapshot & {
    readonly text: string;
    readonly projection: HistoricalTransitionProjectionV1;
    readonly segmentOrdinal: number;
  } => snapshot.validity === "semantic_valid" && snapshot.text !== null &&
    snapshot.projection !== null && snapshot.segmentOrdinal !== null);
  const indexByCommit = new Map(
    processed.map((snapshot, index) => [snapshot.evidence.commitId, index]),
  );
  const preflightFacts: readonly [
    HistoricalLinearLimitNameV1,
    number,
    number,
  ][] = [
    [
      "entityValueEpochs",
      valid.reduce(
        (sum, snapshot) =>
          sum + semanticRecords(snapshot.projection.semantic).length,
        0,
      ),
      limits.entityValueEpochs,
    ],
    [
      "transitionRecords",
      valid.reduce((sum, snapshot, index) => {
        const previous = index === 0 ? undefined : valid[index - 1];
        return sum + (previous !== undefined &&
            indexByCommit.get(snapshot.evidence.commitId) ===
              indexByCommit.get(previous.evidence.commitId)! + 1
          ? 1
          : 0);
      }, 0),
      limits.transitionRecords,
    ],
    [
      "renderedGraphOccurrences",
      valid.reduce(
        (sum, snapshot) =>
          sum + semanticRecords(snapshot.projection.semantic).length,
        0,
      ),
      limits.renderedGraphOccurrences,
    ],
    [
      "historicalSourceBindings",
      valid.reduce(
        (sum, snapshot) => sum + countSourceBindings(snapshot.projection),
        0,
      ),
      limits.historicalSourceBindings,
    ],
  ];
  const exceededPreflight = preflightFacts.filter(([, actual, limit]) =>
    actual > limit
  );
  if (exceededPreflight.length > 0) {
    return outputLimitResult(
      evidence,
      limits,
      selectedSnapshotCommitId,
      valid.at(-1)?.evidence.commitId ?? null,
      [
        ...causes,
        ...exceededPreflight.map(([name, actual]) =>
          causeRecord("hard_limit", "limit", null, name, actual)
        ),
      ],
    );
  }
  const attempts = new Map<string, CanonicalAdvanceAttempt>();
  const sequenceInputs = valid.map((snapshot, index) => {
    const previous = index === 0 ? undefined : valid[index - 1];
    const connected = previous !== undefined &&
      indexByCommit.get(snapshot.evidence.commitId) ===
        indexByCommit.get(previous.evidence.commitId)! + 1;
    const attempt = connected
      ? canonicalAdvanceAttempt(
          previous.text,
          previous.projection,
          snapshot.projection,
        )
      : null;
    if (attempt !== null) attempts.set(snapshot.evidence.commitId, attempt);
    return {
      commit_id: snapshot.evidence.commitId,
      projection: snapshot.projection,
      connected_to_previous: connected,
      is_merge_commit: snapshot.evidence.isMergeCommit,
      ...(attempt?.summaryVerified === true
        ? { canonical_advance_candidate: attempt.candidate }
        : {}),
    };
  });
  const sequence = projectHistoricalTransitionSequence(sequenceInputs);
  const sequenceByCommit = new Map(
    sequence.checkpoints.map((checkpoint) => [checkpoint.commit_id, checkpoint]),
  );
  for (const cause of sequence.causes) {
    causes.push(causeRecord(cause.cause, "transition", cause.commit_id));
  }
  for (const checkpoint of sequence.checkpoints) {
    if (checkpoint.transition.class === "ambiguous_edit") {
      causes.push(causeRecord(
        "ambiguous_edit",
        "transition",
        checkpoint.commit_id,
      ));
    }
  }

  const occurrenceMemory = new Map<string, HistoricalGraphOccurrenceV1>();
  const checkpoints: HistoricalCheckpointV1[] = [];
  for (const snapshot of valid) {
    const sequenceCheckpoint = sequenceByCommit.get(snapshot.evidence.commitId);
    if (sequenceCheckpoint === undefined) {
      throw new Error("historical sequence checkpoint is missing");
    }
    const graph = graphFor(
      snapshot.evidence.commitId,
      snapshot.projection,
      sequenceCheckpoint.entity_value_epochs,
      sequenceCheckpoint.topology_epoch_id,
      occurrenceMemory,
    );
    for (const occurrence of graph.occurrences) {
      if (occurrence.occurrence_id !== null) {
        occurrenceMemory.set(occurrence.occurrence_id, occurrence);
      }
    }
    checkpoints.push(deepFreeze({
      commit_id: snapshot.evidence.commitId,
      parent_commit_ids: [...snapshot.evidence.parentCommitIds],
      blob_id: snapshot.evidence.blobId!,
      source_digest: snapshot.evidence.sourceDigest!,
      recorded_at: snapshot.evidence.recordedAt,
      is_merge_commit: snapshot.evidence.isMergeCommit,
      segment_ordinal: snapshot.segmentOrdinal,
      assurance: snapshot.assurance,
      semantic_digest: snapshot.projection.semantic_digest,
      transition: sequenceCheckpoint.transition,
      graph,
      source_bindings: sourceBindings(snapshot.evidence, snapshot.projection),
    }));
  }

  const checkpointByCommit = new Map(
    checkpoints.map((checkpoint) => [checkpoint.commit_id, checkpoint]),
  );
  const timelineEntries: HistoricalTimelineEntryV1[] = processed.map((snapshot) => {
    const checkpoint = checkpointByCommit.get(snapshot.evidence.commitId);
    return deepFreeze({
      commit_id: snapshot.evidence.commitId,
      parent_commit_ids: [...snapshot.evidence.parentCommitIds],
      blob_id: snapshot.evidence.blobId,
      source_digest: snapshot.evidence.sourceDigest,
      recorded_at: snapshot.evidence.recordedAt,
      is_merge_commit: snapshot.evidence.isMergeCommit,
      validity: snapshot.validity,
      assurance: snapshot.assurance,
      segment_ordinal: snapshot.segmentOrdinal,
      semantic_digest: checkpoint?.semantic_digest ?? null,
      topology_epoch_id: checkpoint?.graph.topology_epoch_id ?? null,
      transition: checkpoint?.transition ?? null,
      graph: checkpoint?.graph ?? null,
      diagnostic_codes: [...snapshot.diagnosticCodes],
    });
  });
  const timelineSegments: HistoricalTimelineSegmentV1[] = [];
  for (let ordinal = 1; ordinal <= segmentOrdinal; ordinal += 1) {
    const commits = checkpoints
      .filter((checkpoint) => checkpoint.segment_ordinal === ordinal)
      .map(({ commit_id }) => commit_id);
    timelineSegments.push({
      ordinal,
      first_commit_id: commits[0]!,
      last_commit_id: commits.at(-1)!,
      checkpoint_commit_ids: commits,
    });
  }

  const effectiveCheckpointId = checkpoints.at(-1)?.commit_id ?? null;
  let selectedSnapshot = checkpointByCommit.get(selectedSnapshotCommitId) ?? null;
  const transitionRecordCount = sequenceInputs.filter(
    ({ connected_to_previous }) => connected_to_previous,
  ).length;
  const entityEpochCount = sequence.checkpoints.reduce(
    (sum, checkpoint) => sum + checkpoint.entity_value_epochs.length,
    0,
  );
  const sourceBindingCount = checkpoints.reduce(
    (sum, checkpoint) => sum + checkpoint.source_bindings.length,
    0,
  );
  const timelineOccurrenceCount = checkpoints.reduce(
    (sum, checkpoint) => sum + checkpoint.graph.occurrences.length,
    0,
  );
  let outputLimited = false;
  const limitFacts: readonly [
    HistoricalLinearLimitNameV1,
    number,
    number,
  ][] = [
    ["entityValueEpochs", entityEpochCount, limits.entityValueEpochs],
    ["transitionRecords", transitionRecordCount, limits.transitionRecords],
    [
      "renderedGraphOccurrences",
      timelineOccurrenceCount,
      limits.renderedGraphOccurrences,
    ],
    [
      "historicalSourceBindings",
      sourceBindingCount,
      limits.historicalSourceBindings,
    ],
  ];
  for (const [name, actual, limit] of limitFacts) {
    if (actual > limit) {
      outputLimited = true;
      causes.push(causeRecord("hard_limit", "limit", null, name, actual));
    }
  }
  if (
    selectedSnapshot !== null &&
    (
      selectedSnapshot.graph.occurrences.length >
        limits.renderedGraphOccurrences ||
      selectedSnapshot.source_bindings.length >
        limits.historicalSourceBindings
    )
  ) selectedSnapshot = null;

  let lineageAvailable = evidence.status === "complete" &&
    processed.every(({ validity }) => validity === "semantic_valid") &&
    sequence.causes.length === 0 &&
    checkpoints.length > 0 &&
    checkpoints.at(-1)?.commit_id === evidence.resolvedEndpoint &&
    !outputLimited;
  const states = new Map<string, OccurrenceState>();
  const frozenEvents = new Map<string, HistoricalFrozenWorkEventV1>();
  const proofs: HistoricalCanonicalAdvanceProofV1[] = [];
  let previousCheckpoint: HistoricalCheckpointV1 | null = null;
  let previousProjection: HistoricalTransitionProjectionV1 | null = null;
  for (const checkpoint of checkpoints) {
    const projection = valid.find(({ evidence: item }) =>
      item.commitId === checkpoint.commit_id
    )!.projection;
    const currentIds = occurrenceIds(checkpoint.graph);
    if (previousCheckpoint !== null && checkpoint.transition.class === "canonical_advance") {
      for (const [id, state] of states) {
        if (state.current && !currentIds.has(id)) {
          states.set(id, {
            current: false,
            occurrence: {
              ...state.occurrence,
              retired_at_commit_id: checkpoint.commit_id,
            },
          });
        }
      }
      const attempt = attempts.get(checkpoint.commit_id);
      if (attempt === undefined || !attempt.summaryVerified || previousProjection === null) {
        lineageAvailable = false;
        causes.push(causeRecord(
          "topology_conflict",
          "lineage",
          checkpoint.commit_id,
        ));
      } else {
        const previousIds = occurrenceIds(previousCheckpoint.graph);
        proofs.push({
          from_commit_id: previousCheckpoint.commit_id,
          to_commit_id: checkpoint.commit_id,
          from_blob_id: previousCheckpoint.blob_id,
          to_blob_id: checkpoint.blob_id,
          from_source_digest: previousCheckpoint.source_digest,
          to_source_digest: checkpoint.source_digest,
          planner_version: HISTORICAL_CANONICAL_ADVANCE_PLANNER_VERSION,
          candidate_semantic_digest: attempt.candidate.candidate.semantic_digest,
          removed_occurrence_ids: sorted([...previousIds].filter((id) =>
            !currentIds.has(id)
          )),
          retained_occurrence_ids: sorted([...previousIds].filter((id) =>
            currentIds.has(id)
          )),
          removed_task_ids: [...attempt.summary.removedTaskIds],
          removed_gate_ids: [...attempt.summary.removedGateIds],
          removed_milestone_ids: [...attempt.summary.removedMilestoneIds],
          removed_work_event_ids: [...attempt.summary.removedWorkEventIds],
          removed_assurance_record_ids: [
            ...attempt.summary.removedAssuranceRecordIds,
          ],
          state_changed_milestone_ids: [
            ...attempt.summary.stateChangedMilestoneIds,
          ],
        });
      }
    } else if (
      previousCheckpoint !== null &&
      checkpoint.transition.class !== "representation_only" &&
      checkpoint.transition.class !== "evidence_extension" &&
      checkpoint.transition.class !== "lifecycle_projection" &&
      checkpoint.transition.class !== "future_plan_edit"
    ) {
      lineageAvailable = false;
    }
    for (const occurrence of checkpoint.graph.occurrences) {
      if (occurrence.occurrence_id !== null) {
        states.set(occurrence.occurrence_id, {
          current: true,
          occurrence,
        });
      }
    }
    const taskOccurrenceById = new Map(checkpoint.graph.occurrences
      .filter(({ entity_kind, occurrence_id }) =>
        entity_kind === "task" && occurrence_id !== null
      )
      .map((occurrence) => [occurrence.source_id, occurrence.occurrence_id!]));
    for (const event of projection.semantic.work_events) {
      const taskOccurrenceId = taskOccurrenceById.get(event.task_id);
      if (taskOccurrenceId === undefined) {
        lineageAvailable = false;
        causes.push(causeRecord(
          "topology_conflict",
          "lineage",
          checkpoint.commit_id,
        ));
        continue;
      }
      const frozen = frozenEvents.get(event.id);
      if (
        frozen !== undefined &&
        (
          frozen.task_occurrence_id !== taskOccurrenceId ||
          canonicalJson(frozen.event) !== canonicalJson(event)
        )
      ) {
        lineageAvailable = false;
        causes.push(causeRecord(
          "event_payload_changed",
          "lineage",
          checkpoint.commit_id,
        ));
        continue;
      }
      frozenEvents.set(event.id, {
        id: event.id,
        task_occurrence_id: taskOccurrenceId,
        first_observed_commit_id:
          frozen?.first_observed_commit_id ?? checkpoint.commit_id,
        last_observed_commit_id: checkpoint.commit_id,
        event,
      });
    }
    previousCheckpoint = checkpoint;
    previousProjection = projection;
  }

  let lineage: HistoricalLineageV1 | null = null;
  if (lineageAvailable) {
    const occurrences = [...states.values()].map(({ occurrence }) => occurrence);
    occurrences.sort((left, right) =>
      compareUnicodeScalars(left.occurrence_id!, right.occurrence_id!)
    );
    const topology = topologyClosedAndAcyclic(occurrences);
    if (topology !== "closed") {
      causes.push(causeRecord(
        topology,
        "lineage",
        evidence.resolvedEndpoint,
      ));
    } else if (occurrences.length > limits.renderedGraphOccurrences) {
      causes.push(causeRecord(
        "hard_limit",
        "limit",
        null,
        "renderedGraphOccurrences",
        occurrences.length,
      ));
    } else {
      lineage = deepFreeze({
        project_id: checkpoints[0]!.graph.project_id,
        endpoint_checkpoint_id: checkpoints.at(-1)!.commit_id,
        occurrences,
        current_occurrence_ids: sorted([...states]
          .filter(([, state]) => state.current)
          .map(([id]) => id)),
        retired_occurrence_ids: sorted([...states]
          .filter(([, state]) => !state.current)
          .map(([id]) => id)),
        frozen_work_events: [...frozenEvents.values()].sort((left, right) =>
          compareUnicodeScalars(left.id, right.id)
        ),
        canonical_advance_proofs: proofs,
      });
    }
  }

  const timeline = outputLimited
    ? null
    : deepFreeze({
        entries: timelineEntries,
        segments: timelineSegments,
      });
  const finalCauses = uniqueCauses(causes);
  const status: HistoricalLinearStatusV1 =
    evidence.status === "complete" &&
      finalCauses.length === 0 && selectedSnapshot !== null &&
      lineage !== null && timeline !== null
      ? "complete"
      : "incomplete";
  return deepFreeze({
    model: HISTORICAL_DAG_MODEL_ID,
    model_version: HISTORICAL_DAG_MODEL_VERSION,
    transition_model_version: HISTORICAL_TRANSITION_MODEL_VERSION,
    status,
    ancestry_profile: "first_parent",
    evidence_status: evidence.status,
    repository_id: evidence.repositoryId,
    repository_relative_path: evidence.repositoryRelativePath,
    repository_read_snapshot_id: evidence.repositoryReadSnapshotId,
    requested_endpoint: evidence.requestedEndpoint,
    resolved_endpoint: evidence.resolvedEndpoint,
    requested_lower_boundary: evidence.requestedLowerBoundary,
    resolved_lower_boundary: evidence.resolvedLowerBoundary,
    effective_checkpoint_id: effectiveCheckpointId,
    selected_snapshot_commit_id: selectedSnapshotCommitId,
    selected_snapshot: selectedSnapshot,
    checkpoints,
    lineage,
    timeline,
    causes: finalCauses,
    limits,
  });
}
