import type { Diagnostic } from "../model/diagnostics.js";
import type { DurationUnit } from "../model/units.js";
import {
  normalizeUnitMigrationRequest,
  prepareUnitMigrationRequest,
  UNIT_MIGRATION_IDENTITY,
  unitMigrationCause,
  type ExactMigrationVelocity,
  type NormalizedUnitMigrationRequest,
  type UnitMigrationDurationField,
  type UnitMigrationPreservedTemporalField,
  type UnitMigrationRequest,
  type UnitMigrationUnavailableCause,
} from "../migration/request.js";
import type {
  MigrationGrammarVersion,
  MigrationVelocityDisposition,
} from "../migration/grammar-boundary.js";
import type { TargetGrammar3Capability } from "../parser/document-parser.js";
import {
  validateTargetGrammar3Document,
  type TargetGrammar3ValidatedDocument,
  type TargetValidationOptions,
} from "../semantic/target-validator.js";

export interface TargetUnitMigrationRequestPreparation {
  readonly ok: boolean;
  readonly unitMigration: typeof UNIT_MIGRATION_IDENTITY;
  readonly documentId: string | null;
  readonly sourceGrammarVersion: MigrationGrammarVersion | null;
  readonly sourceUnit: DurationUnit | null;
  readonly targetUnit: DurationUnit;
  readonly changed: boolean;
  readonly effectiveVelocity: ExactMigrationVelocity | null;
  readonly velocityDisposition: MigrationVelocityDisposition | null;
  readonly durationInventory: readonly UnitMigrationDurationField[];
  readonly preservedTemporalFields:
    readonly UnitMigrationPreservedTemporalField[];
  readonly unavailableCauses: readonly UnitMigrationUnavailableCause[];
  readonly diagnostics: readonly Diagnostic[];
  readonly diagnosticsTruncated: boolean;
  readonly validatedDocument: TargetGrammar3ValidatedDocument | null;
}

function invalidOriginal(
  request: NormalizedUnitMigrationRequest,
  documentId: string | null,
  diagnostics: readonly Diagnostic[],
  diagnosticsTruncated: boolean,
): TargetUnitMigrationRequestPreparation {
  return Object.freeze({
    ok: false,
    unitMigration: UNIT_MIGRATION_IDENTITY,
    documentId,
    sourceGrammarVersion: null,
    sourceUnit: null,
    targetUnit: request.targetUnit,
    changed: false,
    effectiveVelocity: null,
    velocityDisposition: null,
    durationInventory: Object.freeze([]),
    preservedTemporalFields: Object.freeze([]),
    unavailableCauses: Object.freeze([
      unitMigrationCause("invalid_original"),
    ]),
    diagnostics,
    diagnosticsTruncated,
    validatedDocument: null,
  });
}

export function prepareTargetUnitMigrationRequest(
  text: string,
  request: UnitMigrationRequest,
  capability: TargetGrammar3Capability,
  options: TargetValidationOptions = {},
): TargetUnitMigrationRequestPreparation {
  const normalizedRequest = normalizeUnitMigrationRequest(request);
  const checked = validateTargetGrammar3Document(text, capability, options);
  if (!checked.ok || checked.validatedDocument === null) {
    return invalidOriginal(
      normalizedRequest,
      checked.documentId,
      checked.diagnostics,
      checked.diagnosticsTruncated,
    );
  }

  const prepared = prepareUnitMigrationRequest(
    checked.validatedDocument,
    normalizedRequest,
  );
  return Object.freeze({
    ok: prepared.ok,
    unitMigration: prepared.unitMigration,
    documentId: checked.documentId,
    sourceGrammarVersion: prepared.sourceGrammarVersion,
    sourceUnit: prepared.sourceUnit,
    targetUnit: prepared.targetUnit,
    changed: prepared.changed,
    effectiveVelocity: prepared.effectiveVelocity,
    velocityDisposition: prepared.velocityDisposition,
    durationInventory: prepared.durationInventory,
    preservedTemporalFields: prepared.preservedTemporalFields,
    unavailableCauses: prepared.unavailableCauses,
    diagnostics: checked.diagnostics,
    diagnosticsTruncated: checked.diagnosticsTruncated,
    validatedDocument: prepared.ok ? checked.validatedDocument : null,
  });
}
