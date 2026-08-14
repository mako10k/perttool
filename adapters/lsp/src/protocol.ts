import type { Range } from "vscode-languageserver/node.js";
import type { Diagnostic } from "perttool/core";

export const EDITOR_PROTOCOL_MODEL_VERSION = 1 as const;
export const EDITOR_MUTATION_PROTOCOL_MODEL_VERSION = 2 as const;
export type EditorProtocolModelVersion =
  | typeof EDITOR_PROTOCOL_MODEL_VERSION
  | typeof EDITOR_MUTATION_PROTOCOL_MODEL_VERSION;
export const GRAPH_VIEW_SCHEMA_VERSION = "Perttool.GraphViewResult.v1" as const;
export const EDITOR_HELP_SCHEMA_VERSION = "Perttool.EditorHelpResult.v1" as const;
export const DAG_FOCUS_PROTOCOL_MODEL_VERSION = 1 as const;
export const DAG_FOCUS_SCHEMA_VERSION = "Perttool.DagFocusResult.v1" as const;
export const MILESTONE_ACCEPTANCE_EDITOR_PROTOCOL_MODEL_VERSION = 1 as const;
export const MILESTONE_ACCEPTANCE_VIEW_SCHEMA_VERSION =
  "Perttool.MilestoneAcceptanceViewResult.v1" as const;
export const HISTORICAL_EDITOR_PROTOCOL_MODEL_VERSION = 1 as const;
export const HISTORICAL_GRAPH_VIEW_SCHEMA_VERSION =
  "Perttool.HistoricalGraphViewResult.v1" as const;
export const HISTORICAL_SOURCE_SCHEMA_VERSION =
  "Perttool.HistoricalSourceResult.v1" as const;

export type HistoricalGraphView = "snapshot" | "lineage" | "timeline";
export type HistoricalGraphAncestryProfile = "first_parent" | "three_way";

export type GraphViewAnalysisMode =
  | "none"
  | "precedence"
  | "resource"
  | "both";

export interface PerttoolInitializationOptionsV1 {
  readonly perttool: {
    readonly editorProtocolModelVersions: readonly number[];
    readonly graphViewResultSchemaVersions: readonly [
      "Perttool.GraphViewResult.v1",
    ];
    readonly editorHelpResultSchemaVersions: readonly [
      "Perttool.EditorHelpResult.v1",
    ];
    readonly dagFocusProtocolModelVersions?: readonly [1];
    readonly dagFocusResultSchemaVersions?: readonly [
      "Perttool.DagFocusResult.v1",
    ];
    readonly milestoneAcceptanceEditorProtocolModelVersions?: readonly [1];
    readonly milestoneAcceptanceViewResultSchemaVersions?: readonly [
      "Perttool.MilestoneAcceptanceViewResult.v1",
    ];
    readonly historicalEditorProtocolModelVersions?: readonly [1];
    readonly historicalGraphViewResultSchemaVersions?: readonly [
      "Perttool.HistoricalGraphViewResult.v1",
    ];
    readonly historicalSourceResultSchemaVersions?: readonly [
      "Perttool.HistoricalSourceResult.v1",
    ];
    readonly historicalLocalRepository?: {
      readonly workspaceTrust: "trusted" | "untrusted";
      readonly workspaceFolderUris: readonly string[];
    };
  };
}

export interface PerttoolExperimentalCapabilitiesV1 {
  readonly perttool: {
    readonly editorProtocolModelVersion: EditorProtocolModelVersion;
    readonly graphViewResultSchemaVersion: "Perttool.GraphViewResult.v1";
    readonly editorHelpResultSchemaVersion: "Perttool.EditorHelpResult.v1";
    readonly graphViewAnalysisModes: readonly GraphViewAnalysisMode[];
    readonly dagFocusProtocolModelVersion?: 1;
    readonly dagFocusResultSchemaVersion?: "Perttool.DagFocusResult.v1";
    readonly milestoneAcceptanceEditorProtocolModelVersion?: 1;
    readonly milestoneAcceptanceViewResultSchemaVersion?:
      "Perttool.MilestoneAcceptanceViewResult.v1";
    readonly historicalEditorProtocolModelVersion?: 1;
    readonly historicalGraphViewResultSchemaVersion?:
      "Perttool.HistoricalGraphViewResult.v1";
    readonly historicalSourceResultSchemaVersion?:
      "Perttool.HistoricalSourceResult.v1";
    readonly historicalGraphViews?: readonly HistoricalGraphView[];
    readonly historicalAncestryProfiles?: readonly HistoricalGraphAncestryProfile[];
  };
}

export interface OpenHelpCommandArgsV1 {
  readonly documentUri: string;
  readonly documentGeneration: string;
  readonly documentVersion: number;
  readonly topicId: string;
}

export interface EditorHelpParamsV1 {
  readonly topicId: string;
  readonly level: "quick" | "detail";
}

export interface EditorHelpResultV1 {
  readonly schemaVersion: "Perttool.EditorHelpResult.v1";
  readonly editorProtocolModelVersion: 1;
  readonly status: "ok" | "not_found";
  readonly topicId: string;
  readonly level: "quick" | "detail";
  readonly content: { readonly kind: "markdown"; readonly value: string } | null;
  readonly relatedTopicIds: readonly string[];
}

export interface GraphViewParamsV1 {
  readonly textDocument: { readonly uri: string };
  readonly documentVersion: number;
  readonly analysisMode: GraphViewAnalysisMode;
}

export interface GraphViewExactValueV1 {
  readonly numerator: string;
  readonly denominator: string;
  readonly unit: string;
  readonly display: string;
}

export interface GraphViewDiagnosticV1 {
  readonly code: string;
  readonly severity: "error" | "warning" | "info";
  readonly message: string;
  readonly range: Range | null;
  readonly related: readonly {
    readonly uri: string;
    readonly range: Range;
    readonly message: string;
  }[];
  readonly helpTopic: string | null;
}

export interface GraphViewMilestoneV1 {
  readonly id: string;
  readonly title: string;
  readonly reached: boolean;
  readonly declarationRange: Range;
  readonly selectionRange: Range;
  readonly precedence: {
    readonly earliest: GraphViewExactValueV1;
    readonly latest: GraphViewExactValueV1;
    readonly slack: GraphViewExactValueV1;
    readonly critical: boolean;
  } | null;
}

export type GraphViewTaskStatus =
  | "planned"
  | "active"
  | "blocked"
  | "suspended"
  | "done";

export interface GraphViewEdgeV1 {
  readonly id: string;
  readonly kind: "task" | "gate";
  readonly sourceMilestoneId: string;
  readonly targetMilestoneId: string;
  readonly label: string;
  readonly status: GraphViewTaskStatus | null;
  readonly declarationRange: Range;
  readonly selectionRange: Range;
  readonly expected: GraphViewExactValueV1;
  readonly precedence: {
    readonly earliestStart: GraphViewExactValueV1;
    readonly earliestFinish: GraphViewExactValueV1;
    readonly latestStart: GraphViewExactValueV1;
    readonly latestFinish: GraphViewExactValueV1;
    readonly totalFloat: GraphViewExactValueV1;
    readonly freeFloat: GraphViewExactValueV1;
    readonly critical: boolean;
    readonly driving: boolean;
  } | null;
  readonly resource: {
    readonly scheduledStart: GraphViewExactValueV1;
    readonly scheduledFinish: GraphViewExactValueV1;
    readonly resourceDelay: GraphViewExactValueV1;
    readonly scheduleCritical: boolean;
  } | null;
}

export interface GraphViewGraphV1 {
  readonly projectId: string;
  readonly finishMilestoneId: string;
  readonly milestones: readonly GraphViewMilestoneV1[];
  readonly edges: readonly GraphViewEdgeV1[];
  readonly precedence: {
    readonly makespan: GraphViewExactValueV1;
    readonly criticalMilestoneIds: readonly string[];
    readonly criticalTaskIds: readonly string[];
    readonly criticalGateIds: readonly string[];
    readonly representativePathEdgeIds: readonly string[];
  } | null;
  readonly resource: {
    readonly algorithmId: "parallel-sgs";
    readonly algorithmVersion: 1;
    readonly optimal: false;
    readonly makespan: GraphViewExactValueV1;
    readonly resourceDelay: GraphViewExactValueV1;
    readonly scheduleCriticalTaskIds: readonly string[];
  } | null;
}

export interface GraphViewResultV1 {
  readonly schemaVersion: "Perttool.GraphViewResult.v1";
  readonly editorProtocolModelVersion: 1;
  readonly document: {
    readonly uri: string;
    readonly generation: string;
    readonly version: number;
    readonly sourceDigest: `sha256:${string}`;
  };
  readonly analysisMode: GraphViewAnalysisMode;
  readonly status: "current" | "invalid" | "unavailable";
  readonly complete: boolean;
  readonly diagnostics: {
    readonly items: readonly GraphViewDiagnosticV1[];
    readonly truncated: boolean;
  };
  readonly graph: GraphViewGraphV1 | null;
}

export interface DagFocusParamsV1 {
  readonly textDocument: { readonly uri: string };
  readonly documentVersion: number;
}

export interface DagFocusProjectionV1 {
  readonly frontierMilestoneIds: readonly string[];
  readonly activeTaskIds: readonly string[];
  readonly readyTaskIds: readonly string[];
  readonly recommendedTaskIds: readonly string[];
  readonly startableTaskIds: readonly string[];
  readonly safeStopReasons: readonly string[];
  readonly entities: readonly {
    readonly kind: "milestone" | "task" | "gate";
    readonly id: string;
    readonly compactId: string;
    readonly title: string;
    readonly description: string | null;
  }[];
  readonly timeSummary: {
    readonly residualTime: GraphViewExactValueV1;
    readonly remainingTime: GraphViewExactValueV1;
    readonly taskTimes: readonly {
      readonly taskId: string;
      readonly taskTime: GraphViewExactValueV1;
      readonly pointForecast: GraphViewExactValueV1 | null;
    }[];
    readonly pointConversion: {
      readonly status: "available" | "unavailable" | "not_applicable";
      readonly targetUnit: "day" | "hour" | null;
      readonly residualTime: GraphViewExactValueV1 | null;
      readonly remainingTime: GraphViewExactValueV1 | null;
      readonly reason: string | null;
    };
  };
}

export interface DagFocusResultV1 {
  readonly schemaVersion: typeof DAG_FOCUS_SCHEMA_VERSION;
  readonly dagFocusProtocolModelVersion: typeof DAG_FOCUS_PROTOCOL_MODEL_VERSION;
  readonly document: {
    readonly uri: string;
    readonly generation: string;
    readonly version: number;
    readonly sourceDigest: `sha256:${string}`;
  };
  readonly status: "current" | "invalid" | "unavailable";
  readonly complete: boolean;
  readonly reason: string | null;
  readonly focus: DagFocusProjectionV1 | null;
}

export interface MilestoneAcceptanceViewParamsV1 {
  readonly textDocument: { readonly uri: string };
  readonly documentVersion: number;
}

export interface MilestoneAcceptanceSourceBindingV1 {
  readonly bindingId: string;
  readonly declarationKind:
    | "milestone"
    | "milestone_criterion_set"
    | "criterion"
    | "milestone_acceptance_receipt"
    | "milestone_acceptance_migration";
  readonly sourceId: string;
  readonly ownerMilestoneId: string | null;
  readonly ownerCriterionId: string | null;
  readonly range: Range;
}

export interface MilestoneAcceptanceCriterionViewV1 {
  readonly criterionId: string;
  readonly description: string;
  readonly required: boolean;
  readonly evidenceKind: "test" | "command" | "artifact" | "observation" | "owner";
  readonly commitment: `sha256:${string}`;
  readonly state: "pending" | "satisfied" | "failed" | "unavailable" | "waived";
  readonly effectiveReceiptId: string | null;
  readonly evidenceReference: string | null;
  readonly evidenceRevision: string | null;
  readonly verifier: string | null;
  readonly assertedAt: string | null;
  readonly waiverReason: string | null;
  readonly revokedReceiptIds: readonly string[];
  readonly criterionBindingId: string;
  readonly effectiveReceiptBindingId: string | null;
  readonly revokedReceiptBindingIds: readonly string[];
}

export interface MilestoneAcceptanceMilestoneViewV1 {
  readonly milestoneId: string;
  readonly title: string;
  readonly closure: "unreached" | "reached";
  readonly acceptance:
    | "not_applicable"
    | "not_declared"
    | "pending"
    | "accepted"
    | "failed"
    | "unavailable";
  readonly grandfathered: boolean;
  readonly criterionSetId: string | null;
  readonly criterionRevisionId: string | null;
  readonly criterionSetCommitment: `sha256:${string}` | null;
  readonly criteria: readonly MilestoneAcceptanceCriterionViewV1[];
  readonly blockingRequiredCriterionIds: readonly string[];
  readonly milestoneBindingId: string;
  readonly criterionSetBindingId: string | null;
}

export interface MilestoneAcceptanceMigrationViewV1 {
  readonly migrationId: string;
  readonly repositoryId: string;
  readonly path: string;
  readonly objectFormat: "sha1" | "sha256";
  readonly head: string;
  readonly blob: string;
  readonly sourceDigest: `sha256:${string}`;
  readonly candidateDigest: `sha256:${string}`;
  readonly grandfatheredMilestoneIds: readonly string[];
  readonly sourceBindingId: string;
}

export interface MilestoneAcceptanceViewProjectionV1 {
  readonly modelVersion: 1;
  readonly grammarVersion: number;
  readonly availability: "available" | "not_applicable";
  readonly milestones: readonly MilestoneAcceptanceMilestoneViewV1[];
  readonly migration: MilestoneAcceptanceMigrationViewV1 | null;
  readonly sourceBindings: readonly MilestoneAcceptanceSourceBindingV1[];
}

export interface MilestoneAcceptanceViewResultV1 {
  readonly schemaVersion: typeof MILESTONE_ACCEPTANCE_VIEW_SCHEMA_VERSION;
  readonly milestoneAcceptanceEditorProtocolModelVersion:
    typeof MILESTONE_ACCEPTANCE_EDITOR_PROTOCOL_MODEL_VERSION;
  readonly document: GraphViewResultV1["document"];
  readonly status: "current" | "invalid" | "unavailable";
  readonly complete: boolean;
  readonly reason: string | null;
  readonly acceptance: MilestoneAcceptanceViewProjectionV1 | null;
}

export interface HistoricalGraphViewParamsV1 {
  readonly textDocument: { readonly uri: string };
  readonly documentVersion: number;
  readonly requestedEndpoint: string;
  readonly lowerBoundary: string | null;
  readonly ancestryProfile: HistoricalGraphAncestryProfile;
  readonly view: HistoricalGraphView;
  readonly snapshotCommitId: string | null;
  readonly analysisMode: GraphViewAnalysisMode;
}

export interface HistoricalEditorDiagnosticV1 {
  readonly code: string;
  readonly severity: "error" | "warning" | "info";
  readonly message: string;
  readonly range: Range | null;
  readonly related: readonly {
    readonly uri: string;
    readonly range: Range;
    readonly message: string;
  }[];
  readonly helpTopic: string | null;
}

export interface HistoricalSourceBindingV1 {
  readonly repository_id: string;
  readonly repository_relative_path: string;
  readonly commit_id: string;
  readonly blob_id: string;
  readonly source_digest: `sha256:${string}`;
  readonly range: {
    readonly start: {
      readonly offset: number;
      readonly line: number;
      readonly column: number;
    };
    readonly end: {
      readonly offset: number;
      readonly line: number;
      readonly column: number;
    };
  };
  readonly declaration_kind: string;
  readonly source_id: string;
  readonly owner_path: string;
  readonly binding_id?: `sha256:${string}`;
}

export interface HistoricalGraphEditorProjectionV1 {
  readonly model: "Perttool.HistoricalDagModel.v1";
  readonly model_version: 1;
  readonly transition_model_version: 1;
  readonly status: "complete" | "incomplete" | "unavailable";
  readonly request: Readonly<Record<string, unknown>>;
  readonly evidence: Readonly<Record<string, unknown>>;
  readonly effective_checkpoint_id: string | null;
  readonly selected_snapshot_commit_id: string | null;
  readonly checkpoints: readonly Readonly<Record<string, unknown>>[];
  readonly snapshot: Readonly<Record<string, unknown>> | null;
  readonly lineage: Readonly<Record<string, unknown>> | null;
  readonly timeline: Readonly<Record<string, unknown>> | null;
  readonly analysis: Readonly<Record<string, unknown>>;
  readonly source_bindings: readonly HistoricalSourceBindingV1[];
  readonly causes: readonly Readonly<Record<string, unknown>>[];
  readonly limits: Readonly<Record<string, unknown>>;
}

export interface HistoricalGraphViewResultV1 {
  readonly schemaVersion: typeof HISTORICAL_GRAPH_VIEW_SCHEMA_VERSION;
  readonly historicalEditorProtocolModelVersion:
    typeof HISTORICAL_EDITOR_PROTOCOL_MODEL_VERSION;
  readonly historyResultId: `sha256:${string}`;
  readonly document: {
    readonly uri: string;
    readonly generation: string;
    readonly version: number;
    readonly sourceDigest: `sha256:${string}`;
  };
  readonly status: "complete" | "incomplete" | "unavailable";
  readonly complete: boolean;
  readonly diagnostics: {
    readonly items: readonly HistoricalEditorDiagnosticV1[];
    readonly truncated: boolean;
  };
  readonly historicalGraph: HistoricalGraphEditorProjectionV1 | null;
}

export interface HistoricalSourceParamsV1 {
  readonly textDocument: { readonly uri: string };
  readonly documentVersion: number;
  readonly historyResultId: `sha256:${string}`;
  readonly bindingId: `sha256:${string}`;
}

export interface HistoricalSourceResultV1 {
  readonly schemaVersion: typeof HISTORICAL_SOURCE_SCHEMA_VERSION;
  readonly historicalEditorProtocolModelVersion:
    typeof HISTORICAL_EDITOR_PROTOCOL_MODEL_VERSION;
  readonly historyResultId: `sha256:${string}`;
  readonly bindingId: `sha256:${string}`;
  readonly virtualDocument: {
    readonly uri: string;
    readonly languageId: "pert";
    readonly repositoryRelativePath: string;
    readonly commitId: string;
    readonly blobId: string;
    readonly sourceDigest: `sha256:${string}`;
    readonly text: string;
    readonly range: Range;
  };
}

export interface HistoricalApplicationInspectionV1 {
  readonly projection: HistoricalGraphEditorProjectionV1 | null;
  readonly diagnostics: readonly {
    readonly code: string;
    readonly severity: "error" | "warning" | "info";
    readonly message: string;
  }[];
  readonly diagnosticsTruncated: boolean;
}

export interface HistoricalLocalTargetV1 {
  readonly targetPath: string;
}

export interface HistoricalEditorApplicationV1 {
  readonly resolveLocalTarget: (
    documentUri: string,
    workspaceFolderUris: readonly string[],
  ) => Promise<HistoricalLocalTargetV1 | null>;
  readonly inspect: (
    targetPath: string,
    request: HistoricalGraphViewParamsV1,
    expectedSourceDigest: `sha256:${string}`,
  ) => Promise<HistoricalApplicationInspectionV1>;
  readonly loadSource: (
    targetPath: string,
    binding: HistoricalSourceBindingV1,
  ) => Promise<{ readonly text: string; readonly range: Range } | null>;
}

export interface DagFocusApplicationInspectionV1 {
  readonly status: "current" | "unavailable";
  readonly reason: string | null;
  readonly focus: DagFocusProjectionV1 | null;
}

export interface DagFocusApplicationV1 {
  readonly inspect: (
    text: string,
    expectedSourceDigest: `sha256:${string}`,
  ) => DagFocusApplicationInspectionV1 | PromiseLike<DagFocusApplicationInspectionV1>;
}

export interface MilestoneAcceptanceEditorApplicationV1 {
  readonly prepareDocument: (
    text: string,
    maxDiagnostics: number,
  ) => {
    readonly analysisText: string;
    readonly diagnostics: readonly Diagnostic[];
  };
  readonly inspect: (
    text: string,
    expectedSourceDigest: `sha256:${string}`,
  ) => unknown | PromiseLike<unknown>;
}

export class PerttoolProtocolError extends Error {
  readonly code: number;

  constructor(code: number, message: string) {
    super(message);
    this.name = "PerttoolProtocolError";
    this.code = code;
  }
}

export function isGraphViewAnalysisMode(
  value: unknown,
): value is GraphViewAnalysisMode {
  return (
    value === "none" ||
    value === "precedence" ||
    value === "resource" ||
    value === "both"
  );
}

export function isHistoricalGraphView(
  value: unknown,
): value is HistoricalGraphView {
  return value === "snapshot" || value === "lineage" || value === "timeline";
}

export function isHistoricalGraphAncestryProfile(
  value: unknown,
): value is HistoricalGraphAncestryProfile {
  return value === "first_parent" || value === "three_way";
}
