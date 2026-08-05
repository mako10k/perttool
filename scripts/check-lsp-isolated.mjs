import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";

const [serverEntry] = process.argv.slice(2);
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

const uri = "untitled:perttool-isolated-acceptance";
const source = `project ISOLATED:
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
assert.deepEqual(diagnostics.params.diagnostics, []);

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
assert.deepEqual(graph.result.graph.edges.map(({ id }) => id), ["WORK"]);
assert.equal(graph.result.graph.resource.optimal, false);

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
