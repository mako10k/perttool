import { createHash } from "node:crypto";
import type { Readable, Writable } from "node:stream";
import {
  ResponseError,
  createConnection,
  type CancellationToken,
  type Connection,
} from "vscode-languageserver/node.js";
import { createPerttoolLanguageServer } from "./server.js";
import {
  PerttoolProtocolError,
  type DagFocusApplicationV1,
  type HistoricalEditorApplicationV1,
} from "./protocol.js";

function digestText(text: string): string {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

async function withCancellation<Value>(
  token: CancellationToken,
  operation: (signal: AbortSignal) => Promise<Value>,
): Promise<Value> {
  const controller = new AbortController();
  if (token.isCancellationRequested) controller.abort();
  const subscription = token.onCancellationRequested(() => controller.abort());
  try {
    return await operation(controller.signal);
  } finally {
    subscription.dispose();
  }
}

async function protocolResult<Value>(operation: () => Promise<Value>): Promise<Value> {
  try {
    return await operation();
  } catch (error: unknown) {
    if (error instanceof PerttoolProtocolError) {
      throw new ResponseError(error.code, error.message);
    }
    throw error;
  }
}

export function startPerttoolStdioServer(
  input: Readable = process.stdin,
  output: Writable = process.stdout,
  options: {
    readonly historicalApplication?: HistoricalEditorApplicationV1;
    readonly dagFocusApplication?: DagFocusApplicationV1;
  } = {},
): Connection {
  const connection = createConnection(input, output);
  const server = createPerttoolLanguageServer({
    digestText,
    publishDiagnostics: (params) => {
      void connection.sendDiagnostics(params);
    },
    onFatalSynchronization: () => {
      queueMicrotask(() => {
        connection.dispose();
        process.exitCode = 1;
      });
    },
    ...(options.historicalApplication === undefined
      ? {}
      : { historicalApplication: options.historicalApplication }),
    ...(options.dagFocusApplication === undefined
      ? {}
      : { dagFocusApplication: options.dagFocusApplication }),
  });

  connection.onInitialize((params) => {
    try {
      return server.initialize(params);
    } catch (error: unknown) {
      if (error instanceof PerttoolProtocolError) {
        throw new ResponseError(error.code, error.message);
      }
      throw error;
    }
  });
  connection.onShutdown(() => {
    server.shutdown();
  });
  connection.onExit(() => server.exit());
  connection.onDidOpenTextDocument((params) => server.didOpen(params));
  connection.onDidChangeTextDocument((params) => server.didChange(params));
  connection.onDidCloseTextDocument((params) => server.didClose(params));
  connection.onDocumentSymbol((params, token) =>
    protocolResult(() =>
      withCancellation(token, async (signal) => [
        ...await server.documentSymbol(params, signal),
      ])
    )
  );
  connection.onHover((params, token) =>
    protocolResult(() =>
      withCancellation(token, (signal) => server.documentHover(params, signal))
    )
  );
  connection.onCompletion((params, token) =>
    protocolResult(() =>
      withCancellation(token, async (signal) => [
        ...await server.completion(params, signal),
      ])
    )
  );
  connection.onDefinition((params, token) =>
    protocolResult(() =>
      withCancellation(token, (signal) =>
        server.documentDefinition(params, signal)
      )
    )
  );
  connection.onCodeAction((params, token) =>
    protocolResult(() =>
      withCancellation(token, async (signal) => [
        ...await server.codeAction(params, signal),
      ])
    )
  );
  connection.onRequest("perttool/help", (params: unknown, token) =>
    protocolResult(() =>
      withCancellation(token, (signal) => server.help(params, signal))
    )
  );
  connection.onRequest("perttool/graphView", (params: unknown, token) =>
    protocolResult(() =>
      withCancellation(token, (signal) => server.graphView(params, signal))
    )
  );
  connection.onRequest("perttool/dagFocus", (params: unknown, token) =>
    protocolResult(() =>
      withCancellation(token, (signal) => server.dagFocus(params, signal))
    )
  );
  connection.onRequest("perttool/historicalGraphView", (params: unknown, token) =>
    protocolResult(() =>
      withCancellation(token, (signal) =>
        server.historicalGraphView(params, signal)
      )
    )
  );
  connection.onRequest("perttool/historicalSource", (params: unknown, token) =>
    protocolResult(() =>
      withCancellation(token, (signal) => server.historicalSource(params, signal))
    )
  );

  connection.listen();
  return connection;
}
