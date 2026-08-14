import type { Diagnostic } from "../model/diagnostics.js";
import { sha256DigestUtf8 } from "../model/sha256.js";
import {
  applyTextEdits,
  normalizeTextEdits,
  type TextEdit,
} from "../mutation/text-edits.js";
import type {
  EffectivePlanDependencyV1,
  PlanAssuranceEvaluationV1,
  PlanAssuranceTaskResultV1,
} from "../assurance/types.js";

export const EDITOR_REPAIR_REGISTRY = Object.freeze({
  id: "perttool.editor-repair",
  version: 1,
} as const);

export const EDITOR_REPAIR_ID = "duration_unit_to_point" as const;
export const EDITOR_REPAIR_QUICK_FIX_TITLE =
  "Migrate duration unit to point" as const;
export const EDITOR_REPAIR_FIX_ALL_KIND =
  "source.fixAll.perttool" as const;

const MAX_SOURCE_BYTES = 8_388_608;
const MAX_CANDIDATE_BYTES = 8_388_608;
const MAX_EDITS = 10_000;
const MAX_REPLACEMENT_BYTES = 8_388_608;
const MAX_AFFECTED_IDENTITIES = 20_000;
const MAX_DIFF_BYTES = 1_048_576;

export type EditorRepairInteraction =
  | "quickfix"
  | typeof EDITOR_REPAIR_FIX_ALL_KIND;

export interface EditorRepairDocumentBindingV1 {
  readonly documentUri: string;
  readonly documentGeneration: string;
  readonly documentVersion: number;
  readonly sourceDigest: `sha256:${string}`;
}

export interface EditorRepairConvertedFieldV1 {
  readonly entityKind: "project" | "task" | "work_event";
  readonly entityId: string;
  readonly fieldPath: string;
  readonly canonicalToken: string;
}

export interface EditorRepairMigrationInputV1 {
  readonly ok: boolean;
  readonly changed: boolean;
  readonly sourceGrammarVersion: number | null;
  readonly targetGrammarVersion: number | null;
  readonly sourceUnit: string | null;
  readonly targetUnit: string;
  readonly velocityDisposition: string | null;
  readonly updatedDigest: string | null;
  readonly updatedText: string | null;
  readonly diff: string | null;
  readonly edits: readonly TextEdit[];
  readonly convertedFields: readonly EditorRepairConvertedFieldV1[];
  readonly diagnostics: readonly Diagnostic[];
  readonly diagnosticsTruncated: boolean;
}

export interface EditorRepairEvaluationInputV1 {
  readonly binding: EditorRepairDocumentBindingV1;
  readonly sourceText: string;
  readonly sourceOk: boolean;
  readonly sourceDiagnostics: readonly Diagnostic[];
  readonly sourceDiagnosticsTruncated: boolean;
  readonly migration: EditorRepairMigrationInputV1;
  readonly candidateOk: boolean;
  readonly candidateDiagnostics: readonly Diagnostic[];
  readonly candidateDiagnosticsTruncated: boolean;
  readonly sourceAssurance: PlanAssuranceEvaluationV1 | null;
  readonly candidateAssurance: PlanAssuranceEvaluationV1 | null;
  readonly sourceDeclarationIdentities: readonly string[];
  readonly candidateDeclarationIdentities: readonly string[];
  readonly protectedRecordKinds: readonly string[];
  readonly interaction: EditorRepairInteraction;
  readonly automatic: boolean;
  readonly matchingDiagnosticCount: number;
  readonly requestedRangeIntersectsDiagnostic: boolean;
}

export type EditorRepairDiagnosticCode =
  | "PTEDM-102"
  | "PTEDM-104"
  | "PTEDM-105"
  | "PTEDM-107"
  | "PTEDM-108"
  | "PTEDM-110";

export interface EditorRepairUnavailableCauseV1 {
  readonly diagnosticCode: EditorRepairDiagnosticCode;
  readonly reason: string;
}

export interface EditorRepairAffectedTaskV1 {
  readonly taskId: string;
  readonly pathTaskIds: readonly string[];
  readonly sourceContractHash: string;
  readonly candidateContractHash: string;
  readonly sourceComputedBasisHash: string;
  readonly candidateComputedBasisHash: string;
  readonly sourceStatus: "unsealed";
  readonly candidateStatus: "unsealed";
}

export interface EditorRepairCandidateV1 {
  readonly registry: typeof EDITOR_REPAIR_REGISTRY;
  readonly repairId: typeof EDITOR_REPAIR_ID;
  readonly binding: EditorRepairDocumentBindingV1;
  readonly interaction: EditorRepairInteraction;
  readonly automatic: boolean;
  readonly status: "applicable" | "unavailable";
  readonly complete: boolean;
  readonly strictClass: "E1" | null;
  readonly candidateSourceDigest: `sha256:${string}` | null;
  readonly convertedFields: readonly EditorRepairConvertedFieldV1[];
  readonly affectedTasks: readonly EditorRepairAffectedTaskV1[];
  readonly planningRelations: readonly EffectivePlanDependencyV1[];
  readonly governanceScopes: readonly [];
  readonly destructiveRecordRanges: readonly [];
  readonly forwardEdits: readonly TextEdit[];
  readonly inverseEdits: readonly TextEdit[];
  readonly unavailableCauses: readonly EditorRepairUnavailableCauseV1[];
}

function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

function cause(
  diagnosticCode: EditorRepairDiagnosticCode,
  reason: string,
): EditorRepairUnavailableCauseV1 {
  return Object.freeze({ diagnosticCode, reason });
}

function unavailable(
  input: EditorRepairEvaluationInputV1,
  causes: readonly EditorRepairUnavailableCauseV1[],
): EditorRepairCandidateV1 {
  return Object.freeze({
    registry: EDITOR_REPAIR_REGISTRY,
    repairId: EDITOR_REPAIR_ID,
    binding: input.binding,
    interaction: input.interaction,
    automatic: input.automatic,
    status: "unavailable",
    complete: false,
    strictClass: null,
    candidateSourceDigest: null,
    convertedFields: Object.freeze([]),
    affectedTasks: Object.freeze([]),
    planningRelations: Object.freeze([]),
    governanceScopes: Object.freeze([]) as readonly [],
    destructiveRecordRanges: Object.freeze([]) as readonly [],
    forwardEdits: Object.freeze([]),
    inverseEdits: Object.freeze([]),
    unavailableCauses: Object.freeze([...causes]),
  });
}

function relationIdentity(
  relation: EffectivePlanDependencyV1,
): string {
  return [
    relation.relationId ?? "",
    relation.predecessorTaskId,
    relation.successorTaskId,
    relation.mode,
    relation.explicit ? "explicit" : "derived",
  ].join("\u0000");
}

function exactUnsealedAssurance(
  evaluation: PlanAssuranceEvaluationV1 | null,
): evaluation is PlanAssuranceEvaluationV1 {
  return evaluation !== null &&
    evaluation.ok &&
    evaluation.modelVersion === 1 &&
    evaluation.hashModelVersion === 1 &&
    evaluation.coverage === "unsealed" &&
    evaluation.directMismatchTaskIds.length === 0 &&
    evaluation.inheritedMismatchTaskIds.length === 0 &&
    evaluation.replanRequiredTaskIds.length === 0 &&
    evaluation.unavailableTaskIds.length === 0 &&
    evaluation.taskResults.every((task) =>
      task.status === "unsealed" &&
      task.outcomeStatus === "unfinished" &&
      task.contractHash !== null &&
      task.computedBasisHash !== null &&
      task.acceptedBasisHash === null &&
      task.directCauses.length === 0 &&
      task.inheritedCauses.length === 0
    );
}

function taskById(
  tasks: readonly PlanAssuranceTaskResultV1[],
): ReadonlyMap<string, PlanAssuranceTaskResultV1> {
  return new Map(tasks.map((task) => [task.taskId, task]));
}

function inverseEdits(
  sourceText: string,
  candidateText: string,
  forward: readonly TextEdit[],
): readonly TextEdit[] {
  let delta = 0;
  const values = forward.map((edit): TextEdit => {
    const startOffset = edit.startOffset + delta;
    const endOffset = startOffset + edit.replacement.length;
    const replacement = sourceText.slice(edit.startOffset, edit.endOffset);
    delta += edit.replacement.length - (edit.endOffset - edit.startOffset);
    return Object.freeze({ startOffset, endOffset, replacement });
  });
  return Object.freeze([
    ...normalizeTextEdits(candidateText, values, "editor repair inverse"),
  ]);
}

function sameOrderedStrings(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return left.length === right.length &&
    left.every((value, index) => value === right[index]);
}

export function evaluateEditorRepairCandidate(
  input: EditorRepairEvaluationInputV1,
): EditorRepairCandidateV1 {
  const causes: EditorRepairUnavailableCauseV1[] = [];
  const migration = input.migration;
  if (sha256DigestUtf8(input.sourceText) !== input.binding.sourceDigest) {
    causes.push(cause(
      "PTEDM-104",
      "the repair request does not match the bound source digest",
    ));
  }
  if (
    input.automatic && input.interaction !== EDITOR_REPAIR_FIX_ALL_KIND ||
    !input.automatic && input.interaction === "quickfix" &&
      !input.requestedRangeIntersectsDiagnostic
  ) {
    causes.push(cause(
      "PTEDM-107",
      "the requested repair interaction is not eligible",
    ));
  }
  if (input.matchingDiagnosticCount < 1) {
    causes.push(cause(
      "PTEDM-107",
      "the request does not carry a current matching PTSEM-114 diagnostic",
    ));
  }
  if (
    !input.sourceOk ||
    input.sourceDiagnosticsTruncated ||
    !migration.ok ||
    !migration.changed ||
    migration.updatedText === null ||
    migration.updatedDigest === null ||
    migration.diff === null ||
    migration.diagnosticsTruncated ||
    !input.candidateOk ||
    input.candidateDiagnosticsTruncated
  ) {
    causes.push(cause(
      "PTEDM-110",
      "the complete source or final repair candidate is invalid or incomplete",
    ));
  }
  const sourceDiagnosticCount = input.sourceDiagnostics.filter(
    ({ code }) => code === "PTSEM-114",
  ).length;
  const candidateDiagnosticCount = input.candidateDiagnostics.filter(
    ({ code }) => code === "PTSEM-114",
  ).length;
  if (sourceDiagnosticCount !== 1 || candidateDiagnosticCount !== 0) {
    causes.push(cause(
      "PTEDM-110",
      "the repair must remove exactly one actionable PTSEM-114 diagnostic",
    ));
  }
  if (
    (migration.sourceGrammarVersion !== 6 &&
      migration.sourceGrammarVersion !== 7) ||
    migration.targetGrammarVersion !== migration.sourceGrammarVersion ||
    (migration.sourceUnit !== "day" && migration.sourceUnit !== "hour") ||
    migration.targetUnit !== "point" ||
    migration.velocityDisposition !== "retained"
  ) {
    causes.push(cause(
      "PTEDM-102",
      "the migration is outside the registered Grammar, unit, or velocity boundary",
    ));
  }
  if (
    input.protectedRecordKinds.length > 0 ||
    migration.convertedFields.some(({ entityKind }) => entityKind === "work_event")
  ) {
    causes.push(cause(
      "PTEDM-102",
      "protected evidence or work-event state makes the candidate stricter than E1",
    ));
  }
  if (!sameOrderedStrings(
    input.sourceDeclarationIdentities,
    input.candidateDeclarationIdentities,
  )) {
    causes.push(cause(
      "PTEDM-102",
      "the candidate changed the declaration identity set or order",
    ));
  }
  if (
    !exactUnsealedAssurance(input.sourceAssurance) ||
    !exactUnsealedAssurance(input.candidateAssurance)
  ) {
    causes.push(cause(
      "PTEDM-102",
      "complete before-and-after unsealed assurance was not proved",
    ));
  }

  const candidateText = migration.updatedText;
  let forward: readonly TextEdit[] = Object.freeze([]);
  let inverse: readonly TextEdit[] = Object.freeze([]);
  if (candidateText !== null) {
    try {
      forward = Object.freeze([
        ...normalizeTextEdits(input.sourceText, migration.edits, "editor repair"),
      ]);
      if (
        forward.length !== migration.edits.length ||
        applyTextEdits(input.sourceText, forward) !== candidateText ||
        sha256DigestUtf8(candidateText) !== migration.updatedDigest
      ) throw new Error("forward proof mismatch");
      inverse = inverseEdits(input.sourceText, candidateText, forward);
      if (applyTextEdits(candidateText, inverse) !== input.sourceText) {
        throw new Error("inverse proof mismatch");
      }
    } catch {
      causes.push(cause(
        "PTEDM-105",
        "normalized forward or inverse recovery evidence does not match",
      ));
    }
  }

  const sourceAssurance = input.sourceAssurance;
  const candidateAssurance = input.candidateAssurance;
  let affectedTasks: readonly EditorRepairAffectedTaskV1[] = Object.freeze([]);
  let relations: readonly EffectivePlanDependencyV1[] = Object.freeze([]);
  if (
    exactUnsealedAssurance(sourceAssurance) &&
    exactUnsealedAssurance(candidateAssurance)
  ) {
    const sourceIds = sourceAssurance.taskResults.map(({ taskId }) => taskId);
    const candidateIds = candidateAssurance.taskResults.map(({ taskId }) => taskId);
    const sourceRelations = sourceAssurance.effectiveDependencies.map(relationIdentity);
    const candidateRelations = candidateAssurance.effectiveDependencies.map(relationIdentity);
    if (
      !sameOrderedStrings(sourceIds, candidateIds) ||
      !sameOrderedStrings(sourceRelations, candidateRelations)
    ) {
      causes.push(cause(
        "PTEDM-102",
        "the complete task or planning-relation closure changed",
      ));
    } else {
      const candidateTasks = taskById(candidateAssurance.taskResults);
      affectedTasks = Object.freeze(sourceAssurance.taskResults.map((sourceTask) => {
        const candidateTask = candidateTasks.get(sourceTask.taskId)!;
        return Object.freeze({
          taskId: sourceTask.taskId,
          pathTaskIds: Object.freeze([sourceTask.taskId]),
          sourceContractHash: sourceTask.contractHash!,
          candidateContractHash: candidateTask.contractHash!,
          sourceComputedBasisHash: sourceTask.computedBasisHash!,
          candidateComputedBasisHash: candidateTask.computedBasisHash!,
          sourceStatus: "unsealed" as const,
          candidateStatus: "unsealed" as const,
        });
      }));
      relations = Object.freeze([...sourceAssurance.effectiveDependencies]);
    }
  }

  if (candidateText !== null && migration.diff !== null) {
    const forwardReplacementBytes = forward.reduce(
      (total, edit) => total + utf8Bytes(edit.replacement),
      0,
    );
    const inverseReplacementBytes = inverse.reduce(
      (total, edit) => total + utf8Bytes(edit.replacement),
      0,
    );
    const affectedIdentities = migration.convertedFields.length +
      affectedTasks.length + relations.length;
    if (
      utf8Bytes(input.sourceText) > MAX_SOURCE_BYTES ||
      utf8Bytes(candidateText) > MAX_CANDIDATE_BYTES ||
      forward.length > MAX_EDITS ||
      inverse.length > MAX_EDITS ||
      forwardReplacementBytes > MAX_REPLACEMENT_BYTES ||
      inverseReplacementBytes > MAX_REPLACEMENT_BYTES ||
      affectedIdentities > MAX_AFFECTED_IDENTITIES ||
      utf8Bytes(migration.diff) > MAX_DIFF_BYTES
    ) {
      causes.push(cause(
        "PTEDM-108",
        "the repair exceeds an editor-mutation hard limit",
      ));
    }
  }

  if (causes.length > 0 || candidateText === null) {
    return unavailable(input, causes);
  }
  return Object.freeze({
    registry: EDITOR_REPAIR_REGISTRY,
    repairId: EDITOR_REPAIR_ID,
    binding: input.binding,
    interaction: input.interaction,
    automatic: input.automatic,
    status: "applicable",
    complete: true,
    strictClass: "E1",
    candidateSourceDigest: migration.updatedDigest as `sha256:${string}`,
    convertedFields: Object.freeze([...migration.convertedFields]),
    affectedTasks,
    planningRelations: relations,
    governanceScopes: Object.freeze([]) as readonly [],
    destructiveRecordRanges: Object.freeze([]) as readonly [],
    forwardEdits: forward,
    inverseEdits: inverse,
    unavailableCauses: Object.freeze([]),
  });
}
