import {
  editorProtocolModelVersion,
  parseGraphViewResult,
  type GraphViewAnalysisMode,
  type GraphViewEdgeV1,
  type GraphViewExactValueV1,
  type GraphViewResultV1,
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
}

const vscode = acquireVsCodeApi();
const svgNamespace = "http://www.w3.org/2000/svg";
const status = requiredElement("status");
const graph = requiredElement("graph") as unknown as SVGSVGElement;
const outline = requiredElement("outline");
const diagnostics = requiredElement("diagnostics");
const mode = requiredElement("analysis-mode") as HTMLSelectElement;
let current: GraphViewResultV1 | null = null;

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
      "kind",
      "message",
      "result",
      "state",
    ]) ||
    record.kind !== "render" ||
    record.editorProtocolModelVersion !== editorProtocolModelVersion ||
    !["empty", "loading", "current", "invalid", "unavailable", "stale", "cancelled"]
      .includes(record.state as string) ||
    typeof record.message !== "string" ||
    !analysisMode(record.analysisMode)
  ) {
    return null;
  }
  const result = record.result === null ? null : parseGraphViewResult(record.result);
  if (record.result !== null && result === null) return null;
  if (record.state === "current" && result?.status !== "current") return null;
  if (record.state !== "current" && result?.status === "current") return null;
  return {
    kind: "render",
    editorProtocolModelVersion,
    state: record.state as PresentationState,
    message: record.message,
    analysisMode: record.analysisMode,
    result,
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

function renderDiagnostics(result: GraphViewResultV1 | null): void {
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
  status.textContent = value.message;
  status.dataset.state = value.state;
  mode.value = value.analysisMode;
  mode.disabled = value.result === null;
  graph.replaceChildren();
  outline.replaceChildren();
  renderDiagnostics(value.result);
  if (value.state === "current" && value.result !== null) {
    renderGraph(value.result);
    renderOutline(value.result);
  }
}

mode.addEventListener("change", () => {
  if (current === null || !analysisMode(mode.value)) return;
  vscode.postMessage({
    kind: "selectAnalysisMode",
    documentUri: current.document.uri,
    documentGeneration: current.document.generation,
    documentVersion: current.document.version,
    analysisMode: mode.value,
  });
});

window.addEventListener("message", (event: MessageEvent<unknown>) => {
  const message = renderMessage(event.data);
  if (message !== null) render(message);
});

vscode.postMessage({
  kind: "ready",
  editorProtocolModelVersion,
});
