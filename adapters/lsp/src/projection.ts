import {
  CodeActionKind,
  CompletionItemKind,
  DiagnosticSeverity,
  MarkupKind,
  Range,
  SymbolKind,
  type CodeAction,
  type CodeActionParams,
  type CompletionItem,
  type Diagnostic as LspDiagnostic,
  type DocumentSymbol,
  type Hover,
  type Location,
  type Position,
  type PublishDiagnosticsParams,
} from "vscode-languageserver/node.js";
import {
  buildResidualGraph,
  compare,
  documentOffsetToPosition,
  documentPositionToOffset,
  formatDecimal,
  getHelp,
  type BaseAnalysisResult,
  type DeclarationNode,
  type Diagnostic as DomainDiagnostic,
  type DocumentAnalysisProjection,
  type DocumentSnapshot,
  type Rational,
  type SourceSpan,
  type TargetDeclarationKind,
} from "perttool/core";
import {
  EDITOR_HELP_SCHEMA_VERSION,
  EDITOR_PROTOCOL_MODEL_VERSION,
  GRAPH_VIEW_SCHEMA_VERSION,
  type EditorHelpResultV1,
  type GraphViewAnalysisMode,
  type GraphViewDiagnosticV1,
  type GraphViewEdgeV1,
  type GraphViewExactValueV1,
  type GraphViewGraphV1,
  type GraphViewMilestoneV1,
  type GraphViewResultV1,
  type GraphViewTaskStatus,
  type OpenHelpCommandArgsV1,
} from "./protocol.js";

type TargetDeclaration = DeclarationNode<TargetDeclarationKind>;

function fieldValue<Value>(
  declaration: TargetDeclaration,
  name: string,
): Value | undefined {
  return declaration.fields.find((field) => field.name === name)?.value as
    | Value
    | undefined;
}

function toRange(snapshot: DocumentSnapshot, span: SourceSpan): Range | null {
  const start = documentOffsetToPosition(snapshot.text, span.start.offset);
  const end = documentOffsetToPosition(snapshot.text, span.end.offset);
  return start === null || end === null ? null : Range.create(start, end);
}

function requiredRange(snapshot: DocumentSnapshot, span: SourceSpan): Range {
  const range = toRange(snapshot, span);
  if (range === null) {
    throw new Error("validated source span is not representable as UTF-16");
  }
  return range;
}

function diagnosticSeverity(
  severity: DomainDiagnostic["severity"],
): DiagnosticSeverity {
  if (severity === "error") return DiagnosticSeverity.Error;
  if (severity === "warning") return DiagnosticSeverity.Warning;
  return DiagnosticSeverity.Information;
}

export function lspDiagnostic(
  snapshot: DocumentSnapshot,
  diagnostic: DomainDiagnostic,
): LspDiagnostic {
  const range =
    diagnostic.span === undefined
      ? Range.create(0, 0, 0, 0)
      : (toRange(snapshot, diagnostic.span) ?? Range.create(0, 0, 0, 0));
  return {
    range,
    severity: diagnosticSeverity(diagnostic.severity),
    code: diagnostic.code,
    source: "perttool",
    message: diagnostic.message,
    ...(diagnostic.related === undefined || diagnostic.related.length === 0
      ? {}
      : {
          relatedInformation: diagnostic.related.flatMap((related) => {
            const relatedRange = toRange(snapshot, related.span);
            return relatedRange === null
              ? []
              : [{
                  location: { uri: snapshot.binding.uri, range: relatedRange },
                  message: related.message,
                }];
          }),
        }),
    data: {
      code: diagnostic.code,
      helpTopic: diagnostic.helpTopic ?? null,
      diagnosticsTruncated: snapshot.semantic.diagnosticsTruncated,
    },
  };
}

export function publishedDiagnostics(
  snapshot: DocumentSnapshot,
): PublishDiagnosticsParams {
  return {
    uri: snapshot.binding.uri,
    version: snapshot.binding.version,
    diagnostics: snapshot.semantic.diagnostics.map((diagnostic) =>
      lspDiagnostic(snapshot, diagnostic)
    ),
  };
}

const symbolKinds: Readonly<Record<string, SymbolKind>> = {
  project: SymbolKind.Package,
  resource: SymbolKind.Variable,
  milestone: SymbolKind.Event,
  task: SymbolKind.Function,
  gate: SymbolKind.Interface,
  task_relation: SymbolKind.Operator,
  plan_seal: SymbolKind.Object,
  task_outcome: SymbolKind.Object,
  assurance_receipt: SymbolKind.Object,
  work_event: SymbolKind.Event,
};

function declarationTitle(declaration: TargetDeclaration): string {
  return fieldValue<string>(declaration, "title") ?? declaration.id;
}

export function documentSymbols(
  snapshot: DocumentSnapshot,
): readonly DocumentSymbol[] {
  if (!snapshot.semantic.ok || snapshot.semantic.diagnosticsTruncated) return [];
  return snapshot.parse.document.declarations.map((declaration) => ({
    name: declaration.id,
    detail: `${declaration.kind}: ${declarationTitle(declaration)}`,
    kind: symbolKinds[declaration.kind] ?? SymbolKind.Object,
    range: requiredRange(snapshot, declaration.span),
    selectionRange: requiredRange(snapshot, declaration.idSpan),
  }));
}

function declarationAt(
  snapshot: DocumentSnapshot,
  offset: number,
): TargetDeclaration | null {
  return snapshot.parse.document.declarations.find(
    (declaration) =>
      offset >= declaration.span.start.offset && offset < declaration.span.end.offset,
  ) ?? null;
}

function wordAt(text: string, offset: number): string | null {
  if (offset < 0 || offset > text.length) return null;
  let start = offset;
  let end = offset;
  while (start > 0 && /[A-Za-z0-9_-]/u.test(text[start - 1]!)) start -= 1;
  while (end < text.length && /[A-Za-z0-9_-]/u.test(text[end]!)) end += 1;
  return start === end ? null : text.slice(start, end);
}

function escapeMarkdown(value: string): string {
  return value.replace(/[\\`*_{}[\]()<>#+.!|>-]/gu, "\\$&");
}

function renderHelpMarkdown(topicId: string, level: "quick" | "detail"): string | null {
  const help = getHelp(topicId, level);
  if (!help.ok) return null;
  const lines = [
    `# ${escapeMarkdown(help.title)}`,
    "",
    escapeMarkdown(help.summary),
  ];
  for (const section of help.sections) {
    lines.push("", `## ${escapeMarkdown(section.title)}`, "", escapeMarkdown(section.body));
  }
  if (help.syntax.length > 0) {
    lines.push("", "## Syntax", "");
    for (const syntax of help.syntax) lines.push(`    ${syntax}`);
  }
  if (help.examples.length > 0) {
    lines.push("", "## Examples", "");
    for (const example of help.examples) {
      lines.push(`- ${escapeMarkdown(example.title)}: ${escapeMarkdown(example.text)}`);
    }
  }
  return lines.join("\n");
}

function syntaxTopic(word: string | null): string | null {
  if (word === null) return null;
  const topics: Readonly<Record<string, string>> = {
    project: "syntax.project",
    resource: "syntax.resource",
    milestone: "syntax.milestone",
    task: "syntax.task",
    gate: "syntax.gate",
    work_event: "syntax.work-event",
  };
  return topics[word] ?? null;
}

export function hover(
  snapshot: DocumentSnapshot,
  position: Position,
): Hover | null {
  const offset = documentPositionToOffset(snapshot.text, position);
  if (offset === null) return null;
  if (!snapshot.semantic.ok || snapshot.semantic.diagnosticsTruncated) {
    const topic = syntaxTopic(wordAt(snapshot.text, offset));
    const value = topic === null ? null : renderHelpMarkdown(topic, "quick");
    return value === null
      ? null
      : { contents: { kind: MarkupKind.Markdown, value } };
  }
  const declaration = declarationAt(snapshot, offset);
  if (declaration === null) return null;
  const facts = [
    `**${escapeMarkdown(declaration.kind)}** \`${escapeMarkdown(declaration.id)}\``,
    "",
    escapeMarkdown(declarationTitle(declaration)),
  ];
  if (declaration.from !== undefined && declaration.to !== undefined) {
    facts.push(
      "",
      `Source: \`${escapeMarkdown(declaration.from)}\``,
      "",
      `Target: \`${escapeMarkdown(declaration.to)}\``,
    );
  }
  const status = fieldValue<string>(declaration, "status");
  if (status !== undefined) facts.push("", `Status: \`${escapeMarkdown(status)}\``);
  return {
    contents: { kind: MarkupKind.Markdown, value: facts.join("\n") },
    range: requiredRange(snapshot, declaration.idSpan),
  };
}

function helpSyntaxLabels(topicId: string): readonly string[] {
  const help = getHelp(topicId, "detail");
  if (!help.ok) return [];
  const labels: string[] = [];
  for (const syntax of help.syntax) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_-]*)/u.exec(syntax);
    if (match?.[1] !== undefined && !labels.includes(match[1])) labels.push(match[1]);
  }
  return labels;
}

export function completions(
  snapshot: DocumentSnapshot,
  position: Position,
): readonly CompletionItem[] {
  const offset = documentPositionToOffset(snapshot.text, position);
  if (offset === null) return [];
  const lineStart = snapshot.text.lastIndexOf("\n", Math.max(0, offset - 1)) + 1;
  const prefix = snapshot.text.slice(lineStart, offset);
  const declaration = declarationAt(snapshot, offset);
  const indented = /^\s+/u.test(prefix);
  const topic = indented && declaration !== null
    ? (syntaxTopic(declaration.kind) ?? "syntax")
    : "syntax";
  return helpSyntaxLabels(topic).map((label) => ({
    label,
    kind: indented ? CompletionItemKind.Field : CompletionItemKind.Keyword,
    detail: indented ? `${declaration?.kind ?? "PERT"} field` : "PERT declaration",
    documentation: {
      kind: MarkupKind.Markdown,
      value: renderHelpMarkdown(topic, "quick") ?? "PERT syntax",
    },
  }));
}

export function definition(
  snapshot: DocumentSnapshot,
  position: Position,
): Location | null {
  if (!snapshot.semantic.ok || snapshot.semantic.diagnosticsTruncated) return null;
  const offset = documentPositionToOffset(snapshot.text, position);
  if (offset === null) return null;
  const id = wordAt(snapshot.text, offset);
  if (id === null) return null;
  const declaration = snapshot.parse.document.declarations.find(
    (candidate) => candidate.id === id,
  );
  return declaration === undefined
    ? null
    : {
        uri: snapshot.binding.uri,
        range: requiredRange(snapshot, declaration.idSpan),
      };
}

function diagnosticHelpTopic(diagnostic: LspDiagnostic): string | null {
  if (typeof diagnostic.data !== "object" || diagnostic.data === null) return null;
  const topic = (diagnostic.data as { readonly helpTopic?: unknown }).helpTopic;
  return typeof topic === "string" && topic.length > 0 ? topic : null;
}

export function helpCodeActions(
  snapshot: DocumentSnapshot,
  params: CodeActionParams,
): readonly CodeAction[] {
  const seen = new Set<string>();
  const actions: CodeAction[] = [];
  for (const diagnostic of params.context.diagnostics) {
    const topicId = diagnosticHelpTopic(diagnostic);
    if (topicId === null || seen.has(topicId)) continue;
    seen.add(topicId);
    const argument: OpenHelpCommandArgsV1 = {
      documentUri: snapshot.binding.uri,
      documentGeneration: snapshot.binding.generation,
      documentVersion: snapshot.binding.version,
      topicId,
    };
    actions.push({
      title: `Open perttool Help: ${topicId}`,
      kind: CodeActionKind.QuickFix,
      diagnostics: [diagnostic],
      command: {
        title: `Open perttool Help: ${topicId}`,
        command: "perttool.openHelp",
        arguments: [argument],
      },
    });
  }
  return actions;
}

export function editorHelp(
  topicId: string,
  level: "quick" | "detail",
): EditorHelpResultV1 {
  const help = getHelp(topicId, level);
  return {
    schemaVersion: EDITOR_HELP_SCHEMA_VERSION,
    editorProtocolModelVersion: EDITOR_PROTOCOL_MODEL_VERSION,
    status: help.ok ? "ok" : "not_found",
    topicId,
    level,
    content: help.ok
      ? {
          kind: "markdown",
          value: renderHelpMarkdown(topicId, level)!,
        }
      : null,
    relatedTopicIds: help.ok ? help.related : [],
  };
}

function graphDiagnostic(
  snapshot: DocumentSnapshot,
  diagnostic: DomainDiagnostic,
): GraphViewDiagnosticV1 {
  return {
    code: diagnostic.code,
    severity: diagnostic.severity,
    message: diagnostic.message,
    range: diagnostic.span === undefined ? null : toRange(snapshot, diagnostic.span),
    related: (diagnostic.related ?? []).flatMap((related) => {
      const range = toRange(snapshot, related.span);
      return range === null
        ? []
        : [{ uri: snapshot.binding.uri, range, message: related.message }];
    }),
    helpTopic: diagnostic.helpTopic ?? null,
  };
}

function exactValue(
  value: Rational,
  unit: string,
  precision: number,
): GraphViewExactValueV1 {
  return {
    numerator: value.numerator.toString(),
    denominator: value.denominator.toString(),
    unit,
    display: formatDecimal(value, precision),
  };
}

function graphStatus(declaration: TargetDeclaration): GraphViewTaskStatus {
  const value = fieldValue<string>(declaration, "status") ?? "planned";
  if (
    value !== "planned" &&
    value !== "active" &&
    value !== "blocked" &&
    value !== "suspended" &&
    value !== "done"
  ) {
    throw new Error(`validated task ${declaration.id} has an unknown status`);
  }
  return value;
}

function graphProjection(
  snapshot: DocumentSnapshot,
  analysisMode: GraphViewAnalysisMode,
  analysis: BaseAnalysisResult | null,
): GraphViewGraphV1 {
  const residual = buildResidualGraph(
    snapshot.parse.document as unknown as Parameters<typeof buildResidualGraph>[0],
  );
  const precision = analysis?.precision ?? 3;
  const durationUnit = residual.durationUnit;
  const precedence = analysisMode === "precedence" || analysisMode === "both"
    ? analysis?.precedence ?? null
    : null;
  const resource = analysisMode === "resource" || analysisMode === "both"
    ? analysis?.resource ?? null
    : null;
  const milestoneTiming = new Map(
    (precedence?.milestones ?? []).map((timing) => [timing.id, timing]),
  );
  const edgeTiming = new Map(
    (precedence?.edges ?? []).map((timing) => [timing.id, timing]),
  );
  const scheduled = new Map(
    (resource?.tasks ?? []).map((task) => [task.id, task]),
  );
  const scheduleCritical = new Set(resource?.scheduleCritical.taskIds ?? []);
  const residualEdges = new Map(residual.edges.map((edge) => [edge.id, edge]));
  const milestones: GraphViewMilestoneV1[] = [];
  const edges: GraphViewEdgeV1[] = [];
  for (const declaration of snapshot.parse.document.declarations) {
    if (declaration.kind === "milestone" && residual.vertices.has(declaration.id)) {
      const timing = milestoneTiming.get(declaration.id);
      milestones.push({
        id: declaration.id,
        title: declarationTitle(declaration),
        reached: residual.effectiveReached.has(declaration.id),
        declarationRange: requiredRange(snapshot, declaration.span),
        selectionRange: requiredRange(snapshot, declaration.idSpan),
        precedence: timing === undefined
          ? null
          : {
              earliest: exactValue(timing.earliest, durationUnit, precision),
              latest: exactValue(timing.latest, durationUnit, precision),
              slack: exactValue(timing.slack, durationUnit, precision),
              critical: compare(timing.slack, residual.criticalEpsilon) <= 0,
            },
      });
      continue;
    }
    if (
      (declaration.kind === "task" || declaration.kind === "gate") &&
      residualEdges.has(declaration.id)
    ) {
      const edge = residualEdges.get(declaration.id)!;
      const timing = edgeTiming.get(declaration.id);
      const schedule = scheduled.get(declaration.id);
      edges.push({
        id: declaration.id,
        kind: declaration.kind,
        sourceMilestoneId: declaration.from!,
        targetMilestoneId: declaration.to!,
        label:
          fieldValue<string>(declaration, "title") ??
          fieldValue<string>(declaration, "reason") ??
          declaration.id,
        status: declaration.kind === "task" ? graphStatus(declaration) : null,
        declarationRange: requiredRange(snapshot, declaration.span),
        selectionRange: requiredRange(snapshot, declaration.idSpan),
        expected: exactValue(edge.expected, durationUnit, precision),
        precedence: timing === undefined
          ? null
          : {
              earliestStart: exactValue(timing.es, durationUnit, precision),
              earliestFinish: exactValue(timing.ef, durationUnit, precision),
              latestStart: exactValue(timing.ls, durationUnit, precision),
              latestFinish: exactValue(timing.lf, durationUnit, precision),
              totalFloat: exactValue(timing.totalFloat, durationUnit, precision),
              freeFloat: exactValue(timing.freeFloat, durationUnit, precision),
              critical: timing.isCritical,
              driving: timing.isDriving,
            },
        resource:
          declaration.kind === "gate" || schedule === undefined
            ? null
            : {
                scheduledStart: exactValue(schedule.start, durationUnit, precision),
                scheduledFinish: exactValue(schedule.finish, durationUnit, precision),
                resourceDelay: exactValue(schedule.resourceWait, durationUnit, precision),
                scheduleCritical: scheduleCritical.has(declaration.id),
              },
      });
    }
  }
  return {
    projectId: residual.project.id,
    finishMilestoneId: residual.finish,
    milestones,
    edges,
    precedence: precedence === null
      ? null
      : {
          makespan: exactValue(precedence.makespan, durationUnit, precision),
          criticalMilestoneIds: precedence.critical.milestoneIds,
          criticalTaskIds: precedence.critical.taskIds,
          criticalGateIds: precedence.critical.gateIds,
          representativePathEdgeIds: precedence.critical.representativePath.edgeIds,
        },
    resource: resource === null
      ? null
      : {
          algorithmId: resource.algorithm.id,
          algorithmVersion: resource.algorithm.version,
          optimal: resource.algorithm.optimal,
          makespan: exactValue(resource.makespan, durationUnit, precision),
          resourceDelay: exactValue(resource.resourceDelay, durationUnit, precision),
          scheduleCriticalTaskIds: resource.scheduleCritical.taskIds,
        },
  };
}

export function graphViewResult(
  snapshot: DocumentSnapshot,
  analysisMode: GraphViewAnalysisMode,
  projection: DocumentAnalysisProjection,
): GraphViewResultV1 {
  const diagnostics = projection.diagnostics.map((diagnostic) =>
    graphDiagnostic(snapshot, diagnostic)
  );
  const document = {
    uri: snapshot.binding.uri,
    generation: snapshot.binding.generation,
    version: snapshot.binding.version,
    sourceDigest: snapshot.binding.sourceDigest,
  } as const;
  const graphDiagnostics = {
    items: diagnostics,
    truncated: snapshot.semantic.diagnosticsTruncated,
  } as const;
  if (projection.status !== "current" || !projection.complete) {
    return {
      schemaVersion: GRAPH_VIEW_SCHEMA_VERSION,
      editorProtocolModelVersion: EDITOR_PROTOCOL_MODEL_VERSION,
      document,
      analysisMode,
      status: projection.status === "invalid" ? "invalid" : "unavailable",
      complete: false,
      diagnostics: graphDiagnostics,
      graph: null,
    };
  }
  return {
    schemaVersion: GRAPH_VIEW_SCHEMA_VERSION,
    editorProtocolModelVersion: EDITOR_PROTOCOL_MODEL_VERSION,
    document,
    analysisMode,
    status: "current",
    complete: true,
    diagnostics: graphDiagnostics,
    graph: graphProjection(snapshot, analysisMode, projection.analysis),
  };
}
