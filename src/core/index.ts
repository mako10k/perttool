export {
  formatDocument,
  parseDocument,
  validateDocument,
} from "./source.js";
export { buildResidualGraph, computeEffectiveReached } from "../analysis/graph.js";
export { analyzePrecedence } from "../analysis/precedence.js";
export { analyzeResources } from "../analysis/resource.js";
export { getHelp } from "../help/registry.js";
export {
  assuranceGuideResultToJson as guideResultToJson,
  getAssuranceGuide as getGuide,
  renderAssuranceGuideResult as renderGuideResult,
  serializeAssuranceGuideResult as serializeGuideResult,
} from "../help/assurance-guide.js";
export { recommendationAnalysisToJson } from "../recommendation/json.js";
export {
  DEFAULT_MAX_DIAGNOSTICS,
  MAX_DIAGNOSTICS_LIMIT,
  compareStableStrings,
  countDiagnostics,
  hasErrors,
  limitDiagnostics,
  normalizeMaxDiagnostics,
  sortDiagnostics,
} from "../model/diagnostics.js";
export * from "../model/rational.js";
export * from "../model/units.js";
export { GOVERNANCE_DIRECT_EDIT_WARNING } from "../governance/guidance.js";

export type {
  AnalysisEdge,
  AnalysisResource,
  ResidualGraph,
  TaskStatus,
} from "../analysis/graph.js";
export type {
  CriticalPath,
  CriticalResult,
  EdgeTiming,
  MilestoneTiming,
  PrecedenceResult,
} from "../analysis/precedence.js";
export type {
  ResourceArc,
  ResourceCapacity,
  ResourceScheduleResult,
  ResourceStatistic,
  ResourceTimelineEntry,
  ScheduleCriticalResult,
  ScheduledTask,
  SchedulePath,
} from "../analysis/resource.js";
export type {
  Diagnostic,
  DiagnosticCounts,
  SourcePosition,
  SourceSpan,
} from "../model/diagnostics.js";
export type {
  DeclarationNode,
  DocumentNode,
  FieldNode,
  ParseResult,
  TargetDeclarationKind,
  TriviaNode,
  VelocityValue,
} from "../model/syntax.js";
export type { ParseOptions } from "../parser/document-parser.js";
export type {
  FormatOptions,
  FormatResult,
} from "../formatter/source-formatter.js";
export type { TextEdit } from "../mutation/text-edits.js";
export type {
  HelpExample,
  HelpLevel,
  HelpNode,
  HelpResult,
  HelpSection,
} from "../help/registry.js";
export type {
  AssuranceGuideResult as GuideResult,
} from "../help/assurance-guide.js";
export type {
  RecommendationAnalysis,
  RecommendationComparison,
  RecommendationDecisionStep,
  RecommendationDescription,
  RecommendationExpression,
  RecommendationFact,
  RecommendationReasonOccurrence,
  RecommendationRelation,
  RecommendationResultDecision,
} from "../recommendation/explanation-types.js";
export type {
  CheckOptions as BaseCheckOptions,
  CheckResult as BaseCheckResult,
  CheckSummary,
  TemporalInputs,
} from "../semantic/check.js";
export type {
  AnalysisResult as BaseAnalysisResult,
  AnalyzeOptions as BaseAnalyzeOptions,
  AnalysisMode,
} from "../analysis/service.js";
export type {
  JsonSchemaCatalogEntry,
  JsonSchemaDiagnostic,
  JsonSchemaResult,
} from "../schema/registry.js";
export type {
  ProjectHistoryCoreResult as ProjectHistoryResult,
} from "../history/project-history.js";
export type {
  VelocityObservationCoreResult as VelocityObservationResult,
} from "../history/velocity-observation.js";
export type {
  PlanAssuranceGovernanceDecisionV2 as GovernanceDecision,
} from "../assurance/governance.js";
export type {
  PlanAssuranceProjectionV1,
  PlanAssuranceStartAuthorityV1,
  PlanAssuranceStateCountsV1,
} from "../assurance/authority.js";
