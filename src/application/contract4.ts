import {
  analyzeDocument as analyzeBaseDocument,
  type AnalysisResult,
  type AnalyzeOptions,
} from "./analyze.js";
import {
  selectNextTasks as selectBaseNextTasks,
  type NextOptions,
  type NextResultV3,
} from "./next.js";
import {
  analyzeTargetTemporalDocument,
  selectTargetTemporalTasks,
  TARGET_ANALYSIS_RESULT_SCHEMA_VERSION,
  TARGET_NEXT_RESULT_SCHEMA_VERSION,
  type TargetNextResultV4,
  type TargetTemporalAnalysis,
} from "./target-temporal-analysis.js";
import {
  TARGET_GRAMMAR_4_CAPABILITY,
} from "../parser/document-parser.js";

export interface AnalysisResultV3 extends AnalysisResult {
  readonly schemaVersion: typeof TARGET_ANALYSIS_RESULT_SCHEMA_VERSION;
  readonly grammarVersion: number | null;
  readonly temporal: TargetTemporalAnalysis | null;
}

export interface NextResultV4Failure extends NextResultV3 {
  readonly schemaVersion: typeof TARGET_NEXT_RESULT_SCHEMA_VERSION;
  readonly grammarVersion: number | null;
  readonly temporal: null;
}

export type NextResultV4 = TargetNextResultV4 | NextResultV4Failure;

export function analyzeDocument(
  text: string,
  options: AnalyzeOptions = {},
): AnalysisResultV3 {
  const base = analyzeBaseDocument(text, options);
  const target = analyzeTargetTemporalDocument(
    text,
    TARGET_GRAMMAR_4_CAPABILITY,
    options,
  );
  return Object.freeze({
    ...base,
    schemaVersion: TARGET_ANALYSIS_RESULT_SCHEMA_VERSION,
    grammarVersion: target.grammarVersion,
    temporal: target.ok ? target.temporal : null,
  });
}

export function selectNextTasks(
  text: string,
  options: NextOptions = {},
): NextResultV4 {
  const target = selectTargetTemporalTasks(
    text,
    TARGET_GRAMMAR_4_CAPABILITY,
    options,
  );
  if ("recommendation" in target) return target;

  const base = selectBaseNextTasks(text, options);
  return Object.freeze({
    ...base,
    schemaVersion: TARGET_NEXT_RESULT_SCHEMA_VERSION,
    grammarVersion: target.grammarVersion,
    temporal: null,
  });
}
