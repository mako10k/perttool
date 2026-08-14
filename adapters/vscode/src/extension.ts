import path from "node:path";
import * as vscode from "vscode";
import {
  LanguageClient,
  TransportKind,
  type LanguageClientOptions,
  type ServerOptions,
} from "vscode-languageclient/node.js";
import {
  dagFocusProtocolModelVersion,
  dagFocusResultSchemaVersion,
  editorHelpResultSchemaVersion,
  editorProtocolModelVersions,
  graphViewResultSchemaVersion,
  graphBindingMatches,
  hasAcceptedDagFocusHandshake,
  hasAcceptedEditorHandshake,
  hasAcceptedEditorMutationHandshake,
  hasAcceptedHistoricalHandshake,
  hasAcceptedMilestoneAcceptanceHandshake,
  historicalEditorProtocolModelVersion,
  historicalGraphViewResultSchemaVersion,
  historicalSourceResultSchemaVersion,
  milestoneAcceptanceEditorProtocolModelVersion,
  milestoneAcceptanceViewResultSchemaVersion,
  parseEditorHelpResult,
  parseOpenHelpCommandArgs,
} from "./bindings.js";
import { DagViewProvider, dagViewId } from "./dag-view.js";

const helpScheme = "perttool-help";
const historicalScheme = "perttool-history";
let client: LanguageClient | undefined;
let customCapabilitiesAvailable = false;
let historicalCapabilitiesAvailable = false;
let dagFocusCapabilitiesAvailable = false;
let milestoneAcceptanceCapabilitiesAvailable = false;
let formattingCapabilitiesAvailable = false;

class HelpContentProvider implements vscode.TextDocumentContentProvider {
  readonly #content = new Map<string, string>();
  readonly #change = new vscode.EventEmitter<vscode.Uri>();

  readonly onDidChange = this.#change.event;

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.#content.get(uri.toString()) ?? "perttool Help is unavailable.";
  }

  publish(topicId: string, content: string): vscode.Uri {
    const uri = vscode.Uri.from({
      scheme: helpScheme,
      path: `/${encodeURIComponent(topicId)}.md`,
      query: "level=detail",
    });
    this.#content.set(uri.toString(), content);
    this.#change.fire(uri);
    return uri;
  }

  dispose(): void {
    this.#change.dispose();
    this.#content.clear();
  }
}

class HistoricalContentProvider implements vscode.TextDocumentContentProvider {
  readonly #content = new Map<string, string>();
  readonly #change = new vscode.EventEmitter<vscode.Uri>();

  readonly onDidChange = this.#change.event;

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.#content.get(uri.toString()) ??
      "Historical perttool source is no longer retained.";
  }

  async open(result: import("./bindings.js").HistoricalSourceResultV1): Promise<boolean> {
    const uri = vscode.Uri.parse(result.virtualDocument.uri, true);
    if (uri.scheme !== historicalScheme) return false;
    if (!this.#content.has(uri.toString()) && this.#content.size >= 32) {
      const open = new Set(
        vscode.workspace.textDocuments
          .filter((document) => document.uri.scheme === historicalScheme)
          .map((document) => document.uri.toString()),
      );
      const evictable = [...this.#content.keys()].find((key) => !open.has(key));
      if (evictable === undefined) return false;
      this.#content.delete(evictable);
    }
    this.#content.delete(uri.toString());
    this.#content.set(uri.toString(), result.virtualDocument.text);
    this.#change.fire(uri);
    const document = await vscode.workspace.openTextDocument(uri);
    if (
      document.languageId !== "pert" ||
      document.getText() !== result.virtualDocument.text ||
      document.isDirty
    ) return false;
    const editor = await vscode.window.showTextDocument(document, { preview: true });
    const range = new vscode.Range(
      result.virtualDocument.range.start.line,
      result.virtualDocument.range.start.character,
      result.virtualDocument.range.end.line,
      result.virtualDocument.range.end.character,
    );
    editor.selection = new vscode.Selection(range.start, range.end);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    return true;
  }

  dispose(): void {
    this.#change.dispose();
    this.#content.clear();
  }
}

function activeDocumentMatches(args: {
  readonly documentUri: string;
  readonly documentVersion: number;
}): boolean {
  const document = vscode.window.activeTextEditor?.document;
  return (
    document?.languageId === "pert" &&
    document.uri.toString() === args.documentUri &&
    document.version === args.documentVersion
  );
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const output = vscode.window.createOutputChannel("perttool", { log: true });
  const help = new HelpContentProvider();
  const historical = new HistoricalContentProvider();
  const serverModule = context.asAbsolutePath(
    path.join("dist", "server", "main.cjs"),
  );
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.stdio },
    debug: { module: serverModule, transport: TransportKind.stdio },
  };
  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ language: "pert" }],
    initializationOptions: {
      perttool: {
        editorProtocolModelVersions,
        graphViewResultSchemaVersions: [graphViewResultSchemaVersion],
        editorHelpResultSchemaVersions: [editorHelpResultSchemaVersion],
        dagFocusProtocolModelVersions: [dagFocusProtocolModelVersion],
        dagFocusResultSchemaVersions: [dagFocusResultSchemaVersion],
        milestoneAcceptanceEditorProtocolModelVersions: [
          milestoneAcceptanceEditorProtocolModelVersion,
        ],
        milestoneAcceptanceViewResultSchemaVersions: [
          milestoneAcceptanceViewResultSchemaVersion,
        ],
        historicalEditorProtocolModelVersions: [
          historicalEditorProtocolModelVersion,
        ],
        historicalGraphViewResultSchemaVersions: [
          historicalGraphViewResultSchemaVersion,
        ],
        historicalSourceResultSchemaVersions: [
          historicalSourceResultSchemaVersion,
        ],
        historicalLocalRepository: {
          workspaceTrust: vscode.workspace.isTrusted ? "trusted" : "untrusted",
          workspaceFolderUris:
            vscode.workspace.workspaceFolders?.map(({ uri }) => uri.toString()) ?? [],
        },
      },
    },
    markdown: { isTrusted: false, supportHtml: false },
    middleware: {
      provideDocumentFormattingEdits: (document, options, token, next) =>
        formattingCapabilitiesAvailable
          ? next(document, options, token)
          : [],
    },
    outputChannel: output,
  };

  client = new LanguageClient(
    "perttool",
    "perttool Language Server",
    serverOptions,
    clientOptions,
  );

  const dag = new DagViewProvider({
    extensionUri: context.extensionUri,
    client: () => client,
    customCapabilitiesAvailable: () => customCapabilitiesAvailable,
    historicalCapabilitiesAvailable: () => historicalCapabilitiesAvailable,
    dagFocusCapabilitiesAvailable: () => dagFocusCapabilitiesAvailable,
    milestoneAcceptanceCapabilitiesAvailable: () =>
      milestoneAcceptanceCapabilitiesAvailable,
    openHistoricalSource: (result) => historical.open(result),
    output,
  });

  context.subscriptions.push(
    output,
    help,
    historical,
    dag,
    vscode.workspace.registerTextDocumentContentProvider(helpScheme, help),
    vscode.workspace.registerTextDocumentContentProvider(
      historicalScheme,
      historical,
    ),
    vscode.window.registerWebviewViewProvider(dagViewId, dag),
    vscode.window.onDidChangeActiveTextEditor(() => dag.scheduleRefresh()),
    vscode.workspace.onDidChangeTextDocument(({ document }) => {
      dag.documentChanged(document);
    }),
    vscode.workspace.onDidCloseTextDocument((document) => {
      dag.documentClosed(document);
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      historicalCapabilitiesAvailable = false;
      dag.invalidateHistorical(
        "Workspace roots changed; reload the window before reading history again.",
      );
    }),
    vscode.workspace.onDidGrantWorkspaceTrust(() => {
      historicalCapabilitiesAvailable = false;
      dag.invalidateHistorical(
        "Workspace trust changed; reload the window before reading history again.",
      );
    }),
    vscode.commands.registerCommand("perttool.showDag", async (value?: unknown) => {
      return await dag.show(
        typeof value === "object" && value !== null &&
            "historical" in value && value.historical === true
          ? {
              historical: true,
              openFirstHistoricalSource:
                "openFirstHistoricalSource" in value &&
                value.openFirstHistoricalSource === true,
            }
          : undefined,
      );
    }),
    vscode.commands.registerCommand("perttool.openHelp", async (value: unknown) => {
      const args = parseOpenHelpCommandArgs(value);
      if (
        args === null ||
        !activeDocumentMatches(args) ||
        client === undefined ||
        !customCapabilitiesAvailable
      ) {
        await vscode.window.showWarningMessage(
          "perttool Help is unavailable for the current document version.",
        );
        return;
      }
      try {
        const binding = await client.sendRequest("perttool/graphView", {
          textDocument: { uri: args.documentUri },
          documentVersion: args.documentVersion,
          analysisMode: "none",
        });
        if (!graphBindingMatches(binding, args)) {
          await vscode.window.showWarningMessage(
            "perttool Help is unavailable for the current document generation.",
          );
          return;
        }
        const raw = await client.sendRequest("perttool/help", {
          topicId: args.topicId,
          level: "detail",
        });
        const result = parseEditorHelpResult(raw);
        if (result?.status !== "ok" || result.content === null) {
          await vscode.window.showWarningMessage("perttool Help topic is unavailable.");
          return;
        }
        const document = await vscode.workspace.openTextDocument(
          help.publish(result.topicId, result.content.value),
        );
        await vscode.window.showTextDocument(document, { preview: true });
      } catch (error) {
        output.warn(`Help request failed closed: ${String(error)}`);
        await vscode.window.showWarningMessage("perttool Help topic is unavailable.");
      }
    }),
  );

  try {
    await client.start();
    const experimental = client.initializeResult?.capabilities.experimental;
    customCapabilitiesAvailable = hasAcceptedEditorHandshake(experimental);
    formattingCapabilitiesAvailable =
      hasAcceptedEditorMutationHandshake(experimental);
    historicalCapabilitiesAvailable =
      hasAcceptedHistoricalHandshake(experimental);
    dagFocusCapabilitiesAvailable = hasAcceptedDagFocusHandshake(experimental);
    milestoneAcceptanceCapabilitiesAvailable =
      hasAcceptedMilestoneAcceptanceHandshake(experimental);
    if (!customCapabilitiesAvailable) {
      output.warn(
        "Custom perttool Help and DAG capabilities are unavailable: incompatible editor protocol handshake.",
      );
    }
    if (!formattingCapabilitiesAvailable) {
      output.info(
        "Format Document is unavailable: editor protocol model 2 was not negotiated.",
      );
    }
    if (!historicalCapabilitiesAvailable) {
      output.warn(
        "Historical DAG capabilities are unavailable: incompatible historical editor handshake.",
      );
    }
    if (!dagFocusCapabilitiesAvailable) {
      output.warn(
        "DAG focus capability is unavailable: incompatible focus protocol handshake.",
      );
    }
    if (!milestoneAcceptanceCapabilitiesAvailable) {
      output.warn(
        "Milestone acceptance capability is unavailable: incompatible editor handshake.",
      );
    }
    dag.scheduleRefresh(0);
  } catch (error) {
    output.error(`Language server startup failed: ${String(error)}`);
    await vscode.window.showErrorMessage(
      "perttool language server is unavailable in this extension host.",
    );
  }
}

export async function deactivate(): Promise<void> {
  const running = client;
  client = undefined;
  customCapabilitiesAvailable = false;
  historicalCapabilitiesAvailable = false;
  dagFocusCapabilitiesAvailable = false;
  milestoneAcceptanceCapabilitiesAvailable = false;
  formattingCapabilitiesAvailable = false;
  if (running !== undefined) await running.stop();
}
