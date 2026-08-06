import { randomBytes } from "node:crypto";
import * as vscode from "vscode";
import type { LanguageClient } from "vscode-languageclient/node.js";
import {
  editorProtocolModelVersion,
  findGraphEntityRange,
  historicalWebviewPresentation,
  parseGraphViewResult,
  parseHistoricalGraphViewResult,
  parseHistoricalSourceResult,
  parseWebviewMessage,
  type GraphViewAnalysisMode,
  type GraphViewResultV1,
  type HistoricalGraphViewResultV1,
  type HistoricalSourceResultV1,
  type HistoricalWebviewPresentationV1,
  type WebviewToExtensionMessageV1,
} from "./bindings.js";

export const dagViewId = "perttool.dag" as const;

type DagPresentationState =
  | "empty"
  | "loading"
  | "current"
  | "invalid"
  | "unavailable"
  | "stale"
  | "cancelled";

interface DagRenderMessageV1 {
  readonly kind: "render";
  readonly editorProtocolModelVersion: 1;
  readonly state: DagPresentationState;
  readonly message: string;
  readonly analysisMode: GraphViewAnalysisMode;
  readonly result: GraphViewResultV1 | null;
  readonly historicalResult: HistoricalWebviewPresentationV1 | null;
  readonly scope: "current" | "historical";
}

export interface DagViewProviderOptions {
  readonly extensionUri: vscode.Uri;
  readonly client: () => LanguageClient | undefined;
  readonly customCapabilitiesAvailable: () => boolean;
  readonly historicalCapabilitiesAvailable: () => boolean;
  readonly openHistoricalSource: (
    result: HistoricalSourceResultV1,
  ) => Promise<boolean>;
  readonly output: vscode.LogOutputChannel;
}

function activePertDocument(): vscode.TextDocument | null {
  const document = vscode.window.activeTextEditor?.document;
  if (document?.languageId === "pert" && document.uri.scheme !== "perttool-history") {
    return document;
  }
  return vscode.window.visibleTextEditors.find(({ document: candidate }) =>
    candidate.languageId === "pert" && candidate.uri.scheme !== "perttool-history"
  )?.document ?? null;
}

function errorCode(error: unknown): number | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "number"
  ) {
    return error.code;
  }
  return null;
}

function bindingMatches(
  result: GraphViewResultV1,
  message: Extract<
    WebviewToExtensionMessageV1,
    { readonly documentUri: string }
  >,
): boolean {
  return (
    result.document.uri === message.documentUri &&
    result.document.generation === message.documentGeneration &&
    result.document.version === message.documentVersion
  );
}

function asRange(range: {
  readonly start: { readonly line: number; readonly character: number };
  readonly end: { readonly line: number; readonly character: number };
}): vscode.Range {
  return new vscode.Range(
    range.start.line,
    range.start.character,
    range.end.line,
    range.end.character,
  );
}

function nonce(): string {
  return randomBytes(18).toString("base64");
}

export class DagViewProvider implements vscode.WebviewViewProvider {
  readonly #options: DagViewProviderOptions;
  readonly #disposables: vscode.Disposable[] = [];
  #view: vscode.WebviewView | undefined;
  #mode: GraphViewAnalysisMode = "both";
  #result: GraphViewResultV1 | null = null;
  #historicalResult: HistoricalGraphViewResultV1 | null = null;
  #scope: "current" | "historical" = "current";
  #requestSerial = 0;
  #cancellation: vscode.CancellationTokenSource | undefined;
  #refreshTimer: ReturnType<typeof setTimeout> | undefined;
  #presentation: DagRenderMessageV1 = {
    kind: "render",
    editorProtocolModelVersion,
    state: "empty",
    message: "Open a .pert document to display its DAG.",
    analysisMode: "both",
    result: null,
    historicalResult: null,
    scope: "current",
  };

  constructor(options: DagViewProviderOptions) {
    this.#options = options;
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.#view = view;
    const assetRoot = vscode.Uri.joinPath(
      this.#options.extensionUri,
      "dist",
      "webview",
    );
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [assetRoot],
    };
    view.webview.html = this.#html(view.webview, assetRoot);
    this.#disposables.push(
      view.onDidChangeVisibility(() => {
        if (view.visible) this.scheduleRefresh(0);
      }),
      view.webview.onDidReceiveMessage((value: unknown) => {
        void this.#receive(value);
      }),
    );
    this.scheduleRefresh(0);
  }

  async show(options?: {
    readonly historical?: boolean;
    readonly openFirstHistoricalSource?: boolean;
  }): Promise<
    HistoricalGraphViewResultV1["status"] | "missing_document" |
      "missing_result" | "capability_unavailable" | "request_failed" | undefined
  > {
    if (options?.historical !== true) {
      await vscode.commands.executeCommand(`${dagViewId}.focus`);
      this.scheduleRefresh(0);
      return undefined;
    }
    if (this.#refreshTimer !== undefined) {
      clearTimeout(this.#refreshTimer);
      this.#refreshTimer = undefined;
    }
    await this.refresh(true);
    const document = activePertDocument();
    const result = this.#result;
    if (document === null) return "missing_document";
    if (result === null) return "missing_result";
    if (!this.#options.historicalCapabilitiesAvailable()) {
      return "capability_unavailable";
    }
    await vscode.commands.executeCommand(`${dagViewId}.focus`);
    const historical = await this.#requestHistorical({
      kind: "requestHistoricalGraph",
      documentUri: result.document.uri,
      documentGeneration: result.document.generation,
      documentVersion: result.document.version,
      requestedEndpoint: "HEAD",
      lowerBoundary: null,
      ancestryProfile: "first_parent",
      view: "lineage",
      snapshotCommitId: null,
      analysisMode: "none",
    }, document, result);
    if (historical !== null && options.openFirstHistoricalSource === true) {
      const bindingId = historical.historicalGraph?.source_bindings.find(
        (binding) => binding.owner_path === binding.source_id,
      )?.binding_id;
      if (bindingId !== undefined) {
        await this.#openHistoricalBinding(historical, bindingId);
      }
    }
    return historical?.status ?? "request_failed";
  }

  scheduleRefresh(delay = 40): void {
    if (this.#refreshTimer !== undefined) clearTimeout(this.#refreshTimer);
    this.#refreshTimer = setTimeout(() => {
      this.#refreshTimer = undefined;
      void this.refresh();
    }, delay);
  }

  documentChanged(document: vscode.TextDocument): void {
    if (activePertDocument()?.uri.toString() === document.uri.toString()) {
      this.invalidateHistorical("The historical DAG was cleared after a document change.");
      this.scheduleRefresh();
    }
  }

  documentClosed(document: vscode.TextDocument): void {
    if (
      this.#result?.document.uri === document.uri.toString() ||
      this.#historicalResult?.document.uri === document.uri.toString()
    ) {
      this.#clear("empty", "The displayed document was closed.");
    }
  }

  invalidateHistorical(message: string): void {
    this.#historicalResult = null;
    if (this.#scope === "historical") {
      this.#scope = "current";
      this.#publish("stale", message, this.#result);
    }
  }

  async refresh(force = false): Promise<void> {
    if (!force && this.#view !== undefined && !this.#view.visible) return;
    const document = activePertDocument();
    if (document === null) {
      this.#clear("empty", "Open a .pert document to display its DAG.");
      return;
    }
    const client = this.#options.client();
    if (client === undefined || !this.#options.customCapabilitiesAvailable()) {
      this.#clear(
        "unavailable",
        "The version-compatible perttool DAG capability is unavailable.",
      );
      return;
    }

    const serial = ++this.#requestSerial;
    this.#cancellation?.cancel();
    this.#cancellation?.dispose();
    const cancellation = new vscode.CancellationTokenSource();
    this.#cancellation = cancellation;
    const binding = {
      uri: document.uri.toString(),
      version: document.version,
    };
    this.#scope = "current";
    this.#result = null;
    this.#publish("loading", `Loading ${this.#mode} DAG analysis…`, null);

    try {
      const raw = await client.sendRequest<unknown>(
        "perttool/graphView",
        {
          textDocument: { uri: binding.uri },
          documentVersion: binding.version,
          analysisMode: this.#mode,
        },
        cancellation.token,
      );
      if (serial !== this.#requestSerial || cancellation.token.isCancellationRequested) {
        return;
      }
      const current = activePertDocument();
      if (
        current === null ||
        current.uri.toString() !== binding.uri ||
        current.version !== binding.version
      ) {
        this.#clear("stale", "The DAG result became stale before presentation.");
        return;
      }
      const result = parseGraphViewResult(raw);
      if (
        result === null ||
        result.document.uri !== binding.uri ||
        result.document.version !== binding.version ||
        result.analysisMode !== this.#mode
      ) {
        this.#clear("unavailable", "The DAG result failed closed validation.");
        return;
      }
      if (result.status === "current") {
        this.#result = result;
        this.#publish("current", "The DAG is current.", result);
      } else {
        this.#clear(
          result.status,
          result.status === "invalid"
            ? "The current .pert document is invalid; no graph is shown."
            : "A complete graph is unavailable for the current document.",
          result,
        );
      }
    } catch (error) {
      if (serial !== this.#requestSerial) return;
      const code = errorCode(error);
      if (code === -32800 || cancellation.token.isCancellationRequested) {
        this.#clear("cancelled", "The DAG request was cancelled.");
      } else if (code === -32801) {
        this.#clear("stale", "The DAG result was rejected as stale.");
      } else {
        this.#options.output.warn(`DAG request failed closed: ${String(error)}`);
        this.#clear("unavailable", "The DAG request is unavailable.");
      }
    } finally {
      if (this.#cancellation === cancellation) {
        cancellation.dispose();
        this.#cancellation = undefined;
      }
    }
  }

  #publish(
    state: DagPresentationState,
    message: string,
    result: GraphViewResultV1 | null,
  ): void {
    this.#presentation = {
      kind: "render",
      editorProtocolModelVersion,
      state,
      message,
      analysisMode: this.#mode,
      result,
      historicalResult: this.#historicalResult === null
        ? null
        : historicalWebviewPresentation(this.#historicalResult),
      scope: this.#scope,
    };
    void this.#view?.webview.postMessage(this.#presentation);
  }

  #clear(
    state: Exclude<DagPresentationState, "current" | "loading">,
    message: string,
    diagnosticResult: GraphViewResultV1 | null = null,
  ): void {
    this.#requestSerial += 1;
    this.#cancellation?.cancel();
    this.#result = diagnosticResult;
    this.#historicalResult = null;
    this.#scope = "current";
    this.#publish(state, message, diagnosticResult);
  }

  async #receive(value: unknown): Promise<void> {
    const message = parseWebviewMessage(value);
    if (message === null) return;
    if (message.kind === "ready") {
      await this.#view?.webview.postMessage(this.#presentation);
      return;
    }
    if (message.kind === "revealHistoricalSource") {
      const result = this.#historicalResult;
      const document = activePertDocument();
      const client = this.#options.client();
      if (
        result === null || document === null || client === undefined ||
        !this.#options.historicalCapabilitiesAvailable() ||
        result.historyResultId !== message.historyResultId ||
        result.document.uri !== document.uri.toString() ||
        result.document.version !== document.version
      ) {
        this.invalidateHistorical(
          "The historical source action no longer matches the active result.",
        );
        return;
      }
      await this.#openHistoricalBinding(result, message.bindingId);
      return;
    }
    const result = this.#result;
    const document = activePertDocument();
    if (
      result === null ||
      document === null ||
      !bindingMatches(result, message) ||
      document.uri.toString() !== message.documentUri ||
      document.version !== message.documentVersion
    ) {
      this.#clear("stale", "The DAG action no longer matches the active document.");
      return;
    }
    if (message.kind === "requestHistoricalGraph") {
      await this.#requestHistorical(message, document, result);
      return;
    }
    if (message.kind === "selectAnalysisMode") {
      this.#mode = message.analysisMode;
      await this.refresh();
      return;
    }
    const selected = findGraphEntityRange(
      result,
      message.entityKind,
      message.entityId,
    );
    if (selected === null) {
      this.#clear("unavailable", "The selected DAG entity is unavailable.");
      return;
    }
    const editor = vscode.window.activeTextEditor;
    if (editor === undefined) return;
    const target = asRange(selected);
    editor.selection = new vscode.Selection(target.start, target.end);
    editor.revealRange(target, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
  }

  async #openHistoricalBinding(
    result: HistoricalGraphViewResultV1,
    bindingId: `sha256:${string}`,
  ): Promise<boolean> {
    const client = this.#options.client();
    if (client === undefined || !this.#options.historicalCapabilitiesAvailable()) {
      return false;
    }
    try {
      const raw = await client.sendRequest<unknown>("perttool/historicalSource", {
        textDocument: { uri: result.document.uri },
        documentVersion: result.document.version,
        historyResultId: result.historyResultId,
        bindingId,
      });
      const source = parseHistoricalSourceResult(raw);
      if (
        source === null ||
        source.historyResultId !== result.historyResultId ||
        source.bindingId !== bindingId ||
        !await this.#options.openHistoricalSource(source)
      ) {
        this.#options.output.warn("Historical source result failed closed validation.");
        return false;
      }
      return true;
    } catch (error) {
      this.#options.output.warn(
        `Historical source request failed closed: ${String(error)}`,
      );
      return false;
    }
  }

  async #requestHistorical(
    message: Extract<
      WebviewToExtensionMessageV1,
      { readonly kind: "requestHistoricalGraph" }
    >,
    document: vscode.TextDocument,
    currentResult: GraphViewResultV1,
  ): Promise<HistoricalGraphViewResultV1 | null> {
    if (this.#refreshTimer !== undefined) {
      clearTimeout(this.#refreshTimer);
      this.#refreshTimer = undefined;
    }
    this.#scope = "historical";
    this.#mode = message.analysisMode;
    this.#historicalResult = null;
    if (!this.#options.historicalCapabilitiesAvailable()) {
      this.#publish(
        "unavailable",
        "Historical DAG access is unavailable for this workspace session.",
        currentResult,
      );
      return null;
    }
    const client = this.#options.client();
    if (client === undefined) return null;
    const serial = ++this.#requestSerial;
    this.#cancellation?.cancel();
    this.#cancellation?.dispose();
    const cancellation = new vscode.CancellationTokenSource();
    this.#cancellation = cancellation;
    this.#publish(
      "loading",
      `Loading historical ${message.view} view at ${message.requestedEndpoint}…`,
      currentResult,
    );
    try {
      const raw = await client.sendRequest<unknown>(
        "perttool/historicalGraphView",
        {
          textDocument: { uri: message.documentUri },
          documentVersion: message.documentVersion,
          requestedEndpoint: message.requestedEndpoint,
          lowerBoundary: message.lowerBoundary,
          ancestryProfile: message.ancestryProfile,
          view: message.view,
          snapshotCommitId: message.snapshotCommitId,
          analysisMode: message.analysisMode,
        },
        cancellation.token,
      );
      if (serial !== this.#requestSerial || cancellation.token.isCancellationRequested) {
        return null;
      }
      const active = activePertDocument();
      const result = parseHistoricalGraphViewResult(raw);
      if (
        active === null || result === null ||
        active.uri.toString() !== document.uri.toString() ||
        active.version !== document.version ||
        result.document.uri !== message.documentUri ||
        result.document.generation !== message.documentGeneration ||
        result.document.version !== message.documentVersion
      ) {
        this.invalidateHistorical(
          "The historical DAG result became stale before presentation.",
        );
        return null;
      }
      this.#historicalResult = result;
      const state = result.status === "unavailable" ? "unavailable" : "current";
      this.#publish(
        state,
        `Historical ${message.view} is ${result.status}; resolved immutable evidence is shown below.`,
        currentResult,
      );
      return result;
    } catch (error) {
      if (serial !== this.#requestSerial) return null;
      const code = errorCode(error);
      this.#historicalResult = null;
      if (code === -32800 || cancellation.token.isCancellationRequested) {
        this.#publish("cancelled", "The historical DAG request was cancelled.", currentResult);
      } else if (code === -32801) {
        this.#publish("stale", "The historical DAG result was rejected as stale.", currentResult);
      } else {
        this.#options.output.warn(
          `Historical DAG request failed closed: ${String(error)}`,
        );
        this.#publish("unavailable", "The historical DAG request is unavailable.", currentResult);
      }
      return null;
    } finally {
      if (this.#cancellation === cancellation) {
        cancellation.dispose();
        this.#cancellation = undefined;
      }
    }
  }

  #html(webview: vscode.Webview, assetRoot: vscode.Uri): string {
    const token = nonce();
    const stylesheet = webview.asWebviewUri(
      vscode.Uri.joinPath(assetRoot, "dag.css"),
    );
    const script = webview.asWebviewUri(vscode.Uri.joinPath(assetRoot, "dag.js"));
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src 'nonce-${token}'; font-src ${webview.cspSource};">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${stylesheet}">
  <title>perttool DAG</title>
</head>
<body>
  <header>
    <h1>perttool DAG</h1>
    <label for="dag-scope">Scope</label>
    <select id="dag-scope" aria-label="DAG scope">
      <option value="current" selected>Current document</option>
      <option value="historical">Git history</option>
    </select>
    <label for="analysis-mode">Analysis</label>
    <select id="analysis-mode" aria-label="DAG analysis mode">
      <option value="none">Topology</option>
      <option value="precedence">Precedence</option>
      <option value="resource">Resource</option>
      <option value="both" selected>Both</option>
    </select>
  </header>
  <fieldset id="historical-controls" hidden>
    <legend>Historical query</legend>
    <label for="historical-endpoint">Endpoint</label>
    <input id="historical-endpoint" value="HEAD" maxlength="1024" spellcheck="false">
    <label for="historical-lower">Lower boundary</label>
    <input id="historical-lower" maxlength="1024" spellcheck="false" placeholder="optional">
    <label for="historical-ancestry">Ancestry</label>
    <select id="historical-ancestry">
      <option value="first_parent" selected>First parent</option>
      <option value="three_way">Three way (unsupported)</option>
    </select>
    <label for="historical-view">View</label>
    <select id="historical-view">
      <option value="snapshot">Snapshot</option>
      <option value="lineage" selected>Proved lineage</option>
      <option value="timeline">Timeline</option>
    </select>
    <label for="historical-snapshot">Snapshot commit</label>
    <input id="historical-snapshot" maxlength="64" spellcheck="false" placeholder="optional full object ID">
    <button id="historical-run" type="button">Load historical DAG</button>
  </fieldset>
  <p id="status" role="status" aria-live="polite"></p>
  <main>
    <svg id="graph" role="img" aria-label="PERT activity-on-arrow graph"></svg>
    <section id="outline-section" aria-labelledby="outline-heading">
      <h2 id="outline-heading">Accessible DAG outline</h2>
      <div id="outline"></div>
    </section>
    <section aria-labelledby="diagnostics-heading">
      <h2 id="diagnostics-heading">Diagnostics</h2>
      <ul id="diagnostics"></ul>
    </section>
  </main>
  <script nonce="${token}" src="${script}"></script>
</body>
</html>`;
  }

  dispose(): void {
    if (this.#refreshTimer !== undefined) clearTimeout(this.#refreshTimer);
    this.#cancellation?.cancel();
    this.#cancellation?.dispose();
    this.#disposables.splice(0).forEach((item) => item.dispose());
    this.#view = undefined;
    this.#result = null;
    this.#historicalResult = null;
  }
}
