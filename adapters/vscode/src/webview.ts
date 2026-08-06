import {
  editorProtocolModelVersion,
  parseGraphViewResult,
  type GraphViewAnalysisMode,
  type GraphViewEdgeV1,
  type GraphViewExactValueV1,
  type GraphViewResultV1,
  type HistoricalGraphAncestryProfile,
  type HistoricalGraphView,
  type HistoricalWebviewPresentationV1,
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
  readonly historicalResult: HistoricalWebviewPresentationV1 | null;
  readonly scope: "current" | "historical";
}

const vscode = acquireVsCodeApi();
const svgNamespace = "http://www.w3.org/2000/svg";
const status = requiredElement("status");
const graph = requiredElement("graph") as unknown as SVGSVGElement;
const outline = requiredElement("outline");
const diagnostics = requiredElement("diagnostics");
const mode = requiredElement("analysis-mode") as HTMLSelectElement;
const scope = requiredElement("dag-scope") as HTMLSelectElement;
const historicalControls = requiredElement("historical-controls") as HTMLFieldSetElement;
const historicalEndpoint = requiredElement("historical-endpoint") as HTMLInputElement;
const historicalLower = requiredElement("historical-lower") as HTMLInputElement;
const historicalAncestry = requiredElement("historical-ancestry") as HTMLSelectElement;
const historicalView = requiredElement("historical-view") as HTMLSelectElement;
const historicalSnapshot = requiredElement("historical-snapshot") as HTMLInputElement;
const historicalRun = requiredElement("historical-run") as HTMLButtonElement;
let current: GraphViewResultV1 | null = null;
let currentHistorical: HistoricalWebviewPresentationV1 | null = null;
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
      "analysisMode",
      "editorProtocolModelVersion",
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
  const historicalResult = record.historicalResult === null
    ? null
    : historicalPresentation(record.historicalResult);
  if (record.historicalResult !== null && historicalResult === null) return null;
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
    historicalResult,
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
    : `${value.display} ${value.unit} (${value.numerator}/${value.denominator})`;
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

function makeInteractive(
  element: Element,
  result: GraphViewResultV1,
  entityKind: "milestone" | "task" | "gate",
  entityId: string,
): void {
  element.setAttribute("role", "button");
  element.setAttribute("tabindex", "0");
  element.setAttribute("aria-label", `Reveal ${entityKind} ${entityId} in source`);
  const reveal = (): void => entityMessage(result, entityKind, entityId);
  element.addEventListener("click", reveal);
  element.addEventListener("keydown", (event) => {
    if (event instanceof KeyboardEvent && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      reveal();
    }
  });
}

function edgeClass(edge: GraphViewEdgeV1): string {
  const values = ["edge", `kind-${edge.kind}`];
  if (edge.status !== null) values.push(`status-${edge.status}`);
  if (edge.precedence?.critical === true) values.push("critical");
  if (edge.precedence?.driving === true) values.push("driving");
  if (edge.resource?.scheduleCritical === true) values.push("schedule-critical");
  return values.join(" ");
}

function renderGraph(result: GraphViewResultV1): void {
  graph.replaceChildren();
  if (result.graph === null) return;
  const semantic = result.graph;
  const count = Math.max(semantic.milestones.length, 1);
  const columns = Math.max(1, Math.ceil(Math.sqrt(count)));
  const rows = Math.ceil(count / columns);
  const width = Math.max(420, columns * 230 + 80);
  const height = Math.max(260, rows * 180 + 80);
  graph.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const marker = svgElement("marker");
  marker.setAttribute("id", "dag-arrow");
  marker.setAttribute("viewBox", "0 0 10 10");
  marker.setAttribute("refX", "9");
  marker.setAttribute("refY", "5");
  marker.setAttribute("markerWidth", "6");
  marker.setAttribute("markerHeight", "6");
  marker.setAttribute("orient", "auto-start-reverse");
  const arrow = svgElement("path");
  arrow.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
  marker.append(arrow);
  const defs = svgElement("defs");
  defs.append(marker);
  graph.append(defs);

  const positions = new Map<string, { readonly x: number; readonly y: number }>();
  semantic.milestones.forEach((item, index) => {
    positions.set(item.id, {
      x: 150 + (index % columns) * 230,
      y: 90 + Math.floor(index / columns) * 180,
    });
  });

  for (const edge of semantic.edges) {
    const source = positions.get(edge.sourceMilestoneId);
    const target = positions.get(edge.targetMilestoneId);
    if (source === undefined || target === undefined) continue;
    const group = svgElement("g");
    group.setAttribute("class", edgeClass(edge));
    makeInteractive(group, result, edge.kind, edge.id);
    const line = svgElement("line");
    line.setAttribute("x1", String(source.x));
    line.setAttribute("y1", String(source.y));
    line.setAttribute("x2", String(target.x));
    line.setAttribute("y2", String(target.y));
    line.setAttribute("marker-end", "url(#dag-arrow)");
    const label = svgElement("text");
    label.setAttribute("x", String((source.x + target.x) / 2));
    label.setAttribute("y", String((source.y + target.y) / 2 - 10));
    label.textContent = edge.label;
    group.append(line, label);
    graph.append(group);
  }

  for (const milestone of semantic.milestones) {
    const point = positions.get(milestone.id);
    if (point === undefined) continue;
    const group = svgElement("g");
    const classes = ["milestone"];
    if (milestone.reached) classes.push("reached");
    if (milestone.precedence?.critical === true) classes.push("critical");
    group.setAttribute("class", classes.join(" "));
    group.setAttribute("transform", `translate(${point.x} ${point.y})`);
    makeInteractive(group, result, "milestone", milestone.id);
    const circle = svgElement("circle");
    circle.setAttribute("r", "25");
    const id = svgElement("text");
    id.setAttribute("class", "milestone-id");
    id.setAttribute("y", "45");
    id.textContent = milestone.id;
    const title = svgElement("title");
    title.textContent = `${milestone.title}; ${milestone.reached ? "reached" : "unreached"}`;
    group.append(title, circle, id);
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

function makeHistoricalInteractive(
  element: Element,
  presentation: HistoricalWebviewPresentationV1,
  occurrence: Record<string, unknown>,
): void {
  const navigation = navigationFor(presentation, occurrence);
  if (navigation === null) return;
  element.setAttribute("role", "button");
  element.setAttribute("tabindex", "0");
  element.setAttribute(
    "aria-label",
    `Open immutable ${navigation.declarationKind} ${navigation.sourceId} at commit ${navigation.commitId}`,
  );
  const reveal = (): void => {
    vscode.postMessage({
      kind: "revealHistoricalSource",
      historyResultId: presentation.historyResultId,
      bindingId: navigation.bindingId,
    });
  };
  element.addEventListener("click", reveal);
  element.addEventListener("keydown", (event) => {
    if (event instanceof KeyboardEvent && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      reveal();
    }
  });
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
  const columns = Math.max(1, Math.ceil(Math.sqrt(Math.max(milestones.length, 1))));
  const rows = Math.max(1, Math.ceil(milestones.length / columns));
  const width = Math.max(420, columns * 230 + 80);
  const height = Math.max(260, rows * 180 + 80);
  graph.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const marker = svgElement("marker");
  marker.setAttribute("id", "dag-arrow");
  marker.setAttribute("viewBox", "0 0 10 10");
  marker.setAttribute("refX", "9");
  marker.setAttribute("refY", "5");
  marker.setAttribute("markerWidth", "6");
  marker.setAttribute("markerHeight", "6");
  marker.setAttribute("orient", "auto-start-reverse");
  const arrow = svgElement("path");
  arrow.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
  marker.append(arrow);
  const defs = svgElement("defs");
  defs.append(marker);
  graph.append(defs);
  const positions = new Map<string, { readonly x: number; readonly y: number }>();
  milestones.forEach((item, index) => {
    const id = String(item["occurrence_id"] ?? "");
    positions.set(id, {
      x: 150 + (index % columns) * 230,
      y: 90 + Math.floor(index / columns) * 180,
    });
  });
  for (const edge of edges) {
    const source = positions.get(String(edge["from_occurrence_id"] ?? ""));
    const target = positions.get(String(edge["to_occurrence_id"] ?? ""));
    if (source === undefined || target === undefined) continue;
    const group = svgElement("g");
    const classes = ["edge", `kind-${String(edge["entity_kind"])}`, "historical"];
    if (edge["retired_at_commit_id"] !== null) classes.push("retired");
    group.setAttribute("class", classes.join(" "));
    makeHistoricalInteractive(group, presentation, edge);
    const line = svgElement("line");
    line.setAttribute("x1", String(source.x));
    line.setAttribute("y1", String(source.y));
    line.setAttribute("x2", String(target.x));
    line.setAttribute("y2", String(target.y));
    line.setAttribute("marker-end", "url(#dag-arrow)");
    const label = svgElement("text");
    label.setAttribute("x", String((source.x + target.x) / 2));
    label.setAttribute("y", String((source.y + target.y) / 2 - 10));
    label.textContent = historicalLabel(edge);
    group.append(line, label);
    graph.append(group);
  }
  for (const milestone of milestones) {
    const point = positions.get(String(milestone["occurrence_id"] ?? ""));
    if (point === undefined) continue;
    const group = svgElement("g");
    const classes = ["milestone", "historical"];
    if (milestone["retired_at_commit_id"] !== null) classes.push("retired");
    group.setAttribute("class", classes.join(" "));
    group.setAttribute("transform", `translate(${point.x} ${point.y})`);
    makeHistoricalInteractive(group, presentation, milestone);
    const circle = svgElement("circle");
    circle.setAttribute("r", "25");
    const label = svgElement("text");
    label.setAttribute("class", "milestone-id");
    label.setAttribute("y", "45");
    label.textContent = String(milestone["source_id"] ?? "unknown");
    const title = svgElement("title");
    title.textContent = `${historicalLabel(milestone)}; ${
      milestone["retired_at_commit_id"] === null ? "current" : "retired"
    }; occurrence ${String(milestone["occurrence_id"] ?? "unknown")}`;
    group.append(title, circle, label);
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
    row.append(revealButton(
      result,
      "milestone",
      item.id,
      `${item.id}: ${item.title}; ${item.reached ? "reached" : "unreached"}; slack ${exactText(item.precedence?.slack ?? null)}`,
    ));
    milestoneList.append(row);
  }
  const edgeHeading = document.createElement("h3");
  edgeHeading.textContent = "Edges";
  const edgeList = document.createElement("ol");
  for (const item of result.graph.edges) {
    const row = document.createElement("li");
    row.append(revealButton(
      result,
      item.kind,
      item.id,
      `${item.kind} ${item.id}: ${item.label}; ${edgeDetails(item)}`,
    ));
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
  for (const occurrence of historicalOccurrences(presentation)) {
    const item = document.createElement("li");
    const summary = document.createElement("p");
    summary.textContent =
      `${String(occurrence["entity_kind"] ?? "entity")} ` +
      `${String(occurrence["source_id"] ?? "unknown")}: ` +
      `${historicalLabel(occurrence)}; occurrence ` +
      `${String(occurrence["occurrence_id"] ?? "unknown")}; first ` +
      `${String(occurrence["first_observed_commit_id"] ?? "unknown")}; last ` +
      `${String(occurrence["last_observed_commit_id"] ?? "unknown")}; ` +
      `${occurrence["retired_at_commit_id"] === null ? "current" :
        `retired at ${String(occurrence["retired_at_commit_id"])}`}.`;
    item.append(summary);
    const reveal = historicalRevealButton(presentation, occurrence);
    if (reveal !== null) item.append(reveal);
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

function render(value: RenderMessageV1): void {
  current = value.result;
  currentHistorical = value.historicalResult;
  status.textContent = value.message;
  status.dataset.state = value.state;
  mode.value = value.analysisMode;
  scope.value = value.scope;
  historicalControls.hidden = value.scope !== "historical";
  mode.disabled = value.result === null;
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
    mode.value = "none";
    requestHistoricalGraph();
  } else if (current !== null) {
    render({
      kind: "render",
      editorProtocolModelVersion,
      state: current.status === "current" ? "current" : current.status,
      message: "The current document DAG is selected.",
      analysisMode: current.analysisMode,
      result: current,
      historicalResult: currentHistorical,
      scope: "current",
    });
  }
});

historicalView.addEventListener("change", () => {
  historicalSnapshot.disabled = historicalView.value !== "snapshot";
  if (historicalView.value !== "snapshot") historicalSnapshot.value = "";
});
historicalRun.addEventListener("click", requestHistoricalGraph);

window.addEventListener("message", (event: MessageEvent<unknown>) => {
  const message = renderMessage(event.data);
  if (message !== null) render(message);
});

vscode.postMessage({
  kind: "ready",
  editorProtocolModelVersion,
});
