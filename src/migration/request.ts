import type { SourceSpan } from "../model/diagnostics.js";
import { compare, divide, rational } from "../model/rational.js";
import type { Rational } from "../model/rational.js";
import type {
  DocumentNode,
  ExactDurationValue,
  FieldNode,
  VelocityValue,
} from "../model/syntax.js";
import { fieldNamed } from "../model/syntax.js";
import type { DurationUnit, Velocity } from "../model/units.js";
import type {
  MigrationGrammarVersion,
  MigrationVelocityDisposition,
} from "./grammar-boundary.js";

export const UNIT_MIGRATION_IDENTITY = Object.freeze({
  id: "perttool.unit-migration",
  version: 2,
} as const);

export type UnitMigrationCause =
  | "invalid_original"
  | "invalid_replacement_velocity"
  | "missing_velocity"
  | "unsupported_direction"
  | "velocity_period_mismatch"
  | "same_unit_velocity_change"
  | "unsupported_duration_field"
  | "invalid_candidate";

export type UnitMigrationDiagnosticCode =
  | "PTMIG-401"
  | "PTMIG-402"
  | "PTMIG-403"
  | "PTMIG-404"
  | "PTMIG-405"
  | "PTMIG-406"
  | "PTMIG-407"
  | "PTMIG-409";

export const UNIT_MIGRATION_DIAGNOSTIC_CODES: Readonly<
  Record<UnitMigrationCause, UnitMigrationDiagnosticCode>
> = Object.freeze({
  invalid_original: "PTMIG-401",
  invalid_replacement_velocity: "PTMIG-402",
  missing_velocity: "PTMIG-403",
  unsupported_direction: "PTMIG-404",
  velocity_period_mismatch: "PTMIG-405",
  same_unit_velocity_change: "PTMIG-406",
  unsupported_duration_field: "PTMIG-407",
  invalid_candidate: "PTMIG-409",
});

export interface UnitMigrationRequest {
  readonly targetUnit: DurationUnit;
  readonly replacementVelocity?: string | null;
}

export interface NormalizedUnitMigrationRequest {
  readonly targetUnit: DurationUnit;
  readonly replacementVelocity: string | null;
}

export interface UnitMigrationUnavailableCause {
  readonly cause: UnitMigrationCause;
  readonly diagnosticCode: UnitMigrationDiagnosticCode;
  readonly fieldPaths: readonly string[];
}

export interface ExactMigrationVelocity extends Velocity {
  readonly inputToken: string;
}

export interface UnitMigrationDurationField {
  readonly entityKind: "project" | "task";
  readonly entityId: string;
  readonly fieldPath: string;
  readonly sourceUnit: DurationUnit;
  readonly sourceToken: string;
  readonly sourceValue: Rational;
  readonly valueSpan: SourceSpan;
}

export interface UnitMigrationPreservedTemporalField {
  readonly entityKind: "project" | "milestone" | "task";
  readonly entityId: string;
  readonly fieldPath: string;
  readonly sourceToken: string;
  readonly valueSpan: SourceSpan;
}

export interface UnitMigrationValidatedSource {
  readonly grammarVersion: MigrationGrammarVersion;
  readonly document: DocumentNode;
}

export interface PreparedUnitMigrationRequest {
  readonly ok: true;
  readonly unitMigration: typeof UNIT_MIGRATION_IDENTITY;
  readonly sourceGrammarVersion: MigrationGrammarVersion;
  readonly sourceUnit: DurationUnit;
  readonly targetUnit: DurationUnit;
  readonly changed: boolean;
  readonly effectiveVelocity: ExactMigrationVelocity | null;
  readonly velocityDisposition: MigrationVelocityDisposition | null;
  readonly durationInventory: readonly UnitMigrationDurationField[];
  readonly preservedTemporalFields:
    readonly UnitMigrationPreservedTemporalField[];
  readonly unavailableCauses: readonly UnitMigrationUnavailableCause[];
}

export interface RejectedUnitMigrationRequest {
  readonly ok: false;
  readonly unitMigration: typeof UNIT_MIGRATION_IDENTITY;
  readonly sourceGrammarVersion: MigrationGrammarVersion;
  readonly sourceUnit: DurationUnit;
  readonly targetUnit: DurationUnit;
  readonly changed: false;
  readonly effectiveVelocity: null;
  readonly velocityDisposition: null;
  readonly durationInventory: readonly UnitMigrationDurationField[];
  readonly preservedTemporalFields:
    readonly UnitMigrationPreservedTemporalField[];
  readonly unavailableCauses: readonly UnitMigrationUnavailableCause[];
}

export type UnitMigrationRequestPreparation =
  | PreparedUnitMigrationRequest
  | RejectedUnitMigrationRequest;

const requestKeys = new Set(["targetUnit", "replacementVelocity"]);
const durationUnits = new Set<DurationUnit>(["day", "hour", "point"]);

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function normalizeUnitMigrationRequest(
  request: UnitMigrationRequest,
): NormalizedUnitMigrationRequest {
  if (!isRecord(request)) {
    throw new TypeError("unit migration request must be an object");
  }
  for (const key of Object.keys(request)) {
    if (!requestKeys.has(key)) {
      throw new TypeError(`unit migration request field ${key} is unsupported`);
    }
  }
  if (!durationUnits.has(request.targetUnit)) {
    throw new TypeError("unit migration targetUnit must be day, hour, or point");
  }
  const replacementVelocity = request.replacementVelocity ?? null;
  if (
    replacementVelocity !== null &&
    typeof replacementVelocity !== "string"
  ) {
    throw new TypeError(
      "unit migration replacementVelocity must be a string or null",
    );
  }
  return Object.freeze({
    targetUnit: request.targetUnit,
    replacementVelocity,
  });
}

function unitFromSuffix(suffix: "d" | "h" | "p"): DurationUnit {
  return suffix === "d" ? "day" : suffix === "h" ? "hour" : "point";
}

function exactDurationValue(value: unknown): value is ExactDurationValue {
  if (!isRecord(value)) return false;
  if (value["suffix"] !== "d" && value["suffix"] !== "h" && value["suffix"] !== "p") {
    return false;
  }
  return (
    (typeof value["digits"] === "bigint" &&
      typeof value["scale"] === "number") ||
    (typeof value["numerator"] === "bigint" &&
      typeof value["denominator"] === "bigint")
  );
}

function exactDurationRational(value: ExactDurationValue): Rational {
  return "numerator" in value
    ? rational(value.numerator, value.denominator)
    : rational(value.digits, 10n ** BigInt(value.scale));
}

function decimalRational(source: string): Rational | null {
  if (!/^[0-9]+(?:\.[0-9]+)?$/.test(source)) return null;
  const [whole, fraction = ""] = source.split(".");
  if (whole === undefined) return null;
  return rational(
    BigInt(`${whole}${fraction}`),
    10n ** BigInt(fraction.length),
  );
}

function parseReplacementVelocity(source: string): ExactMigrationVelocity | null {
  const match =
    /^([0-9]+(?:\.[0-9]+)?)p\/([0-9]+(?:\.[0-9]+)?)([dh])$/.exec(source);
  if (match === null) return null;
  const points = decimalRational(match[1]!);
  const period = decimalRational(match[2]!);
  if (
    points === null ||
    period === null ||
    points.numerator <= 0n ||
    period.numerator <= 0n
  ) {
    return null;
  }
  return Object.freeze({
    points,
    period,
    periodUnit: match[3] === "d" ? "day" : "hour",
    inputToken: source,
  });
}

function declaredVelocity(
  value: VelocityValue | undefined,
): ExactMigrationVelocity | null {
  if (value === undefined) return null;
  return Object.freeze({
    points: exactDurationRational(value.points),
    period: exactDurationRational(value.period),
    periodUnit: value.period.suffix === "d" ? "day" : "hour",
    inputToken: value.text,
  });
}

function velocitySemanticallyEqual(
  left: ExactMigrationVelocity,
  right: ExactMigrationVelocity,
): boolean {
  return (
    left.periodUnit === right.periodUnit &&
    compare(
      divide(left.points, left.period),
      divide(right.points, right.period),
    ) === 0
  );
}

function cause(
  kind: UnitMigrationCause,
  fieldPaths: readonly string[],
): UnitMigrationUnavailableCause {
  return Object.freeze({
    cause: kind,
    diagnosticCode: UNIT_MIGRATION_DIAGNOSTIC_CODES[kind],
    fieldPaths: Object.freeze([...fieldPaths]),
  });
}

export function unitMigrationCause(
  kind: UnitMigrationCause,
  fieldPaths: readonly string[] = [],
): UnitMigrationUnavailableCause {
  return cause(kind, fieldPaths);
}

function projectFrom(document: DocumentNode) {
  const project = document.declarations.find(
    (declaration) => declaration.kind === "project",
  );
  if (project === undefined) {
    throw new Error("validated migration source has no project declaration");
  }
  return project;
}

function sourceDurationUnit(document: DocumentNode): DurationUnit {
  const field = fieldNamed(projectFrom(document), "duration_unit");
  if (
    field?.value !== "day" &&
    field?.value !== "hour" &&
    field?.value !== "point"
  ) {
    throw new Error("validated migration source has no duration unit");
  }
  return field.value;
}

function scalarFields(
  field: FieldNode,
): readonly FieldNode[] {
  return field.children ?? [field];
}

function durationFieldPath(
  declarationKind: string,
  declarationId: string,
  field: FieldNode,
  parent: FieldNode,
): string | null {
  if (
    declarationKind === "project" &&
    parent === field &&
    (field.name === "critical_epsilon" || field.name === "target_duration")
  ) {
    return `project.${field.name}`;
  }
  if (declarationKind !== "task") return null;
  if (parent === field && field.name === "duration") {
    return `task.${declarationId}.duration`;
  }
  if (
    parent.name === "estimate" &&
    (field.name === "optimistic" ||
      field.name === "most_likely" ||
      field.name === "pessimistic")
  ) {
    return `task.${declarationId}.estimate.${field.name}`;
  }
  return null;
}

function inventoryDurationFields(
  source: UnitMigrationValidatedSource,
  sourceUnit: DurationUnit,
):
  | {
      readonly ok: true;
      readonly fields: readonly UnitMigrationDurationField[];
    }
  | {
      readonly ok: false;
      readonly unsupportedFieldPaths: readonly string[];
    } {
  const fields: UnitMigrationDurationField[] = [];
  const unsupportedFieldPaths: string[] = [];
  for (const declaration of source.document.declarations) {
    for (const parent of declaration.fields) {
      for (const field of scalarFields(parent)) {
        if (!exactDurationValue(field.value)) continue;
        const fieldPath = durationFieldPath(
          declaration.kind,
          declaration.id,
          field,
          parent,
        );
        if (fieldPath === null) {
          unsupportedFieldPaths.push(
            `${declaration.kind}.${declaration.id}.${parent.name}${
              parent === field ? "" : `.${field.name}`
            }`,
          );
          continue;
        }
        const valueUnit = unitFromSuffix(field.value.suffix);
        if (valueUnit !== sourceUnit) {
          throw new Error(
            "validated migration source contains a mismatched Duration unit",
          );
        }
        fields.push(Object.freeze({
          entityKind: declaration.kind as "project" | "task",
          entityId: declaration.id,
          fieldPath,
          sourceUnit,
          sourceToken: field.rawValue,
          sourceValue: exactDurationRational(field.value),
          valueSpan: field.valueSpan,
        }));
      }
    }
  }
  return unsupportedFieldPaths.length === 0
    ? { ok: true, fields: Object.freeze(fields) }
    : {
        ok: false,
        unsupportedFieldPaths: Object.freeze(unsupportedFieldPaths),
      };
}

function preservedTemporalFields(
  document: DocumentNode,
): readonly UnitMigrationPreservedTemporalField[] {
  const fields: UnitMigrationPreservedTemporalField[] = [];
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
      if (fieldPath === null) continue;
      fields.push(Object.freeze({
        entityKind: declaration.kind as "project" | "milestone" | "task",
        entityId: declaration.id,
        fieldPath,
        sourceToken: field.rawValue,
        valueSpan: field.valueSpan,
      }));
    }
  }
  return Object.freeze(fields);
}

function reject(
  source: UnitMigrationValidatedSource,
  sourceUnit: DurationUnit,
  targetUnit: DurationUnit,
  unavailableCause: UnitMigrationUnavailableCause,
): RejectedUnitMigrationRequest {
  return Object.freeze({
    ok: false,
    unitMigration: UNIT_MIGRATION_IDENTITY,
    sourceGrammarVersion: source.grammarVersion,
    sourceUnit,
    targetUnit,
    changed: false,
    effectiveVelocity: null,
    velocityDisposition: null,
    durationInventory: Object.freeze([]),
    preservedTemporalFields: Object.freeze([]),
    unavailableCauses: Object.freeze([unavailableCause]),
  });
}

export function prepareUnitMigrationRequest(
  source: UnitMigrationValidatedSource,
  request: NormalizedUnitMigrationRequest,
): UnitMigrationRequestPreparation {
  const sourceUnit = sourceDurationUnit(source.document);
  const targetUnit = request.targetUnit;
  const project = projectFrom(source.document);
  const replacement = request.replacementVelocity === null
    ? null
    : parseReplacementVelocity(request.replacementVelocity);
  if (request.replacementVelocity !== null && replacement === null) {
    return reject(
      source,
      sourceUnit,
      targetUnit,
      cause("invalid_replacement_velocity", [
        "request.replacement_velocity",
      ]),
    );
  }

  if (sourceUnit === targetUnit && replacement !== null) {
    return reject(
      source,
      sourceUnit,
      targetUnit,
      cause("same_unit_velocity_change", [
        "request.replacement_velocity",
      ]),
    );
  }
  if (
    sourceUnit !== "point" &&
    targetUnit !== "point" &&
    sourceUnit !== targetUnit
  ) {
    return reject(
      source,
      sourceUnit,
      targetUnit,
      cause("unsupported_direction", [
        "project.duration_unit",
        "request.target_unit",
      ]),
    );
  }

  const declaredField = fieldNamed(project, "velocity");
  const declared = declaredVelocity(
    declaredField?.value as VelocityValue | undefined,
  );
  if (sourceUnit !== targetUnit && replacement === null && declared === null) {
    return reject(
      source,
      sourceUnit,
      targetUnit,
      cause("missing_velocity", ["project.velocity"]),
    );
  }

  let effectiveVelocity: ExactMigrationVelocity | null = null;
  let velocityDisposition: MigrationVelocityDisposition | null = null;
  if (sourceUnit !== targetUnit) {
    if (replacement === null) {
      effectiveVelocity = declared;
      velocityDisposition = "retained";
    } else if (
      declared !== null &&
      velocitySemanticallyEqual(declared, replacement)
    ) {
      effectiveVelocity = declared;
      velocityDisposition = "retained";
    } else {
      effectiveVelocity = replacement;
      velocityDisposition = declared === null ? "inserted" : "replaced";
    }
    if (effectiveVelocity === null) {
      throw new Error("changing migration has no effective velocity");
    }
    const requiredPeriodUnit =
      sourceUnit === "point" ? targetUnit : sourceUnit;
    if (effectiveVelocity.periodUnit !== requiredPeriodUnit) {
      return reject(
        source,
        sourceUnit,
        targetUnit,
        cause("velocity_period_mismatch", [
          replacement === null
            ? "project.velocity"
            : "request.replacement_velocity",
          sourceUnit === "point"
            ? "request.target_unit"
            : "project.duration_unit",
        ]),
      );
    }
  }

  const inventory = inventoryDurationFields(source, sourceUnit);
  if (!inventory.ok) {
    return reject(
      source,
      sourceUnit,
      targetUnit,
      cause(
        "unsupported_duration_field",
        inventory.unsupportedFieldPaths,
      ),
    );
  }

  return Object.freeze({
    ok: true,
    unitMigration: UNIT_MIGRATION_IDENTITY,
    sourceGrammarVersion: source.grammarVersion,
    sourceUnit,
    targetUnit,
    changed: sourceUnit !== targetUnit,
    effectiveVelocity,
    velocityDisposition,
    durationInventory: inventory.fields,
    preservedTemporalFields: preservedTemporalFields(source.document),
    unavailableCauses: Object.freeze([]),
  });
}
