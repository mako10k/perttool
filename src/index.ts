// R: Expose the supported public package contract through one root facade.
export {
  analyzeDocument,
  checkDocument,
} from "./application/contract11-runtime.js";
export { selectNextTasks } from "./application/contract12-next.js";
export {
  getProjectMetadata,
  inspectPlanAssurance,
  planAssuranceMutation,
  planBatchMutation,
  planFinishActuals,
  planFormat,
  planLifecycle as planLifecycleMutation,
  planMutation,
  planUnitMigration,
} from "./application/contract10-runtime.js";
export { planReviewProjection } from "./application/contract11-runtime.js";
export { planContract11GrammarMigration } from "./application/contract11-migration.js";
export { planPlanReviewCreate, planPlanReviewResolve, planPlanReviewBatchMutation } from "./application/plan-review-mutation.js";
export { persistPlanReviewMutation } from "./plan-review/write.js";
export { parsePlanReviewSource, PLAN_REVIEW_SOURCE_CAPABILITY } from "./plan-review/source.js";
export { formatPlanReviewSource } from "./plan-review/format.js";
export { projectPlanReviewState } from "./plan-review/projection.js";
export { PLAN_REVIEW_BASIS_ID, projectPlanReviewBasis, digestPlanReviewBasis } from "./plan-review/basis.js";
export { PLAN_REVIEW_CREATE_REQUEST_ID, PLAN_REVIEW_RESOLVE_REQUEST_ID, PLAN_REVIEW_AUTHORITY_ID } from "./plan-review/mutation-types.js";
export type { PlanReviewCreateRequestV1, PlanReviewResolveRequestV1, PlanReviewMutationCoreResult } from "./plan-review/mutation-types.js";
export type { PlanReviewBasisV1 } from "./plan-review/basis.js";
export type { PlanReviewRequestSource, PlanReviewProjectionV1 } from "./plan-review/source-types.js";
export type { Contract11NextResult as NextResultV9 } from "./application/contract11-runtime.js";
export type { NextResultV10, NextResultV10 as NextResult, NextTaskV10, NextTaskV10 as NextTask, NextGroupsV10, NextGroupsV10 as NextGroups } from "./application/contract12-next.js";
export type { RecommendationAnalysisV2, RecommendationAnalysisV2 as RecommendationAnalysis, MaximumCountStartAuthority, DispatchSelectionEvidence } from "./recommendation/maximum-count-contract.js";
export {
  planMilestoneAcceptanceMigration,
  recheckCommittedMigrationProof,
} from "./milestone-acceptance/migration.js";
export {
  persistMilestoneAcceptanceMutation,
  planAcceptanceReceiptMutation,
  planCriterionSetReplacement,
  showMilestoneAcceptance,
} from "./milestone-acceptance/mutation.js";
export { planMilestoneAcceptanceAdvance } from "./milestone-acceptance/advance.js";
export const ADVANCE_RESULT_SCHEMA_VERSION = "Perttool.AdvanceResult.v4" as const;
export { createNodeHost } from "./node/host.js";
export { getAgentHelp } from "./application/agent-help.js";
export {
  planProjectInit,
  projectInitResultToJson,
  renderProjectInitResult,
  serializeProjectInitResult,
  withProjectInitOutput,
} from "./application/init.js";
export { recommendationAnalysisToJson } from "./recommendation/json.js";
export {
  canonicalOverrideArtifact,
  humanOverrideDecisionToJson,
  overrideValidationResultToJson,
  validateOverride,
} from "./recommendation/override-dispatch.js";
export {
  planAdvance,
} from "./application/contract7-mutation.js";
export {
  PLAN_ASSURANCE_INSPECTION_CLI_CONTRACT_VERSION,
  PLAN_ASSURANCE_RESULT_SCHEMA_VERSION,
} from "./application/target-assurance-inspection.js";
export {
  withUnitMigrationWrite,
} from "./application/contract7-unit-migration.js";
export {
  exportMermaid,
  importMermaid,
} from "./application/contract7-mermaid.js";
export { buildResidualGraph, computeEffectiveReached } from "./analysis/graph.js";
export { analyzePrecedence } from "./analysis/precedence.js";
export { analyzeResources } from "./analysis/resource.js";
export { getHelp } from "./help/registry.js";
export {
  commandOptionSets,
  getAgentHelpCommandHelp,
} from "./command/registry.js";
export {
  CONTRACT12_COMMAND_REGISTRY as COMMAND_REGISTRY,
  contract12CommandDescriptorToJson as commandDescriptorToJson,
  contract12CommandHelpResultToJson as commandHelpResultToJson,
  contract12CommandRegistryToJson as commandRegistryToJson,
  getContract12CommandDiscovery as getCommandDiscovery,
  renderContract12CommandHelpResult as renderCommandHelpResult,
  serializeContract12CommandHelpResult as serializeCommandHelpResult,
} from "./command/contract12-discovery.js";
export {
  contract12CommandUsageErrorToJson as commandUsageErrorToJson,
  renderContract12CommandUsageError as renderCommandUsageError,
  serializeContract12CommandUsageError as serializeCommandUsageError,
  validateContract12CommandInvocation as validateCommandInvocation,
} from "./command/contract12-usage.js";
export {
  contract12GuideResultToJson as guideResultToJson,
  getContract12Guide as getGuide,
  renderContract12GuideResult as renderGuideResult,
  serializeContract12GuideResult as serializeGuideResult,
} from "./help/contract12-guide.js";
export {
  getJsonSchema,
  getJsonSchemaCatalog,
  getJsonSchemaResult,
  jsonSchemaResultToJson,
  JSON_SCHEMA_DIALECT,
  JSON_SCHEMA_RESULT_SCHEMA_VERSION,
  renderJsonSchemaResult,
  serializeJsonSchemaResult,
} from "./schema/registry.js";
export type {
  JsonSchemaCatalogEntry,
  JsonSchemaDiagnostic,
  JsonSchemaIdentityDiagnostic,
  JsonSchemaReferenceDiagnostic,
  JsonSchemaResult,
  JsonSchemaResultOptions,
  JsonSchemaView,
} from "./schema/registry.js";
export type {
  BundledArtifactSourcePort,
  DigestPort,
  DocumentByteSourcePort,
  GitEvidencePort,
  NodeHostPorts,
  ProcessContextPort,
  SafePersistencePort,
  Sha256Digest,
} from "./ports/node-host.js";
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
  Contract12CommandDescriptor as CommandDescriptor,
  Contract12CommandDescriptor as ProjectedCommandDescriptor,
  Contract12CommandHelpResult as CommandHelpResult,
} from "./command/contract12-discovery.js";
export type {
  TargetGovernanceOptionDescriptor as OptionDescriptor,
} from "./command/target-governance-discovery.js";
export type {
  Contract12CommandInvocationValidation as CommandInvocationValidation,
  Contract12InvalidCommandInvocation as InvalidCommandInvocation,
  Contract12ValidCommandInvocation as ValidCommandInvocation,
} from "./command/contract12-usage.js";
export type {
  Contract12GuideResult as GuideResult,
} from "./help/contract12-guide.js";
export {
  beginPlanningPoolReshapeCommit,
  inspectPlanningPool,
  observeCurrentPlanningPool,
  planPlanningWindowMutation,
  preflightPlanningPoolReshape,
  preparePlanningPoolReshapeApply,
  recoverPlanningPoolReshapeCommit,
  settlePlanningPoolReshapeCommit,
} from "./application/contract10-planning.js";
export { observeHistoricalPlanningPool } from "./application/contract10-planning-history.js";
export { PlanningReshapeTokenRegistry } from "./planning-pool/reshape-token.js";
export type {
  PlanningMutationOptions,
  PlanningPoolReadOperation,
  PlanningPoolReadQuery,
  PlanningPoolReadResult,
  PlanningReshapeApplicationResult,
} from "./application/contract10-planning.js";
export type {
  PlanningObservationRequest,
  PlanningPoolObservationResult,
} from "./planning-pool/observation-types.js";
export type {
  PlanningPoolHistoricalObservationResult,
} from "./planning-pool/history-types.js";
export type {
  PlanningReshapeRequest,
  PlanningReshapePreflightResult,
  PlanningWorkTitleDisposition,
} from "./planning-pool/reshape-types.js";
export type {
  PlanningIntentAction,
  PlanningIntentRequest,
} from "./planning-pool/intent-types.js";
export type {
  PlanningWindowMutationRequest,
  PlanningWindowMutationAuditResult,
} from "./planning-pool/window-types.js";
export type {
  PlanningPoolSourceModel as PlanningPoolModelV1,
} from "./planning-pool/source-types.js";
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
export {
  formatDocument,
  parseDocument,
  validateDocument,
} from "./application/contract7-source.js";
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
export { GOVERNANCE_DIRECT_EDIT_WARNING } from "./governance/guidance.js";
export type {
  AdvanceResultV3 as AdvanceResult,
  AdvanceResultV3,
  LifecycleResultV5 as LifecycleResult,
  LifecycleResultV5,
} from "./application/contract8-milestone-acceptance.js";
export type {
  Contract9AnalysisResult as AnalysisResult,
  Contract9AnalysisResult as AnalysisResultV7,
  Contract9CheckResult as CheckResult,
  Contract9CheckResult as CheckResultV6,
  Contract9NextResult as NextResultV8,
} from "./application/contract9-temporal.js";
export type {
  Contract9MutationResultV6 as MutationResult,
  Contract9MutationResultV6 as MutationResultV6,
} from "./application/contract9-mixed-mutation.js";
export type {
  CheckOptions,
  CheckSummary,
  MilestoneDeadlineInput,
  TaskTemporalConstraint,
  TemporalInputs,
} from "./application/check.js";
export type {
  ProjectMetadata,
  ProjectMetadataDurationUnit,
  ProjectMetadataResult,
} from "./application/contract7-project.js";
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
  MermaidExportResult,
  MermaidProfile,
} from "./conversion/mermaid.js";
export type {
  Contract7MermaidExportOptions as MermaidExportOptions,
} from "./application/contract7-mermaid.js";
export type {
  GeneratedId,
  MermaidImportOptions,
  MermaidImportResult,
} from "./conversion/mermaid-import.js";
export type {
  FormatPreviewOptions,
} from "./application/format.js";
export type {
  FormatPreviewResultV7 as FormatPreviewResult,
} from "./application/contract7-source.js";
export type {
  AnalysisMode,
  AnalyzeOptions,
} from "./application/analyze.js";
export type {
  ExplanationNode,
  NextGroups as NextGroupsV3,
  NextOptions,
  NextResultV3,
  NextTask as NextTaskV3,
  ResourceRejection,
  TaskClassification,
  UnsatisfiedEdgeExplanation,
} from "./application/next.js";
export type {
  AnalysisResultV5,
  Contract7NextResultV6,
  NextResultV6,
} from "./application/contract7-assurance.js";
export type {
  RecommendationAnalysis as RecommendationAnalysisV1,
  RecommendationComparison as RecommendationComparisonV1,
  RecommendationComparisonScope as RecommendationComparisonScopeV1,
  RecommendationDecisionPhase as RecommendationDecisionPhaseV1,
  RecommendationDecisionRole,
  RecommendationDecisionStep as RecommendationDecisionStepV1,
  RecommendationDescription as RecommendationDescriptionV1,
  RecommendationDescriptionParameter,
  RecommendationEntityKind,
  RecommendationEntityReference,
  RecommendationExplanationStatus,
  RecommendationExplanationTaskDecision as RecommendationExplanationTaskDecisionV1,
  RecommendationExpression,
  RecommendationExpressionTerm,
  RecommendationFact,
  RecommendationProvenance,
  RecommendationProvenanceKind,
  RecommendationReasonCode as RecommendationReasonCodeV1,
  RecommendationReasonEffect,
  RecommendationReasonOccurrence as RecommendationReasonOccurrenceV1,
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
  RecommendationTier as RecommendationTierV1,
} from "./recommendation/types.js";
export type {
  HumanOverrideDecision as HumanOverrideDecisionV1,
  HumanOverrideReasonCode,
  OverrideActor,
  OverrideDecisionSource as OverrideDecisionSourceV1,
  OverrideEvidenceKind,
  OverrideEvidenceReference,
  OverrideFeasibility,
  OverrideReason,
  OverrideRequest as OverrideRequestV1,
  OverrideResourceWitness,
  OverrideSelection,
  OverrideTaskDecision,
  OverrideTriggerCode,
  OverrideValidationResult as OverrideValidationResultV1,
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
  AdvanceResultV2,
  LifecycleResultV4,
  MutationResultV4,
} from "./application/contract7-mutation.js";
export type {
  PlanAssuranceHashKind,
  PlanAssuranceInspectionRequest,
  TargetPlanAssuranceInspectionResultV1 as PlanAssuranceResultV1,
} from "./application/target-assurance-inspection.js";
export type {
  PlanAssuranceMutation,
  PlanAssuranceMutationOptions,
  PlanAssuranceImpactV1,
} from "./assurance/mutation.js";
export type {
  PlanAssuranceProjectionV1,
  PlanAssuranceStartAuthorityV1,
  PlanAssuranceStateCountsV1,
} from "./assurance/authority.js";
export type {
  AdvanceHistoryGuardCause,
  AdvanceHistoryGuardStatus,
  AdvanceHistoryGuardV1,
  AdvanceResultV1,
} from "./application/advance-history.js";
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
  GovernanceDenialCause,
  GovernancePersistenceIntent,
  GovernanceRequest,
  GovernanceRequestInput,
  GovernanceScope,
  GovernanceScopeDecision,
} from "./governance/types.js";
export type {
  PlanAssuranceGovernanceDecisionV2 as GovernanceDecisionV2,
  PlanAssuranceGovernanceDecisionV2 as GovernanceDecision,
  PlanAssuranceGovernanceScope,
} from "./assurance/governance.js";
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
} from "./application/contract7-unit-migration.js";
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

export type {
  OverrideRequestAny as OverrideRequest, OverrideRequestV2,
  OverrideDecisionV2, OverrideValidationResultAny as OverrideValidationResult,
  OverrideValidationResultV2,
} from "./recommendation/maximum-count-override-types.js";
export type HumanOverrideDecision = import("./recommendation/override-types.js").HumanOverrideDecision
  | import("./recommendation/maximum-count-override-types.js").OverrideDecisionV2;

export type {
  DispatchComparison as RecommendationComparison,
  DispatchDecisionStep as RecommendationDecisionStep,
  DispatchDescription as RecommendationDescription,
  DispatchTaskDecision as RecommendationExplanationTaskDecision,
  DispatchReasonCode as RecommendationReasonCode,
  DispatchReasonOccurrence as RecommendationReasonOccurrence,
} from "./recommendation/maximum-count-contract.js";
export type RecommendationComparisonScope = import("./recommendation/maximum-count-contract.js").DispatchComparison["scope"];
export type RecommendationDecisionPhase = import("./recommendation/maximum-count-contract.js").DispatchDecisionStep["phase"];
export type RecommendationTier = import("./recommendation/maximum-count-contract.js").DispatchTaskDecision["tier"];

export type OverrideDecisionSource = import("./recommendation/override-types.js").OverrideDecisionSource
  | import("./recommendation/maximum-count-override-types.js").OverrideDecisionV2["source"];
