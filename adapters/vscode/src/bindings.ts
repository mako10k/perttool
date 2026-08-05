export const editorProtocolModelVersion = 1 as const;
export const graphViewResultSchemaVersion =
  "Perttool.GraphViewResult.v1" as const;
export const editorHelpResultSchemaVersion =
  "Perttool.EditorHelpResult.v1" as const;

export type GraphViewAnalysisMode =
  | "none"
  | "precedence"
  | "resource"
  | "both";

export interface GraphViewPositionV1 {
  readonly line: number;
  readonly character: number;
}

export interface GraphViewRangeV1 {
  readonly start: GraphViewPositionV1;
  readonly end: GraphViewPositionV1;
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
  readonly range: GraphViewRangeV1 | null;
  readonly related: readonly {
    readonly uri: string;
    readonly range: GraphViewRangeV1;
    readonly message: string;
  }[];
  readonly helpTopic: string | null;
}

export interface GraphViewMilestoneV1 {
  readonly id: string;
  readonly title: string;
  readonly reached: boolean;
  readonly declarationRange: GraphViewRangeV1;
  readonly selectionRange: GraphViewRangeV1;
  readonly precedence: {
    readonly earliest: GraphViewExactValueV1;
    readonly latest: GraphViewExactValueV1;
    readonly slack: GraphViewExactValueV1;
    readonly critical: boolean;
  } | null;
}

export interface GraphViewEdgeV1 {
  readonly id: string;
  readonly kind: "task" | "gate";
  readonly sourceMilestoneId: string;
  readonly targetMilestoneId: string;
  readonly label: string;
  readonly status:
    | "planned"
    | "active"
    | "blocked"
    | "suspended"
    | "done"
    | null;
  readonly declarationRange: GraphViewRangeV1;
  readonly selectionRange: GraphViewRangeV1;
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
  readonly schemaVersion: typeof graphViewResultSchemaVersion;
  readonly editorProtocolModelVersion: typeof editorProtocolModelVersion;
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

export type WebviewToExtensionMessageV1 =
  | {
      readonly kind: "ready";
      readonly editorProtocolModelVersion: 1;
    }
  | {
      readonly kind: "selectAnalysisMode";
      readonly documentUri: string;
      readonly documentGeneration: string;
      readonly documentVersion: number;
      readonly analysisMode: GraphViewAnalysisMode;
    }
  | {
      readonly kind: "revealSource";
      readonly documentUri: string;
      readonly documentGeneration: string;
      readonly documentVersion: number;
      readonly entityKind: "milestone" | "task" | "gate";
      readonly entityId: string;
    };

export interface OpenHelpCommandArgsV1 {
  readonly documentUri: string;
  readonly documentGeneration: string;
  readonly documentVersion: number;
  readonly topicId: string;
}

export interface EditorHelpResultV1 {
  readonly schemaVersion: typeof editorHelpResultSchemaVersion;
  readonly editorProtocolModelVersion: typeof editorProtocolModelVersion;
  readonly status: "ok" | "not_found";
  readonly topicId: string;
  readonly level: "quick" | "detail";
  readonly content: { readonly kind: "markdown"; readonly value: string } | null;
  readonly relatedTopicIds: readonly string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  return (
    actual.length === expected.length &&
    expected.every((key, index) => actual[index] === key)
  );
}

export function parseOpenHelpCommandArgs(
  value: unknown,
): OpenHelpCommandArgsV1 | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "documentGeneration",
      "documentUri",
      "documentVersion",
      "topicId",
    ]) ||
    typeof value.documentUri !== "string" ||
    value.documentUri.length === 0 ||
    typeof value.documentGeneration !== "string" ||
    value.documentGeneration.length === 0 ||
    !Number.isSafeInteger(value.documentVersion) ||
    (value.documentVersion as number) < 0 ||
    typeof value.topicId !== "string" ||
    value.topicId.length === 0
  ) {
    return null;
  }
  return {
    documentUri: value.documentUri,
    documentGeneration: value.documentGeneration,
    documentVersion: value.documentVersion as number,
    topicId: value.topicId,
  };
}

export function parseEditorHelpResult(value: unknown): EditorHelpResultV1 | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "content",
      "editorProtocolModelVersion",
      "level",
      "relatedTopicIds",
      "schemaVersion",
      "status",
      "topicId",
    ]) ||
    value.schemaVersion !== editorHelpResultSchemaVersion ||
    value.editorProtocolModelVersion !== editorProtocolModelVersion ||
    (value.status !== "ok" && value.status !== "not_found") ||
    typeof value.topicId !== "string" ||
    (value.level !== "quick" && value.level !== "detail") ||
    !Array.isArray(value.relatedTopicIds) ||
    !value.relatedTopicIds.every((item) => typeof item === "string")
  ) {
    return null;
  }
  let content: EditorHelpResultV1["content"] = null;
  if (value.content !== null) {
    if (
      !isRecord(value.content) ||
      !hasExactKeys(value.content, ["kind", "value"]) ||
      value.content.kind !== "markdown" ||
      typeof value.content.value !== "string"
    ) {
      return null;
    }
    content = { kind: "markdown", value: value.content.value };
  }
  if (
    (value.status === "ok" && content === null) ||
    (value.status === "not_found" &&
      (content !== null || value.relatedTopicIds.length !== 0))
  ) {
    return null;
  }
  return {
    schemaVersion: editorHelpResultSchemaVersion,
    editorProtocolModelVersion,
    status: value.status,
    topicId: value.topicId,
    level: value.level,
    content,
    relatedTopicIds: [...value.relatedTopicIds] as string[],
  };
}

export function hasAcceptedEditorHandshake(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const perttool = value.perttool;
  return (
    isRecord(perttool) &&
    perttool.editorProtocolModelVersion === editorProtocolModelVersion &&
    perttool.graphViewResultSchemaVersion === graphViewResultSchemaVersion &&
    perttool.editorHelpResultSchemaVersion === editorHelpResultSchemaVersion
  );
}

export function graphBindingMatches(
  value: unknown,
  expected: OpenHelpCommandArgsV1,
): boolean {
  if (
    !isRecord(value) ||
    value.schemaVersion !== graphViewResultSchemaVersion ||
    value.editorProtocolModelVersion !== editorProtocolModelVersion ||
    !isRecord(value.document)
  ) {
    return false;
  }
  return (
    value.document.uri === expected.documentUri &&
    value.document.generation === expected.documentGeneration &&
    value.document.version === expected.documentVersion
  );
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function stringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function graphMode(value: unknown): value is GraphViewAnalysisMode {
  return (
    value === "none" ||
    value === "precedence" ||
    value === "resource" ||
    value === "both"
  );
}

function position(value: unknown): value is GraphViewPositionV1 {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["character", "line"]) &&
    Number.isSafeInteger(value.line) &&
    (value.line as number) >= 0 &&
    Number.isSafeInteger(value.character) &&
    (value.character as number) >= 0
  );
}

function range(value: unknown): value is GraphViewRangeV1 {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["end", "start"]) &&
    position(value.start) &&
    position(value.end)
  );
}

function exactValue(value: unknown): value is GraphViewExactValueV1 {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["denominator", "display", "numerator", "unit"]) &&
    typeof value.numerator === "string" &&
    typeof value.denominator === "string" &&
    typeof value.unit === "string" &&
    typeof value.display === "string"
  );
}

function diagnostic(value: unknown): value is GraphViewDiagnosticV1 {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "code",
      "helpTopic",
      "message",
      "range",
      "related",
      "severity",
    ]) ||
    typeof value.code !== "string" ||
    (value.severity !== "error" &&
      value.severity !== "warning" &&
      value.severity !== "info") ||
    typeof value.message !== "string" ||
    (value.range !== null && !range(value.range)) ||
    (value.helpTopic !== null && typeof value.helpTopic !== "string") ||
    !Array.isArray(value.related)
  ) {
    return false;
  }
  return value.related.every(
    (related) =>
      isRecord(related) &&
      hasExactKeys(related, ["message", "range", "uri"]) &&
      nonEmptyString(related.uri) &&
      range(related.range) &&
      typeof related.message === "string",
  );
}

function milestone(value: unknown): value is GraphViewMilestoneV1 {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "declarationRange",
      "id",
      "precedence",
      "reached",
      "selectionRange",
      "title",
    ]) ||
    !nonEmptyString(value.id) ||
    typeof value.title !== "string" ||
    typeof value.reached !== "boolean" ||
    !range(value.declarationRange) ||
    !range(value.selectionRange)
  ) {
    return false;
  }
  return (
    value.precedence === null ||
    (isRecord(value.precedence) &&
      hasExactKeys(value.precedence, ["critical", "earliest", "latest", "slack"]) &&
      exactValue(value.precedence.earliest) &&
      exactValue(value.precedence.latest) &&
      exactValue(value.precedence.slack) &&
      typeof value.precedence.critical === "boolean")
  );
}

function edge(value: unknown): value is GraphViewEdgeV1 {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "declarationRange",
      "expected",
      "id",
      "kind",
      "label",
      "precedence",
      "resource",
      "selectionRange",
      "sourceMilestoneId",
      "status",
      "targetMilestoneId",
    ]) ||
    !nonEmptyString(value.id) ||
    (value.kind !== "task" && value.kind !== "gate") ||
    !nonEmptyString(value.sourceMilestoneId) ||
    !nonEmptyString(value.targetMilestoneId) ||
    typeof value.label !== "string" ||
    ![null, "planned", "active", "blocked", "suspended", "done"].includes(
      value.status as null | string,
    ) ||
    !range(value.declarationRange) ||
    !range(value.selectionRange) ||
    !exactValue(value.expected)
  ) {
    return false;
  }
  const precedence =
    value.precedence === null ||
    (isRecord(value.precedence) &&
      hasExactKeys(value.precedence, [
        "critical",
        "driving",
        "earliestFinish",
        "earliestStart",
        "freeFloat",
        "latestFinish",
        "latestStart",
        "totalFloat",
      ]) &&
      exactValue(value.precedence.earliestStart) &&
      exactValue(value.precedence.earliestFinish) &&
      exactValue(value.precedence.latestStart) &&
      exactValue(value.precedence.latestFinish) &&
      exactValue(value.precedence.totalFloat) &&
      exactValue(value.precedence.freeFloat) &&
      typeof value.precedence.critical === "boolean" &&
      typeof value.precedence.driving === "boolean");
  const resource =
    value.resource === null ||
    (isRecord(value.resource) &&
      hasExactKeys(value.resource, [
        "resourceDelay",
        "scheduleCritical",
        "scheduledFinish",
        "scheduledStart",
      ]) &&
      exactValue(value.resource.scheduledStart) &&
      exactValue(value.resource.scheduledFinish) &&
      exactValue(value.resource.resourceDelay) &&
      typeof value.resource.scheduleCritical === "boolean");
  return precedence && resource && (value.kind === "task" || value.status === null);
}

function graph(value: unknown): value is GraphViewGraphV1 {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "edges",
      "finishMilestoneId",
      "milestones",
      "precedence",
      "projectId",
      "resource",
    ]) ||
    !nonEmptyString(value.projectId) ||
    !nonEmptyString(value.finishMilestoneId) ||
    !Array.isArray(value.milestones) ||
    !value.milestones.every(milestone) ||
    !Array.isArray(value.edges) ||
    !value.edges.every(edge)
  ) {
    return false;
  }
  const precedence =
    value.precedence === null ||
    (isRecord(value.precedence) &&
      hasExactKeys(value.precedence, [
        "criticalGateIds",
        "criticalMilestoneIds",
        "criticalTaskIds",
        "makespan",
        "representativePathEdgeIds",
      ]) &&
      exactValue(value.precedence.makespan) &&
      stringArray(value.precedence.criticalMilestoneIds) &&
      stringArray(value.precedence.criticalTaskIds) &&
      stringArray(value.precedence.criticalGateIds) &&
      stringArray(value.precedence.representativePathEdgeIds));
  const resource =
    value.resource === null ||
    (isRecord(value.resource) &&
      hasExactKeys(value.resource, [
        "algorithmId",
        "algorithmVersion",
        "makespan",
        "optimal",
        "resourceDelay",
        "scheduleCriticalTaskIds",
      ]) &&
      value.resource.algorithmId === "parallel-sgs" &&
      value.resource.algorithmVersion === 1 &&
      value.resource.optimal === false &&
      exactValue(value.resource.makespan) &&
      exactValue(value.resource.resourceDelay) &&
      stringArray(value.resource.scheduleCriticalTaskIds));
  return precedence && resource;
}

function modeProjectionIsClosed(result: GraphViewResultV1): boolean {
  if (result.status !== "current") {
    return result.complete === false && result.graph === null;
  }
  if (!result.complete || result.graph === null) return false;
  const hasPrecedence =
    result.analysisMode === "precedence" || result.analysisMode === "both";
  const hasResource =
    result.analysisMode === "resource" || result.analysisMode === "both";
  if ((result.graph.precedence !== null) !== hasPrecedence) return false;
  if ((result.graph.resource !== null) !== hasResource) return false;
  if (
    result.graph.milestones.some(
      (item) => (item.precedence !== null) !== hasPrecedence,
    )
  ) {
    return false;
  }
  return result.graph.edges.every(
    (item) =>
      (item.precedence !== null) === hasPrecedence &&
      (item.resource !== null) === (hasResource && item.kind === "task"),
  );
}

export function parseGraphViewResult(value: unknown): GraphViewResultV1 | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "analysisMode",
      "complete",
      "diagnostics",
      "document",
      "editorProtocolModelVersion",
      "graph",
      "schemaVersion",
      "status",
    ]) ||
    value.schemaVersion !== graphViewResultSchemaVersion ||
    value.editorProtocolModelVersion !== editorProtocolModelVersion ||
    !isRecord(value.document) ||
    !hasExactKeys(value.document, ["generation", "sourceDigest", "uri", "version"]) ||
    !nonEmptyString(value.document.uri) ||
    !nonEmptyString(value.document.generation) ||
    !Number.isSafeInteger(value.document.version) ||
    (value.document.version as number) < 0 ||
    typeof value.document.sourceDigest !== "string" ||
    !/^sha256:[0-9a-f]{64}$/u.test(value.document.sourceDigest) ||
    !graphMode(value.analysisMode) ||
    (value.status !== "current" &&
      value.status !== "invalid" &&
      value.status !== "unavailable") ||
    typeof value.complete !== "boolean" ||
    !isRecord(value.diagnostics) ||
    !hasExactKeys(value.diagnostics, ["items", "truncated"]) ||
    !Array.isArray(value.diagnostics.items) ||
    !value.diagnostics.items.every(diagnostic) ||
    typeof value.diagnostics.truncated !== "boolean" ||
    (value.graph !== null && !graph(value.graph))
  ) {
    return null;
  }
  const result = value as unknown as GraphViewResultV1;
  if (!modeProjectionIsClosed(result)) return null;
  return JSON.parse(JSON.stringify(result)) as GraphViewResultV1;
}

export function parseWebviewMessage(
  value: unknown,
): WebviewToExtensionMessageV1 | null {
  if (!isRecord(value) || typeof value.kind !== "string") return null;
  if (value.kind === "ready") {
    return hasExactKeys(value, ["editorProtocolModelVersion", "kind"]) &&
      value.editorProtocolModelVersion === editorProtocolModelVersion
      ? { kind: "ready", editorProtocolModelVersion }
      : null;
  }
  const common =
    nonEmptyString(value.documentUri) &&
    nonEmptyString(value.documentGeneration) &&
    Number.isSafeInteger(value.documentVersion) &&
    (value.documentVersion as number) >= 0;
  if (
    value.kind === "selectAnalysisMode" &&
    hasExactKeys(value, [
      "analysisMode",
      "documentGeneration",
      "documentUri",
      "documentVersion",
      "kind",
    ]) &&
    common &&
    graphMode(value.analysisMode)
  ) {
    return value as unknown as WebviewToExtensionMessageV1;
  }
  if (
    value.kind === "revealSource" &&
    hasExactKeys(value, [
      "documentGeneration",
      "documentUri",
      "documentVersion",
      "entityId",
      "entityKind",
      "kind",
    ]) &&
    common &&
    nonEmptyString(value.entityId) &&
    (value.entityKind === "milestone" ||
      value.entityKind === "task" ||
      value.entityKind === "gate")
  ) {
    return value as unknown as WebviewToExtensionMessageV1;
  }
  return null;
}

export function findGraphEntityRange(
  result: GraphViewResultV1,
  entityKind: "milestone" | "task" | "gate",
  entityId: string,
): GraphViewRangeV1 | null {
  if (result.status !== "current" || result.graph === null) return null;
  if (entityKind === "milestone") {
    return result.graph.milestones.find(({ id }) => id === entityId)
      ?.selectionRange ?? null;
  }
  return result.graph.edges.find(
    ({ id, kind }) => id === entityId && kind === entityKind,
  )?.selectionRange ?? null;
}
