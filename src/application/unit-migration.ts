import type { DocumentWriteResult } from "../io/safe-write.js";
import type { UnitMigrationRequest } from "../migration/request.js";
import {
  TARGET_GRAMMAR_3_CAPABILITY,
} from "../parser/document-parser.js";
import {
  planTargetUnitMigrationResult,
  withTargetUnitMigrationWrite,
  type TargetUnitMigrationResult,
  type TargetUnitMigrationResultConvertedField,
  type TargetUnitMigrationResultWrite,
  type TargetUnitMigrationEffectiveVelocity,
  type TargetUnitMigrationExactValue,
} from "./target-unit-migration-result.js";
import type {
  TargetUnitMigrationCandidateOptions,
} from "./target-unit-migration-candidate.js";

export type UnitMigrationResult = TargetUnitMigrationResult;
export type UnitMigrationConvertedField =
  TargetUnitMigrationResultConvertedField;
export type UnitMigrationWrite = TargetUnitMigrationResultWrite;
export type UnitMigrationEffectiveVelocity =
  TargetUnitMigrationEffectiveVelocity;
export type UnitMigrationExactValue = TargetUnitMigrationExactValue;
export type UnitMigrationOptions = TargetUnitMigrationCandidateOptions;

export function planUnitMigration(
  text: string,
  request: UnitMigrationRequest,
  options: UnitMigrationOptions = {},
): UnitMigrationResult {
  return planTargetUnitMigrationResult(
    text,
    request,
    TARGET_GRAMMAR_3_CAPABILITY,
    options,
  );
}

export function withUnitMigrationWrite(
  result: UnitMigrationResult,
  output: DocumentWriteResult,
): UnitMigrationResult {
  return withTargetUnitMigrationWrite(result, output);
}
