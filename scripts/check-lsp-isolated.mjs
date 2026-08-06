import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [serverEntry, historicalTarget] = process.argv.slice(2);
if (serverEntry === undefined || !path.isAbsolute(serverEntry)) {
  throw new Error("expected one absolute isolated language-server entry path");
}

const child = spawn(process.execPath, [serverEntry], {
  cwd: path.dirname(serverEntry),
  stdio: ["pipe", "pipe", "pipe"],
});
let stderr = "";
let buffered = Buffer.alloc(0);
const messages = [];
const waiters = [];

child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => {
  stderr += chunk;
});

function deliver(message) {
  messages.push(message);
  const index = waiters.findIndex(({ predicate }) => predicate(message));
  if (index < 0) return;
  const [waiter] = waiters.splice(index, 1);
  waiter.resolve(message);
}

child.stdout.on("data", (chunk) => {
  buffered = Buffer.concat([buffered, chunk]);
  while (true) {
    const headerEnd = buffered.indexOf("\r\n\r\n");
    if (headerEnd < 0) return;
    const header = buffered.subarray(0, headerEnd).toString("ascii");
    const length = Number(/Content-Length: (\d+)/iu.exec(header)?.[1]);
    const bodyStart = headerEnd + 4;
    if (!Number.isSafeInteger(length) || buffered.length < bodyStart + length) {
      return;
    }
    const body = buffered.subarray(bodyStart, bodyStart + length).toString("utf8");
    buffered = buffered.subarray(bodyStart + length);
    deliver(JSON.parse(body));
  }
});

function send(message) {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  child.stdin.write(`Content-Length: ${body.length}\r\n\r\n`);
  child.stdin.write(body);
}

function waitFor(predicate) {
  const existing = messages.find(predicate);
  if (existing !== undefined) return Promise.resolve(existing);
  return new Promise((resolve, reject) => {
    const waiter = { predicate, resolve };
    waiters.push(waiter);
    const timer = setTimeout(() => {
      const index = waiters.indexOf(waiter);
      if (index >= 0) waiters.splice(index, 1);
      reject(new Error(`isolated LSP response timed out: ${stderr}`));
    }, 5000);
    waiter.resolve = (message) => {
      clearTimeout(timer);
      resolve(message);
    };
  });
}

const fallbackSource = `project ISOLATED:
  version 6
  title "isolated 😀"
  description |
    Exact offline language-server acceptance.
  duration_unit day
  finish DONE

milestone NOW:
  title "now"
  state reached

milestone DONE:
  title "done"

task WORK NOW -> DONE:
  title "work"
  duration 1d
`;
const uri = historicalTarget === undefined
  ? "untitled:perttool-isolated-acceptance"
  : pathToFileURL(path.resolve(historicalTarget)).toString();
const source = historicalTarget === undefined
  ? fallbackSource
  : await readFile(path.resolve(historicalTarget), "utf8");

send({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    processId: null,
    rootUri: null,
    capabilities: { general: { positionEncodings: ["utf-16"] } },
    initializationOptions: {
      perttool: {
        editorProtocolModelVersions: [1],
        graphViewResultSchemaVersions: ["Perttool.GraphViewResult.v1"],
        editorHelpResultSchemaVersions: ["Perttool.EditorHelpResult.v1"],
        ...(historicalTarget === undefined
          ? {}
          : {
              historicalEditorProtocolModelVersions: [1],
              historicalGraphViewResultSchemaVersions: [
                "Perttool.HistoricalGraphViewResult.v1",
              ],
              historicalSourceResultSchemaVersions: [
                "Perttool.HistoricalSourceResult.v1",
              ],
              historicalLocalRepository: {
                workspaceTrust: "trusted",
                workspaceFolderUris: [
                  pathToFileURL(path.dirname(path.resolve(historicalTarget))).toString(),
                ],
              },
            }),
      },
    },
  },
});
const initialized = await waitFor((message) => message.id === 1);
assert.equal(initialized.result.capabilities.positionEncoding, "utf-16");
assert.equal(initialized.result.capabilities.renameProvider, undefined);
assert.equal(
  initialized.result.capabilities.experimental.perttool.editorProtocolModelVersion,
  1,
);

send({ jsonrpc: "2.0", method: "initialized", params: {} });
send({
  jsonrpc: "2.0",
  method: "textDocument/didOpen",
  params: {
    textDocument: { uri, languageId: "pert", version: 1, text: source },
  },
});
const diagnostics = await waitFor(
  (message) =>
    message.method === "textDocument/publishDiagnostics" &&
    message.params.uri === uri,
);
assert.equal(diagnostics.params.version, 1);
if (historicalTarget === undefined) {
  assert.deepEqual(diagnostics.params.diagnostics, []);
} else {
  assert.equal(
    diagnostics.params.diagnostics.some(({ severity }) => severity === 1),
    false,
  );
}

send({
  jsonrpc: "2.0",
  id: 2,
  method: "perttool/graphView",
  params: {
    textDocument: { uri },
    documentVersion: 1,
    analysisMode: "both",
  },
});
const graph = await waitFor((message) => message.id === 2);
assert.equal(graph.result.schemaVersion, "Perttool.GraphViewResult.v1");
assert.equal(graph.result.status, "current");
assert.equal(graph.result.complete, true);
if (historicalTarget === undefined) {
  assert.deepEqual(graph.result.graph.edges.map(({ id }) => id), ["WORK"]);
} else {
  assert.ok(graph.result.graph.edges.length > 0);
}
assert.equal(graph.result.graph.resource.optimal, false);

if (historicalTarget !== undefined) {
  assert.equal(
    initialized.result.capabilities.experimental.perttool
      .historicalEditorProtocolModelVersion,
    1,
  );
  send({
    jsonrpc: "2.0",
    id: 4,
    method: "perttool/historicalGraphView",
    params: {
      textDocument: { uri },
      documentVersion: 1,
      requestedEndpoint: "HEAD",
      lowerBoundary: null,
      ancestryProfile: "first_parent",
      view: "snapshot",
      snapshotCommitId: null,
      analysisMode: "none",
    },
  });
  const historical = await waitFor((message) => message.id === 4);
  assert.equal(
    historical.result.schemaVersion,
    "Perttool.HistoricalGraphViewResult.v1",
  );
  assert.ok(["complete", "incomplete"].includes(historical.result.status));
  assert.ok(historical.result.historicalGraph.source_bindings.length > 0);
  const binding = historical.result.historicalGraph.source_bindings.find(
    (candidate) => candidate.owner_path === candidate.source_id,
  );
  assert.ok(binding);
  send({
    jsonrpc: "2.0",
    id: 5,
    method: "perttool/historicalSource",
    params: {
      textDocument: { uri },
      documentVersion: 1,
      historyResultId: historical.result.historyResultId,
      bindingId: binding.binding_id,
    },
  });
  const historicalSource = await waitFor((message) => message.id === 5);
  assert.equal(
    historicalSource.result.schemaVersion,
    "Perttool.HistoricalSourceResult.v1",
  );
  assert.equal(historicalSource.result.bindingId, binding.binding_id);
  assert.equal(historicalSource.result.virtualDocument.languageId, "pert");
  assert.match(historicalSource.result.virtualDocument.uri, /^perttool-history:/u);
}

send({ jsonrpc: "2.0", id: 3, method: "shutdown", params: null });
const shutdown = await waitFor((message) => message.id === 3);
assert.equal(shutdown.result, null);

const exited = new Promise((resolve, reject) => {
  const timer = setTimeout(() => {
    child.kill();
    reject(new Error(`isolated LSP exit timed out: ${stderr}`));
  }, 5000);
  child.once("exit", (code, signal) => {
    clearTimeout(timer);
    resolve({ code, signal });
  });
});
send({ jsonrpc: "2.0", method: "exit", params: null });
assert.deepEqual(await exited, { code: 0, signal: null });
assert.equal(stderr, "");
