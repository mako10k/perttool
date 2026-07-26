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

export type UnitMigrationResult = Omit<
  TargetUnitMigrationResult,
  "sourceGrammarVersion" | "targetGrammarVersion"
> & {
  readonly sourceGrammarVersion: 1 | 2 | 3 | null;
  readonly targetGrammarVersion: 1 | 2 | 3 | null;
};
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
  const result = planTargetUnitMigrationResult(
    text,
    request,
    TARGET_GRAMMAR_3_CAPABILITY,
    options,
  );
  if (
    result.sourceGrammarVersion === 4 ||
    result.targetGrammarVersion === 4
  ) {
    throw new Error("active Grammar 3 unit migration returned Grammar 4");
  }
  return result as UnitMigrationResult;
}

export function withUnitMigrationWrite(
  result: UnitMigrationResult,
  output: DocumentWriteResult,
): UnitMigrationResult {
  const written = withTargetUnitMigrationWrite(result, output);
  if (
    written.sourceGrammarVersion === 4 ||
    written.targetGrammarVersion === 4
  ) {
    throw new Error("active Grammar 3 unit migration returned Grammar 4");
  }
  return written as UnitMigrationResult;
}
