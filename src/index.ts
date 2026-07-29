export { checkDocument } from "./application/check.js";
export {
  analyzeDocument,
  selectNextTasks,
} from "./application/contract6-actuals.js";
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
export { recommendationAnalysisToJson } from "./recommendation/json.js";
export {
  canonicalOverrideArtifact,
  humanOverrideDecisionToJson,
  overrideValidationResultToJson,
  validateOverride,
} from "./recommendation/override.js";
export {
  planAdvance,
  planBatchMutation,
  planFinishActuals,
  planLifecycle as planLifecycleMutation,
  planMutation,
} from "./application/contract6-mutation.js";
export {
  planUnitMigration,
  withUnitMigrationWrite,
} from "./application/unit-migration.js";
export { exportMermaid } from "./conversion/mermaid.js";
export { importMermaid } from "./conversion/mermaid-import.js";
export { buildResidualGraph, computeEffectiveReached } from "./analysis/graph.js";
export { analyzePrecedence } from "./analysis/precedence.js";
export { analyzeResources } from "./analysis/resource.js";
export { getHelp } from "./help/registry.js";
export {
  commandOptionSets,
  getAgentHelpCommandHelp,
} from "./command/registry.js";
export {
  ACTUALS_COMMAND_REGISTRY as COMMAND_REGISTRY,
  actualsCommandDescriptorToJson as commandDescriptorToJson,
  actualsCommandHelpResultToJson as commandHelpResultToJson,
  actualsCommandRegistryToJson as commandRegistryToJson,
  getActualsCommandDiscovery as getCommandDiscovery,
  renderActualsCommandHelpResult as renderCommandHelpResult,
  serializeActualsCommandHelpResult as serializeCommandHelpResult,
} from "./command/actuals-discovery.js";
export {
  actualsCommandUsageErrorToJson as commandUsageErrorToJson,
  renderActualsCommandUsageError as renderCommandUsageError,
  serializeActualsCommandUsageError as serializeCommandUsageError,
  validateActualsCommandInvocation as validateCommandInvocation,
} from "./command/actuals-usage.js";
export {
  actualsGuideResultToJson as guideResultToJson,
  getActualsGuide as getGuide,
  renderActualsGuideResult as renderGuideResult,
  serializeActualsGuideResult as serializeGuideResult,
} from "./help/actuals-guide.js";
export type {
  CommandExample,
  CommandHandler,
  CommandOutputDescriptor,
  ExitStatusDescriptor,
  OperandDescriptor,
  SharedOptionGroup,
} from "./command/registry.js";
export type {
  CommandHelpQuery,
  CommandResourceSummary,
} from "./command/discovery.js";
export type {
  CommandHelpTarget,
  CommandOptionOccurrence,
  CommandUsageError,
  CommandUsageErrorKind,
  CommandUsageSuggestion,
  CommandUsageSuggestionKind,
} from "./command/usage.js";
export type {
  ActualsCommandDescriptor as CommandDescriptor,
  ActualsCommandDescriptor as ProjectedCommandDescriptor,
  ActualsCommandHelpResult as CommandHelpResult,
} from "./command/actuals-discovery.js";
export type {
  TargetGovernanceOptionDescriptor as OptionDescriptor,
} from "./command/target-governance-discovery.js";
export type {
  ActualsCommandInvocationValidation as CommandInvocationValidation,
  ActualsInvalidCommandInvocation as InvalidCommandInvocation,
  ActualsValidCommandInvocation as ValidCommandInvocation,
} from "./command/actuals-usage.js";
export type {
  ActualsGuideResult as GuideResult,
} from "./help/actuals-guide.js";
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
export { GOVERNANCE_DIRECT_EDIT_WARNING } from "./governance/guidance.js";
export type {
  CheckOptions,
  CheckResult,
  CheckSummary,
  MilestoneDeadlineInput,
  TaskTemporalConstraint,
  TemporalInputs,
} from "./application/check.js";
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
  AnalyzeOptions,
} from "./application/analyze.js";
export type {
  ExplanationNode,
  NextGroups,
  NextOptions,
  NextResultV3,
  NextTask,
  ResourceRejection,
  TaskClassification,
  UnsatisfiedEdgeExplanation,
} from "./application/next.js";
export type {
  AnalysisResultV4 as AnalysisResult,
  AnalysisResultV4,
  NextResultV5 as NextResult,
  NextResultV5,
} from "./application/contract6-actuals.js";
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
  AdvanceRetainedEdge,
  AdvanceRetentionReason,
} from "./mutation/advance.js";
export type {
  AdvanceResultV3 as AdvanceResult,
  AdvanceResultV3,
  LifecycleResultV3,
  MutationResultV3 as MutationResult,
  MutationResultV3,
} from "./application/contract6-mutation.js";
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
export type {
  GovernanceDecisionV1,
  GovernanceDenialCause,
  GovernancePersistenceIntent,
  GovernanceRequest,
  GovernanceRequestInput,
  GovernanceScope,
  GovernanceScopeDecision,
} from "./governance/types.js";
export type {
  DeclaredGovernance,
  EffectiveGovernance,
  GovernanceMetadata,
  GovernanceSourceSnapshot,
  PrincipalId,
} from "./governance/source.js";
export type {
  UnitMigrationConvertedField,
  UnitMigrationEffectiveVelocity,
  UnitMigrationExactValue,
  UnitMigrationOptions,
  UnitMigrationResult,
  UnitMigrationWrite,
} from "./application/unit-migration.js";
export type {
  UnitMigrationCause,
  UnitMigrationDiagnosticCode,
  UnitMigrationRequest,
  UnitMigrationUnavailableCause,
} from "./migration/request.js";
export {
  inspectProjectHistory,
} from "./history/project-history.js";
export {
  observeProjectVelocity,
} from "./history/velocity-observation.js";
export {
  inspectTargetProjectHistoryFile as inspectProjectHistoryFile,
  renderTargetProjectHistoryText as renderProjectHistoryText,
  targetProjectHistoryResultToJson as projectHistoryResultToJson,
} from "./application/target-project-history.js";
export {
  renderTargetVelocityObservationText as renderVelocityObservationText,
  targetVelocityObservationResultToJson as velocityObservationResultToJson,
} from "./application/target-velocity-observation.js";
export type {
  FinishActualsMutation,
  LifecycleEventInput,
  LifecycleMutation,
  ResumeActualsMutation,
  StartActualsMutation,
  SuspendActualsMutation,
  TaskLifecycleState,
} from "./actuals/lifecycle.js";
export type {
  HistoryRequest,
  ProjectHistoryCoreResult as ProjectHistoryResultV1,
} from "./history/project-history.js";
export type {
  PlanRevisionSnapshot,
} from "./history/git-probe.js";
export type {
  VelocityObservationCoreResult as VelocityObservationResultV1,
  VelocityObservationRequest,
} from "./history/velocity-observation.js";
