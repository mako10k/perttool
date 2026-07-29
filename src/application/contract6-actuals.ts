import {
  analyzeDocument as analyzeBaseDocument,
  type AnalysisResult,
  type AnalyzeOptions,
} from "./analyze.js";
import {
  selectNextTasks as selectBaseNextTasks,
  type NextOptions,
  type NextGroups,
  type NextResultV3,
} from "./next.js";
import {
  analyzeTargetActualsDocument,
  selectTargetActualsTasks,
  TARGET_ACTUALS_ANALYSIS_RESULT_SCHEMA_VERSION,
  TARGET_ACTUALS_NEXT_RESULT_SCHEMA_VERSION,
  type TargetActualsAnalysisResultV4,
  type TargetActualsNextResultV5,
  type TargetActualsPrecedenceResult,
  type TargetActualsResourceScheduleResult,
  type TargetActualsTemporalAnalysis,
  type TargetTaskActualsCoverage,
} from "./target-actuals-analysis.js";
import {
  TARGET_GRAMMAR_5_CAPABILITY,
} from "../parser/document-parser.js";

export interface AnalysisResultV4
  extends Omit<AnalysisResult, "precedence" | "resource"> {
  readonly schemaVersion:
    typeof TARGET_ACTUALS_ANALYSIS_RESULT_SCHEMA_VERSION;
  readonly grammarVersion: number | null;
  readonly taskActuals: readonly TargetTaskActualsCoverage[];
  readonly precedence: TargetActualsPrecedenceResult | null;
  readonly resource: TargetActualsResourceScheduleResult | null;
  readonly temporal: TargetActualsTemporalAnalysis | null;
}

export interface NextResultV5Failure
  extends Omit<NextResultV3, "groups"> {
  readonly schemaVersion: typeof TARGET_ACTUALS_NEXT_RESULT_SCHEMA_VERSION;
  readonly grammarVersion: number | null;
  readonly temporal: null;
  readonly groups: NextGroups & {
    readonly suspended: readonly string[];
  };
}

export type NextResultV5 = TargetActualsNextResultV5 | NextResultV5Failure;

export function analyzeDocument(
  text: string,
  options: AnalyzeOptions = {},
): AnalysisResultV4 {
  const target = analyzeTargetActualsDocument(
    text,
    TARGET_GRAMMAR_5_CAPABILITY,
    options,
  );
  if (target.ok && target.base !== null) {
    return Object.freeze({
      ...target.base,
      schemaVersion: TARGET_ACTUALS_ANALYSIS_RESULT_SCHEMA_VERSION,
      grammarVersion: target.grammarVersion,
      taskActuals: target.taskActuals,
      precedence: target.precedence,
      resource: target.resource,
      temporal: target.temporal,
      diagnostics: target.diagnostics,
      diagnosticsTruncated: target.diagnosticsTruncated,
    });
  }
  const base = analyzeBaseDocument(text, options);
  return Object.freeze({
    ...base,
    schemaVersion: TARGET_ACTUALS_ANALYSIS_RESULT_SCHEMA_VERSION,
    grammarVersion: target.grammarVersion,
    taskActuals: Object.freeze([]),
    precedence: null,
    resource: null,
    temporal: null,
    diagnostics: target.diagnostics,
    diagnosticsTruncated: target.diagnosticsTruncated,
  });
}

export function selectNextTasks(
  text: string,
  options: NextOptions = {},
): NextResultV5 {
  const target = selectTargetActualsTasks(
    text,
    TARGET_GRAMMAR_5_CAPABILITY,
    options,
  );
  if ("recommendation" in target) return target;

  const base = selectBaseNextTasks(text, options);
  return Object.freeze({
    ...base,
    schemaVersion: TARGET_ACTUALS_NEXT_RESULT_SCHEMA_VERSION,
    grammarVersion: target.grammarVersion,
    groups: Object.freeze({
      ...base.groups,
      suspended: Object.freeze([]),
    }),
    temporal: null,
    diagnostics: target.diagnostics,
    diagnosticsTruncated: target.diagnosticsTruncated,
  });
}

export type {
  TargetActualsAnalysisResultV4,
  TargetActualsNextResultV5,
  TargetActualsPrecedenceResult,
  TargetActualsResourceScheduleResult,
  TargetActualsTemporalAnalysis,
  TargetTaskActualsCoverage,
};
