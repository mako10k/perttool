import {
  CodeActionKind,
  ErrorCodes,
  LSPErrorCodes,
  type CodeAction,
  type CodeActionParams,
  type CompletionItem,
  type CompletionParams,
  type DefinitionParams,
  type DidChangeTextDocumentParams,
  type DidCloseTextDocumentParams,
  type DidOpenTextDocumentParams,
  type DocumentSymbol,
  type DocumentSymbolParams,
  type Hover,
  type HoverParams,
  type InitializeParams,
  type InitializeResult,
  type Location,
  type PublishDiagnosticsParams,
} from "vscode-languageserver/node.js";
import {
  createDocumentSession,
  type DocumentProjectionStatus,
  type DocumentSession,
  type DocumentSessionFailureReason,
  type DocumentSnapshot,
} from "perttool/core";
import {
  completions,
  definition,
  documentSymbols,
  editorHelp,
  graphViewResult,
  helpCodeActions,
  hover,
  publishedDiagnostics,
} from "./projection.js";
import {
  EDITOR_HELP_SCHEMA_VERSION,
  EDITOR_PROTOCOL_MODEL_VERSION,
  DAG_FOCUS_PROTOCOL_MODEL_VERSION,
  DAG_FOCUS_SCHEMA_VERSION,
  GRAPH_VIEW_SCHEMA_VERSION,
  HISTORICAL_EDITOR_PROTOCOL_MODEL_VERSION,
  HISTORICAL_GRAPH_VIEW_SCHEMA_VERSION,
  HISTORICAL_SOURCE_SCHEMA_VERSION,
  PerttoolProtocolError,
  isGraphViewAnalysisMode,
  isHistoricalGraphAncestryProfile,
  isHistoricalGraphView,
  type EditorHelpParamsV1,
  type EditorHelpResultV1,
  type DagFocusApplicationV1,
  type DagFocusParamsV1,
  type DagFocusProjectionV1,
  type DagFocusResultV1,
  type GraphViewParamsV1,
  type GraphViewResultV1,
  type HistoricalEditorApplicationV1,
  type HistoricalGraphEditorProjectionV1,
  type HistoricalGraphViewParamsV1,
  type HistoricalGraphViewResultV1,
  type HistoricalSourceBindingV1,
  type HistoricalSourceParamsV1,
  type HistoricalSourceResultV1,
  type PerttoolExperimentalCapabilitiesV1,
} from "./protocol.js";

export interface PerttoolLanguageServerOptions {
  readonly digestText: (text: string) => string;
  readonly maxDiagnostics?: number;
  readonly publishDiagnostics: (params: PublishDiagnosticsParams) => void;
  readonly onFatalSynchronization?: (
    reason: DocumentSessionFailureReason,
  ) => void;
  readonly historicalApplication?: HistoricalEditorApplicationV1;
  readonly dagFocusApplication?: DagFocusApplicationV1;
}

export interface PerttoolLanguageServer {
  readonly customProtocolNegotiated: boolean;
  readonly historicalProtocolNegotiated: boolean;
  readonly dagFocusProtocolNegotiated: boolean;
  readonly stopped: boolean;
  initialize(params: InitializeParams): InitializeResult;
  didOpen(params: DidOpenTextDocumentParams): void;
  didChange(params: DidChangeTextDocumentParams): void;
  didClose(params: DidCloseTextDocumentParams): void;
  documentSymbol(
    params: DocumentSymbolParams,
    signal?: AbortSignal,
  ): Promise<readonly DocumentSymbol[]>;
  documentHover(params: HoverParams, signal?: AbortSignal): Promise<Hover | null>;
  completion(
    params: CompletionParams,
    signal?: AbortSignal,
  ): Promise<readonly CompletionItem[]>;
  documentDefinition(
    params: DefinitionParams,
    signal?: AbortSignal,
  ): Promise<Location | null>;
  codeAction(
    params: CodeActionParams,
    signal?: AbortSignal,
  ): Promise<readonly CodeAction[]>;
  help(params: unknown, signal?: AbortSignal): Promise<EditorHelpResultV1>;
  graphView(params: unknown, signal?: AbortSignal): Promise<GraphViewResultV1>;
  dagFocus(params: unknown, signal?: AbortSignal): Promise<DagFocusResultV1>;
  historicalGraphView(
    params: unknown,
    signal?: AbortSignal,
  ): Promise<HistoricalGraphViewResultV1>;
  historicalSource(
    params: unknown,
    signal?: AbortSignal,
  ): Promise<HistoricalSourceResultV1>;
  shutdown(): void;
  exit(): void;
}

function record(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(
  value: Readonly<Record<string, unknown>>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
}

function isAbsoluteDocumentUri(uri: string): boolean {
  if (!/^[A-Za-z][A-Za-z0-9+.-]*:/u.test(uri)) return false;
  try {
    return new URL(uri).protocol.length > 1;
  } catch {
    return false;
  }
}

function validPosition(value: unknown): value is {
  readonly line: number;
  readonly character: number;
} {
  return (
    record(value) &&
    Number.isSafeInteger(value["line"]) &&
    (value["line"] as number) >= 0 &&
    Number.isSafeInteger(value["character"]) &&
    (value["character"] as number) >= 0
  );
}

function incrementalChanges(value: unknown): readonly {
  readonly range: {
    readonly start: { readonly line: number; readonly character: number };
    readonly end: { readonly line: number; readonly character: number };
  };
  readonly text: string;
}[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const result = [];
  for (const change of value) {
    if (
      !record(change) ||
      typeof change["text"] !== "string" ||
      !record(change["range"]) ||
      !validPosition(change["range"]["start"]) ||
      !validPosition(change["range"]["end"])
    ) {
      return null;
    }
    result.push({
      range: {
        start: change["range"]["start"],
        end: change["range"]["end"],
      },
      text: change["text"],
    });
  }
  return result;
}

function customProtocolSelected(options: unknown): boolean {
  if (!record(options) || !record(options["perttool"])) return false;
  const perttool = options["perttool"];
  if (
    !Array.isArray(perttool["editorProtocolModelVersions"]) ||
    !Array.isArray(perttool["graphViewResultSchemaVersions"]) ||
    !Array.isArray(perttool["editorHelpResultSchemaVersions"])
  ) {
    return false;
  }
  return (
    perttool["editorProtocolModelVersions"].includes(EDITOR_PROTOCOL_MODEL_VERSION) &&
    perttool["graphViewResultSchemaVersions"].includes(GRAPH_VIEW_SCHEMA_VERSION) &&
    perttool["editorHelpResultSchemaVersions"].includes(EDITOR_HELP_SCHEMA_VERSION)
  );
}

function dagFocusProtocolSelected(
  options: unknown,
  applicationAvailable: boolean,
): boolean {
  if (!applicationAvailable || !record(options) || !record(options["perttool"])) {
    return false;
  }
  const perttool = options["perttool"];
  return (
    Array.isArray(perttool["dagFocusProtocolModelVersions"]) &&
    perttool["dagFocusProtocolModelVersions"].includes(
      DAG_FOCUS_PROTOCOL_MODEL_VERSION,
    ) &&
    Array.isArray(perttool["dagFocusResultSchemaVersions"]) &&
    perttool["dagFocusResultSchemaVersions"].includes(DAG_FOCUS_SCHEMA_VERSION)
  );
}

interface HistoricalSessionV1 {
  readonly workspaceTrust: "trusted" | "untrusted";
  readonly workspaceFolderUris: readonly string[];
}

function historicalProtocolSelected(
  options: unknown,
  applicationAvailable: boolean,
): HistoricalSessionV1 | null {
  if (!applicationAvailable || !record(options) || !record(options["perttool"])) {
    return null;
  }
  const perttool = options["perttool"];
  const local = perttool["historicalLocalRepository"];
  if (
    !Array.isArray(perttool["historicalEditorProtocolModelVersions"]) ||
    !Array.isArray(perttool["historicalGraphViewResultSchemaVersions"]) ||
    !Array.isArray(perttool["historicalSourceResultSchemaVersions"]) ||
    !record(local) ||
    !exactKeys(local, ["workspaceTrust", "workspaceFolderUris"]) ||
    (local["workspaceTrust"] !== "trusted" &&
      local["workspaceTrust"] !== "untrusted") ||
    !Array.isArray(local["workspaceFolderUris"]) ||
    !local["workspaceFolderUris"].every((uri) =>
      typeof uri === "string" && isAbsoluteDocumentUri(uri)
    )
  ) {
    return null;
  }
  if (
    !perttool["historicalEditorProtocolModelVersions"].includes(
      HISTORICAL_EDITOR_PROTOCOL_MODEL_VERSION,
    ) ||
    !perttool["historicalGraphViewResultSchemaVersions"].includes(
      HISTORICAL_GRAPH_VIEW_SCHEMA_VERSION,
    ) ||
    !perttool["historicalSourceResultSchemaVersions"].includes(
      HISTORICAL_SOURCE_SCHEMA_VERSION,
    )
  ) {
    return null;
  }
  return Object.freeze({
    workspaceTrust: local["workspaceTrust"],
    workspaceFolderUris: Object.freeze([
      ...local["workspaceFolderUris"] as string[],
    ]),
  });
}

function initializeCapabilities(
  custom: boolean,
  historical: boolean,
  dagFocus: boolean,
): InitializeResult["capabilities"] {
  const experimental: PerttoolExperimentalCapabilitiesV1 = {
    perttool: {
      editorProtocolModelVersion: EDITOR_PROTOCOL_MODEL_VERSION,
      graphViewResultSchemaVersion: GRAPH_VIEW_SCHEMA_VERSION,
      editorHelpResultSchemaVersion: EDITOR_HELP_SCHEMA_VERSION,
      graphViewAnalysisModes: ["none", "precedence", "resource", "both"],
      ...(dagFocus
        ? {
            dagFocusProtocolModelVersion: DAG_FOCUS_PROTOCOL_MODEL_VERSION,
            dagFocusResultSchemaVersion: DAG_FOCUS_SCHEMA_VERSION,
          }
        : {}),
      ...(historical
        ? {
            historicalEditorProtocolModelVersion:
              HISTORICAL_EDITOR_PROTOCOL_MODEL_VERSION,
            historicalGraphViewResultSchemaVersion:
              HISTORICAL_GRAPH_VIEW_SCHEMA_VERSION,
            historicalSourceResultSchemaVersion: HISTORICAL_SOURCE_SCHEMA_VERSION,
            historicalGraphViews: ["snapshot", "lineage", "timeline"] as const,
            historicalAncestryProfiles: ["first_parent", "three_way"] as const,
          }
        : {}),
    },
  };
  return {
    positionEncoding: "utf-16",
    textDocumentSync: { openClose: true, change: 2 },
    documentSymbolProvider: true,
    hoverProvider: true,
    completionProvider: { resolveProvider: false },
    definitionProvider: true,
    codeActionProvider: { codeActionKinds: [CodeActionKind.QuickFix] },
    ...(custom ? { experimental } : {}),
  };
}

function validateHelpParams(value: unknown): EditorHelpParamsV1 {
  if (
    !record(value) ||
    !exactKeys(value, ["topicId", "level"]) ||
    typeof value["topicId"] !== "string" ||
    value["topicId"].length === 0 ||
    (value["level"] !== "quick" && value["level"] !== "detail")
  ) {
    throw new PerttoolProtocolError(
      ErrorCodes.InvalidParams,
      "perttool/help parameters are invalid",
    );
  }
  return {
    topicId: value["topicId"],
    level: value["level"] as "quick" | "detail",
  };
}

function validateGraphViewParams(value: unknown): GraphViewParamsV1 {
  if (
    !record(value) ||
    !exactKeys(value, ["textDocument", "documentVersion", "analysisMode"]) ||
    !record(value["textDocument"]) ||
    !exactKeys(value["textDocument"], ["uri"]) ||
    typeof value["textDocument"]["uri"] !== "string" ||
    !isAbsoluteDocumentUri(value["textDocument"]["uri"]) ||
    !Number.isSafeInteger(value["documentVersion"]) ||
    !isGraphViewAnalysisMode(value["analysisMode"])
  ) {
    throw new PerttoolProtocolError(
      ErrorCodes.InvalidParams,
      "perttool/graphView parameters are invalid",
    );
  }
  return {
    textDocument: { uri: value["textDocument"]["uri"] },
    documentVersion: value["documentVersion"] as number,
    analysisMode: value["analysisMode"],
  };
}

function validateDagFocusParams(value: unknown): DagFocusParamsV1 {
  if (
    !record(value) ||
    !exactKeys(value, ["textDocument", "documentVersion"]) ||
    !record(value["textDocument"]) ||
    !exactKeys(value["textDocument"], ["uri"]) ||
    typeof value["textDocument"]["uri"] !== "string" ||
    !isAbsoluteDocumentUri(value["textDocument"]["uri"]) ||
    !Number.isSafeInteger(value["documentVersion"])
  ) {
    throw new PerttoolProtocolError(
      ErrorCodes.InvalidParams,
      "perttool/dagFocus parameters are invalid",
    );
  }
  return {
    textDocument: { uri: value["textDocument"]["uri"] },
    documentVersion: value["documentVersion"] as number,
  };
}

function validStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) =>
    typeof item === "string" && item.length > 0
  );
}

function validDagExactValue(value: unknown): boolean {
  return record(value) && exactKeys(value, [
    "numerator",
    "denominator",
    "unit",
    "display",
  ]) &&
    typeof value["numerator"] === "string" &&
    /^-?(?:0|[1-9][0-9]*)$/u.test(value["numerator"]) &&
    typeof value["denominator"] === "string" &&
    /^(?:[1-9][0-9]*)$/u.test(value["denominator"]) &&
    (value["unit"] === "point" || value["unit"] === "hour" ||
      value["unit"] === "day") &&
    typeof value["display"] === "string" && value["display"].length > 0;
}

function validDagDisplayEntity(value: unknown): boolean {
  if (!record(value) || !exactKeys(value, [
    "kind",
    "id",
    "compactId",
    "title",
    "description",
  ])) return false;
  const prefix = value["kind"] === "milestone"
    ? "M"
    : value["kind"] === "task"
      ? "T"
      : value["kind"] === "gate"
        ? "G"
        : null;
  return prefix !== null &&
    typeof value["id"] === "string" && value["id"].length > 0 &&
    typeof value["compactId"] === "string" &&
    new RegExp(`^${prefix}[0-9]{2,}$`, "u").test(value["compactId"]) &&
    typeof value["title"] === "string" && value["title"].length > 0 &&
    (value["description"] === null || typeof value["description"] === "string");
}

function validDagTimeSummary(value: unknown): boolean {
  if (!record(value) || !exactKeys(value, [
    "residualTime",
    "remainingTime",
    "taskTimes",
    "pointConversion",
  ]) ||
    !validDagExactValue(value["residualTime"]) ||
    !validDagExactValue(value["remainingTime"]) ||
    !Array.isArray(value["taskTimes"]) ||
    !value["taskTimes"].every((task) =>
      record(task) && exactKeys(task, ["taskId", "taskTime", "pointForecast"]) &&
      typeof task["taskId"] === "string" && task["taskId"].length > 0 &&
      validDagExactValue(task["taskTime"]) &&
      (task["pointForecast"] === null || validDagExactValue(task["pointForecast"]))
    ) ||
    !record(value["pointConversion"]) ||
    !exactKeys(value["pointConversion"], [
      "status",
      "targetUnit",
      "residualTime",
      "remainingTime",
      "reason",
    ])) return false;
  const residual = value["residualTime"] as Readonly<Record<string, unknown>>;
  const remaining = value["remainingTime"] as Readonly<Record<string, unknown>>;
  const taskTimes = value["taskTimes"] as readonly Readonly<Record<string, unknown>>[];
  if (residual["unit"] !== remaining["unit"] ||
    taskTimes.some((task) =>
      (task["taskTime"] as Readonly<Record<string, unknown>>)["unit"] !==
        residual["unit"]
    ) ||
    new Set(taskTimes.map(({ taskId }) => String(taskId))).size !== taskTimes.length) {
    return false;
  }
  const conversion = value["pointConversion"];
  if (
    conversion["status"] !== "available" &&
    conversion["status"] !== "unavailable" &&
    conversion["status"] !== "not_applicable"
  ) return false;
  if (conversion["status"] === "available") {
    return residual["unit"] === "point" &&
      (conversion["targetUnit"] === "hour" || conversion["targetUnit"] === "day") &&
      validDagExactValue(conversion["residualTime"]) &&
      validDagExactValue(conversion["remainingTime"]) &&
      (conversion["residualTime"] as Readonly<Record<string, unknown>>)["unit"] ===
        conversion["targetUnit"] &&
      (conversion["remainingTime"] as Readonly<Record<string, unknown>>)["unit"] ===
        conversion["targetUnit"] &&
      taskTimes.every((task) =>
        record(task["pointForecast"]) &&
        task["pointForecast"]["unit"] === conversion["targetUnit"]
      ) &&
      conversion["reason"] === null;
  }
  return (conversion["status"] === "unavailable"
      ? residual["unit"] === "point"
      : residual["unit"] === "day" || residual["unit"] === "hour") &&
    taskTimes.every((task) => task["pointForecast"] === null) &&
    conversion["targetUnit"] === null &&
    conversion["residualTime"] === null &&
    conversion["remainingTime"] === null &&
    (conversion["status"] === "not_applicable"
      ? conversion["reason"] === null
      : typeof conversion["reason"] === "string" && conversion["reason"].length > 0);
}

function validDagFocusProjection(value: unknown): value is DagFocusProjectionV1 {
  if (!record(value) || !exactKeys(value, [
    "frontierMilestoneIds",
    "activeTaskIds",
    "readyTaskIds",
    "recommendedTaskIds",
    "startableTaskIds",
    "safeStopReasons",
    "entities",
    "timeSummary",
  ])) return false;
  const stringLists = [
    value["frontierMilestoneIds"],
    value["activeTaskIds"],
    value["readyTaskIds"],
    value["recommendedTaskIds"],
    value["startableTaskIds"],
    value["safeStopReasons"],
  ];
  if (!stringLists.every(validStringArray) ||
    !Array.isArray(value["entities"]) ||
    !value["entities"].every(validDagDisplayEntity) ||
    !validDagTimeSummary(value["timeSummary"])) return false;
  const entities = value["entities"] as readonly Readonly<Record<string, unknown>>[];
  const entityKeys = entities.map(({ kind, id }) => `${String(kind)}\u0000${String(id)}`);
  const compactIds = entities.map(({ compactId }) => String(compactId));
  const milestones = new Set(
    entities.filter(({ kind }) => kind === "milestone").map(({ id }) => String(id)),
  );
  const tasks = new Set(
    entities.filter(({ kind }) => kind === "task").map(({ id }) => String(id)),
  );
  const summary = value["timeSummary"] as Readonly<Record<string, unknown>>;
  const taskTimes = summary["taskTimes"] as readonly Readonly<Record<string, unknown>>[];
  const taskTimeIds = new Set(taskTimes.map(({ taskId }) => String(taskId)));
  const taskLists = [
    value["activeTaskIds"],
    value["readyTaskIds"],
    value["recommendedTaskIds"],
    value["startableTaskIds"],
  ] as readonly (readonly string[])[];
  return new Set(entityKeys).size === entityKeys.length &&
    new Set(compactIds).size === compactIds.length &&
    [...value["frontierMilestoneIds"] as readonly string[]].every((id) =>
      milestones.has(id)
    ) &&
    taskLists.every((ids) => ids.every((id) => tasks.has(id))) &&
    tasks.size === taskTimeIds.size && [...tasks].every((id) => taskTimeIds.has(id));
}

function validRevision(value: unknown, nullable = false): boolean {
  if (nullable && value === null) return true;
  return typeof value === "string" && value.length > 0 && value.length <= 1_024 &&
    !/[\u0000\r\n]/u.test(value);
}

function validateHistoricalGraphViewParams(
  value: unknown,
): HistoricalGraphViewParamsV1 {
  if (
    !record(value) ||
    !exactKeys(value, [
      "textDocument",
      "documentVersion",
      "requestedEndpoint",
      "lowerBoundary",
      "ancestryProfile",
      "view",
      "snapshotCommitId",
      "analysisMode",
    ]) ||
    !record(value["textDocument"]) ||
    !exactKeys(value["textDocument"], ["uri"]) ||
    typeof value["textDocument"]["uri"] !== "string" ||
    !isAbsoluteDocumentUri(value["textDocument"]["uri"]) ||
    !Number.isSafeInteger(value["documentVersion"]) ||
    !validRevision(value["requestedEndpoint"]) ||
    !validRevision(value["lowerBoundary"], true) ||
    !isHistoricalGraphAncestryProfile(value["ancestryProfile"]) ||
    !isHistoricalGraphView(value["view"]) ||
    (
      value["snapshotCommitId"] !== null &&
      (
        typeof value["snapshotCommitId"] !== "string" ||
        !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(value["snapshotCommitId"])
      )
    ) ||
    (value["view"] !== "snapshot" && value["snapshotCommitId"] !== null) ||
    !isGraphViewAnalysisMode(value["analysisMode"])
  ) {
    throw new PerttoolProtocolError(
      ErrorCodes.InvalidParams,
      "perttool/historicalGraphView parameters are invalid",
    );
  }
  return {
    textDocument: { uri: value["textDocument"]["uri"] },
    documentVersion: value["documentVersion"] as number,
    requestedEndpoint: value["requestedEndpoint"] as string,
    lowerBoundary: value["lowerBoundary"] as string | null,
    ancestryProfile: value["ancestryProfile"],
    view: value["view"],
    snapshotCommitId: value["snapshotCommitId"] as string | null,
    analysisMode: value["analysisMode"],
  };
}

function validateHistoricalSourceParams(
  value: unknown,
): HistoricalSourceParamsV1 {
  if (
    !record(value) ||
    !exactKeys(value, [
      "textDocument",
      "documentVersion",
      "historyResultId",
      "bindingId",
    ]) ||
    !record(value["textDocument"]) ||
    !exactKeys(value["textDocument"], ["uri"]) ||
    typeof value["textDocument"]["uri"] !== "string" ||
    !isAbsoluteDocumentUri(value["textDocument"]["uri"]) ||
    !Number.isSafeInteger(value["documentVersion"]) ||
    typeof value["historyResultId"] !== "string" ||
    !/^sha256:[0-9a-f]{64}$/u.test(value["historyResultId"]) ||
    typeof value["bindingId"] !== "string" ||
    !/^sha256:[0-9a-f]{64}$/u.test(value["bindingId"])
  ) {
    throw new PerttoolProtocolError(
      ErrorCodes.InvalidParams,
      "perttool/historicalSource parameters are invalid",
    );
  }
  return {
    textDocument: { uri: value["textDocument"]["uri"] },
    documentVersion: value["documentVersion"] as number,
    historyResultId: value["historyResultId"] as `sha256:${string}`,
    bindingId: value["bindingId"] as `sha256:${string}`,
  };
}

function projectionError(status: DocumentProjectionStatus): PerttoolProtocolError {
  if (status === "cancelled") {
    return new PerttoolProtocolError(
      LSPErrorCodes.RequestCancelled,
      "request cancelled",
    );
  }
  return new PerttoolProtocolError(
    LSPErrorCodes.ContentModified,
    "document content changed before the request completed",
  );
}

function isAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  const entries = Object.entries(value as Readonly<Record<string, unknown>>)
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, child]) =>
    `${JSON.stringify(key)}:${canonicalJson(child)}`
  ).join(",")}}`;
}

function historicalDiagnostic(
  code: "PTHED-101" | "PTHED-102" | "PTHED-103" | "PTHED-104" | "PTHED-105",
  message: string,
) {
  return Object.freeze({
    code,
    severity: "warning" as const,
    message,
    range: null,
    related: Object.freeze([]),
    helpTopic: "historical-dag",
  });
}

function dagFocusResult(
  snapshot: DocumentSnapshot,
  status: DagFocusResultV1["status"],
  focus: DagFocusProjectionV1 | null,
  reason: string | null,
): DagFocusResultV1 {
  return Object.freeze({
    schemaVersion: DAG_FOCUS_SCHEMA_VERSION,
    dagFocusProtocolModelVersion: DAG_FOCUS_PROTOCOL_MODEL_VERSION,
    document: snapshot.binding,
    status,
    complete: status === "current",
    reason,
    focus,
  });
}

interface RetainedHistoricalResultV1 {
  readonly targetPath: string;
  readonly result: HistoricalGraphViewResultV1;
  readonly bindings: ReadonlyMap<`sha256:${string}`, HistoricalSourceBindingV1>;
}

function historicalProjectionMatchesRequest(
  projection: HistoricalGraphEditorProjectionV1,
  request: HistoricalGraphViewParamsV1,
): boolean {
  return projection.request["requested_endpoint"] === request.requestedEndpoint &&
    projection.request["requested_lower_boundary"] === request.lowerBoundary &&
    projection.request["ancestry_profile"] === request.ancestryProfile &&
    projection.request["view"] === request.view &&
    projection.request["snapshot_commit_id"] === request.snapshotCommitId &&
    projection.request["analysis_mode"] === request.analysisMode;
}

class ReadOnlyPerttoolLanguageServer implements PerttoolLanguageServer {
  readonly #session: DocumentSession;
  readonly #publishDiagnostics: (params: PublishDiagnosticsParams) => void;
  readonly #onFatalSynchronization:
    | ((reason: DocumentSessionFailureReason) => void)
    | undefined;
  readonly #digestText: (text: string) => string;
  readonly #historicalApplication: HistoricalEditorApplicationV1 | undefined;
  readonly #dagFocusApplication: DagFocusApplicationV1 | undefined;
  readonly #openVersions = new Map<string, number>();
  readonly #historicalRequests = new Map<string, number>();
  readonly #retainedHistorical = new Map<
    `sha256:${string}`,
    RetainedHistoricalResultV1
  >();
  #initialized = false;
  #customProtocolNegotiated = false;
  #dagFocusProtocolNegotiated = false;
  #historicalSession: HistoricalSessionV1 | null = null;
  #stopped = false;

  constructor(options: PerttoolLanguageServerOptions) {
    this.#session = createDocumentSession({
      digestText: options.digestText,
      ...(options.maxDiagnostics === undefined
        ? {}
        : { maxDiagnostics: options.maxDiagnostics }),
    });
    this.#publishDiagnostics = options.publishDiagnostics;
    this.#onFatalSynchronization = options.onFatalSynchronization;
    this.#digestText = options.digestText;
    this.#historicalApplication = options.historicalApplication;
    this.#dagFocusApplication = options.dagFocusApplication;
  }

  get customProtocolNegotiated(): boolean {
    return this.#customProtocolNegotiated;
  }

  get historicalProtocolNegotiated(): boolean {
    return this.#historicalSession !== null;
  }

  get dagFocusProtocolNegotiated(): boolean {
    return this.#dagFocusProtocolNegotiated;
  }

  get stopped(): boolean {
    return this.#stopped;
  }

  #ensureRunning(): void {
    if (this.#stopped) {
      throw new PerttoolProtocolError(
        ErrorCodes.InvalidRequest,
        "language server is stopped",
      );
    }
  }

  #requireCustomProtocol(): void {
    if (!this.#customProtocolNegotiated) {
      throw new PerttoolProtocolError(
        ErrorCodes.MethodNotFound,
        "perttool custom protocol was not negotiated",
      );
    }
  }

  #requireHistoricalProtocol(): HistoricalSessionV1 {
    if (this.#historicalSession === null) {
      throw new PerttoolProtocolError(
        ErrorCodes.MethodNotFound,
        "perttool historical editor protocol was not negotiated",
      );
    }
    return this.#historicalSession;
  }

  #requireDagFocusProtocol(): DagFocusApplicationV1 {
    if (!this.#dagFocusProtocolNegotiated || this.#dagFocusApplication === undefined) {
      throw new PerttoolProtocolError(
        ErrorCodes.MethodNotFound,
        "perttool DAG focus protocol was not negotiated",
      );
    }
    return this.#dagFocusApplication;
  }

  #invalidateHistoricalDocument(uri: string): void {
    this.#historicalRequests.set(uri, (this.#historicalRequests.get(uri) ?? 0) + 1);
    for (const [id, retained] of this.#retainedHistorical) {
      if (retained.result.document.uri === uri) this.#retainedHistorical.delete(id);
    }
  }

  #fatal(reason: DocumentSessionFailureReason): void {
    for (const [uri, version] of this.#openVersions) {
      this.#publishDiagnostics({ uri, version, diagnostics: [] });
    }
    this.#openVersions.clear();
    this.#historicalRequests.clear();
    this.#retainedHistorical.clear();
    this.#session.dispose();
    this.#stopped = true;
    this.#onFatalSynchronization?.(reason);
  }

  initialize(params: InitializeParams): InitializeResult {
    this.#ensureRunning();
    if (this.#initialized) {
      throw new PerttoolProtocolError(
        ErrorCodes.InvalidRequest,
        "language server is already initialized",
      );
    }
    if (!record(params) || !record(params["capabilities"])) {
      throw new PerttoolProtocolError(
        ErrorCodes.InvalidParams,
        "initialize parameters are invalid",
      );
    }
    const capabilities = params["capabilities"];
    const general = record(capabilities["general"])
      ? capabilities["general"]
      : null;
    const encodings = general === null
      ? undefined
      : general["positionEncodings"];
    if (encodings !== undefined && !Array.isArray(encodings)) {
      throw new PerttoolProtocolError(
        ErrorCodes.InvalidParams,
        "positionEncodings must be an array",
      );
    }
    if (encodings !== undefined && !encodings.includes("utf-16")) {
      throw new PerttoolProtocolError(
        ErrorCodes.InvalidParams,
        "perttool language server requires UTF-16 positions",
      );
    }
    this.#customProtocolNegotiated = customProtocolSelected(
      params.initializationOptions,
    );
    this.#historicalSession = historicalProtocolSelected(
      params.initializationOptions,
      this.#historicalApplication !== undefined,
    );
    this.#dagFocusProtocolNegotiated = this.#customProtocolNegotiated &&
      dagFocusProtocolSelected(
        params.initializationOptions,
        this.#dagFocusApplication !== undefined,
      );
    this.#initialized = true;
    return {
      capabilities: initializeCapabilities(
        this.#customProtocolNegotiated,
        this.#historicalSession !== null,
        this.#dagFocusProtocolNegotiated,
      ),
      serverInfo: { name: "perttool language server", version: "0.0.0-private" },
    };
  }

  didOpen(params: DidOpenTextDocumentParams): void {
    this.#ensureRunning();
    if (!record(params) || !record(params["textDocument"])) {
      this.#fatal("invalid_binding");
      return;
    }
    const document = params["textDocument"];
    const uri = document["uri"];
    const languageId = document["languageId"];
    const version = document["version"];
    const text = document["text"];
    if (
      typeof uri !== "string" ||
      languageId !== "pert" ||
      !isAbsoluteDocumentUri(uri) ||
      !Number.isSafeInteger(version) ||
      typeof text !== "string"
    ) {
      this.#fatal("invalid_binding");
      return;
    }
    const transition = this.#session.open({
      uri,
      version: version as number,
      text,
    });
    if (transition.status !== "current" || transition.snapshot === null) {
      this.#fatal(transition.reason ?? "snapshot_unavailable");
      return;
    }
    this.#invalidateHistoricalDocument(uri);
    this.#openVersions.set(uri, version as number);
    this.#publishDiagnostics(publishedDiagnostics(transition.snapshot));
  }

  didChange(params: DidChangeTextDocumentParams): void {
    this.#ensureRunning();
    if (!record(params) || !record(params["textDocument"])) {
      this.#fatal("invalid_binding");
      return;
    }
    const document = params["textDocument"];
    const uri = document["uri"];
    const version = document["version"];
    if (
      typeof uri !== "string" ||
      !isAbsoluteDocumentUri(uri) ||
      !Number.isSafeInteger(version)
    ) {
      this.#fatal("invalid_binding");
      return;
    }
    const rangedChanges = incrementalChanges(params["contentChanges"]);
    if (rangedChanges === null) {
      this.#fatal("invalid_change");
      return;
    }
    const transition = this.#session.change({
      uri,
      version: version as number,
      changes: rangedChanges,
    });
    if (transition.status !== "current" || transition.snapshot === null) {
      this.#fatal(transition.reason ?? "snapshot_unavailable");
      return;
    }
    this.#invalidateHistoricalDocument(uri);
    this.#openVersions.set(uri, version as number);
    this.#publishDiagnostics(publishedDiagnostics(transition.snapshot));
  }

  didClose(params: DidCloseTextDocumentParams): void {
    this.#ensureRunning();
    if (
      !record(params) ||
      !record(params["textDocument"]) ||
      typeof params["textDocument"]["uri"] !== "string" ||
      !isAbsoluteDocumentUri(params["textDocument"]["uri"])
    ) {
      this.#fatal("invalid_binding");
      return;
    }
    const uri = params["textDocument"]["uri"];
    const version = this.#openVersions.get(uri);
    this.#invalidateHistoricalDocument(uri);
    this.#session.close(uri);
    this.#openVersions.delete(uri);
    this.#publishDiagnostics({
      uri,
      ...(version === undefined ? {} : { version }),
      diagnostics: [],
    });
  }

  async #project<Value>(
    uri: string,
    cacheKey: string,
    signal: AbortSignal | undefined,
    compute: (snapshot: DocumentSnapshot) => Value,
  ): Promise<Value | null> {
    this.#ensureRunning();
    const snapshot = this.#session.current(uri);
    if (snapshot === null) return null;
    const result = await this.#session.project({
      binding: snapshot.binding,
      cacheKey,
      ...(signal === undefined ? {} : { signal }),
      allowInvalid: true,
      allowTruncated: true,
      compute,
    });
    if (result.status !== "current") {
      throw projectionError(result.status);
    }
    return result.value;
  }

  async documentSymbol(
    params: DocumentSymbolParams,
    signal?: AbortSignal,
  ): Promise<readonly DocumentSymbol[]> {
    return await this.#project(
      params.textDocument.uri,
      "lsp:documentSymbol:v1",
      signal,
      documentSymbols,
    ) ?? [];
  }

  async documentHover(
    params: HoverParams,
    signal?: AbortSignal,
  ): Promise<Hover | null> {
    return await this.#project(
      params.textDocument.uri,
      `lsp:hover:v1:${params.position.line}:${params.position.character}`,
      signal,
      (snapshot) => hover(snapshot, params.position),
    );
  }

  async completion(
    params: CompletionParams,
    signal?: AbortSignal,
  ): Promise<readonly CompletionItem[]> {
    return await this.#project(
      params.textDocument.uri,
      `lsp:completion:v1:${params.position.line}:${params.position.character}`,
      signal,
      (snapshot) => completions(snapshot, params.position),
    ) ?? [];
  }

  async documentDefinition(
    params: DefinitionParams,
    signal?: AbortSignal,
  ): Promise<Location | null> {
    return await this.#project(
      params.textDocument.uri,
      `lsp:definition:v1:${params.position.line}:${params.position.character}`,
      signal,
      (snapshot) => definition(snapshot, params.position),
    );
  }

  async codeAction(
    params: CodeActionParams,
    signal?: AbortSignal,
  ): Promise<readonly CodeAction[]> {
    if (!this.#customProtocolNegotiated) return [];
    return await this.#project(
      params.textDocument.uri,
      `lsp:codeAction:v1:${JSON.stringify(params.range)}:${JSON.stringify(params.context.diagnostics)}`,
      signal,
      (snapshot) => helpCodeActions(snapshot, params),
    ) ?? [];
  }

  async help(
    params: unknown,
    signal?: AbortSignal,
  ): Promise<EditorHelpResultV1> {
    this.#ensureRunning();
    this.#requireCustomProtocol();
    if (isAborted(signal)) throw projectionError("cancelled");
    const accepted = validateHelpParams(params);
    const result = editorHelp(accepted.topicId, accepted.level);
    await Promise.resolve();
    if (isAborted(signal)) throw projectionError("cancelled");
    return result;
  }

  async graphView(
    params: unknown,
    signal?: AbortSignal,
  ): Promise<GraphViewResultV1> {
    this.#ensureRunning();
    this.#requireCustomProtocol();
    const accepted = validateGraphViewParams(params);
    const snapshot = this.#session.current(accepted.textDocument.uri);
    if (snapshot === null) {
      throw new PerttoolProtocolError(
        ErrorCodes.InvalidParams,
        "perttool/graphView document is not open",
      );
    }
    if (snapshot.binding.version !== accepted.documentVersion) {
      throw projectionError("stale");
    }
    const projection = await this.#session.analyze(
      snapshot.binding,
      { mode: accepted.analysisMode },
      signal,
    );
    if (
      projection.status === "cancelled" ||
      projection.status === "stale" ||
      projection.status === "closed" ||
      projection.status === "desynchronized"
    ) {
      throw projectionError(projection.status);
    }
    if (projection.snapshot === null) {
      throw projectionError("stale");
    }
    return graphViewResult(
      projection.snapshot,
      accepted.analysisMode,
      {
        status:
          projection.status === "invalid"
            ? "invalid"
            : projection.status === "unavailable"
              ? "unavailable"
              : "current",
        binding: projection.binding,
        analysisMode: projection.analysisMode,
        complete: projection.complete,
        diagnostics: projection.diagnostics,
        analysis: projection.analysis,
      },
    );
  }

  async dagFocus(
    params: unknown,
    signal?: AbortSignal,
  ): Promise<DagFocusResultV1> {
    this.#ensureRunning();
    const application = this.#requireDagFocusProtocol();
    const accepted = validateDagFocusParams(params);
    const snapshot = this.#session.current(accepted.textDocument.uri);
    if (snapshot === null) {
      throw new PerttoolProtocolError(
        ErrorCodes.InvalidParams,
        "perttool/dagFocus document is not open",
      );
    }
    if (snapshot.binding.version !== accepted.documentVersion) {
      throw projectionError("stale");
    }
    const projected = await this.#session.project<DagFocusResultV1>({
      binding: snapshot.binding,
      cacheKey: "lsp:dagFocus:v1",
      ...(signal === undefined ? {} : { signal }),
      allowInvalid: true,
      allowTruncated: true,
      compute: async (current) => {
        if (!current.semantic.ok) {
          return dagFocusResult(
            current,
            "invalid",
            null,
            "The synchronized document is invalid.",
          );
        }
        if (current.semantic.diagnosticsTruncated) {
          return dagFocusResult(
            current,
            "unavailable",
            null,
            "The synchronized document diagnostics are truncated.",
          );
        }
        const inspected: unknown = await application.inspect(
          current.text,
          current.binding.sourceDigest,
        );
        if (
          !record(inspected) ||
          !exactKeys(inspected, ["status", "reason", "focus"]) ||
          inspected["status"] !== "current" ||
          inspected["reason"] !== null ||
          !validDagFocusProjection(inspected["focus"])
        ) {
          return dagFocusResult(
            current,
            "unavailable",
            null,
            record(inspected) &&
                typeof inspected["reason"] === "string" &&
                inspected["reason"].length > 0
              ? inspected["reason"]
              : "Complete DAG focus semantics are unavailable.",
          );
        }
        return dagFocusResult(current, "current", inspected["focus"], null);
      },
    });
    if (
      projected.status === "cancelled" ||
      projected.status === "stale" ||
      projected.status === "closed" ||
      projected.status === "desynchronized"
    ) {
      throw projectionError(projected.status);
    }
    if (projected.value === null) throw projectionError("stale");
    return projected.value;
  }

  #sha256(value: unknown): `sha256:${string}` {
    const digest = this.#digestText(canonicalJson(value));
    if (!/^sha256:[0-9a-f]{64}$/u.test(digest)) {
      throw new Error("historical editor digest port returned an invalid digest");
    }
    return digest as `sha256:${string}`;
  }

  #unavailableHistoricalResult(
    snapshot: DocumentSnapshot,
    request: HistoricalGraphViewParamsV1,
    message: string,
  ): HistoricalGraphViewResultV1 {
    const document = {
      uri: snapshot.binding.uri,
      generation: snapshot.binding.generation,
      version: snapshot.binding.version,
      sourceDigest: snapshot.binding.sourceDigest,
    } as const;
    return Object.freeze({
      schemaVersion: HISTORICAL_GRAPH_VIEW_SCHEMA_VERSION,
      historicalEditorProtocolModelVersion:
        HISTORICAL_EDITOR_PROTOCOL_MODEL_VERSION,
      historyResultId: this.#sha256({
        historicalEditorProtocolModelVersion:
          HISTORICAL_EDITOR_PROTOCOL_MODEL_VERSION,
        document,
        request,
        status: "unavailable",
        message,
      }),
      document,
      status: "unavailable",
      complete: false,
      diagnostics: Object.freeze({
        items: Object.freeze([historicalDiagnostic("PTHED-101", message)]),
        truncated: false,
      }),
      historicalGraph: null,
    });
  }

  async historicalGraphView(
    params: unknown,
    signal?: AbortSignal,
  ): Promise<HistoricalGraphViewResultV1> {
    this.#ensureRunning();
    const historicalSession = this.#requireHistoricalProtocol();
    const accepted = validateHistoricalGraphViewParams(params);
    const snapshot = this.#session.current(accepted.textDocument.uri);
    if (snapshot === null) {
      throw new PerttoolProtocolError(
        ErrorCodes.InvalidParams,
        "perttool/historicalGraphView document is not open",
      );
    }
    if (snapshot.binding.version !== accepted.documentVersion) {
      throw projectionError("stale");
    }
    if (isAborted(signal)) throw projectionError("cancelled");
    const requestSerial = (this.#historicalRequests.get(snapshot.binding.uri) ?? 0) + 1;
    this.#historicalRequests.set(snapshot.binding.uri, requestSerial);
    const currentBinding = snapshot.binding;

    if (historicalSession.workspaceTrust !== "trusted") {
      return this.#unavailableHistoricalResult(
        snapshot,
        accepted,
        "PTHED-101: historical repository access requires a trusted workspace",
      );
    }
    const application = this.#historicalApplication;
    if (application === undefined) {
      throw new PerttoolProtocolError(
        ErrorCodes.MethodNotFound,
        "perttool historical Application service is unavailable",
      );
    }
    const localTarget = await application.resolveLocalTarget(
      accepted.textDocument.uri,
      historicalSession.workspaceFolderUris,
    );
    if (isAborted(signal)) throw projectionError("cancelled");
    if (localTarget === null) {
      return this.#unavailableHistoricalResult(
        snapshot,
        accepted,
        "PTHED-101: the document is not an eligible local workspace PERT file",
      );
    }

    const inspected = await application.inspect(
      localTarget.targetPath,
      accepted,
      currentBinding.sourceDigest,
    );
    if (isAborted(signal)) throw projectionError("cancelled");
    const after = this.#session.current(accepted.textDocument.uri);
    if (
      this.#historicalRequests.get(snapshot.binding.uri) !== requestSerial ||
      after === null ||
      after.binding.generation !== currentBinding.generation ||
      after.binding.version !== currentBinding.version ||
      after.binding.sourceDigest !== currentBinding.sourceDigest
    ) {
      throw projectionError("stale");
    }

    const bindingMap = new Map<
      `sha256:${string}`,
      HistoricalSourceBindingV1
    >();
    if (
      inspected.projection !== null &&
      !historicalProjectionMatchesRequest(inspected.projection, accepted)
    ) {
      throw new PerttoolProtocolError(
        ErrorCodes.InternalError,
        "PTHED-105: historical Application result does not match the request",
      );
    }
    const projection = inspected.projection === null
      ? null
      : Object.freeze({
          ...inspected.projection,
          source_bindings: Object.freeze(
            inspected.projection.source_bindings.map((binding) => {
              const bindingId = this.#sha256({
                historicalEditorProtocolModelVersion:
                  HISTORICAL_EDITOR_PROTOCOL_MODEL_VERSION,
                repositoryId: binding.repository_id,
                repositoryRelativePath: binding.repository_relative_path,
                commitId: binding.commit_id,
                blobId: binding.blob_id,
                sourceDigest: binding.source_digest,
                declarationKind: binding.declaration_kind,
                sourceId: binding.source_id,
                ownerPath: binding.owner_path,
                range: binding.range,
              });
              bindingMap.set(bindingId, binding);
              return Object.freeze({ ...binding, binding_id: bindingId });
            }),
          ),
        }) satisfies HistoricalGraphEditorProjectionV1;
    const document = {
      uri: currentBinding.uri,
      generation: currentBinding.generation,
      version: currentBinding.version,
      sourceDigest: currentBinding.sourceDigest,
    } as const;
    const semanticProjectionDigest = this.#sha256(projection);
    const evidence = projection?.evidence;
    const historyResultId = this.#sha256({
      historicalEditorProtocolModelVersion:
        HISTORICAL_EDITOR_PROTOCOL_MODEL_VERSION,
      document,
      request: projection?.request ?? accepted,
      evidence: evidence === undefined
        ? null
        : {
            repository_id: evidence["repository_id"] ?? null,
            repository_read_snapshot_id:
              evidence["repository_read_snapshot_id"] ?? null,
            resolved_endpoint: evidence["resolved_endpoint"] ?? null,
            resolved_lower_boundary: evidence["resolved_lower_boundary"] ?? null,
          },
      semanticProjectionDigest,
    });
    const status = projection?.status ?? "unavailable";
    const result: HistoricalGraphViewResultV1 = Object.freeze({
      schemaVersion: HISTORICAL_GRAPH_VIEW_SCHEMA_VERSION,
      historicalEditorProtocolModelVersion:
        HISTORICAL_EDITOR_PROTOCOL_MODEL_VERSION,
      historyResultId,
      document,
      status,
      complete: status === "complete",
      diagnostics: Object.freeze({
        items: Object.freeze(inspected.diagnostics.map((diagnostic) =>
          Object.freeze({
            ...diagnostic,
            range: null,
            related: Object.freeze([]),
            helpTopic: "historical-dag",
          })
        )),
        truncated: inspected.diagnosticsTruncated,
      }),
      historicalGraph: projection,
    });

    for (const [id, retained] of this.#retainedHistorical) {
      if (retained.result.document.uri === document.uri) {
        this.#retainedHistorical.delete(id);
      }
    }
    while (this.#retainedHistorical.size >= 32) {
      const oldest = this.#retainedHistorical.keys().next().value as
        | `sha256:${string}`
        | undefined;
      if (oldest === undefined) break;
      this.#retainedHistorical.delete(oldest);
    }
    this.#retainedHistorical.set(historyResultId, Object.freeze({
      targetPath: localTarget.targetPath,
      result,
      bindings: bindingMap,
    }));
    return result;
  }

  async historicalSource(
    params: unknown,
    signal?: AbortSignal,
  ): Promise<HistoricalSourceResultV1> {
    this.#ensureRunning();
    this.#requireHistoricalProtocol();
    const accepted = validateHistoricalSourceParams(params);
    if (isAborted(signal)) throw projectionError("cancelled");
    const retained = this.#retainedHistorical.get(accepted.historyResultId);
    const snapshot = this.#session.current(accepted.textDocument.uri);
    if (
      retained === undefined ||
      snapshot === null ||
      retained.result.document.uri !== accepted.textDocument.uri ||
      retained.result.document.version !== accepted.documentVersion ||
      snapshot.binding.generation !== retained.result.document.generation ||
      snapshot.binding.version !== retained.result.document.version ||
      snapshot.binding.sourceDigest !== retained.result.document.sourceDigest
    ) {
      throw projectionError("stale");
    }
    const binding = retained.bindings.get(accepted.bindingId);
    if (binding === undefined || this.#historicalApplication === undefined) {
      throw new PerttoolProtocolError(
        ErrorCodes.InvalidRequest,
        "PTHED-103: retained historical source binding is unavailable",
      );
    }
    const loaded = await this.#historicalApplication.loadSource(
      retained.targetPath,
      binding,
    );
    if (isAborted(signal)) throw projectionError("cancelled");
    const current = this.#session.current(accepted.textDocument.uri);
    if (
      loaded === null ||
      current === null ||
      current.binding.generation !== retained.result.document.generation ||
      current.binding.version !== retained.result.document.version ||
      current.binding.sourceDigest !== retained.result.document.sourceDigest ||
      this.#retainedHistorical.get(accepted.historyResultId) !== retained
    ) {
      throw new PerttoolProtocolError(
        ErrorCodes.InvalidRequest,
        "PTHED-103: historical blob or retained result verification failed",
      );
    }
    const repositoryToken = this.#sha256(binding.repository_id).slice(7, 23);
    const basename = binding.repository_relative_path.split("/").at(-1) ?? "plan.pert";
    const virtualUri = new URL(
      `perttool-history://${repositoryToken}/${accepted.bindingId.slice(7)}/${encodeURIComponent(`${binding.commit_id} ${basename}`)}`,
    );
    virtualUri.searchParams.set("commit", binding.commit_id);
    return Object.freeze({
      schemaVersion: HISTORICAL_SOURCE_SCHEMA_VERSION,
      historicalEditorProtocolModelVersion:
        HISTORICAL_EDITOR_PROTOCOL_MODEL_VERSION,
      historyResultId: accepted.historyResultId,
      bindingId: accepted.bindingId,
      virtualDocument: Object.freeze({
        uri: virtualUri.toString(),
        languageId: "pert",
        repositoryRelativePath: binding.repository_relative_path,
        commitId: binding.commit_id,
        blobId: binding.blob_id,
        sourceDigest: binding.source_digest,
        text: loaded.text,
        range: loaded.range,
      }),
    });
  }

  shutdown(): void {
    if (this.#stopped) return;
    this.#session.dispose();
    this.#openVersions.clear();
    this.#historicalRequests.clear();
    this.#retainedHistorical.clear();
    this.#historicalSession = null;
    this.#dagFocusProtocolNegotiated = false;
    this.#stopped = true;
  }

  exit(): void {
    this.shutdown();
  }
}

export function createPerttoolLanguageServer(
  options: PerttoolLanguageServerOptions,
): PerttoolLanguageServer {
  return new ReadOnlyPerttoolLanguageServer(options);
}
