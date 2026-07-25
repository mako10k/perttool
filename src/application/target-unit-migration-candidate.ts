import { createHash } from "node:crypto";
import { createUnifiedDiff } from "../editing/unified-diff.js";
import type { Diagnostic } from "../model/diagnostics.js";
import { serializeExactDurationSource } from "../model/exact-duration-source.js";
import type {
  DocumentNode,
  FieldNode,
  VelocityValue,
} from "../model/syntax.js";
import { fieldNamed } from "../model/syntax.js";
import type { DurationUnit } from "../model/units.js";
import {
  convertPreparedUnitMigrationRequest,
  type ExactUnitMigrationConvertedField,
} from "../migration/conversion.js";
import type {
  MigrationGrammarDisposition,
  MigrationGrammarVersion,
  MigrationQualification,
  MigrationReversibility,
  MigrationVelocityDisposition,
} from "../migration/grammar-boundary.js";
import {
  UNIT_MIGRATION_IDENTITY,
  unitMigrationCause,
  type ExactMigrationVelocity,
  type UnitMigrationPreservedTemporalField,
  type UnitMigrationRequest,
  type UnitMigrationUnavailableCause,
} from "../migration/request.js";
import {
  planProjectMutationEdits,
  TARGET_GRAMMAR_3_PROJECT_MUTATION_PROFILE,
} from "../mutation/project.js";
import {
  applyTextEdits,
  normalizeTextEdits,
  type TextEdit,
} from "../mutation/text-edits.js";
import type { TargetGrammar3Capability } from "../parser/document-parser.js";
import {
  validateTargetGrammar3Document,
  type TargetValidationOptions,
} from "../semantic/target-validator.js";
import {
  prepareTargetUnitMigrationRequest,
  type TargetUnitMigrationRequestFailure,
  type TargetUnitMigrationRequestSuccess,
} from "./target-unit-migration-request.js";

export interface TargetUnitMigrationCandidateOptions
  extends TargetValidationOptions {
  readonly originalLabel?: string;
  readonly updatedLabel?: string;
}

interface TargetUnitMigrationCandidateBase {
  readonly unitMigration: typeof UNIT_MIGRATION_IDENTITY;
  readonly documentId: string | null;
  readonly sourceGrammarVersion: MigrationGrammarVersion | null;
  readonly targetGrammarVersion: MigrationGrammarVersion | null;
  readonly grammarDisposition: MigrationGrammarDisposition | null;
  readonly sourceUnit: DurationUnit | null;
  readonly targetUnit: DurationUnit;
  readonly effectiveVelocity: ExactMigrationVelocity | null;
  readonly velocityDisposition: MigrationVelocityDisposition | null;
  readonly changed: boolean;
  readonly convertedFields: readonly ExactUnitMigrationConvertedField[];
  readonly reversibility: MigrationReversibility;
  readonly qualifications: readonly MigrationQualification[];
  readonly unavailableCauses: readonly UnitMigrationUnavailableCause[];
  readonly originalDigest: string;
  readonly updatedDigest: string | null;
  readonly updatedText: string | null;
  readonly diff: string | null;
  readonly edits: readonly TextEdit[];
  readonly diagnostics: readonly Diagnostic[];
  readonly diagnosticsTruncated: boolean;
}

export interface TargetUnitMigrationCandidateSuccess
  extends TargetUnitMigrationCandidateBase {
  readonly ok: true;
  readonly sourceGrammarVersion: MigrationGrammarVersion;
  readonly targetGrammarVersion: MigrationGrammarVersion;
  readonly grammarDisposition: MigrationGrammarDisposition;
  readonly sourceUnit: DurationUnit;
  readonly updatedDigest: string;
  readonly updatedText: string;
  readonly diff: string;
}

export interface TargetUnitMigrationCandidateFailure
  extends TargetUnitMigrationCandidateBase {
  readonly ok: false;
  readonly changed: false;
  readonly convertedFields: readonly [];
  readonly reversibility: "not_applicable";
  readonly qualifications: readonly [];
  readonly updatedDigest: null;
  readonly updatedText: null;
  readonly diff: null;
  readonly edits: readonly [];
}

export type TargetUnitMigrationCandidate =
  | TargetUnitMigrationCandidateSuccess
  | TargetUnitMigrationCandidateFailure;

function digest(text: string): string {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

function failedPreparation(
  prepared: TargetUnitMigrationRequestFailure,
  originalDigest: string,
): TargetUnitMigrationCandidateFailure {
  return Object.freeze({
    ok: false,
    unitMigration: prepared.unitMigration,
    documentId: prepared.documentId,
    sourceGrammarVersion: prepared.sourceGrammarVersion,
    targetGrammarVersion: null,
    grammarDisposition: null,
    sourceUnit: prepared.sourceUnit,
    targetUnit: prepared.targetUnit,
    effectiveVelocity: null,
    velocityDisposition: null,
    changed: false,
    convertedFields: Object.freeze([]) as readonly [],
    reversibility: "not_applicable",
    qualifications: Object.freeze([]) as readonly [],
    unavailableCauses: prepared.unavailableCauses,
    originalDigest,
    updatedDigest: null,
    updatedText: null,
    diff: null,
    edits: Object.freeze([]) as readonly [],
    diagnostics: prepared.diagnostics,
    diagnosticsTruncated: prepared.diagnosticsTruncated,
  });
}

function invalidCandidate(
  prepared: TargetUnitMigrationRequestSuccess,
  originalDigest: string,
  targetGrammarVersion: MigrationGrammarVersion,
  grammarDisposition: MigrationGrammarDisposition,
  diagnostics: readonly Diagnostic[],
  diagnosticsTruncated: boolean,
): TargetUnitMigrationCandidateFailure {
  return Object.freeze({
    ok: false,
    unitMigration: prepared.unitMigration,
    documentId: prepared.documentId,
    sourceGrammarVersion: prepared.sourceGrammarVersion,
    targetGrammarVersion,
    grammarDisposition,
    sourceUnit: prepared.sourceUnit,
    targetUnit: prepared.targetUnit,
    effectiveVelocity: prepared.effectiveVelocity,
    velocityDisposition: prepared.velocityDisposition,
    changed: false,
    convertedFields: Object.freeze([]) as readonly [],
    reversibility: "not_applicable",
    qualifications: Object.freeze([]) as readonly [],
    unavailableCauses: Object.freeze([
      unitMigrationCause("invalid_candidate"),
    ]),
    originalDigest,
    updatedDigest: null,
    updatedText: null,
    diff: null,
    edits: Object.freeze([]) as readonly [],
    diagnostics,
    diagnosticsTruncated,
  });
}

function canonicalVelocity(velocity: ExactMigrationVelocity): string {
  const points = serializeExactDurationSource(velocity.points, "point");
  const period = serializeExactDurationSource(
    velocity.period,
    velocity.periodUnit,
  );
  if (
    points.classification !== "decimal" ||
    period.classification !== "decimal"
  ) {
    throw new Error("migration velocity quantities must remain Decimal");
  }
  return `${points.token}/${period.token}`;
}

function effectiveVelocity(
  prepared: TargetUnitMigrationRequestSuccess,
): ExactMigrationVelocity {
  if (prepared.effectiveVelocity === null) {
    throw new Error("changing migration has no effective velocity");
  }
  return prepared.effectiveVelocity;
}

function projectConfigurationEdits(
  text: string,
  prepared: TargetUnitMigrationRequestSuccess,
  targetGrammarVersion: MigrationGrammarVersion,
): readonly TextEdit[] {
  const set = {
    ...(targetGrammarVersion === prepared.sourceGrammarVersion
      ? {}
      : { version: targetGrammarVersion }),
    durationUnit: prepared.targetUnit,
    ...(prepared.velocityDisposition === "replaced" ||
    prepared.velocityDisposition === "inserted"
      ? {
          velocity: canonicalVelocity(effectiveVelocity(prepared)),
        }
      : {}),
  };
  const planned = planProjectMutationEdits(
    text,
    prepared.validatedDocument.document,
    { kind: "project.set", set },
    TARGET_GRAMMAR_3_PROJECT_MUTATION_PROFILE,
  );
  if (planned.diagnostic !== undefined) {
    throw new Error(
      `unit migration project edit planning failed: ${planned.diagnostic.code}`,
    );
  }
  return planned.edits;
}

function durationEdits(
  prepared: TargetUnitMigrationRequestSuccess,
  convertedFields: readonly ExactUnitMigrationConvertedField[],
): readonly TextEdit[] {
  if (prepared.durationInventory.length !== convertedFields.length) {
    throw new Error("unit migration conversion lost an inventory field");
  }
  return convertedFields.map((converted, index) => {
    const source = prepared.durationInventory[index]!;
    if (
      source.entityKind !== converted.entityKind ||
      source.entityId !== converted.entityId ||
      source.fieldPath !== converted.fieldPath
    ) {
      throw new Error("unit migration conversion changed inventory order");
    }
    return Object.freeze({
      startOffset: source.valueSpan.start.offset,
      endOffset: source.valueSpan.end.offset,
      replacement: converted.canonicalToken,
    });
  });
}

function scalarFields(field: FieldNode): readonly FieldNode[] {
  return field.children ?? [field];
}

function candidateDurationTokens(
  document: DocumentNode,
): readonly {
  readonly fieldPath: string;
  readonly token: string;
}[] {
  const tokens: Array<{ fieldPath: string; token: string }> = [];
  for (const declaration of document.declarations) {
    for (const parent of declaration.fields) {
      for (const field of scalarFields(parent)) {
        const fieldPath =
          declaration.kind === "project" &&
          parent === field &&
          (field.name === "critical_epsilon" ||
            field.name === "target_duration")
            ? `project.${field.name}`
            : declaration.kind === "task" &&
                parent === field &&
                field.name === "duration"
              ? `task.${declaration.id}.duration`
              : declaration.kind === "task" &&
                  parent.name === "estimate" &&
                  (field.name === "optimistic" ||
                    field.name === "most_likely" ||
                    field.name === "pessimistic")
                ? `task.${declaration.id}.estimate.${field.name}`
                : null;
        if (fieldPath !== null) {
          tokens.push({ fieldPath, token: field.rawValue });
        }
      }
    }
  }
  return tokens;
}

function candidateTemporalTokens(
  document: DocumentNode,
): readonly {
  readonly fieldPath: string;
  readonly token: string;
}[] {
  const tokens: Array<{ fieldPath: string; token: string }> = [];
  for (const declaration of document.declarations) {
    for (const field of declaration.fields) {
      const fieldPath =
        declaration.kind === "project" && field.name === "as_of"
          ? "project.as_of"
          : declaration.kind === "milestone" && field.name === "deadline"
            ? `milestone.${declaration.id}.deadline`
            : declaration.kind === "task" && field.name === "not_before"
              ? `task.${declaration.id}.not_before`
              : declaration.kind === "task" && field.name === "deadline"
                ? `task.${declaration.id}.deadline`
                : null;
      if (fieldPath !== null) {
        tokens.push({ fieldPath, token: field.rawValue });
      }
    }
  }
  return tokens;
}

function sourceTemporalTokens(
  fields: readonly UnitMigrationPreservedTemporalField[],
): readonly {
  readonly fieldPath: string;
  readonly token: string;
}[] {
  return fields.map(({ fieldPath, sourceToken }) => ({
    fieldPath,
    token: sourceToken,
  }));
}

function assertCandidatePostconditions(
  prepared: TargetUnitMigrationRequestSuccess,
  targetGrammarVersion: MigrationGrammarVersion,
  convertedFields: readonly ExactUnitMigrationConvertedField[],
  candidateDocument: DocumentNode,
): void {
  const project = candidateDocument.declarations.find(
    ({ kind }) => kind === "project",
  );
  if (project === undefined) {
    throw new Error("unit migration candidate lost its project");
  }
  if (fieldNamed(project, "duration_unit")?.value !== prepared.targetUnit) {
    throw new Error("unit migration candidate has the wrong target unit");
  }
  const declaredVersion = fieldNamed(project, "version")?.value ?? 1;
  if (declaredVersion !== targetGrammarVersion) {
    throw new Error("unit migration candidate has the wrong grammar version");
  }
  const velocity = fieldNamed(project, "velocity")?.value as
    | VelocityValue
    | undefined;
  if (prepared.effectiveVelocity === null || velocity === undefined) {
    throw new Error("changing unit migration candidate lost its velocity");
  }
  const expectedVelocity =
    prepared.velocityDisposition === "retained"
      ? prepared.effectiveVelocity.inputToken
      : canonicalVelocity(prepared.effectiveVelocity);
  if (fieldNamed(project, "velocity")?.rawValue !== expectedVelocity) {
    throw new Error("unit migration candidate changed velocity unexpectedly");
  }

  const expectedDurations = convertedFields.map(
    ({ fieldPath, canonicalToken }) => ({
      fieldPath,
      token: canonicalToken,
    }),
  );
  if (
    JSON.stringify(candidateDurationTokens(candidateDocument)) !==
    JSON.stringify(expectedDurations)
  ) {
    throw new Error("unit migration candidate does not match exact conversion");
  }
  if (
    JSON.stringify(candidateTemporalTokens(candidateDocument)) !==
    JSON.stringify(sourceTemporalTokens(prepared.preservedTemporalFields))
  ) {
    throw new Error("unit migration candidate changed temporal source");
  }
}

export function planTargetUnitMigrationCandidate(
  text: string,
  request: UnitMigrationRequest,
  capability: TargetGrammar3Capability,
  options: TargetUnitMigrationCandidateOptions = {},
): TargetUnitMigrationCandidate {
  const originalDigest = digest(text);
  const prepared = prepareTargetUnitMigrationRequest(
    text,
    request,
    capability,
    options,
  );
  if (!prepared.ok) return failedPreparation(prepared, originalDigest);

  const converted = convertPreparedUnitMigrationRequest(prepared);
  if (!prepared.changed) {
    return Object.freeze({
      ok: true,
      unitMigration: prepared.unitMigration,
      documentId: prepared.documentId,
      sourceGrammarVersion: converted.sourceGrammarVersion,
      targetGrammarVersion: converted.targetGrammarVersion,
      grammarDisposition: converted.grammarDisposition,
      sourceUnit: prepared.sourceUnit,
      targetUnit: prepared.targetUnit,
      effectiveVelocity: prepared.effectiveVelocity,
      velocityDisposition: prepared.velocityDisposition,
      changed: false,
      convertedFields: converted.convertedFields,
      reversibility: converted.reversibility,
      qualifications: converted.qualifications,
      unavailableCauses: prepared.unavailableCauses,
      originalDigest,
      updatedDigest: originalDigest,
      updatedText: text,
      diff: "",
      edits: Object.freeze([]),
      diagnostics: prepared.diagnostics,
      diagnosticsTruncated: prepared.diagnosticsTruncated,
    });
  }

  const edits = normalizeTextEdits(
    text,
    [
      ...projectConfigurationEdits(
        text,
        prepared,
        converted.targetGrammarVersion,
      ),
      ...durationEdits(prepared, converted.convertedFields),
    ],
    "unit migration candidate",
  );
  const updatedText = applyTextEdits(text, edits);
  const candidate = validateTargetGrammar3Document(
    updatedText,
    capability,
    options,
  );
  if (
    !candidate.ok ||
    candidate.validatedDocument === null ||
    candidate.validatedDocument.grammarVersion !==
      converted.targetGrammarVersion
  ) {
    return invalidCandidate(
      prepared,
      originalDigest,
      converted.targetGrammarVersion,
      converted.grammarDisposition,
      candidate.diagnostics,
      candidate.diagnosticsTruncated,
    );
  }
  assertCandidatePostconditions(
    prepared,
    converted.targetGrammarVersion,
    converted.convertedFields,
    candidate.validatedDocument.document,
  );

  return Object.freeze({
    ok: true,
    unitMigration: prepared.unitMigration,
    documentId: prepared.documentId,
    sourceGrammarVersion: converted.sourceGrammarVersion,
    targetGrammarVersion: converted.targetGrammarVersion,
    grammarDisposition: converted.grammarDisposition,
    sourceUnit: prepared.sourceUnit,
    targetUnit: prepared.targetUnit,
    effectiveVelocity: prepared.effectiveVelocity,
    velocityDisposition: prepared.velocityDisposition,
    changed: true,
    convertedFields: converted.convertedFields,
    reversibility: converted.reversibility,
    qualifications: converted.qualifications,
    unavailableCauses: prepared.unavailableCauses,
    originalDigest,
    updatedDigest: digest(updatedText),
    updatedText,
    diff: createUnifiedDiff(text, updatedText, {
      ...(options.originalLabel === undefined
        ? {}
        : { originalLabel: options.originalLabel }),
      ...(options.updatedLabel === undefined
        ? {}
        : { updatedLabel: options.updatedLabel }),
    }),
    edits: Object.freeze([...edits]),
    diagnostics: candidate.diagnostics,
    diagnosticsTruncated: candidate.diagnosticsTruncated,
  });
}
