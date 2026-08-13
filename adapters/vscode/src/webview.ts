import { Graph, layout, type Point } from "@dagrejs/dagre";
import {
  allocateHistoricalCompactIds,
  editorProtocolModelVersion,
  formatPresentationDuration,
  parseDagFocusResult,
  parseGraphViewResult,
  parseMilestoneAcceptanceViewResult,
  type GraphViewAnalysisMode,
  type DagFocusResultV1,
  type GraphViewEdgeV1,
  type GraphViewExactValueV1,
  type GraphViewResultV1,
  type HistoricalGraphAncestryProfile,
  type HistoricalGraphView,
  type HistoricalWebviewPresentationV1,
  type MilestoneAcceptanceViewResultV1,
} from "./bindings.js";

interface VsCodeApi {
  readonly postMessage: (message: unknown) => void;
}

declare function acquireVsCodeApi(): VsCodeApi;

type PresentationState =
  | "empty"
  | "loading"
  | "current"
  | "invalid"
  | "unavailable"
  | "stale"
  | "cancelled";

interface RenderMessageV1 {
  readonly kind: "render";
  readonly editorProtocolModelVersion: 1;
  readonly state: PresentationState;
  readonly message: string;
  readonly analysisMode: GraphViewAnalysisMode;
  readonly result: GraphViewResultV1 | null;
  readonly focusResult: DagFocusResultV1 | null;
  readonly historicalResult: HistoricalWebviewPresentationV1 | null;
  readonly acceptanceResult: MilestoneAcceptanceViewResultV1 | null;
  readonly scope: "current" | "historical";
}

const vscode = acquireVsCodeApi();
const svgNamespace = "http://www.w3.org/2000/svg";
const status = requiredElement("status");
const graph = requiredElement("graph") as unknown as SVGSVGElement;
const viewport = requiredElement("graph-viewport");
const zoomOut = requiredElement("zoom-out") as HTMLButtonElement;
const zoomIn = requiredElement("zoom-in") as HTMLButtonElement;
const zoomFit = requiredElement("zoom-fit") as HTMLButtonElement;
const zoomLevel = requiredElement("zoom-level") as HTMLOutputElement;
const currentMilestones = requiredElement("current-milestones");
const criticalPath = requiredElement("critical-path");
const nextTasks = requiredElement("next-tasks");
const timeSummary = requiredElement("time-summary");
const milestoneAcceptance = requiredElement("milestone-acceptance");
const outlineSection = requiredElement("outline-section") as HTMLDetailsElement;
const outline = requiredElement("outline");
const diagnostics = requiredElement("diagnostics");
const mode = requiredElement("analysis-mode") as HTMLSelectElement;
const scope = requiredElement("dag-scope") as HTMLSelectElement;
const historicalControls = requiredElement("historical-controls") as HTMLDetailsElement;
const historicalEndpoint = requiredElement("historical-endpoint") as HTMLInputElement;
const historicalLower = requiredElement("historical-lower") as HTMLInputElement;
const historicalAncestry = requiredElement("historical-ancestry") as HTMLSelectElement;
const historicalView = requiredElement("historical-view") as HTMLSelectElement;
const historicalSnapshot = requiredElement("historical-snapshot") as HTMLInputElement;
const historicalRun = requiredElement("historical-run") as HTMLButtonElement;
let current: GraphViewResultV1 | null = null;
let currentFocus: DagFocusResultV1 | null = null;
let currentHistorical: HistoricalWebviewPresentationV1 | null = null;
let currentAcceptance: MilestoneAcceptanceViewResultV1 | null = null;
let layoutWidth = 420;
let layoutHeight = 260;
let zoom = 1;
historicalSnapshot.disabled = true;

function requiredElement(id: string): HTMLElement {
  const value = document.getElementById(id);
  if (value === null) throw new Error(`missing Webview element: ${id}`);
  return value;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
}

function analysisMode(value: unknown): value is GraphViewAnalysisMode {
  return value === "none" || value === "precedence" ||
    value === "resource" || value === "both";
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function historicalPresentation(
  value: unknown,
): HistoricalWebviewPresentationV1 | null {
  if (
    !record(value) ||
    !exactKeys(value, [
      "complete",
      "diagnostics",
      "document",
      "historicalGraph",
      "historyResultId",
      "status",
    ]) ||
    !/^sha256:[0-9a-f]{64}$/u.test(String(value.historyResultId)) ||
    !record(value.document) ||
    !exactKeys(value.document, ["generation", "sourceDigest", "uri", "version"]) ||
    typeof value.document.uri !== "string" ||
    typeof value.document.generation !== "string" ||
    !Number.isSafeInteger(value.document.version) ||
    !/^sha256:[0-9a-f]{64}$/u.test(String(value.document.sourceDigest)) ||
    (value.status !== "complete" && value.status !== "incomplete" &&
      value.status !== "unavailable") ||
    typeof value.complete !== "boolean" ||
    value.complete !== (value.status === "complete") ||
    !record(value.diagnostics) ||
    !Array.isArray(value.diagnostics.items) ||
    typeof value.diagnostics.truncated !== "boolean"
  ) return null;
  if (value.historicalGraph !== null) {
    if (
      !record(value.historicalGraph) ||
      !exactKeys(value.historicalGraph, [
        "analysis",
        "causes",
        "checkpoints",
        "effectiveCheckpointId",
        "evidence",
        "lineage",
        "model",
        "navigation",
        "request",
        "selectedSnapshotCommitId",
        "snapshot",
        "status",
        "timeline",
      ]) ||
      value.historicalGraph.model !== "Perttool.HistoricalDagModel.v1" ||
      value.historicalGraph.status !== value.status ||
      !record(value.historicalGraph.request) ||
      !record(value.historicalGraph.evidence) ||
      !Array.isArray(value.historicalGraph.checkpoints) ||
      !record(value.historicalGraph.analysis) ||
      !Array.isArray(value.historicalGraph.causes) ||
      !Array.isArray(value.historicalGraph.navigation) ||
      JSON.stringify(value.historicalGraph).includes("repository_id") ||
      JSON.stringify(value.historicalGraph).includes("repository_relative_path")
    ) return null;
  }
  return value as unknown as HistoricalWebviewPresentationV1;
}

function renderMessage(value: unknown): RenderMessageV1 | null {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    !exactKeys(record, [
      "acceptanceResult",
      "analysisMode",
      "editorProtocolModelVersion",
      "focusResult",
      "historicalResult",
      "kind",
      "message",
      "result",
      "scope",
      "state",
    ]) ||
    record.kind !== "render" ||
    record.editorProtocolModelVersion !== editorProtocolModelVersion ||
    !["empty", "loading", "current", "invalid", "unavailable", "stale", "cancelled"]
      .includes(record.state as string) ||
    typeof record.message !== "string" ||
    !analysisMode(record.analysisMode) ||
    (record.scope !== "current" && record.scope !== "historical")
  ) {
    return null;
  }
  const result = record.result === null ? null : parseGraphViewResult(record.result);
  if (record.result !== null && result === null) return null;
  const focusResult = record.focusResult === null
    ? null
    : parseDagFocusResult(record.focusResult);
  if (record.focusResult !== null && focusResult === null) return null;
  const historicalResult = record.historicalResult === null
    ? null
    : historicalPresentation(record.historicalResult);
  if (record.historicalResult !== null && historicalResult === null) return null;
  const acceptanceResult = record.acceptanceResult === null
    ? null
    : parseMilestoneAcceptanceViewResult(record.acceptanceResult);
  if (record.acceptanceResult !== null && acceptanceResult === null) return null;
  if (
    record.scope === "current" && record.state === "current" &&
    result?.status !== "current"
  ) return null;
  return {
    kind: "render",
    editorProtocolModelVersion,
    state: record.state as PresentationState,
    message: record.message,
    analysisMode: record.analysisMode,
    result,
    focusResult,
    historicalResult,
    acceptanceResult,
    scope: record.scope,
  };
}

function svgElement<K extends keyof SVGElementTagNameMap>(
  name: K,
): SVGElementTagNameMap[K] {
  return document.createElementNS(svgNamespace, name);
}

function exactText(value: GraphViewExactValueV1 | null): string {
  return value === null
    ? "unavailable"
    : formatPresentationDuration(value);
}

function exactTitle(value: GraphViewExactValueV1 | null): string {
  return value === null
    ? "unavailable"
    : `${value.display} ${value.unit} (${value.numerator}/${value.denominator})`;
}

function compactEntity(
  kind: "milestone" | "task" | "gate",
  id: string,
) {
  return currentFocus?.status === "current"
    ? currentFocus.focus?.entities.find((entity) =>
        entity.kind === kind && entity.id === id
      ) ?? null
    : null;
}

function compactId(
  kind: "milestone" | "task" | "gate",
  id: string,
): string {
  return compactEntity(kind, id)?.compactId ?? id;
}

function currentDetailId(
  kind: "milestone" | "task" | "gate",
  id: string,
): string {
  return `detail-current-${compactId(kind, id)}`;
}

function currentGraphId(
  kind: "milestone" | "task" | "gate",
  id: string,
): string {
  return `graph-current-${compactId(kind, id)}`;
}

function focusDomElement(id: string): void {
  const target = document.getElementById(id);
  if (target === null) return;
  target.focus({ preventScroll: true });
  target.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
}

function makeDetailLink(
  element: Element,
  compact: string,
  detailId: string,
): void {
  element.setAttribute("role", "link");
  element.setAttribute("tabindex", "0");
  element.setAttribute("aria-label", `Show details for ${compact}`);
  const reveal = (): void => {
    outlineSection.open = true;
    requestAnimationFrame(() => focusDomElement(detailId));
  };
  element.addEventListener("click", reveal);
  element.addEventListener("keydown", (event) => {
    if (event instanceof KeyboardEvent && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      reveal();
    }
  });
}

function entityMessage(
  result: GraphViewResultV1,
  entityKind: "milestone" | "task" | "gate",
  entityId: string,
): void {
  vscode.postMessage({
    kind: "revealSource",
    documentUri: result.document.uri,
    documentGeneration: result.document.generation,
    documentVersion: result.document.version,
    entityKind,
    entityId,
  });
}

function edgeClass(
  edge: GraphViewEdgeV1,
  focus: DagFocusResultV1 | null,
): string {
  const values = ["edge", `kind-${edge.kind}`];
  if (edge.status !== null) values.push(`status-${edge.status}`);
  if (edge.precedence?.critical === true) values.push("critical");
  if (edge.precedence?.driving === true) values.push("driving");
  if (edge.resource?.scheduleCritical === true) values.push("schedule-critical");
  if (focus?.focus?.readyTaskIds.includes(edge.id) === true) values.push("ready");
  if (focus?.focus?.startableTaskIds.includes(edge.id) === true) values.push("next");
  return values.join(" ");
}

function markerDefinition(): SVGDefsElement {
  const marker = svgElement("marker");
  marker.setAttribute("id", "dag-arrow");
  marker.setAttribute("viewBox", "0 0 10 10");
  marker.setAttribute("refX", "9");
  marker.setAttribute("refY", "5");
  marker.setAttribute("markerWidth", "7");
  marker.setAttribute("markerHeight", "7");
  marker.setAttribute("orient", "auto-start-reverse");
  const arrow = svgElement("path");
  arrow.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
  marker.append(arrow);
  const defs = svgElement("defs");
  defs.append(marker);
  return defs;
}

function pathData(points: readonly Point[]): string {
  return points.map(({ x, y }, index) =>
    `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`
  ).join(" ");
}

function boundedLabel(value: string, maximum = 30): string {
  return value.length <= maximum ? value : `${value.slice(0, maximum - 1)}…`;
}

function edgeLabelWidth(value: string): number {
  return Math.max(56, Math.min(112, value.length * 7 + 26));
}

function applyZoom(next: number): void {
  zoom = Math.max(0.3, Math.min(2.5, next));
  graph.style.width = `${Math.ceil(layoutWidth * zoom)}px`;
  graph.style.height = `${Math.ceil(layoutHeight * zoom)}px`;
  zoomLevel.value = `${Math.round(zoom * 100)}%`;
}

function fitGraph(): void {
  const availableWidth = Math.max(1, viewport.clientWidth - 4);
  const availableHeight = Math.max(1, viewport.clientHeight - 4);
  applyZoom(Math.min(1.5, availableWidth / layoutWidth, availableHeight / layoutHeight));
  viewport.scrollTo({ left: 0, top: 0, behavior: "auto" });
}

function setGraphExtent(width: number, height: number): void {
  layoutWidth = Math.max(420, Math.ceil(width));
  layoutHeight = Math.max(260, Math.ceil(height));
  graph.setAttribute("viewBox", `0 0 ${layoutWidth} ${layoutHeight}`);
  requestAnimationFrame(fitGraph);
}

function renderGraph(result: GraphViewResultV1): void {
  graph.replaceChildren();
  if (result.graph === null) return;
  const semantic = result.graph;
  const dag = new Graph({ directed: true, multigraph: true });
  dag.setGraph({
    rankdir: "LR",
    ranker: "network-simplex",
    align: "UL",
    nodesep: 48,
    edgesep: 20,
    ranksep: 104,
    marginx: 48,
    marginy: 48,
  });
  dag.setDefaultEdgeLabel(() => ({}));
  for (const milestone of semantic.milestones) {
    dag.setNode(milestone.id, { width: 88, height: 48 });
  }
  for (const edge of semantic.edges) {
    const displayId = compactId(edge.kind, edge.id);
    dag.setEdge(
      edge.sourceMilestoneId,
      edge.targetMilestoneId,
      {
        width: edgeLabelWidth(displayId),
        height: 30,
        weight: edge.precedence?.critical === true ? 8 : 1,
        minlen: 1,
        labelpos: "c",
      },
      edge.id,
    );
  }
  layout(dag);
  const extent = dag.graph();
  setGraphExtent(extent.width ?? 420, extent.height ?? 260);
  graph.append(markerDefinition());

  for (const edge of semantic.edges) {
    const positioned = dag.edge({
      v: edge.sourceMilestoneId,
      w: edge.targetMilestoneId,
      name: edge.id,
    });
    if (positioned === undefined || positioned.points === undefined) continue;
    const group = svgElement("g");
    group.setAttribute("class", edgeClass(edge, currentFocus));
    const displayId = compactId(edge.kind, edge.id);
    group.setAttribute("id", currentGraphId(edge.kind, edge.id));
    makeDetailLink(group, displayId, currentDetailId(edge.kind, edge.id));
    const path = svgElement("path");
    path.setAttribute("d", pathData(positioned.points));
    path.setAttribute("marker-end", "url(#dag-arrow)");
    const background = svgElement("rect");
    const width = positioned.width ?? edgeLabelWidth(displayId);
    const height = positioned.height ?? 30;
    background.setAttribute("class", "edge-label-background");
    background.setAttribute("x", String((positioned.x ?? 0) - width / 2));
    background.setAttribute("y", String((positioned.y ?? 0) - height / 2));
    background.setAttribute("width", String(width));
    background.setAttribute("height", String(height));
    background.setAttribute("rx", "8");
    const label = svgElement("text");
    label.setAttribute("x", String(positioned.x ?? 0));
    label.setAttribute("y", String((positioned.y ?? 0) + 4));
    label.textContent = displayId;
    const title = svgElement("title");
    title.textContent = `${displayId}: ${edge.id}; ${edge.label}`;
    group.append(title, path, background, label);
    graph.append(group);
  }

  for (const milestone of semantic.milestones) {
    const point = dag.node(milestone.id);
    if (point === undefined || point.x === undefined || point.y === undefined) continue;
    const group = svgElement("g");
    const classes = ["milestone"];
    if (milestone.reached) classes.push("reached");
    if (milestone.precedence?.critical === true) classes.push("critical");
    if (
      currentFocus?.status === "current" &&
      currentFocus.focus?.frontierMilestoneIds.includes(milestone.id) === true
    ) classes.push("current");
    group.setAttribute("class", classes.join(" "));
    group.setAttribute("transform", `translate(${point.x} ${point.y})`);
    const displayId = compactId("milestone", milestone.id);
    group.setAttribute("id", currentGraphId("milestone", milestone.id));
    makeDetailLink(
      group,
      displayId,
      currentDetailId("milestone", milestone.id),
    );
    const node = svgElement("rect");
    node.setAttribute("x", "-44");
    node.setAttribute("y", "-24");
    node.setAttribute("width", "88");
    node.setAttribute("height", "48");
    node.setAttribute("rx", "12");
    const id = svgElement("text");
    id.setAttribute("class", "milestone-id");
    id.setAttribute("y", "4");
    id.textContent = displayId;
    const title = svgElement("title");
    title.textContent = `${displayId}: ${milestone.id}; ${milestone.title}; ${
      milestone.reached ? "reached" : "unreached"
    }`;
    group.append(title, node, id);
    graph.append(group);
  }
}

function recordArray(value: unknown): readonly Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(record) : [];
}

function historicalOccurrences(
  presentation: HistoricalWebviewPresentationV1,
): readonly Record<string, unknown>[] {
  const historical = presentation.historicalGraph;
  if (historical === null) return [];
  const view = historical.request["view"];
  if (view === "snapshot" && record(historical.snapshot)) {
    const snapshotGraph = historical.snapshot["graph"];
    return record(snapshotGraph)
      ? recordArray(snapshotGraph["occurrences"])
      : [];
  }
  if (view === "lineage" && record(historical.lineage)) {
    return recordArray(historical.lineage["occurrences"]);
  }
  if (view === "timeline" && record(historical.timeline)) {
    const entries = recordArray(historical.timeline["entries"]);
    const selected = historical.selectedSnapshotCommitId;
    const entry = entries.find((item) => item["commit_id"] === selected) ??
      [...entries].reverse().find((item) => record(item["graph"]));
    const selectedGraph = entry?.["graph"];
    return record(selectedGraph)
      ? recordArray(selectedGraph["occurrences"])
      : [];
  }
  return [];
}

function navigationFor(
  presentation: HistoricalWebviewPresentationV1,
  occurrence: Record<string, unknown>,
) {
  const navigation = presentation.historicalGraph?.navigation ?? [];
  const sourceId = occurrence["source_id"];
  const preferredCommit = occurrence["last_observed_commit_id"] ??
    presentation.historicalGraph?.selectedSnapshotCommitId ??
    presentation.historicalGraph?.effectiveCheckpointId;
  return navigation.find((binding) =>
    binding.sourceId === sourceId && binding.commitId === preferredCommit
  ) ?? navigation.find((binding) => binding.sourceId === sourceId) ?? null;
}

function historicalDetailId(displayId: string): string {
  return `detail-history-${displayId}`;
}

function historicalGraphId(displayId: string): string {
  return `graph-history-${displayId}`;
}

function historicalLabel(occurrence: Record<string, unknown>): string {
  const semantic = occurrence["semantic"];
  if (!record(semantic)) return String(occurrence["source_id"] ?? "unknown");
  if (record(semantic["plan"]) && typeof semantic["plan"]["title"] === "string") {
    return semantic["plan"]["title"];
  }
  if (typeof semantic["title"] === "string") return semantic["title"];
  if (typeof semantic["reason"] === "string") return semantic["reason"];
  return String(occurrence["source_id"] ?? "unknown");
}

function renderHistoricalGraph(presentation: HistoricalWebviewPresentationV1): void {
  graph.replaceChildren();
  const occurrences = historicalOccurrences(presentation);
  const milestones = occurrences.filter((item) => item["entity_kind"] === "milestone");
  const edges = occurrences.filter((item) =>
    item["entity_kind"] === "task" || item["entity_kind"] === "gate"
  );
  const displayIds = allocateHistoricalCompactIds(occurrences);
  const historical = presentation.historicalGraph;
  const analysis = historical === null ? null : historical.analysis;
  const precedence = record(analysis?.["precedence"])
    ? analysis["precedence"]
    : null;
  const criticalMilestones = new Set(
    Array.isArray(precedence?.["critical_milestone_occurrence_ids"])
      ? precedence["critical_milestone_occurrence_ids"].map(String)
      : [],
  );
  const criticalEdges = new Set(
    Array.isArray(precedence?.["representative_path_occurrence_ids"])
      ? precedence["representative_path_occurrence_ids"].map(String)
      : [],
  );
  const dag = new Graph({ directed: true, multigraph: true });
  dag.setGraph({
    rankdir: "LR",
    ranker: "network-simplex",
    align: "UL",
    nodesep: 48,
    edgesep: 20,
    ranksep: 104,
    marginx: 48,
    marginy: 48,
  });
  dag.setDefaultEdgeLabel(() => ({}));
  for (const milestone of milestones) {
    dag.setNode(String(milestone["occurrence_id"] ?? ""), {
      width: 88,
      height: 48,
    });
  }
  for (const edge of edges) {
    const occurrenceId = String(edge["occurrence_id"] ?? "");
    const label = displayIds.get(occurrenceId) ?? String(edge["source_id"] ?? "?");
    dag.setEdge(
      String(edge["from_occurrence_id"] ?? ""),
      String(edge["to_occurrence_id"] ?? ""),
      {
        width: edgeLabelWidth(label),
        height: 30,
        weight: criticalEdges.has(occurrenceId) ? 8 : 1,
        minlen: 1,
        labelpos: "c",
      },
      occurrenceId,
    );
  }
  layout(dag);
  const extent = dag.graph();
  setGraphExtent(extent.width ?? 420, extent.height ?? 260);
  graph.append(markerDefinition());
  for (const edge of edges) {
    const occurrenceId = String(edge["occurrence_id"] ?? "");
    const positioned = dag.edge({
      v: String(edge["from_occurrence_id"] ?? ""),
      w: String(edge["to_occurrence_id"] ?? ""),
      name: occurrenceId,
    });
    if (positioned === undefined || positioned.points === undefined) continue;
    const group = svgElement("g");
    const classes = ["edge", `kind-${String(edge["entity_kind"])}`, "historical"];
    if (edge["retired_at_commit_id"] !== null) classes.push("retired");
    if (criticalEdges.has(occurrenceId)) classes.push("critical");
    if (
      edge["retired_at_commit_id"] === null &&
      currentFocus?.focus?.readyTaskIds.includes(String(edge["source_id"])) === true
    ) classes.push("ready");
    if (
      edge["retired_at_commit_id"] === null &&
      currentFocus?.focus?.startableTaskIds.includes(String(edge["source_id"])) === true
    ) classes.push("next");
    group.setAttribute("class", classes.join(" "));
    const displayId = displayIds.get(occurrenceId) ?? String(edge["source_id"] ?? "?");
    group.setAttribute("id", historicalGraphId(displayId));
    makeDetailLink(group, displayId, historicalDetailId(displayId));
    const path = svgElement("path");
    path.setAttribute("d", pathData(positioned.points));
    path.setAttribute("marker-end", "url(#dag-arrow)");
    const labelText = displayId;
    const width = positioned.width ?? edgeLabelWidth(labelText);
    const height = positioned.height ?? 30;
    const background = svgElement("rect");
    background.setAttribute("class", "edge-label-background");
    background.setAttribute("x", String((positioned.x ?? 0) - width / 2));
    background.setAttribute("y", String((positioned.y ?? 0) - height / 2));
    background.setAttribute("width", String(width));
    background.setAttribute("height", String(height));
    background.setAttribute("rx", "8");
    const label = svgElement("text");
    label.setAttribute("x", String(positioned.x ?? 0));
    label.setAttribute("y", String((positioned.y ?? 0) + 4));
    label.textContent = labelText;
    const title = svgElement("title");
    title.textContent = `${displayId}: ${String(edge["source_id"])}; ${
      historicalLabel(edge)
    }`;
    group.append(title, path, background, label);
    graph.append(group);
  }
  for (const milestone of milestones) {
    const occurrenceId = String(milestone["occurrence_id"] ?? "");
    const point = dag.node(occurrenceId);
    if (point === undefined || point.x === undefined || point.y === undefined) continue;
    const group = svgElement("g");
    const classes = ["milestone", "historical"];
    if (milestone["retired_at_commit_id"] !== null) classes.push("retired");
    if (criticalMilestones.has(occurrenceId)) classes.push("critical");
    if (
      milestone["retired_at_commit_id"] === null &&
      currentFocus?.focus?.frontierMilestoneIds.includes(
        String(milestone["source_id"]),
      ) === true
    ) classes.push("current");
    group.setAttribute("class", classes.join(" "));
    group.setAttribute("transform", `translate(${point.x} ${point.y})`);
    const displayId = displayIds.get(occurrenceId) ??
      String(milestone["source_id"] ?? "?");
    group.setAttribute("id", historicalGraphId(displayId));
    makeDetailLink(group, displayId, historicalDetailId(displayId));
    const node = svgElement("rect");
    node.setAttribute("x", "-44");
    node.setAttribute("y", "-24");
    node.setAttribute("width", "88");
    node.setAttribute("height", "48");
    node.setAttribute("rx", "12");
    const id = svgElement("text");
    id.setAttribute("class", "milestone-id");
    id.setAttribute("y", "4");
    id.textContent = displayId;
    const title = svgElement("title");
    title.textContent = `${displayId}: ${String(milestone["source_id"])}; ${
      historicalLabel(milestone)
    }; ${
      milestone["retired_at_commit_id"] === null ? "current" : "retired"
    }; occurrence ${String(milestone["occurrence_id"] ?? "unknown")}`;
    group.append(title, node, id);
    graph.append(group);
  }
}

function revealButton(
  result: GraphViewResultV1,
  entityKind: "milestone" | "task" | "gate",
  entityId: string,
  label: string,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", () => entityMessage(result, entityKind, entityId));
  return button;
}

function edgeDetails(edge: GraphViewEdgeV1): string {
  const values = [
    `${edge.sourceMilestoneId} to ${edge.targetMilestoneId}`,
    `status ${edge.status ?? "not applicable"}`,
    `expected ${exactText(edge.expected)}`,
  ];
  if (edge.precedence !== null) {
    values.push(
      `total float ${exactText(edge.precedence.totalFloat)}`,
      `precedence critical ${String(edge.precedence.critical)}`,
    );
  }
  if (edge.resource !== null) {
    values.push(
      `scheduled ${exactText(edge.resource.scheduledStart)} to ${exactText(edge.resource.scheduledFinish)}`,
      `resource delay ${exactText(edge.resource.resourceDelay)}`,
      `schedule critical ${String(edge.resource.scheduleCritical)}`,
    );
  }
  return values.join("; ");
}

function backToGraphButton(graphId: string, compact: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = `Back to ${compact} in graph`;
  button.addEventListener("click", () => focusDomElement(graphId));
  return button;
}

function taskTimeText(taskId: string): string {
  const task = currentFocus?.focus?.timeSummary.taskTimes.find((item) =>
    item.taskId === taskId
  );
  if (task === undefined) return "task time unavailable";
  return `task time ${exactText(task.taskTime)}${
    task.pointForecast === null
      ? ""
      : `; velocity forecast ${exactText(task.pointForecast)}`
  }`;
}

function detailIntroduction(
  compact: string,
  originalId: string,
  title: string,
  description: string | null,
): readonly HTMLElement[] {
  const heading = document.createElement("h4");
  heading.textContent = `${compact} — ${originalId}`;
  const titleText = document.createElement("p");
  titleText.textContent = `Title: ${title}`;
  const descriptionText = document.createElement("p");
  descriptionText.textContent = description === null || description.length === 0
    ? "Description: not declared"
    : `Description: ${description}`;
  return [heading, titleText, descriptionText];
}

function renderOutline(result: GraphViewResultV1): void {
  outline.replaceChildren();
  if (result.graph === null) return;
  const project = document.createElement("p");
  project.textContent = `Project ${result.graph.projectId}; finish ${result.graph.finishMilestoneId}.`;
  const milestoneHeading = document.createElement("h3");
  milestoneHeading.textContent = "Milestones";
  const milestoneList = document.createElement("ol");
  for (const item of result.graph.milestones) {
    const row = document.createElement("li");
    const entity = compactEntity("milestone", item.id);
    const displayId = entity?.compactId ?? item.id;
    row.id = currentDetailId("milestone", item.id);
    row.className = "entity-detail";
    row.tabIndex = -1;
    const facts = document.createElement("p");
    facts.textContent =
      `${item.reached ? "Reached" : "Unreached"}; ` +
      `slack ${exactText(item.precedence?.slack ?? null)}.`;
    const actions = document.createElement("div");
    actions.className = "detail-actions";
    actions.append(
      revealButton(result, "milestone", item.id, "Open source"),
      backToGraphButton(currentGraphId("milestone", item.id), displayId),
    );
    row.append(
      ...detailIntroduction(
        displayId,
        item.id,
        entity?.title ?? item.title,
        entity?.description ?? null,
      ),
      facts,
      actions,
    );
    milestoneList.append(row);
  }
  const edgeHeading = document.createElement("h3");
  edgeHeading.textContent = "Edges";
  const edgeList = document.createElement("ol");
  for (const item of result.graph.edges) {
    const row = document.createElement("li");
    const entity = compactEntity(item.kind, item.id);
    const displayId = entity?.compactId ?? item.id;
    row.id = currentDetailId(item.kind, item.id);
    row.className = "entity-detail";
    row.tabIndex = -1;
    const facts = document.createElement("p");
    facts.textContent = `${edgeDetails(item)}; ${
      item.kind === "task" ? taskTimeText(item.id) : "task time not applicable"
    }.`;
    const actions = document.createElement("div");
    actions.className = "detail-actions";
    actions.append(
      revealButton(result, item.kind, item.id, "Open source"),
      backToGraphButton(currentGraphId(item.kind, item.id), displayId),
    );
    row.append(
      ...detailIntroduction(
        displayId,
        item.id,
        entity?.title ?? item.label,
        entity?.description ?? null,
      ),
      facts,
      actions,
    );
    edgeList.append(row);
  }
  outline.append(project, milestoneHeading, milestoneList, edgeHeading, edgeList);
}

function historicalRevealButton(
  presentation: HistoricalWebviewPresentationV1,
  occurrence: Record<string, unknown>,
): HTMLButtonElement | null {
  const navigation = navigationFor(presentation, occurrence);
  if (navigation === null) return null;
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = `Open immutable source at ${navigation.commitId}`;
  button.addEventListener("click", () => {
    vscode.postMessage({
      kind: "revealHistoricalSource",
      historyResultId: presentation.historyResultId,
      bindingId: navigation.bindingId,
    });
  });
  return button;
}

function renderHistoricalOutline(
  presentation: HistoricalWebviewPresentationV1,
): void {
  outline.replaceChildren();
  const historical = presentation.historicalGraph;
  if (historical === null) {
    const unavailable = document.createElement("p");
    unavailable.textContent = "No safe historical semantic payload is available.";
    outline.append(unavailable);
    return;
  }
  const request = document.createElement("p");
  request.textContent =
    `Requested ${String(historical.request["requested_endpoint"] ?? "unknown")}; ` +
    `resolved ${String(historical.evidence["resolved_endpoint"] ?? "unavailable")}; ` +
    `lower ${String(historical.evidence["resolved_lower_boundary"] ?? "none")}; ` +
    `ancestry ${String(historical.request["ancestry_profile"] ?? "unknown")}; ` +
    `view ${String(historical.request["view"] ?? "unknown")}; ` +
    `selected ${historical.selectedSnapshotCommitId ?? "none"}; ` +
    `analysis ${String(historical.request["analysis_mode"] ?? "none")}.`;
  const occurrenceHeading = document.createElement("h3");
  occurrenceHeading.textContent = "Historical occurrences";
  const occurrenceList = document.createElement("ol");
  const occurrences = historicalOccurrences(presentation);
  const displayIds = allocateHistoricalCompactIds(occurrences);
  for (const occurrence of occurrences) {
    const item = document.createElement("li");
    const occurrenceId = String(occurrence["occurrence_id"] ?? "unknown");
    const displayId = displayIds.get(occurrenceId) ??
      String(occurrence["source_id"] ?? "unknown");
    item.id = historicalDetailId(displayId);
    item.className = "entity-detail";
    item.tabIndex = -1;
    const semantic = record(occurrence["semantic"])
      ? occurrence["semantic"]
      : null;
    const description = semantic !== null && typeof semantic["description"] === "string"
      ? semantic["description"]
      : null;
    item.append(...detailIntroduction(
      displayId,
      String(occurrence["source_id"] ?? "unknown"),
      historicalLabel(occurrence),
      description,
    ));
    const summary = document.createElement("p");
    summary.textContent =
      `${String(occurrence["entity_kind"] ?? "entity")} ` +
      `occurrence ${occurrenceId}; first ` +
      `${String(occurrence["first_observed_commit_id"] ?? "unknown")}; last ` +
      `${String(occurrence["last_observed_commit_id"] ?? "unknown")}; ` +
      `${occurrence["retired_at_commit_id"] === null ? "current" :
        `retired at ${String(occurrence["retired_at_commit_id"])}`}; ` +
      `${occurrence["entity_kind"] === "task"
        ? "task time unavailable in HistoricalGraphResult.v1"
        : "task time not applicable"}.`;
    item.append(summary);
    const actions = document.createElement("div");
    actions.className = "detail-actions";
    const reveal = historicalRevealButton(presentation, occurrence);
    if (reveal !== null) actions.append(reveal);
    actions.append(backToGraphButton(historicalGraphId(displayId), displayId));
    item.append(actions);
    occurrenceList.append(item);
  }
  const timelineHeading = document.createElement("h3");
  timelineHeading.textContent = "Timeline and continuity";
  const timelineList = document.createElement("ol");
  if (record(historical.timeline)) {
    for (const entry of recordArray(historical.timeline["entries"])) {
      const item = document.createElement("li");
      const parents = Array.isArray(entry["parent_commit_ids"])
        ? entry["parent_commit_ids"].join(", ")
        : "none";
      const transition = record(entry["transition"])
        ? String(entry["transition"]["class"] ?? "unknown")
        : "none";
      item.textContent =
        `Commit ${String(entry["commit_id"] ?? "unknown")}; parents ${parents}; ` +
        `merge ${String(entry["is_merge_commit"] ?? false)}; validity ` +
        `${String(entry["validity"] ?? "unknown")}; segment ` +
        `${String(entry["segment_ordinal"] ?? "none")}; transition ${transition}; ` +
        `topology ${String(entry["topology_epoch_id"] ?? "none")}.`;
      timelineList.append(item);
    }
  }
  const causeHeading = document.createElement("h3");
  causeHeading.textContent = "Historical causes";
  const causeList = document.createElement("ul");
  for (const cause of historical.causes) {
    const item = document.createElement("li");
    item.textContent =
      `${String(cause["cause"] ?? "unknown")}; subject ` +
      `${String(cause["subject"] ?? "unknown")}; commit ` +
      `${String(cause["commit_id"] ?? "none")}.`;
    causeList.append(item);
  }
  if (causeList.childElementCount === 0) {
    const item = document.createElement("li");
    item.textContent = "No historical causes.";
    causeList.append(item);
  }
  outline.append(
    request,
    occurrenceHeading,
    occurrenceList,
    timelineHeading,
    timelineList,
    causeHeading,
    causeList,
  );
}

function renderDiagnostics(
  result: GraphViewResultV1 | HistoricalWebviewPresentationV1 | null,
): void {
  diagnostics.replaceChildren();
  if (result === null || result.diagnostics.items.length === 0) {
    const row = document.createElement("li");
    row.textContent = "No diagnostics.";
    diagnostics.append(row);
    return;
  }
  for (const item of result.diagnostics.items) {
    const row = document.createElement("li");
    row.textContent = `${item.severity} ${item.code}: ${item.message}`;
    diagnostics.append(row);
  }
  if (result.diagnostics.truncated) {
    const row = document.createElement("li");
    row.textContent = "Additional diagnostics were truncated by the semantic result.";
    diagnostics.append(row);
  }
}

function focusButtons(
  container: HTMLElement,
  result: GraphViewResultV1 | null,
  ids: readonly string[],
  entity: "milestone" | "edge",
  empty: string,
): void {
  container.replaceChildren();
  if (ids.length === 0) {
    const text = document.createElement("p");
    text.className = "focus-empty";
    text.textContent = empty;
    container.append(text);
    return;
  }
  const list = document.createElement("ul");
  list.className = "focus-list";
  for (const id of ids) {
    const item = document.createElement("li");
    if (result?.graph === null || result === null) {
      item.textContent = id;
    } else if (entity === "milestone") {
      const semantic = compactEntity("milestone", id);
      item.append(revealButton(
        result,
        "milestone",
        id,
        semantic === null ? id : `${semantic.compactId} · ${semantic.title}`,
      ));
    } else {
      const edge = result.graph.edges.find((candidate) => candidate.id === id);
      if (edge === undefined) item.textContent = id;
      else {
        const semantic = compactEntity(edge.kind, id);
        const taskTime = edge.kind === "task"
          ? currentFocus?.focus?.timeSummary.taskTimes.find((value) =>
              value.taskId === id
            ) ?? null
          : null;
        const time = taskTime === null
          ? ""
          : ` · ${formatPresentationDuration(taskTime.taskTime)}${
            taskTime.pointForecast === null
              ? ""
              : ` → ${formatPresentationDuration(taskTime.pointForecast)}`}`;
        item.append(revealButton(
          result,
          edge.kind,
          id,
          `${semantic?.compactId ?? id} · ${semantic?.title ?? edge.label}${time}`,
        ));
      }
    }
    list.append(item);
  }
  container.append(list);
}

function historicalExactText(value: unknown): string {
  if (!record(value)) return "unavailable";
  const display = value["display"];
  const unit = value["unit"];
  const numerator = value["numerator"];
  const denominator = value["denominator"];
  return typeof display === "string" && typeof unit === "string" &&
      typeof numerator === "string" && typeof denominator === "string"
    ? formatPresentationDuration({ display, unit, numerator, denominator })
    : "unavailable";
}

function historicalExactTitle(value: unknown): string {
  if (!record(value)) return "unavailable";
  const display = value["display"];
  const unit = value["unit"];
  const numerator = value["numerator"];
  const denominator = value["denominator"];
  return typeof display === "string" && typeof unit === "string" &&
      typeof numerator === "string" && typeof denominator === "string"
    ? `${display} ${unit} (${numerator}/${denominator})`
    : "unavailable";
}

function renderTimeSummary(
  scopeValue: "current" | "historical",
  focusResult: DagFocusResultV1 | null,
  historicalResult: HistoricalWebviewPresentationV1 | null,
): void {
  timeSummary.replaceChildren();
  const list = document.createElement("dl");
  const add = (term: string, value: string, exact: string | null = null): void => {
    const label = document.createElement("dt");
    label.textContent = term;
    const description = document.createElement("dd");
    description.textContent = value;
    if (exact !== null) description.title = `Exact: ${exact}`;
    list.append(label, description);
  };
  if (scopeValue === "current") {
    const summary = focusResult?.status === "current"
      ? focusResult.focus?.timeSummary ?? null
      : null;
    if (summary === null) {
      add("Residual", "Unavailable");
      add("Remaining", "Unavailable");
    } else {
      const conversion = summary.pointConversion;
      add(
        "Residual",
        `${exactText(summary.residualTime)}${conversion.residualTime === null
          ? ""
          : `; ${exactText(conversion.residualTime)} by velocity`}`,
        `${exactTitle(summary.residualTime)}${conversion.residualTime === null
          ? ""
          : `; ${exactTitle(conversion.residualTime)} by velocity`}`,
      );
      add(
        "Remaining",
        `${exactText(summary.remainingTime)}${conversion.remainingTime === null
          ? ""
          : `; ${exactText(conversion.remainingTime)} by velocity`}`,
        `${exactTitle(summary.remainingTime)}${conversion.remainingTime === null
          ? ""
          : `; ${exactTitle(conversion.remainingTime)} by velocity`}`,
      );
      if (conversion.status === "unavailable") {
        add("Point conversion", conversion.reason ?? "Unavailable");
      }
    }
  } else {
    const analysis = historicalResult?.historicalGraph?.analysis ?? null;
    const precedence = record(analysis?.["precedence"])
      ? analysis["precedence"]
      : null;
    const resource = record(analysis?.["resource"])
      ? analysis["resource"]
      : null;
    add(
      "Residual",
      historicalExactText(precedence?.["makespan"]),
      historicalExactTitle(precedence?.["makespan"]),
    );
    add(
      "Remaining",
      historicalExactText(resource?.["makespan"]),
      historicalExactTitle(resource?.["makespan"]),
    );
    if (analysis?.["duration_unit"] === "point") {
      add(
        "Point conversion",
        "Unavailable: the historical result does not carry checkpoint velocity.",
      );
    }
  }
  timeSummary.append(list);
}

function renderFocusSummary(
  result: GraphViewResultV1 | null,
  focusResult: DagFocusResultV1 | null,
): void {
  const focus = focusResult?.status === "current" ? focusResult.focus : null;
  focusButtons(
    currentMilestones,
    result,
    focus?.frontierMilestoneIds ?? [],
    "milestone",
    focusResult === null ? "Focus unavailable" : "No current frontier",
  );
  focusButtons(
    criticalPath,
    result,
    result?.graph?.precedence?.representativePathEdgeIds ?? [],
    "edge",
    result?.analysisMode === "none" || result?.analysisMode === "resource"
      ? "Enable critical-path analysis"
      : "No remaining critical path",
  );
  const safeStop = focus?.safeStopReasons ?? [];
  focusButtons(
    nextTasks,
    result,
    focus?.startableTaskIds ?? [],
    "edge",
    safeStop.length > 0
      ? `Safe stop: ${safeStop.join(", ")}`
      : focusResult === null
        ? "Start authority unavailable"
        : "No task is startable now",
  );
}

function acceptanceSourceButton(
  result: MilestoneAcceptanceViewResultV1,
  bindingId: string,
  label: string,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", () => {
    vscode.postMessage({
      kind: "revealAcceptanceSource",
      documentUri: result.document.uri,
      documentGeneration: result.document.generation,
      documentVersion: result.document.version,
      bindingId,
    });
  });
  return button;
}

function renderMilestoneAcceptance(
  result: MilestoneAcceptanceViewResultV1 | null,
): void {
  milestoneAcceptance.replaceChildren();
  if (result === null) {
    milestoneAcceptance.textContent = "Milestone acceptance view is unavailable.";
    return;
  }
  if (result.status !== "current" || result.acceptance === null) {
    milestoneAcceptance.textContent = result.reason ??
      "Milestone acceptance view is unavailable.";
    return;
  }
  const summary = document.createElement("p");
  summary.textContent = result.acceptance.availability === "available"
    ? `Grammar ${result.acceptance.grammarVersion}; acceptance model 1.`
    : `Grammar ${result.acceptance.grammarVersion}; milestone acceptance is not applicable.`;
  const list = document.createElement("ol");
  for (const item of result.acceptance.milestones) {
    const row = document.createElement("li");
    row.className = `acceptance-${item.acceptance}`;
    const heading = document.createElement("h3");
    heading.textContent = `${item.milestoneId}: ${item.title}`;
    const state = document.createElement("p");
    state.textContent = `Closure ${item.closure}; acceptance ${item.acceptance}${
      item.grandfathered ? "; grandfathered" : ""
    }.`;
    const actions = document.createElement("div");
    actions.className = "detail-actions";
    actions.append(acceptanceSourceButton(
      result,
      item.milestoneBindingId,
      "Open milestone",
    ));
    if (item.criterionSetBindingId !== null) {
      actions.append(acceptanceSourceButton(
        result,
        item.criterionSetBindingId,
        "Open criteria",
      ));
    }
    row.append(heading, state, actions);
    if (item.blockingRequiredCriterionIds.length > 0) {
      const blocked = document.createElement("p");
      blocked.textContent =
        `Blocking required criteria: ${item.blockingRequiredCriterionIds.join(", ")}.`;
      row.append(blocked);
    }
    if (item.criteria.length > 0) {
      const criteria = document.createElement("ul");
      for (const criterion of item.criteria) {
        const criterionRow = document.createElement("li");
        const detail = document.createElement("p");
        detail.textContent = `${criterion.criterionId} (${criterion.required
          ? "required"
          : "optional"}, ${criterion.evidenceKind}): ${criterion.state}. ${
          criterion.description
        }`;
        const provenance = document.createElement("p");
        provenance.textContent = criterion.effectiveReceiptId === null
          ? "No effective receipt."
          : `Receipt ${criterion.effectiveReceiptId}; verifier ${
            criterion.verifier ?? "unavailable"
          }; asserted ${criterion.assertedAt ?? "unavailable"}; evidence ${
            criterion.evidenceReference ?? "unavailable"
          } @ ${criterion.evidenceRevision ?? "unavailable"}.`;
        const criterionActions = document.createElement("div");
        criterionActions.className = "detail-actions";
        criterionActions.append(acceptanceSourceButton(
          result,
          criterion.criterionBindingId,
          "Open criterion",
        ));
        if (criterion.effectiveReceiptBindingId !== null) {
          criterionActions.append(acceptanceSourceButton(
            result,
            criterion.effectiveReceiptBindingId,
            "Open receipt",
          ));
        }
        criterionRow.append(detail, provenance, criterionActions);
        criteria.append(criterionRow);
      }
      row.append(criteria);
    }
    list.append(row);
  }
  milestoneAcceptance.append(summary, list);
}

function render(value: RenderMessageV1): void {
  current = value.result;
  currentFocus = value.focusResult;
  currentHistorical = value.historicalResult;
  currentAcceptance = value.acceptanceResult;
  status.textContent = value.message;
  status.dataset.state = value.state;
  mode.value = value.analysisMode;
  scope.value = value.scope;
  historicalControls.hidden = value.scope !== "historical";
  mode.disabled = value.result === null;
  renderFocusSummary(value.result, value.focusResult);
  renderTimeSummary(value.scope, value.focusResult, value.historicalResult);
  renderMilestoneAcceptance(value.acceptanceResult);
  graph.replaceChildren();
  outline.replaceChildren();
  if (value.scope === "historical") {
    renderDiagnostics(value.historicalResult);
    if (value.historicalResult !== null) {
      renderHistoricalGraph(value.historicalResult);
      renderHistoricalOutline(value.historicalResult);
    }
  } else {
    renderDiagnostics(value.result);
  }
  if (
    value.scope === "current" && value.state === "current" &&
    value.result !== null
  ) {
    renderGraph(value.result);
    renderOutline(value.result);
  }
}

mode.addEventListener("change", () => {
  if (current === null || !analysisMode(mode.value)) return;
  if (scope.value === "historical") {
    requestHistoricalGraph();
    return;
  }
  vscode.postMessage({
    kind: "selectAnalysisMode",
    documentUri: current.document.uri,
    documentGeneration: current.document.generation,
    documentVersion: current.document.version,
    analysisMode: mode.value,
  });
});

function historicalGraphView(value: unknown): value is HistoricalGraphView {
  return value === "snapshot" || value === "lineage" || value === "timeline";
}

function historicalGraphAncestry(
  value: unknown,
): value is HistoricalGraphAncestryProfile {
  return value === "first_parent" || value === "three_way";
}

function requestHistoricalGraph(): void {
  if (
    current === null || !analysisMode(mode.value) ||
    !historicalGraphView(historicalView.value) ||
    !historicalGraphAncestry(historicalAncestry.value)
  ) return;
  const endpoint = historicalEndpoint.value.trim();
  const lower = historicalLower.value.trim();
  const snapshot = historicalSnapshot.value.trim();
  if (
    endpoint.length === 0 || endpoint.length > 1_024 ||
    /[\u0000\r\n]/u.test(endpoint) || lower.length > 1_024 ||
    /[\u0000\r\n]/u.test(lower) ||
    (historicalView.value === "snapshot" && snapshot.length > 0 &&
      !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(snapshot))
  ) {
    status.textContent = "The historical revision query is invalid.";
    status.dataset.state = "unavailable";
    return;
  }
  vscode.postMessage({
    kind: "requestHistoricalGraph",
    documentUri: current.document.uri,
    documentGeneration: current.document.generation,
    documentVersion: current.document.version,
    requestedEndpoint: endpoint,
    lowerBoundary: lower === "" ? null : lower,
    ancestryProfile: historicalAncestry.value,
    view: historicalView.value,
    snapshotCommitId:
      historicalView.value === "snapshot" && snapshot !== "" ? snapshot : null,
    analysisMode: mode.value,
  });
}

scope.addEventListener("change", () => {
  historicalControls.hidden = scope.value !== "historical";
  if (scope.value === "historical") {
    requestHistoricalGraph();
  } else if (current !== null) {
    render({
      kind: "render",
      editorProtocolModelVersion,
      state: current.status === "current" ? "current" : current.status,
      message: "The current document DAG is selected.",
      analysisMode: current.analysisMode,
      result: current,
      focusResult: currentFocus,
      historicalResult: currentHistorical,
      acceptanceResult: currentAcceptance,
      scope: "current",
    });
  }
});

historicalView.addEventListener("change", () => {
  historicalSnapshot.disabled = historicalView.value !== "snapshot";
  if (historicalView.value !== "snapshot") historicalSnapshot.value = "";
});
historicalRun.addEventListener("click", requestHistoricalGraph);

zoomOut.addEventListener("click", () => applyZoom(zoom / 1.2));
zoomIn.addEventListener("click", () => applyZoom(zoom * 1.2));
zoomFit.addEventListener("click", fitGraph);

viewport.addEventListener("wheel", (event) => {
  if (!(event.ctrlKey || event.metaKey)) return;
  event.preventDefault();
  const bounds = viewport.getBoundingClientRect();
  const contentX = (viewport.scrollLeft + event.clientX - bounds.left) / zoom;
  const contentY = (viewport.scrollTop + event.clientY - bounds.top) / zoom;
  applyZoom(event.deltaY < 0 ? zoom * 1.12 : zoom / 1.12);
  viewport.scrollLeft = contentX * zoom - (event.clientX - bounds.left);
  viewport.scrollTop = contentY * zoom - (event.clientY - bounds.top);
}, { passive: false });

viewport.addEventListener("keydown", (event) => {
  if (event.key === "+" || event.key === "=") {
    event.preventDefault();
    applyZoom(zoom * 1.2);
  } else if (event.key === "-") {
    event.preventDefault();
    applyZoom(zoom / 1.2);
  } else if (event.key === "0") {
    event.preventDefault();
    fitGraph();
  }
});

let pan: { readonly x: number; readonly y: number; readonly left: number; readonly top: number } | null = null;
viewport.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || (event.target !== viewport && event.target !== graph)) return;
  pan = {
    x: event.clientX,
    y: event.clientY,
    left: viewport.scrollLeft,
    top: viewport.scrollTop,
  };
  viewport.setPointerCapture(event.pointerId);
  viewport.classList.add("panning");
});
viewport.addEventListener("pointermove", (event) => {
  if (pan === null) return;
  viewport.scrollLeft = pan.left - (event.clientX - pan.x);
  viewport.scrollTop = pan.top - (event.clientY - pan.y);
});
const stopPan = (event: PointerEvent): void => {
  if (pan === null) return;
  pan = null;
  viewport.classList.remove("panning");
  if (viewport.hasPointerCapture(event.pointerId)) {
    viewport.releasePointerCapture(event.pointerId);
  }
};
viewport.addEventListener("pointerup", stopPan);
viewport.addEventListener("pointercancel", stopPan);

window.addEventListener("message", (event: MessageEvent<unknown>) => {
  const message = renderMessage(event.data);
  if (message !== null) render(message);
});

vscode.postMessage({
  kind: "ready",
  editorProtocolModelVersion,
});
