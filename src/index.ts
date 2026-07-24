export { checkDocument } from "./application/check.js";
export { analyzeDocument } from "./application/analyze.js";
export { getAgentHelp } from "./application/agent-help.js";
export { getProjectMetadata } from "./application/project.js";
export {
  planProjectInit,
  projectInitResultToJson,
  renderProjectInitResult,
  serializeProjectInitResult,
  withProjectInitOutput,
} from "./application/init.js";
export { planFormat } from "./application/format.js";
export { selectNextTasks } from "./application/next.js";
export { recommendationAnalysisToJson } from "./recommendation/json.js";
export {
  canonicalOverrideArtifact,
  humanOverrideDecisionToJson,
  overrideValidationResultToJson,
  validateOverride,
} from "./recommendation/override.js";
export { planMutation } from "./application/mutate.js";
export { planAdvance } from "./mutation/advance.js";
export { exportMermaid } from "./conversion/mermaid.js";
export { importMermaid } from "./conversion/mermaid-import.js";
export { buildResidualGraph, computeEffectiveReached } from "./analysis/graph.js";
export { analyzePrecedence } from "./analysis/precedence.js";
export { analyzeResources } from "./analysis/resource.js";
export { getHelp } from "./help/registry.js";
export {
  COMMAND_REGISTRY,
  commandDescriptorToJson,
  commandOptionSets,
  commandRegistryToJson,
  getAgentHelpCommandHelp,
  getCommandDescriptor,
  getCommandDescriptorByOperation,
  renderCommandHelp,
  renderTopLevelHelp,
} from "./command/registry.js";
export type {
  CommandDescriptor,
  CommandExample,
  CommandHandler,
  CommandOutputDescriptor,
  ExitStatusDescriptor,
  OperandDescriptor,
  OptionDescriptor,
  SharedOptionGroup,
} from "./command/registry.js";
export {
  getAgentGuidance,
  getBundledAgentGuidance,
} from "./guidance/query.js";
export {
  agentGuidanceResultToJson,
  serializeAgentGuidanceResult,
} from "./guidance/projection.js";
export {
  agentGuidanceExitCode,
  renderAgentGuidanceText,
} from "./guidance/text.js";
export {
  AGENT_GUIDANCE_GUIDANCE_REGISTRY_V1,
  AGENT_GUIDANCE_PROFILE_V1,
  AGENT_GUIDANCE_RISK_REGISTRY_V1,
  AGENT_GUIDANCE_SNAPSHOT_V1,
} from "./guidance/profile.js";
export {
  agentGuidanceProfileToJson,
  createAgentGuidanceProfileSnapshot,
  digestAgentGuidanceProfile,
  serializeAgentGuidanceProfile,
  validateAgentGuidanceProfile,
} from "./guidance/validator.js";
export { formatDocument } from "./formatter/source-formatter.js";
export {
  digestDocumentBytes,
  documentContentFromBytes,
  readDocumentFile,
} from "./io/document-file.js";
export {
  createArtifactFile,
  createDocumentFile,
  replaceDocumentFile,
  SafeWriteConflictError,
  SafeWriteVerificationError,
} from "./io/safe-write.js";
export {
  DEFAULT_MAX_DIAGNOSTICS,
  MAX_DIAGNOSTICS_LIMIT,
} from "./model/diagnostics.js";
export * from "./model/rational.js";
export * from "./model/units.js";
export { parseDocument } from "./parser/document-parser.js";
export { validateDocument } from "./semantic/validator.js";
export type { CheckOptions, CheckResult, CheckSummary } from "./application/check.js";
export type {
  ProjectMetadata,
  ProjectMetadataDurationUnit,
  ProjectMetadataResult,
} from "./application/project.js";
export type {
  ProjectInitDurationUnit,
  ProjectInitRequest,
  ProjectInitResult,
  ProjectInitWrite,
} from "./application/init.js";
export {
  AGENT_GUIDANCE_DIRECTIVES,
  AGENT_GUIDANCE_ORIGINS,
  AGENT_GUIDANCE_PROVIDER_IDS,
  AGENT_GUIDANCE_RISK_KINDS,
  AGENT_GUIDANCE_SCOPE_IDS,
  AGENT_GUIDANCE_SUPPORT_STATUSES,
  AGENT_GUIDANCE_SURFACE_IDS,
} from "./guidance/types.js";
export type {
  AgentGuidanceAlias,
  AgentGuidanceArtifact,
  AgentGuidanceArtifactProfile,
  AgentGuidanceArtifactResolution,
  AgentGuidanceCapabilities,
  AgentGuidanceDiagnostic,
  AgentGuidanceDirective,
  AgentGuidanceEvidenceKind,
  AgentGuidanceLevel,
  AgentGuidanceOrigin,
  AgentGuidanceProfile,
  AgentGuidanceProfileSnapshot,
  AgentGuidanceProfileValidationResult,
  AgentGuidanceProjectedStatusEvidence,
  AgentGuidanceProvider,
  AgentGuidanceProviderId,
  AgentGuidanceProviderProfile,
  AgentGuidanceQuery,
  AgentGuidanceQueryProjection,
  AgentGuidanceRecord,
  AgentGuidanceRecordProfile,
  AgentGuidanceResult,
  AgentGuidanceRisk,
  AgentGuidanceRiskKind,
  AgentGuidanceRiskProfile,
  AgentGuidanceScopeId,
  AgentGuidanceSource,
  AgentGuidanceSourceProfile,
  AgentGuidanceStaleness,
  AgentGuidanceStalenessStatus,
  AgentGuidanceStatusEvidence,
  AgentGuidanceSupportStatus,
  AgentGuidanceSurface,
  AgentGuidanceSurfaceId,
  AgentGuidanceSurfaceProfile,
  GuidanceDescription,
  GuidanceDescriptionParameter,
} from "./guidance/types.js";
export type {
  ConversionLoss,
  ConversionLossReport,
  MermaidAnalysisMode,
  MermaidExportOptions,
  MermaidExportResult,
  MermaidProfile,
} from "./conversion/mermaid.js";
export type {
  GeneratedId,
  MermaidImportOptions,
  MermaidImportResult,
} from "./conversion/mermaid-import.js";
export type {
  FormatPreviewOptions,
  FormatPreviewResult,
} from "./application/format.js";
export type {
  AnalysisMode,
  AnalysisResult,
  AnalyzeOptions,
} from "./application/analyze.js";
export type {
  ExplanationNode,
  NextGroups,
  NextOptions,
  NextResult,
  NextResultV3,
  NextTask,
  ResourceRejection,
  TaskClassification,
  UnsatisfiedEdgeExplanation,
} from "./application/next.js";
export type {
  RecommendationAnalysis,
  RecommendationComparison,
  RecommendationComparisonScope,
  RecommendationDecisionPhase,
  RecommendationDecisionRole,
  RecommendationDecisionStep,
  RecommendationDescription,
  RecommendationDescriptionParameter,
  RecommendationEntityKind,
  RecommendationEntityReference,
  RecommendationExplanationStatus,
  RecommendationExplanationTaskDecision,
  RecommendationExpression,
  RecommendationExpressionTerm,
  RecommendationFact,
  RecommendationProvenance,
  RecommendationProvenanceKind,
  RecommendationReasonCode,
  RecommendationReasonEffect,
  RecommendationReasonOccurrence,
  RecommendationRelation,
  RecommendationResultDecision,
  RecommendationScalarValue,
  RecommendationUnit,
  RecommendationValue,
} from "./recommendation/explanation-types.js";
export type {
  RecommendationCriticalClass,
  RecommendationDistance,
  RecommendationRankingRuleId,
  RecommendationTier,
} from "./recommendation/types.js";
export type {
  HumanOverrideDecision,
  HumanOverrideReasonCode,
  OverrideActor,
  OverrideDecisionSource,
  OverrideEvidenceKind,
  OverrideEvidenceReference,
  OverrideFeasibility,
  OverrideReason,
  OverrideRequest,
  OverrideResourceWitness,
  OverrideSelection,
  OverrideTaskDecision,
  OverrideTriggerCode,
  OverrideValidationResult,
} from "./recommendation/override-types.js";
export type {
  AnalysisEdge,
  AnalysisResource,
  ResidualGraph,
  TaskStatus,
} from "./analysis/graph.js";
export type {
  CriticalPath,
  CriticalResult,
  EdgeTiming,
  MilestoneTiming,
  PrecedenceResult,
} from "./analysis/precedence.js";
export type {
  ResourceArc,
  ResourceCapacity,
  ResourceScheduleResult,
  ResourceStatistic,
  ResourceTimelineEntry,
  ScheduleCriticalResult,
  ScheduledTask,
  SchedulePath,
} from "./analysis/resource.js";
export type {
  Diagnostic,
  DiagnosticCounts,
  SourcePosition,
  SourceSpan,
} from "./model/diagnostics.js";
export type {
  DocumentNode,
  DeclarationNode,
  FieldNode,
  TriviaNode,
  VelocityValue,
} from "./model/syntax.js";
export type { ParseOptions } from "./parser/document-parser.js";
export type {
  FormatOptions,
  FormatResult,
} from "./formatter/source-formatter.js";
export type { TextEdit } from "./mutation/text-edits.js";
export type {
  AdvanceDetails,
  AdvanceResult,
  AdvanceRetainedEdge,
  AdvanceRetentionReason,
} from "./mutation/advance.js";
export type { DocumentContent } from "./io/document-file.js";
export type {
  CreateArtifactOptions,
  CreateDocumentOptions,
  DocumentWriteResult,
  ReplaceDocumentOptions,
  SafeWriteConflictReason,
  SafeWriteVerificationReason,
} from "./io/safe-write.js";
export type {
  AddGateMutation,
  AddMilestoneMutation,
  AddResourceMutation,
  AddTaskMutation,
  AtomicMutation,
  BatchMutation,
  FinishTaskMutation,
  GateDefinition,
  GateFieldSet,
  GateMutation,
  MilestoneClearableField,
  MilestoneDefinition,
  MilestoneFieldSet,
  MilestoneMutation,
  MilestoneMutationState,
  Mutation,
  MutationOptions,
  MutationResult,
  RemoveMilestoneMutation,
  RemoveGateMutation,
  RemoveResourceMutation,
  RemoveTaskMutation,
  ProjectClearableField,
  ProjectDurationUnit,
  ProjectFieldSet,
  ProjectMutation,
  ResourceClearableField,
  ResourceDefinition,
  ResourceFieldSet,
  ResourceMutation,
  SetMilestoneMutation,
  SetGateMutation,
  SetProjectMutation,
  SetResourceMutation,
  SetTaskMutation,
  TaskClearableField,
  TaskDefinition,
  TaskEstimateInput,
  TaskFieldSet,
  TaskMutation,
  TaskMutationStatus,
  TaskRequirementInput,
} from "./mutation/types.js";
