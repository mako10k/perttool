import path from "node:path";
import * as vscode from "vscode";
import {
  LanguageClient,
  TransportKind,
  type LanguageClientOptions,
  type ServerOptions,
} from "vscode-languageclient/node.js";
import {
  editorHelpResultSchemaVersion,
  editorProtocolModelVersion,
  graphViewResultSchemaVersion,
  graphBindingMatches,
  hasAcceptedEditorHandshake,
  parseEditorHelpResult,
  parseOpenHelpCommandArgs,
} from "./bindings.js";
import { DagViewProvider, dagViewId } from "./dag-view.js";

const helpScheme = "perttool-help";
let client: LanguageClient | undefined;
let customCapabilitiesAvailable = false;

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
        editorProtocolModelVersions: [editorProtocolModelVersion],
        graphViewResultSchemaVersions: [graphViewResultSchemaVersion],
        editorHelpResultSchemaVersions: [editorHelpResultSchemaVersion],
      },
    },
    markdown: { isTrusted: false, supportHtml: false },
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
    output,
  });

  context.subscriptions.push(
    output,
    help,
    dag,
    vscode.workspace.registerTextDocumentContentProvider(helpScheme, help),
    vscode.window.registerWebviewViewProvider(dagViewId, dag),
    vscode.window.onDidChangeActiveTextEditor(() => dag.scheduleRefresh()),
    vscode.workspace.onDidChangeTextDocument(({ document }) => {
      dag.documentChanged(document);
    }),
    vscode.workspace.onDidCloseTextDocument((document) => {
      dag.documentClosed(document);
    }),
    vscode.commands.registerCommand("perttool.showDag", async () => {
      await dag.show();
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
    if (!customCapabilitiesAvailable) {
      output.warn(
        "Custom perttool Help and DAG capabilities are unavailable: incompatible editor protocol handshake.",
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
  if (running !== undefined) await running.stop();
}
