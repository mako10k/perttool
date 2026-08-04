import type { DocumentWriteResult } from "../io/safe-write.js";
import type { UnitMigrationRequest } from "../migration/request.js";
import {
  TARGET_GRAMMAR_5_CAPABILITY,
  TARGET_GRAMMAR_6_CAPABILITY,
} from "../parser/document-parser.js";
import { validateTargetGrammar6Document } from "../semantic/target-validator.js";
import {
  planTargetUnitMigrationResult,
  withTargetUnitMigrationWrite,
  type TargetUnitMigrationEffectiveVelocity,
  type TargetUnitMigrationExactValue,
  type TargetUnitMigrationResult,
  type TargetUnitMigrationResultConvertedField,
  type TargetUnitMigrationResultWrite,
} from "./target-unit-migration-result.js";
import type { TargetUnitMigrationCandidateOptions } from "./target-unit-migration-candidate.js";

export type UnitMigrationResult = TargetUnitMigrationResult;
export type UnitMigrationConvertedField = TargetUnitMigrationResultConvertedField;
export type UnitMigrationWrite = TargetUnitMigrationResultWrite;
export type UnitMigrationEffectiveVelocity = TargetUnitMigrationEffectiveVelocity;
export type UnitMigrationExactValue = TargetUnitMigrationExactValue;
export type UnitMigrationOptions = TargetUnitMigrationCandidateOptions;

export function planUnitMigration(
  text: string,
  request: UnitMigrationRequest,
  options: UnitMigrationOptions = {},
): UnitMigrationResult {
  const checked = validateTargetGrammar6Document(
    text,
    TARGET_GRAMMAR_6_CAPABILITY,
    options,
  );
  return planTargetUnitMigrationResult(
    text,
    request,
    checked.validatedDocument?.grammarVersion === 6
      ? TARGET_GRAMMAR_6_CAPABILITY
      : TARGET_GRAMMAR_5_CAPABILITY,
    options,
  );
}

export function withUnitMigrationWrite(
  result: UnitMigrationResult,
  output: DocumentWriteResult,
): UnitMigrationResult {
  return withTargetUnitMigrationWrite(result, output);
}
