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
  GRAPH_VIEW_SCHEMA_VERSION,
  PerttoolProtocolError,
  isGraphViewAnalysisMode,
  type EditorHelpParamsV1,
  type EditorHelpResultV1,
  type GraphViewParamsV1,
  type GraphViewResultV1,
  type PerttoolExperimentalCapabilitiesV1,
} from "./protocol.js";

export interface PerttoolLanguageServerOptions {
  readonly digestText: (text: string) => string;
  readonly maxDiagnostics?: number;
  readonly publishDiagnostics: (params: PublishDiagnosticsParams) => void;
  readonly onFatalSynchronization?: (
    reason: DocumentSessionFailureReason,
  ) => void;
}

export interface PerttoolLanguageServer {
  readonly customProtocolNegotiated: boolean;
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

function initializeCapabilities(
  custom: boolean,
): InitializeResult["capabilities"] {
  const experimental: PerttoolExperimentalCapabilitiesV1 = {
    perttool: {
      editorProtocolModelVersion: EDITOR_PROTOCOL_MODEL_VERSION,
      graphViewResultSchemaVersion: GRAPH_VIEW_SCHEMA_VERSION,
      editorHelpResultSchemaVersion: EDITOR_HELP_SCHEMA_VERSION,
      graphViewAnalysisModes: ["none", "precedence", "resource", "both"],
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

class ReadOnlyPerttoolLanguageServer implements PerttoolLanguageServer {
  readonly #session: DocumentSession;
  readonly #publishDiagnostics: (params: PublishDiagnosticsParams) => void;
  readonly #onFatalSynchronization:
    | ((reason: DocumentSessionFailureReason) => void)
    | undefined;
  readonly #openVersions = new Map<string, number>();
  #initialized = false;
  #customProtocolNegotiated = false;
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
  }

  get customProtocolNegotiated(): boolean {
    return this.#customProtocolNegotiated;
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

  #fatal(reason: DocumentSessionFailureReason): void {
    for (const [uri, version] of this.#openVersions) {
      this.#publishDiagnostics({ uri, version, diagnostics: [] });
    }
    this.#openVersions.clear();
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
    this.#initialized = true;
    return {
      capabilities: initializeCapabilities(this.#customProtocolNegotiated),
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

  shutdown(): void {
    if (this.#stopped) return;
    this.#session.dispose();
    this.#openVersions.clear();
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
