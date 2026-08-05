import type { Range } from "vscode-languageserver/node.js";

export const EDITOR_PROTOCOL_MODEL_VERSION = 1 as const;
export const GRAPH_VIEW_SCHEMA_VERSION = "Perttool.GraphViewResult.v1" as const;
export const EDITOR_HELP_SCHEMA_VERSION = "Perttool.EditorHelpResult.v1" as const;

export type GraphViewAnalysisMode =
  | "none"
  | "precedence"
  | "resource"
  | "both";

export interface PerttoolInitializationOptionsV1 {
  readonly perttool: {
    readonly editorProtocolModelVersions: readonly [1];
    readonly graphViewResultSchemaVersions: readonly [
      "Perttool.GraphViewResult.v1",
    ];
    readonly editorHelpResultSchemaVersions: readonly [
      "Perttool.EditorHelpResult.v1",
    ];
  };
}

export interface PerttoolExperimentalCapabilitiesV1 {
  readonly perttool: {
    readonly editorProtocolModelVersion: 1;
    readonly graphViewResultSchemaVersion: "Perttool.GraphViewResult.v1";
    readonly editorHelpResultSchemaVersion: "Perttool.EditorHelpResult.v1";
    readonly graphViewAnalysisModes: readonly GraphViewAnalysisMode[];
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
