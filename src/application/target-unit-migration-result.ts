import type { DocumentWriteResult } from "../io/safe-write.js";
import type { Diagnostic } from "../model/diagnostics.js";
import type { Rational } from "../model/rational.js";
import type { CalendarUnit, DurationUnit } from "../model/units.js";
import type {
  MigrationGrammarDisposition,
  MigrationGrammarVersion,
  MigrationQualification,
  MigrationReversibility,
  MigrationVelocityDisposition,
} from "../migration/grammar-boundary.js";
import type {
  UnitMigrationRequest,
  UnitMigrationUnavailableCause,
} from "../migration/request.js";
import type { TextEdit } from "../mutation/text-edits.js";
import type {
  TargetGrammar3Capability,
  TargetGrammar4Capability,
  TargetGrammar5Capability,
  TargetGrammar6Capability,
} from "../parser/document-parser.js";
import {
  planTargetGrammar6UnitMigrationCandidate,
  planTargetUnitMigrationCandidate,
  type TargetUnitMigrationCandidateOptions,
} from "./target-unit-migration-candidate.js";

export const TARGET_UNIT_MIGRATION_RESULT_SCHEMA_VERSION =
  "Perttool.UnitMigrationResult.v3" as const;

export interface TargetUnitMigrationExactValue extends Rational {
  readonly unit: DurationUnit;
}

export interface TargetUnitMigrationEffectiveVelocity {
  readonly points: TargetUnitMigrationExactValue & {
    readonly unit: "point";
  };
  readonly period: TargetUnitMigrationExactValue & {
    readonly unit: CalendarUnit;
  };
}

export interface TargetUnitMigrationResultConvertedField {
  readonly entityKind: "project" | "task" | "work_event";
  readonly entityId: string;
  readonly fieldPath: string;
  readonly original: TargetUnitMigrationExactValue;
  readonly converted: TargetUnitMigrationExactValue;
  readonly canonicalToken: string;
}

export interface TargetUnitMigrationResultWrite {
  readonly mode: "preview" | "in_place" | "out";
  readonly target: string | null;
  readonly written: boolean;
}

export interface TargetUnitMigrationResult {
  readonly schemaVersion: typeof TARGET_UNIT_MIGRATION_RESULT_SCHEMA_VERSION;
  readonly ok: boolean;
  readonly unitMigration: {
    readonly id: "perttool.unit-migration";
    readonly version: 3;
  };
  readonly documentId: string | null;
  readonly sourceGrammarVersion: MigrationGrammarVersion | null;
  readonly targetGrammarVersion: MigrationGrammarVersion | null;
  readonly grammarDisposition: MigrationGrammarDisposition | null;
  readonly sourceUnit: DurationUnit | null;
  readonly targetUnit: DurationUnit;
  readonly effectiveVelocity: TargetUnitMigrationEffectiveVelocity | null;
  readonly velocityDisposition: MigrationVelocityDisposition | null;
  readonly changed: boolean;
  readonly convertedFields:
    readonly TargetUnitMigrationResultConvertedField[];
  readonly reversibility: MigrationReversibility;
  readonly qualifications: readonly MigrationQualification[];
  readonly unavailableCauses: readonly UnitMigrationUnavailableCause[];
  readonly originalDigest: string;
  readonly updatedDigest: string | null;
  readonly updatedText: string | null;
  readonly diff: string | null;
  readonly edits: readonly TextEdit[];
  readonly write: TargetUnitMigrationResultWrite;
  readonly diagnostics: readonly Diagnostic[];
  readonly diagnosticsTruncated: boolean;
}

const previewWrite: TargetUnitMigrationResultWrite = Object.freeze({
  mode: "preview",
  target: null,
  written: false,
});

function exactValue<Unit extends DurationUnit>(
  value: Rational,
  unit: Unit,
): TargetUnitMigrationExactValue & { readonly unit: Unit } {
  return Object.freeze({
    numerator: value.numerator,
    denominator: value.denominator,
    unit,
  });
}

function effectiveVelocity(
  value: ReturnType<
    typeof planTargetUnitMigrationCandidate
  >["effectiveVelocity"],
): TargetUnitMigrationEffectiveVelocity | null {
  if (value === null) return null;
  return Object.freeze({
    points: exactValue(value.points, "point"),
    period: exactValue(value.period, value.periodUnit),
  });
}

export function planTargetUnitMigrationResult(
  text: string,
  request: UnitMigrationRequest,
  capability:
    | TargetGrammar3Capability
    | TargetGrammar4Capability
    | TargetGrammar5Capability
    | TargetGrammar6Capability,
  options: TargetUnitMigrationCandidateOptions = {},
): TargetUnitMigrationResult {
  const candidate = capability.grammarVersion === 6
    ? planTargetGrammar6UnitMigrationCandidate(
        text,
        request,
        capability,
        options,
      )
    : planTargetUnitMigrationCandidate(
        text,
        request,
        capability,
        options,
      );
  return Object.freeze({
    schemaVersion: TARGET_UNIT_MIGRATION_RESULT_SCHEMA_VERSION,
    ok: candidate.ok,
    unitMigration: candidate.unitMigration,
    documentId: candidate.documentId,
    sourceGrammarVersion: candidate.sourceGrammarVersion,
    targetGrammarVersion: candidate.targetGrammarVersion,
    grammarDisposition: candidate.grammarDisposition,
    sourceUnit: candidate.sourceUnit,
    targetUnit: candidate.targetUnit,
    effectiveVelocity: effectiveVelocity(candidate.effectiveVelocity),
    velocityDisposition: candidate.velocityDisposition,
    changed: candidate.changed,
    convertedFields: Object.freeze(
      candidate.convertedFields.map((field) =>
        Object.freeze({
          entityKind: field.entityKind,
          entityId: field.entityId,
          fieldPath: field.fieldPath,
          original: exactValue(field.original, field.original.unit),
          converted: exactValue(field.converted, field.converted.unit),
          canonicalToken: field.canonicalToken,
        }),
      ),
    ),
    reversibility: candidate.reversibility,
    qualifications: Object.freeze([...candidate.qualifications]),
    unavailableCauses: Object.freeze(
      candidate.unavailableCauses.map((cause) =>
        Object.freeze({
          cause: cause.cause,
          diagnosticCode: cause.diagnosticCode,
          fieldPaths: Object.freeze([...cause.fieldPaths]),
        }),
      ),
    ),
    originalDigest: candidate.originalDigest,
    updatedDigest: candidate.updatedDigest,
    updatedText: candidate.updatedText,
    diff: candidate.diff,
    edits: Object.freeze([...candidate.edits]),
    write: previewWrite,
    diagnostics: Object.freeze([...candidate.diagnostics]),
    diagnosticsTruncated: candidate.diagnosticsTruncated,
  });
}

export function withTargetUnitMigrationWrite(
  result: TargetUnitMigrationResult,
  output: DocumentWriteResult,
): TargetUnitMigrationResult {
  if (
    !result.ok ||
    result.updatedDigest === null ||
    result.updatedText === null
  ) {
    throw new Error(
      "cannot attach write state to a failed unit-migration result",
    );
  }
  if (
    result.write.mode !== "preview" ||
    result.write.target !== null ||
    result.write.written ||
    output.target.length === 0 ||
    output.digest !== result.updatedDigest ||
    (output.mode === "out" && !output.written)
  ) {
    throw new Error(
      "unit-migration write state does not match the candidate",
    );
  }
  return Object.freeze({
    ...result,
    write: Object.freeze({
      mode: output.mode,
      target: output.target,
      written: output.written,
    }),
  });
}
