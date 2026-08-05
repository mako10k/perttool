import { randomBytes } from "node:crypto";
import * as vscode from "vscode";
import type { LanguageClient } from "vscode-languageclient/node.js";
import {
  editorProtocolModelVersion,
  findGraphEntityRange,
  parseGraphViewResult,
  parseWebviewMessage,
  type GraphViewAnalysisMode,
  type GraphViewResultV1,
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
}

export interface DagViewProviderOptions {
  readonly extensionUri: vscode.Uri;
  readonly client: () => LanguageClient | undefined;
  readonly customCapabilitiesAvailable: () => boolean;
  readonly output: vscode.LogOutputChannel;
}

function activePertDocument(): vscode.TextDocument | null {
  const document = vscode.window.activeTextEditor?.document;
  return document?.languageId === "pert" ? document : null;
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
  message: Exclude<WebviewToExtensionMessageV1, { readonly kind: "ready" }>,
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

  async show(): Promise<void> {
    await vscode.commands.executeCommand(`${dagViewId}.focus`);
    this.scheduleRefresh(0);
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
      this.scheduleRefresh();
    }
  }

  documentClosed(document: vscode.TextDocument): void {
    if (this.#result?.document.uri === document.uri.toString()) {
      this.#clear("empty", "The displayed document was closed.");
    }
  }

  async refresh(): Promise<void> {
    if (this.#view !== undefined && !this.#view.visible) return;
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
    this.#publish(state, message, diagnosticResult);
  }

  async #receive(value: unknown): Promise<void> {
    const message = parseWebviewMessage(value);
    if (message === null) return;
    if (message.kind === "ready") {
      await this.#view?.webview.postMessage(this.#presentation);
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
    <label for="analysis-mode">Analysis</label>
    <select id="analysis-mode" aria-label="DAG analysis mode">
      <option value="none">Topology</option>
      <option value="precedence">Precedence</option>
      <option value="resource">Resource</option>
      <option value="both" selected>Both</option>
    </select>
  </header>
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
  }
}
