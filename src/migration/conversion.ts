import {
  serializeExactDurationSource,
  type ExactDurationSourceToken,
} from "../model/exact-duration-source.js";
import { divide, multiply, rational } from "../model/rational.js";
import type { Rational } from "../model/rational.js";
import type { DurationUnit } from "../model/units.js";
import {
  selectExactDurationGrammarBoundary,
  type MigrationGrammarDisposition,
  type MigrationGrammarVersion,
  type MigrationQualification,
  type MigrationReversibility,
  type MigrationVelocityDisposition,
} from "./grammar-boundary.js";
import type {
  ExactMigrationVelocity,
  UnitMigrationDurationField,
} from "./request.js";

export interface ExactUnitMigrationValue extends Rational {
  readonly unit: DurationUnit;
}

export interface ExactUnitMigrationConvertedField {
  readonly entityKind: "project" | "task" | "work_event";
  readonly entityId: string;
  readonly fieldPath: string;
  readonly original: ExactUnitMigrationValue;
  readonly converted: ExactUnitMigrationValue;
  readonly canonicalToken: string;
  readonly tokenClassification: ExactDurationSourceToken["classification"];
}

export interface ExactUnitMigrationConversionInput {
  readonly ok: true;
  readonly sourceGrammarVersion: MigrationGrammarVersion;
  readonly sourceUnit: DurationUnit;
  readonly targetUnit: DurationUnit;
  readonly changed: boolean;
  readonly effectiveVelocity: ExactMigrationVelocity | null;
  readonly velocityDisposition: MigrationVelocityDisposition | null;
  readonly durationInventory: readonly UnitMigrationDurationField[];
}

export interface ExactUnitMigrationConversion {
  readonly sourceGrammarVersion: MigrationGrammarVersion;
  readonly targetGrammarVersion: MigrationGrammarVersion;
  readonly grammarDisposition: MigrationGrammarDisposition;
  readonly sourceUnit: DurationUnit;
  readonly targetUnit: DurationUnit;
  readonly changed: boolean;
  readonly convertedFields: readonly ExactUnitMigrationConvertedField[];
  readonly reversibility: MigrationReversibility;
  readonly qualifications: readonly MigrationQualification[];
}

function exactValue(
  value: Rational,
  unit: DurationUnit,
): ExactUnitMigrationValue {
  const normalized = rational(value.numerator, value.denominator);
  return Object.freeze({
    numerator: normalized.numerator,
    denominator: normalized.denominator,
    unit,
  });
}

function exactPositive(value: Rational, name: string): Rational {
  const normalized = rational(value.numerator, value.denominator);
  if (normalized.numerator <= 0n) {
    throw new Error(`${name} must be positive`);
  }
  return normalized;
}

function targetPerSource(
  input: ExactUnitMigrationConversionInput,
): Rational | null {
  if (!input.changed) {
    if (input.sourceUnit !== input.targetUnit) {
      throw new Error("unchanged migration must retain the source unit");
    }
    if (
      input.effectiveVelocity !== null ||
      input.velocityDisposition !== null
    ) {
      throw new Error("unchanged migration must not select a velocity");
    }
    return null;
  }

  const velocity = input.effectiveVelocity;
  if (velocity === null || input.velocityDisposition === null) {
    throw new Error("changing migration requires an effective velocity");
  }
  const points = exactPositive(velocity.points, "velocity points");
  const period = exactPositive(velocity.period, "velocity period");
  if (input.sourceUnit === "point") {
    if (
      input.targetUnit === "point" ||
      velocity.periodUnit !== input.targetUnit
    ) {
      throw new Error(
        "Point migration target must match the velocity period unit",
      );
    }
    return divide(period, points);
  }
  if (
    input.targetUnit !== "point" ||
    velocity.periodUnit !== input.sourceUnit
  ) {
    throw new Error(
      "time migration source must match the velocity period unit",
    );
  }
  return divide(points, period);
}

function convertField(
  field: UnitMigrationDurationField,
  sourceUnit: DurationUnit,
  targetUnit: DurationUnit,
  factor: Rational,
): {
  readonly record: ExactUnitMigrationConvertedField;
  readonly token: ExactDurationSourceToken;
} {
  if (field.sourceUnit !== sourceUnit) {
    throw new Error(
      `migration inventory field ${field.fieldPath} has the wrong source unit`,
    );
  }
  const original = exactValue(field.sourceValue, sourceUnit);
  if (original.numerator < 0n) {
    throw new Error(
      `migration inventory field ${field.fieldPath} must not be negative`,
    );
  }
  const converted = exactValue(multiply(original, factor), targetUnit);
  const serialized = serializeExactDurationSource(converted, targetUnit);
  const token = Object.freeze({ ...serialized });
  return {
    record: Object.freeze({
      entityKind: field.entityKind,
      entityId: field.entityId,
      fieldPath: field.fieldPath,
      original,
      converted,
      canonicalToken: token.token,
      tokenClassification: token.classification,
    }),
    token,
  };
}

export function convertPreparedUnitMigrationRequest(
  input: ExactUnitMigrationConversionInput,
): ExactUnitMigrationConversion {
  if (input.ok !== true) {
    throw new TypeError(
      "exact unit conversion requires a successful prepared request",
    );
  }
  if (!Array.isArray(input.durationInventory)) {
    throw new TypeError("durationInventory must be an array");
  }

  const factor = targetPerSource(input);
  const convertedFields: ExactUnitMigrationConvertedField[] = [];
  const generatedTokens: ExactDurationSourceToken[] = [];
  if (factor !== null) {
    for (const field of input.durationInventory) {
      const converted = convertField(
        field,
        input.sourceUnit,
        input.targetUnit,
        factor,
      );
      convertedFields.push(converted.record);
      generatedTokens.push(converted.token);
    }
  }

  const grammar = selectExactDurationGrammarBoundary(
    input.sourceGrammarVersion,
    generatedTokens,
    {
      migrationChanged: input.changed,
      velocityDisposition: input.velocityDisposition,
    },
  );
  return Object.freeze({
    sourceGrammarVersion: grammar.sourceGrammarVersion,
    targetGrammarVersion: grammar.targetGrammarVersion,
    grammarDisposition: grammar.grammarDisposition,
    sourceUnit: input.sourceUnit,
    targetUnit: input.targetUnit,
    changed: input.changed,
    convertedFields: Object.freeze(convertedFields),
    reversibility: grammar.reversibility,
    qualifications: grammar.qualifications,
  });
}
