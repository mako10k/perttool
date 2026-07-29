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
import type {
  TargetGrammar3Capability,
  TargetGrammar4Capability,
  TargetGrammar5Capability,
} from "../parser/document-parser.js";
import {
  validateTargetGrammar3Document,
  validateTargetGrammar4Document,
  validateTargetGrammar5Document,
  type TargetGrammar3ValidatedDocument,
  type TargetGrammar4ValidatedDocument,
  type TargetGrammar5ValidatedDocument,
  type TargetValidationOptions,
} from "../semantic/target-validator.js";

interface TargetUnitMigrationRequestPreparationBase {
  readonly unitMigration: typeof UNIT_MIGRATION_IDENTITY;
  readonly documentId: string | null;
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
}

export interface TargetUnitMigrationRequestSuccess
  extends TargetUnitMigrationRequestPreparationBase {
  readonly ok: true;
  readonly sourceGrammarVersion: MigrationGrammarVersion;
  readonly sourceUnit: DurationUnit;
  readonly validatedDocument:
    | TargetGrammar3ValidatedDocument
    | TargetGrammar4ValidatedDocument
    | TargetGrammar5ValidatedDocument;
}

export interface TargetUnitMigrationRequestFailure
  extends TargetUnitMigrationRequestPreparationBase {
  readonly ok: false;
  readonly sourceGrammarVersion: MigrationGrammarVersion | null;
  readonly sourceUnit: DurationUnit | null;
  readonly validatedDocument: null;
}

export type TargetUnitMigrationRequestPreparation =
  | TargetUnitMigrationRequestSuccess
  | TargetUnitMigrationRequestFailure;

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
  capability:
    | TargetGrammar3Capability
    | TargetGrammar4Capability
    | TargetGrammar5Capability,
  options: TargetValidationOptions = {},
): TargetUnitMigrationRequestPreparation {
  const normalizedRequest = normalizeUnitMigrationRequest(request);
  const checked = capability.grammarVersion === 5
    ? validateTargetGrammar5Document(text, capability, options)
    : capability.grammarVersion === 4
      ? validateTargetGrammar4Document(text, capability, options)
      : validateTargetGrammar3Document(text, capability, options);
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
  if (!prepared.ok) {
    return Object.freeze({
      ok: false,
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
      validatedDocument: null,
    });
  }
  return Object.freeze({
    ok: true,
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
    validatedDocument: checked.validatedDocument,
  });
}
