import { sha256DigestUtf8 } from "../model/sha256.js";
import {
  inspectProjectHistoryWithValidator,
  type HistoryRequest,
  type ProjectHistoryCoreResultFor,
  type ProjectHistorySourceValidation,
} from "../history/project-history.js";
import type { GitHistoryProbeResult } from "../history/git-probe.js";
import type { Diagnostic, SourceSpan } from "../model/diagnostics.js";
import type {
  DeclarationNode,
  DocumentNode,
  TargetDeclarationKind,
  VelocityValue,
} from "../model/syntax.js";
import { fieldNamed } from "../model/syntax.js";
import {
  governanceMetadataFromDocument,
  type DeclaredGovernance,
  type EffectiveGovernance,
} from "../governance/source.js";
import type { TargetCalendarValue } from "../model/target-calendar.js";
import { projectDeclaredCalendarValue } from "../model/target-calendar.js";
import type { TargetGrammar6Capability } from "../parser/document-parser.js";
import {
  validateTargetGrammar6Document,
  type TargetGrammar6ValidatedDocument,
  type TargetValidationOptions,
} from "../semantic/target-validator.js";
import { projectPlanAssuranceInput } from "./source.js";

export const PLAN_ASSURANCE_COMPATIBILITY_MODEL_VERSION = 1 as const;

export const PLAN_ASSURANCE_DIRECT_EDIT_GUIDANCE = Object.freeze({
  modelVersion: 1 as const,
  summary:
    "Direct edits can invalidate a task plan, planning relation, accepted seal, outcome, or frontier receipt.",
  actions: Object.freeze([
    "Inspect semantic task fields and affected planning descendants before editing hashes.",
    "Use the read-only hash projection only as supplemental identity evidence.",
    "Replan the affected tasks, then use the governed reseal mutation against one fresh candidate.",
  ]),
  boundaries: Object.freeze([
    "Hash inspection does not add, replace, or repair a plan_seal or assurance_receipt.",
    "Hash inspection does not accept a plan or authorize reseal or persistence.",
    "A matching digest is not a digital signature or proof that the plan is correct.",
  ]),
});

export type AssuranceOwnedSourceKind =
  | "project.plan_assurance_model"
  | "project.plan_assurance_hash_model"
  | "task_relation"
  | "plan_seal"
  | "task_outcome"
  | "assurance_receipt";

export interface AssuranceOwnedSourceRecordV1 {
  readonly kind: AssuranceOwnedSourceKind;
  readonly id: string;
  readonly sourceText: string;
  readonly span: SourceSpan;
}

export interface AssuranceOwnedSourceSnapshotV1 {
  readonly modelVersion: typeof PLAN_ASSURANCE_COMPATIBILITY_MODEL_VERSION;
  readonly records: readonly AssuranceOwnedSourceRecordV1[];
}

const assuranceDeclarationKinds = new Set<TargetDeclarationKind>([
  "task_relation",
  "plan_seal",
  "task_outcome",
  "assurance_receipt",
]);

function sourceAt(text: string, span: SourceSpan): string {
  return text.slice(span.start.offset, span.end.offset);
}

export function captureAssuranceOwnedSource(
  text: string,
  validated: TargetGrammar6ValidatedDocument,
): AssuranceOwnedSourceSnapshotV1 {
  const records: AssuranceOwnedSourceRecordV1[] = [];
  const project = validated.document.declarations.find(
    ({ kind }) => kind === "project",
  );
  if (project !== undefined) {
    for (const [fieldName, kind] of [
      ["plan_assurance_model", "project.plan_assurance_model"],
      ["plan_assurance_hash_model", "project.plan_assurance_hash_model"],
    ] as const) {
      const field = fieldNamed(project, fieldName);
      if (field !== undefined) {
        records.push(Object.freeze({
          kind,
          id: project.id,
          sourceText: sourceAt(text, field.span),
          span: field.span,
        }));
      }
    }
  }
  for (const declaration of validated.document.declarations) {
    if (!assuranceDeclarationKinds.has(declaration.kind)) continue;
    records.push(Object.freeze({
      kind: declaration.kind as Exclude<
        AssuranceOwnedSourceKind,
        "project.plan_assurance_model" | "project.plan_assurance_hash_model"
      >,
      id: declaration.id,
      sourceText: sourceAt(text, declaration.span),
      span: declaration.span,
    }));
  }
  return Object.freeze({
    modelVersion: PLAN_ASSURANCE_COMPATIBILITY_MODEL_VERSION,
    records: Object.freeze(records),
  });
}

function protectedRecordIdentity(
  record: AssuranceOwnedSourceRecordV1,
): string {
  return `${record.kind}\u0000${record.id}`;
}

export function assuranceOwnedSourceEqual(
  before: AssuranceOwnedSourceSnapshotV1,
  after: AssuranceOwnedSourceSnapshotV1,
): boolean {
  const compact = (snapshot: AssuranceOwnedSourceSnapshotV1) =>
    snapshot.records.map((record) => [
      protectedRecordIdentity(record),
      record.sourceText,
    ]);
  return JSON.stringify(compact(before)) === JSON.stringify(compact(after));
}

export function planAssuranceSemanticDigest(
  validated: TargetGrammar6ValidatedDocument,
): string {
  const bytes = JSON.stringify(projectPlanAssuranceInput(validated));
  return sha256DigestUtf8(bytes);
}

export interface PlanAssuranceProjectMetadataV1 {
  readonly id: string;
  readonly grammarVersion: 6;
  readonly title: string;
  readonly description: string | null;
  readonly asOf: TargetCalendarValue | null;
  readonly durationUnit: "day" | "hour" | "point";
  readonly velocity: string | null;
  readonly finish: string;
  readonly governance: {
    readonly sourceContractVersion: 1;
    readonly declared: DeclaredGovernance;
    readonly effective: EffectiveGovernance;
  };
  readonly assurance: {
    readonly enabled: boolean;
    readonly modelVersion: number | null;
    readonly hashModelVersion: number | null;
  };
}

export interface PlanAssuranceProjectMetadataResultV1 {
  readonly ok: boolean;
  readonly documentId: string | null;
  readonly grammarVersion: 6 | null;
  readonly project: PlanAssuranceProjectMetadataV1 | null;
  readonly diagnostics: readonly Diagnostic[];
  readonly diagnosticsTruncated: boolean;
}

function stringValue(
  declaration: DeclarationNode<TargetDeclarationKind>,
  name: string,
): string | null {
  const value = fieldNamed(declaration, name)?.value;
  return typeof value === "string" ? value : null;
}

export function getPlanAssuranceProjectMetadata(
  text: string,
  capability: TargetGrammar6Capability,
  options: TargetValidationOptions = {},
): PlanAssuranceProjectMetadataResultV1 {
  const checked = validateTargetGrammar6Document(text, capability, options);
  const validated = checked.validatedDocument;
  const project = validated?.document.declarations.find(
    ({ kind }) => kind === "project",
  );
  if (
    !checked.ok ||
    validated === null ||
    validated.grammarVersion !== 6 ||
    project === undefined
  ) {
    return Object.freeze({
      ok: false,
      documentId: checked.documentId,
      grammarVersion: null,
      project: null,
      diagnostics: checked.diagnostics,
      diagnosticsTruncated: checked.diagnosticsTruncated,
    });
  }
  const title = stringValue(project, "title");
  const durationUnit = fieldNamed(project, "duration_unit")?.value;
  const finish = stringValue(project, "finish");
  if (
    title === null ||
    finish === null ||
    (durationUnit !== "day" &&
      durationUnit !== "hour" &&
      durationUnit !== "point")
  ) {
    throw new Error("validated Grammar 6 project metadata is incomplete");
  }
  const asOfField = fieldNamed(project, "as_of");
  const asOf = asOfField === undefined
    ? null
    : projectDeclaredCalendarValue(asOfField.value);
  if (asOfField !== undefined && asOf === null) {
    throw new Error("validated Grammar 6 project calendar is unprojectable");
  }
  const model = fieldNamed(project, "plan_assurance_model")?.value;
  const hashModel = fieldNamed(project, "plan_assurance_hash_model")?.value;
  const governance = governanceMetadataFromDocument(validated.document);
  return Object.freeze({
    ok: true,
    documentId: checked.documentId,
    grammarVersion: 6,
    project: Object.freeze({
      id: project.id,
      grammarVersion: 6,
      title,
      description: stringValue(project, "description"),
      asOf,
      durationUnit,
      velocity:
        (fieldNamed(project, "velocity")?.value as VelocityValue | undefined)
          ?.text ?? null,
      finish,
      governance: Object.freeze({
        sourceContractVersion: 1,
        ...governance,
      }),
      assurance: Object.freeze({
        enabled: model !== undefined || hashModel !== undefined,
        modelVersion: typeof model === "number" ? model : null,
        hashModelVersion: typeof hashModel === "number" ? hashModel : null,
      }),
    }),
    diagnostics: checked.diagnostics,
    diagnosticsTruncated: checked.diagnosticsTruncated,
  });
}

export type PlanAssuranceProjectHistoryResultV1 =
  ProjectHistoryCoreResultFor<1 | 2 | 3 | 4 | 5 | 6>;

export function inspectPlanAssuranceProjectHistory(
  probe: GitHistoryProbeResult,
  request: HistoryRequest,
  capability: TargetGrammar6Capability,
): PlanAssuranceProjectHistoryResultV1 {
  return inspectProjectHistoryWithValidator(
    probe,
    request,
    (text): ProjectHistorySourceValidation<1 | 2 | 3 | 4 | 5 | 6> => {
      const checked = validateTargetGrammar6Document(text, capability);
      return {
        ok: checked.ok && checked.validatedDocument !== null,
        documentId: checked.documentId,
        grammarVersion: checked.validatedDocument?.grammarVersion ?? null,
        document:
          checked.validatedDocument?.document ?? checked.document,
      };
    },
  );
}

export function assuranceOwnedDeclarationCount(
  document: DocumentNode<TargetDeclarationKind>,
): number {
  return document.declarations.filter(({ kind }) =>
    assuranceDeclarationKinds.has(kind)
  ).length;
}
