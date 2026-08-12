import { computeEffectiveReached } from "../analysis/graph.js";
import { sha256Digest } from "../model/sha256.js";
import { TARGET_GRAMMAR_6_CAPABILITY } from "../parser/document-parser.js";
import { validateTargetGrammar6Document } from "../semantic/target-validator.js";
import {
  evaluateMilestoneAcceptance,
  type MilestoneAcceptanceModelResultV1,
} from "../milestone-acceptance/evaluate.js";
import { planMilestoneAcceptanceAdvance } from "../milestone-acceptance/advance.js";
import { planTargetPlanAssuranceAdvance } from "../assurance/advance.js";
import {
  MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY,
  milestoneAcceptanceBaseText,
  parseMilestoneAcceptanceSource,
  type MilestoneAcceptanceSourceRecordV1,
} from "../milestone-acceptance/source.js";
import type {
  HistoricalGitEvidenceResult,
  HistoricalGitInspectionSnapshot,
} from "./git-probe.js";

export const HISTORICAL_MILESTONE_ACCEPTANCE_MODEL =
  "Perttool.HistoricalMilestoneAcceptanceModel.v1" as const;
export const HISTORICAL_MILESTONE_ACCEPTANCE_MODEL_VERSION = 1 as const;
export const HISTORICAL_MILESTONE_ACCEPTANCE_ADVANCE_PLANNER =
  "perttool.milestone-acceptance-advance.v1" as const;

export const HISTORICAL_MILESTONE_ACCEPTANCE_LIMITS = Object.freeze({
  checkpoints: 2_048,
  records: 100_000,
});

export type HistoricalMilestoneAcceptanceCheckpointStatusV1 =
  | "not_applicable"
  | "available"
  | "unavailable";

export type HistoricalMilestoneAcceptanceCauseV1 =
  | "evidence_binding_invalid"
  | "source_missing"
  | "source_invalid"
  | "grammar_unsupported"
  | "migration_missing"
  | "migration_baseline_unavailable"
  | "migration_provenance_mismatch"
  | "contract_regression"
  | "acceptance_bypassed"
  | "hard_limit";

export interface HistoricalMilestoneAcceptanceCauseRecordV1 {
  readonly cause: HistoricalMilestoneAcceptanceCauseV1;
  readonly commit_id: string | null;
  readonly record_id: string | null;
  readonly limit: "checkpoints" | "records" | null;
  readonly actual: number | null;
}

export interface HistoricalMilestoneAcceptanceRecordV1 {
  readonly kind: MilestoneAcceptanceSourceRecordV1["kind"];
  readonly id: string;
  readonly owner_id: string;
  readonly revision_id: string | null;
  readonly action: string | null;
  readonly commitment: string | null;
  readonly source_range: MilestoneAcceptanceSourceRecordV1["span"];
}

export interface HistoricalMilestoneAcceptanceCheckpointV1 {
  readonly commit_id: string;
  readonly blob_id: string | null;
  readonly source_digest: string | null;
  readonly grammar_version: number | null;
  readonly status: HistoricalMilestoneAcceptanceCheckpointStatusV1;
  readonly evaluation: MilestoneAcceptanceModelResultV1 | null;
  readonly records: readonly HistoricalMilestoneAcceptanceRecordV1[];
  readonly diagnostic_codes: readonly string[];
}

export interface HistoricalMilestoneAcceptanceAdvanceProofV1 {
  readonly from_commit_id: string;
  readonly to_commit_id: string;
  readonly planner_version:
    typeof HISTORICAL_MILESTONE_ACCEPTANCE_ADVANCE_PLANNER;
  readonly candidate_digest: string;
  readonly affected_milestone_ids: readonly string[];
  readonly grandfathered_milestone_ids: readonly string[];
  readonly accepted_milestone_ids: readonly string[];
  readonly removed_record_ids: readonly string[];
}

export interface HistoricalMilestoneAcceptanceHistoryV1 {
  readonly model: typeof HISTORICAL_MILESTONE_ACCEPTANCE_MODEL;
  readonly model_version:
    typeof HISTORICAL_MILESTONE_ACCEPTANCE_MODEL_VERSION;
  readonly status: "complete" | "incomplete" | "unavailable";
  readonly checkpoints:
    readonly HistoricalMilestoneAcceptanceCheckpointV1[];
  readonly canonical_advance_proofs:
    readonly HistoricalMilestoneAcceptanceAdvanceProofV1[];
  readonly causes: readonly HistoricalMilestoneAcceptanceCauseRecordV1[];
  readonly limits: typeof HISTORICAL_MILESTONE_ACCEPTANCE_LIMITS;
}

interface DecodedCheckpoint {
  readonly snapshot: HistoricalGitInspectionSnapshot;
  readonly text: string | null;
  readonly checkpoint: HistoricalMilestoneAcceptanceCheckpointV1;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value;
}

function cause(
  value: HistoricalMilestoneAcceptanceCauseV1,
  commitId: string | null,
  recordId: string | null = null,
  limit: HistoricalMilestoneAcceptanceCauseRecordV1["limit"] = null,
  actual: number | null = null,
): HistoricalMilestoneAcceptanceCauseRecordV1 {
  return { cause: value, commit_id: commitId, record_id: recordId, limit, actual };
}

function recordProjection(
  record: MilestoneAcceptanceSourceRecordV1,
): HistoricalMilestoneAcceptanceRecordV1 {
  if (record.kind === "milestone_criterion_set") {
    return {
      kind: record.kind,
      id: record.id,
      owner_id: record.milestoneId,
      revision_id: record.revisionId,
      action: null,
      commitment: record.commitment,
      source_range: record.span,
    };
  }
  if (record.kind === "milestone_acceptance_receipt") {
    return {
      kind: record.kind,
      id: record.id,
      owner_id: record.setId,
      revision_id: record.criterionId,
      action: record.action,
      commitment: record.criterionCommitment,
      source_range: record.span,
    };
  }
  return {
    kind: record.kind,
    id: record.id,
    owner_id: record.path,
    revision_id: record.head,
    action: null,
    commitment: record.candidateDigest,
    source_range: record.span,
  };
}

function decode(snapshot: HistoricalGitInspectionSnapshot): string | null {
  if (
    snapshot.source === null || snapshot.sourceDigest === null ||
    sha256Digest(snapshot.source) !== snapshot.sourceDigest
  ) return null;
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      snapshot.source,
    );
  } catch {
    return null;
  }
}

function evaluateCheckpoint(
  snapshot: HistoricalGitInspectionSnapshot,
): DecodedCheckpoint {
  const text = decode(snapshot);
  if (text === null) {
    return {
      snapshot,
      text: null,
      checkpoint: {
        commit_id: snapshot.commitId,
        blob_id: snapshot.blobId,
        source_digest: snapshot.sourceDigest,
        grammar_version: null,
        status: "unavailable",
        evaluation: null,
        records: [],
        diagnostic_codes: [],
      },
    };
  }
  const source = parseMilestoneAcceptanceSource(
    text,
    MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY,
  );
  const grammarVersion = source.grammarVersion;
  if (grammarVersion === null || grammarVersion < 1 || grammarVersion > 7) {
    return {
      snapshot,
      text,
      checkpoint: {
        commit_id: snapshot.commitId,
        blob_id: snapshot.blobId,
        source_digest: snapshot.sourceDigest,
        grammar_version: grammarVersion,
        status: "unavailable",
        evaluation: null,
        records: [],
        diagnostic_codes: [],
      },
    };
  }
  if (grammarVersion < 7) {
    const checked = validateTargetGrammar6Document(
      text,
      TARGET_GRAMMAR_6_CAPABILITY,
    );
    return {
      snapshot,
      text,
      checkpoint: {
        commit_id: snapshot.commitId,
        blob_id: snapshot.blobId,
        source_digest: snapshot.sourceDigest,
        grammar_version: grammarVersion,
        status: checked.ok ? "not_applicable" : "unavailable",
        evaluation: null,
        records: [],
        diagnostic_codes: checked.diagnostics.map(({ code }) => code),
      },
    };
  }
  const checked = validateTargetGrammar6Document(
    milestoneAcceptanceBaseText(text),
    TARGET_GRAMMAR_6_CAPABILITY,
  );
  const diagnostics = [
    ...checked.diagnostics.map(({ code }) => code),
    ...source.diagnostics.map(({ code }) => code),
  ];
  if (!source.ok || !checked.ok || checked.validatedDocument === null) {
    return {
      snapshot,
      text,
      checkpoint: {
        commit_id: snapshot.commitId,
        blob_id: snapshot.blobId,
        source_digest: snapshot.sourceDigest,
        grammar_version: grammarVersion,
        status: "unavailable",
        evaluation: null,
        records: source.records.map(recordProjection),
        diagnostic_codes: diagnostics,
      },
    };
  }
  const milestoneIds = checked.document.declarations
    .filter(({ kind }) => kind === "milestone")
    .map(({ id }) => id);
  const evaluation = evaluateMilestoneAcceptance({
    source,
    milestoneIds,
    closureReachedMilestoneIds: computeEffectiveReached(checked.document as never),
  });
  return {
    snapshot,
    text,
    checkpoint: {
      commit_id: snapshot.commitId,
      blob_id: snapshot.blobId,
      source_digest: snapshot.sourceDigest,
      grammar_version: grammarVersion,
      status: evaluation.ok ? "available" : "unavailable",
      evaluation,
      records: source.records.map(recordProjection),
      diagnostic_codes: diagnostics,
    },
  };
}

function evidenceBindingValid(evidence: HistoricalGitEvidenceResult): boolean {
  if (evidence.status === "unavailable") return false;
  return evidence.repositoryId !== null && evidence.repositoryRelativePath !== null &&
    evidence.objectFormat !== null && evidence.snapshots.length === evidence.inspectedCommitIds.length &&
    evidence.snapshots.every((snapshot, index) =>
      snapshot.commitId === evidence.inspectedCommitIds[index] &&
      snapshot.repositoryId === evidence.repositoryId &&
      snapshot.repositoryRelativePath === evidence.repositoryRelativePath &&
      snapshot.objectFormat === evidence.objectFormat
    );
}

function migrationCauses(
  evidence: HistoricalGitEvidenceResult,
  decoded: readonly DecodedCheckpoint[],
  proofs: readonly HistoricalMilestoneAcceptanceAdvanceProofV1[],
): HistoricalMilestoneAcceptanceCauseRecordV1[] {
  const causes: HistoricalMilestoneAcceptanceCauseRecordV1[] = [];
  const byCommit = new Map(decoded.map((value) => [value.snapshot.commitId, value]));
  const proofByTransition = new Map(proofs.map((proof) => [
    `${proof.from_commit_id}\0${proof.to_commit_id}`,
    proof,
  ]));
  let sawGrammar7 = false;
  let baselineEstablished = false;
  let baselineRetired = false;
  let activeMigrationId: string | null = null;
  for (let index = 0; index < decoded.length; index += 1) {
    const value = decoded[index]!;
    const checkpoint = value.checkpoint;
    if (checkpoint.grammar_version !== 7 || value.text === null) {
      if (sawGrammar7 && checkpoint.grammar_version !== null && checkpoint.grammar_version < 7) {
        causes.push(cause("contract_regression", checkpoint.commit_id));
      }
      continue;
    }
    sawGrammar7 = true;
    const parsed = parseMilestoneAcceptanceSource(
      value.text,
      MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY,
    );
    const migrations = parsed.records.filter((record) =>
      record.kind === "milestone_acceptance_migration"
    );
    if (migrations.length === 0) {
      const previous = decoded[index - 1];
      const proof = previous === undefined
        ? undefined
        : proofByTransition.get(
            `${previous.snapshot.commitId}\0${value.snapshot.commitId}`,
          );
      if (
        baselineEstablished && !baselineRetired &&
        activeMigrationId !== null &&
        proof?.removed_record_ids.includes(activeMigrationId)
      ) {
        baselineRetired = true;
        activeMigrationId = null;
        continue;
      }
      if (baselineRetired) continue;
      causes.push(cause("migration_missing", checkpoint.commit_id));
      continue;
    }
    if (migrations.length !== 1 || baselineRetired) {
      causes.push(cause(
        "migration_provenance_mismatch",
        checkpoint.commit_id,
        migrations[0]?.id ?? null,
      ));
      continue;
    }
    const migration = migrations[0]!;
    const baseline = byCommit.get(migration.head);
    if (baseline === undefined) {
      causes.push(cause(
        "migration_baseline_unavailable",
        checkpoint.commit_id,
        migration.id,
      ));
      continue;
    }
    if (
      evidence.repositoryId !== migration.repositoryId ||
      evidence.repositoryRelativePath !== migration.path ||
      evidence.objectFormat !== migration.objectFormat ||
      baseline.snapshot.blobId !== migration.blob ||
      baseline.snapshot.sourceDigest !== migration.sourceDigest
    ) {
      causes.push(cause(
        "migration_provenance_mismatch",
        checkpoint.commit_id,
        migration.id,
      ));
      continue;
    }
    baselineEstablished = true;
    activeMigrationId = migration.id;
  }
  return causes;
}

function uniqueCauses(
  values: readonly HistoricalMilestoneAcceptanceCauseRecordV1[],
): readonly HistoricalMilestoneAcceptanceCauseRecordV1[] {
  const result = new Map<string, HistoricalMilestoneAcceptanceCauseRecordV1>();
  for (const value of values) {
    const key = JSON.stringify(value);
    if (!result.has(key)) result.set(key, value);
  }
  return [...result.values()];
}

export function reconstructHistoricalMilestoneAcceptance(
  evidence: HistoricalGitEvidenceResult,
): HistoricalMilestoneAcceptanceHistoryV1 {
  if (!evidenceBindingValid(evidence)) {
    return deepFreeze({
      model: HISTORICAL_MILESTONE_ACCEPTANCE_MODEL,
      model_version: HISTORICAL_MILESTONE_ACCEPTANCE_MODEL_VERSION,
      status: "unavailable",
      checkpoints: [],
      canonical_advance_proofs: [],
      causes: [cause("evidence_binding_invalid", null)],
      limits: HISTORICAL_MILESTONE_ACCEPTANCE_LIMITS,
    });
  }
  const decoded = evidence.snapshots.map(evaluateCheckpoint);
  const causes: HistoricalMilestoneAcceptanceCauseRecordV1[] = [];
  if (decoded.length > HISTORICAL_MILESTONE_ACCEPTANCE_LIMITS.checkpoints) {
    causes.push(cause(
      "hard_limit",
      null,
      null,
      "checkpoints",
      decoded.length,
    ));
  }
  const recordCount = decoded.reduce(
    (sum, value) => sum + value.checkpoint.records.length,
    0,
  );
  if (recordCount > HISTORICAL_MILESTONE_ACCEPTANCE_LIMITS.records) {
    causes.push(cause("hard_limit", null, null, "records", recordCount));
  }
  for (const value of decoded) {
    if (value.text === null) {
      causes.push(cause("source_missing", value.snapshot.commitId));
    } else if (value.checkpoint.grammar_version === null) {
      causes.push(cause("source_invalid", value.snapshot.commitId));
    } else if (value.checkpoint.grammar_version > 7) {
      causes.push(cause("grammar_unsupported", value.snapshot.commitId));
    } else if (value.checkpoint.status === "unavailable") {
      causes.push(cause("source_invalid", value.snapshot.commitId));
    }
  }
  const proofs: HistoricalMilestoneAcceptanceAdvanceProofV1[] = [];
  for (let index = 1; index < decoded.length; index += 1) {
    const before = decoded[index - 1]!;
    const after = decoded[index]!;
    if (
      before.text === null || after.text === null ||
      before.checkpoint.status !== "available"
    ) continue;
    const planned = planMilestoneAcceptanceAdvance(before.text, {
      provisionalPlanner: (baseText) => planTargetPlanAssuranceAdvance(
        baseText,
        TARGET_GRAMMAR_6_CAPABILITY,
        { governance: { intent: "preview" } },
      ),
    });
    if (
      planned.provisional?.updatedText === after.text &&
      planned.acceptanceGuard?.status === "blocked"
    ) {
      causes.push(cause("acceptance_bypassed", after.snapshot.commitId));
      continue;
    }
    if (
      !planned.ok || !planned.persistable || planned.canonical === null ||
      planned.acceptanceGuard === null ||
      planned.canonical.updatedText !== after.text ||
      planned.canonical.updatedDigest === null
    ) continue;
    const afterRecordIds = new Set(after.checkpoint.records.map(({ id }) => id));
    proofs.push({
      from_commit_id: before.snapshot.commitId,
      to_commit_id: after.snapshot.commitId,
      planner_version: HISTORICAL_MILESTONE_ACCEPTANCE_ADVANCE_PLANNER,
      candidate_digest: planned.canonical.updatedDigest,
      affected_milestone_ids: planned.acceptanceGuard.affectedMilestoneIds,
      grandfathered_milestone_ids:
        planned.acceptanceGuard.grandfatheredMilestoneIds,
      accepted_milestone_ids: planned.acceptanceGuard.acceptedMilestoneIds,
      removed_record_ids: before.checkpoint.records
        .filter(({ id }) => !afterRecordIds.has(id))
        .map(({ id }) => id),
    });
  }
  causes.push(...migrationCauses(evidence, decoded, proofs));
  const finalCauses = uniqueCauses(causes);
  return deepFreeze({
    model: HISTORICAL_MILESTONE_ACCEPTANCE_MODEL,
    model_version: HISTORICAL_MILESTONE_ACCEPTANCE_MODEL_VERSION,
    status: finalCauses.length === 0 ? "complete" : "incomplete",
    checkpoints: decoded.map(({ checkpoint }) => checkpoint),
    canonical_advance_proofs: proofs,
    causes: finalCauses,
    limits: HISTORICAL_MILESTONE_ACCEPTANCE_LIMITS,
  });
}
