import { computeEffectiveReached } from "../analysis/graph.js";
import type { Diagnostic, SourceSpan } from "../model/diagnostics.js";
import { sha256DigestUtf8 } from "../model/sha256.js";
import type { DeclarationNode, TargetDeclarationKind } from "../model/syntax.js";
import {
  MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY,
  milestoneAcceptanceBaseText,
  parseMilestoneAcceptanceSource,
  type CriterionEvidenceKind,
  type MilestoneAcceptanceMigrationSourceV1,
  type MilestoneAcceptanceReceiptSourceV1,
  type MilestoneCriterionSetSourceV1,
} from "../milestone-acceptance/source.js";
import {
  checkDocument,
} from "./contract8-milestone-acceptance.js";

export const EDITOR_MILESTONE_ACCEPTANCE_MODEL_VERSION = 1 as const;

export interface EditorMilestoneAcceptanceDocumentPreparationV1 {
  readonly analysisText: string;
  readonly diagnostics: readonly Diagnostic[];
}

export interface EditorMilestoneAcceptanceSourceBindingV1 {
  readonly bindingId: string;
  readonly declarationKind:
    | "milestone"
    | "milestone_criterion_set"
    | "criterion"
    | "milestone_acceptance_receipt"
    | "milestone_acceptance_migration";
  readonly sourceId: string;
  readonly ownerMilestoneId: string | null;
  readonly ownerCriterionId: string | null;
  readonly span: SourceSpan;
}

export interface EditorMilestoneAcceptanceCriterionV1 {
  readonly criterionId: string;
  readonly description: string;
  readonly required: boolean;
  readonly evidenceKind: CriterionEvidenceKind;
  readonly commitment: `sha256:${string}`;
  readonly state: "pending" | "satisfied" | "failed" | "unavailable" | "waived";
  readonly effectiveReceiptId: string | null;
  readonly evidenceReference: string | null;
  readonly evidenceRevision: string | null;
  readonly verifier: string | null;
  readonly assertedAt: string | null;
  readonly waiverReason: string | null;
  readonly revokedReceiptIds: readonly string[];
  readonly criterionBindingId: string;
  readonly effectiveReceiptBindingId: string | null;
  readonly revokedReceiptBindingIds: readonly string[];
}

export interface EditorMilestoneAcceptanceMilestoneV1 {
  readonly milestoneId: string;
  readonly title: string;
  readonly closure: "unreached" | "reached";
  readonly acceptance:
    | "not_applicable"
    | "not_declared"
    | "pending"
    | "accepted"
    | "failed"
    | "unavailable";
  readonly grandfathered: boolean;
  readonly criterionSetId: string | null;
  readonly criterionRevisionId: string | null;
  readonly criterionSetCommitment: `sha256:${string}` | null;
  readonly criteria: readonly EditorMilestoneAcceptanceCriterionV1[];
  readonly blockingRequiredCriterionIds: readonly string[];
  readonly milestoneBindingId: string;
  readonly criterionSetBindingId: string | null;
}

export interface EditorMilestoneAcceptanceMigrationV1 {
  readonly migrationId: string;
  readonly repositoryId: string;
  readonly path: string;
  readonly objectFormat: "sha1" | "sha256";
  readonly head: string;
  readonly blob: string;
  readonly sourceDigest: `sha256:${string}`;
  readonly candidateDigest: `sha256:${string}`;
  readonly grandfatheredMilestoneIds: readonly string[];
  readonly sourceBindingId: string;
}

export interface EditorMilestoneAcceptanceProjectionV1 {
  readonly modelVersion: 1;
  readonly grammarVersion: number;
  readonly availability: "available" | "not_applicable";
  readonly milestones: readonly EditorMilestoneAcceptanceMilestoneV1[];
  readonly migration: EditorMilestoneAcceptanceMigrationV1 | null;
  readonly sourceBindings: readonly EditorMilestoneAcceptanceSourceBindingV1[];
}

export interface EditorMilestoneAcceptanceInspectionV1 {
  readonly status: "current" | "invalid" | "unavailable";
  readonly reason: string | null;
  readonly acceptance: EditorMilestoneAcceptanceProjectionV1 | null;
}

type TargetDeclaration = DeclarationNode<TargetDeclarationKind>;

function fieldValue<Value>(declaration: TargetDeclaration, name: string): Value | undefined {
  return declaration.fields.find((field) => field.name === name)?.value as Value | undefined;
}

function binding(
  bindingId: string,
  declarationKind: EditorMilestoneAcceptanceSourceBindingV1["declarationKind"],
  sourceId: string,
  ownerMilestoneId: string | null,
  ownerCriterionId: string | null,
  span: SourceSpan,
): EditorMilestoneAcceptanceSourceBindingV1 {
  return Object.freeze({
    bindingId,
    declarationKind,
    sourceId,
    ownerMilestoneId,
    ownerCriterionId,
    span,
  });
}

function milestoneBindingId(milestoneId: string): string {
  return `milestone:${milestoneId}`;
}

function setBindingId(setId: string): string {
  return `milestone_criterion_set:${setId}`;
}

function criterionBindingId(setId: string, criterionId: string): string {
  return `criterion:${setId}:${criterionId}`;
}

function receiptBindingId(receiptId: string): string {
  return `milestone_acceptance_receipt:${receiptId}`;
}

function migrationProjection(
  migration: MilestoneAcceptanceMigrationSourceV1 | undefined,
): EditorMilestoneAcceptanceMigrationV1 | null {
  if (migration === undefined) return null;
  return Object.freeze({
    migrationId: migration.id,
    repositoryId: migration.repositoryId,
    path: migration.path,
    objectFormat: migration.objectFormat,
    head: migration.head,
    blob: migration.blob,
    sourceDigest: migration.sourceDigest,
    candidateDigest: migration.candidateDigest,
    grandfatheredMilestoneIds: migration.grandfatheredMilestoneIds,
    sourceBindingId: `milestone_acceptance_migration:${migration.id}`,
  });
}

export function prepareEditorMilestoneAcceptanceDocument(
  text: string,
  maxDiagnostics?: number,
): EditorMilestoneAcceptanceDocumentPreparationV1 {
  const checked = checkDocument(text, {
    ...(maxDiagnostics === undefined ? {} : { maxDiagnostics }),
  });
  return Object.freeze({
    analysisText: milestoneAcceptanceBaseText(text),
    diagnostics: checked.diagnostics,
  });
}

export function inspectEditorMilestoneAcceptance(
  text: string,
  expectedDigest: string,
): EditorMilestoneAcceptanceInspectionV1 {
  if (sha256DigestUtf8(text) !== expectedDigest) {
    return Object.freeze({
      status: "unavailable",
      reason: "The milestone acceptance source digest does not match the synchronized document.",
      acceptance: null,
    });
  }
  const checked = checkDocument(text);
  if (!checked.ok || checked.grammarVersion === null) {
    return Object.freeze({
      status: "invalid",
      reason: "The synchronized document is invalid.",
      acceptance: null,
    });
  }
  if (checked.acceptance !== null && !checked.acceptance.ok) {
    return Object.freeze({
      status: "invalid",
      reason: "The milestone acceptance evaluation is invalid.",
      acceptance: null,
    });
  }

  const milestoneDeclarations = checked.document.declarations.filter(
    (declaration): declaration is TargetDeclaration => declaration.kind === "milestone",
  );
  const reached = computeEffectiveReached(checked.document as never);
  const parsed = parseMilestoneAcceptanceSource(
    text,
    MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY,
  );
  const sets = parsed.records.filter(
    (record): record is MilestoneCriterionSetSourceV1 =>
      record.kind === "milestone_criterion_set",
  );
  const receipts = parsed.records.filter(
    (record): record is MilestoneAcceptanceReceiptSourceV1 =>
      record.kind === "milestone_acceptance_receipt",
  );
  const migration = parsed.records.find(
    (record): record is MilestoneAcceptanceMigrationSourceV1 =>
      record.kind === "milestone_acceptance_migration",
  );
  const sourceBindings: EditorMilestoneAcceptanceSourceBindingV1[] = milestoneDeclarations
    .map((declaration) => binding(
      milestoneBindingId(declaration.id),
      "milestone",
      declaration.id,
      declaration.id,
      null,
      declaration.span,
    ));

  for (const set of sets) {
    sourceBindings.push(binding(
      setBindingId(set.id),
      "milestone_criterion_set",
      set.id,
      set.milestoneId,
      null,
      set.span,
    ));
    for (const criterion of set.criteria) {
      sourceBindings.push(binding(
        criterionBindingId(set.id, criterion.criterionId),
        "criterion",
        criterion.criterionId,
        set.milestoneId,
        criterion.criterionId,
        criterion.span,
      ));
    }
  }
  for (const receipt of receipts) {
    const set = sets.find(({ id }) => id === receipt.setId);
    sourceBindings.push(binding(
      receiptBindingId(receipt.id),
      "milestone_acceptance_receipt",
      receipt.id,
      set?.milestoneId ?? null,
      receipt.criterionId,
      receipt.span,
    ));
  }
  if (migration !== undefined) {
    sourceBindings.push(binding(
      `milestone_acceptance_migration:${migration.id}`,
      "milestone_acceptance_migration",
      migration.id,
      null,
      null,
      migration.span,
    ));
  }
  if (new Set(sourceBindings.map(({ bindingId }) => bindingId)).size !== sourceBindings.length) {
    throw new Error("milestone acceptance editor source binding identity is not unique");
  }

  const evaluatedById = new Map(
    checked.acceptance?.milestones.map((item) => [item.milestoneId, item]) ?? [],
  );
  const milestones = milestoneDeclarations.map((declaration): EditorMilestoneAcceptanceMilestoneV1 => {
    const evaluated = evaluatedById.get(declaration.id);
    if (evaluated === undefined) {
      return Object.freeze({
        milestoneId: declaration.id,
        title: fieldValue<string>(declaration, "title") ?? declaration.id,
        closure: reached.has(declaration.id) ? "reached" : "unreached",
        acceptance: "not_applicable",
        grandfathered: false,
        criterionSetId: null,
        criterionRevisionId: null,
        criterionSetCommitment: null,
        criteria: Object.freeze([]),
        blockingRequiredCriterionIds: Object.freeze([]),
        milestoneBindingId: milestoneBindingId(declaration.id),
        criterionSetBindingId: null,
      });
    }
    const set = evaluated.criterionSetId === null
      ? undefined
      : sets.find(({ id }) => id === evaluated.criterionSetId);
    const criteria = evaluated.criteria.map((criterion): EditorMilestoneAcceptanceCriterionV1 => {
      const sourceCriterion = set?.criteria.find(
        ({ criterionId: id }) => id === criterion.criterionId,
      );
      if (set === undefined || sourceCriterion === undefined) {
        throw new Error("milestone acceptance editor criterion source is unavailable");
      }
      return Object.freeze({
        ...criterion,
        description: sourceCriterion.description,
        criterionBindingId: criterionBindingId(set.id, criterion.criterionId),
        effectiveReceiptBindingId: criterion.effectiveReceiptId === null
          ? null
          : receiptBindingId(criterion.effectiveReceiptId),
        revokedReceiptBindingIds: Object.freeze(
          criterion.revokedReceiptIds.map(receiptBindingId),
        ),
      });
    });
    return Object.freeze({
      ...evaluated,
      title: fieldValue<string>(declaration, "title") ?? declaration.id,
      criteria: Object.freeze(criteria),
      milestoneBindingId: milestoneBindingId(declaration.id),
      criterionSetBindingId: set === undefined ? null : setBindingId(set.id),
    });
  });

  return Object.freeze({
    status: "current",
    reason: null,
    acceptance: Object.freeze({
      modelVersion: EDITOR_MILESTONE_ACCEPTANCE_MODEL_VERSION,
      grammarVersion: checked.grammarVersion,
      availability: checked.acceptance === null ? "not_applicable" : "available",
      milestones: Object.freeze(milestones),
      migration: migrationProjection(migration),
      sourceBindings: Object.freeze(sourceBindings),
    }),
  });
}
