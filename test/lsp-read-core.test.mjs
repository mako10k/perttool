import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as core from "../dist/core/index.js";
import * as packageRoot from "../dist/index.js";
import * as nodeFacade from "../dist/node/index.js";
import {
  PerttoolProtocolError,
  createPerttoolLanguageServer,
} from "../adapters/lsp/dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const uri = "untitled:perttool-lsp-test";

function repositoryText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function digestText(text) {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

function initializationOptions() {
  return {
    perttool: {
      editorProtocolModelVersions: [1],
      graphViewResultSchemaVersions: ["Perttool.GraphViewResult.v1"],
      editorHelpResultSchemaVersions: ["Perttool.EditorHelpResult.v1"],
    },
  };
}

function initializeParams(custom = true) {
  return {
    processId: null,
    rootUri: null,
    capabilities: { general: { positionEncodings: ["utf-16"] } },
    ...(custom ? { initializationOptions: initializationOptions() } : {}),
  };
}

function createServer(custom = true) {
  const diagnostics = [];
  const fatal = [];
  const server = createPerttoolLanguageServer({
    digestText,
    publishDiagnostics: (params) => diagnostics.push(params),
    onFatalSynchronization: (reason) => fatal.push(reason),
  });
  const initialized = server.initialize(initializeParams(custom));
  return { server, initialized, diagnostics, fatal };
}

function open(server, text, version = 1, documentUri = uri) {
  server.didOpen({
    textDocument: {
      uri: documentUri,
      languageId: "pert",
      version,
      text,
    },
  });
}

async function expectProtocolError(promise, code) {
  await assert.rejects(
    promise,
    (error) => error instanceof PerttoolProtocolError && error.code === code,
  );
}

function expectedIds(prefix, count) {
  return Array.from(
    { length: count },
    (_, index) => `${prefix}-${String(index + 1).padStart(3, "0")}`,
  );
}

test("private workspace pins the stable LSP 3.17 SDK without changing root dependencies", async () => {
  const [fixtureText, packageText, lockText, workspaceText, sourceEntries] =
    await Promise.all([
      repositoryText("test/fixtures/lsp-read-core-cases-v1.json"),
      repositoryText("package.json"),
      repositoryText("package-lock.json"),
      repositoryText("adapters/lsp/package.json"),
      readdir(path.join(root, "adapters/lsp/src")),
    ]);
  const fixture = JSON.parse(fixtureText);
  const packageJson = JSON.parse(packageText);
  const lock = JSON.parse(lockText);
  const workspace = JSON.parse(workspaceText);
  assert.equal(fixture.schema_version, "Perttool.LspReadCoreCases.v1");
  assert.deepEqual(packageJson.workspaces, ["adapters/*"]);
  assert.equal(Object.keys(packageJson.dependencies ?? {}).length, 0);
  assert.equal(workspace.name, fixture.workspace.name);
  assert.equal(workspace.private, true);
  assert.equal(
    workspace.peerDependencies.perttool,
    fixture.workspace.perttool_peer_version,
  );
  assert.equal(
    workspace.devDependencies.perttool,
    fixture.workspace.perttool_development_dependency,
  );
  assert.equal(workspace.dependencies[fixture.workspace.sdk], fixture.workspace.sdk_version);
  assert.equal(
    lock.packages["node_modules/vscode-languageserver"].version,
    fixture.workspace.sdk_version,
  );
  assert.equal(
    lock.packages["node_modules/vscode-languageserver-protocol"].version,
    fixture.workspace.protocol_dependency_version,
  );
  assert.deepEqual(
    sourceEntries.filter((name) => name.endsWith(".ts")).sort(),
    fixture.workspace.source_files,
  );
});

test("initialization exposes only the accepted standard and negotiated custom capabilities", async () => {
  const standard = createServer(false);
  assert.deepEqual(Object.keys(standard.initialized.capabilities), [
    "positionEncoding",
    "textDocumentSync",
    "documentSymbolProvider",
    "hoverProvider",
    "completionProvider",
    "definitionProvider",
    "codeActionProvider",
  ]);
  assert.equal(standard.server.customProtocolNegotiated, false);
  await expectProtocolError(
    standard.server.help({ topicId: "syntax", level: "quick" }),
    -32601,
  );

  const custom = createServer(true);
  assert.equal(custom.server.customProtocolNegotiated, true);
  assert.deepEqual(custom.initialized.capabilities.experimental, {
    perttool: {
      editorProtocolModelVersion: 1,
      graphViewResultSchemaVersion: "Perttool.GraphViewResult.v1",
      editorHelpResultSchemaVersion: "Perttool.EditorHelpResult.v1",
      graphViewAnalysisModes: ["none", "precedence", "resource", "both"],
    },
  });
  for (const forbidden of [
    "renameProvider",
    "documentFormattingProvider",
    "documentRangeFormattingProvider",
    "executeCommandProvider",
    "workspaceSymbolProvider",
  ]) {
    assert.equal(custom.initialized.capabilities[forbidden], undefined, forbidden);
  }

  const rejected = createPerttoolLanguageServer({
    digestText,
    publishDiagnostics: () => undefined,
  });
  assert.throws(
    () => rejected.initialize({
      processId: null,
      rootUri: null,
      capabilities: { general: { positionEncodings: ["utf-8"] } },
    }),
    (error) => error instanceof PerttoolProtocolError && error.code === -32602,
  );
});

test("incremental synchronization publishes exact versioned diagnostics and closes cleanly", async () => {
  const source = await repositoryText("docs/examples/minimal.pert");
  const { server, diagnostics, fatal } = createServer();
  open(server, source);
  assert.equal(diagnostics.at(-1).uri, uri);
  assert.equal(diagnostics.at(-1).version, 1);
  assert.deepEqual(
    diagnostics.at(-1).diagnostics.map(({ code, severity }) => [code, severity]),
    [["PTSEM-114", 2]],
  );

  server.didChange({
    textDocument: { uri, version: 3 },
    contentChanges: [
      {
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
        text: "# synchronized\n",
      },
      {
        range: { start: { line: 1, character: 8 }, end: { line: 1, character: 15 } },
        text: "RENAMED",
      },
    ],
  });
  assert.equal(server.stopped, false);
  assert.deepEqual(fatal, []);
  assert.equal(diagnostics.at(-1).version, 3);
  assert.deepEqual(
    diagnostics.at(-1).diagnostics.map(({ code }) => code),
    ["PTSEM-114"],
  );
  const symbols = await server.documentSymbol({ textDocument: { uri } });
  assert.equal(symbols[0].name, "RENAMED");

  server.didClose({ textDocument: { uri } });
  assert.deepEqual(diagnostics.at(-1), { uri, version: 3, diagnostics: [] });
  assert.deepEqual(
    await server.documentSymbol({ textDocument: { uri } }),
    [],
  );
});

test("a synchronization violation clears presentation state and is terminal", async () => {
  const source = await repositoryText("docs/examples/minimal.pert");
  for (const violation of ["duplicate_version", "full_text_change", "missing_document"]) {
    const { server, diagnostics, fatal } = createServer();
    if (violation !== "missing_document") open(server, source);
    server.didChange({
      textDocument: { uri, version: violation === "duplicate_version" ? 1 : 2 },
      contentChanges: violation === "full_text_change"
        ? [{ text: source }]
        : [{
            range: {
              start: { line: 0, character: 0 },
              end: { line: 0, character: 0 },
            },
            text: "# change\n",
          }],
    });
    assert.equal(server.stopped, true, violation);
    assert.equal(fatal.length, 1, violation);
    if (violation !== "missing_document") {
      assert.equal(diagnostics.at(-1).diagnostics.length, 0, violation);
    }
    assert.throws(
      () => open(server, source, 4),
      (error) => error instanceof PerttoolProtocolError && error.code === -32600,
      violation,
    );
  }
});

test("symbols, hover, completion, and definition use current UTF-16 source ranges", async () => {
  const source = await repositoryText("docs/examples/minimal.pert");
  const { server } = createServer();
  open(server, source);
  const symbols = await server.documentSymbol({ textDocument: { uri } });
  assert.deepEqual(symbols.map(({ name }) => name), ["MINIMAL", "NOW", "DONE", "WORK"]);
  assert.deepEqual(symbols[2].selectionRange.start, { line: 10, character: 10 });

  const taskHover = await server.documentHover({
    textDocument: { uri },
    position: { line: 13, character: 6 },
  });
  assert.match(taskHover.contents.value, /task/);
  assert.match(taskHover.contents.value, /WORK/);

  const completion = await server.completion({
    textDocument: { uri },
    position: { line: 14, character: 2 },
  });
  assert.ok(completion.some(({ label }) => label === "title"));
  assert.ok(completion.some(({ label }) => label === "duration"));
  for (const item of completion) {
    assert.equal(item.textEdit, undefined);
    assert.equal(item.additionalTextEdits, undefined);
    assert.equal(item.command, undefined);
  }

  const location = await server.documentDefinition({
    textDocument: { uri },
    position: { line: 4, character: 10 },
  });
  assert.deepEqual(location, {
    uri,
    range: {
      start: { line: 10, character: 10 },
      end: { line: 10, character: 14 },
    },
  });
});

test("invalid source keeps diagnostics and syntax Help while semantic features fail closed", async () => {
  const { server, diagnostics } = createServer();
  open(server, "project BROKEN:\n");
  assert.ok(diagnostics.at(-1).diagnostics.length > 0);
  assert.equal(diagnostics.at(-1).version, 1);
  assert.deepEqual(await server.documentSymbol({ textDocument: { uri } }), []);
  assert.equal(
    await server.documentDefinition({
      textDocument: { uri },
      position: { line: 0, character: 9 },
    }),
    null,
  );
  const syntaxHover = await server.documentHover({
    textDocument: { uri },
    position: { line: 0, character: 2 },
  });
  assert.match(syntaxHover.contents.value, /Project syntax/);
  const graph = await server.graphView({
    textDocument: { uri },
    documentVersion: 1,
    analysisMode: "both",
  });
  assert.equal(graph.status, "invalid");
  assert.equal(graph.complete, false);
  assert.equal(graph.graph, null);
  assert.ok(graph.diagnostics.items.length > 0);
});

test("negotiated Help and quick fixes contain bundled read-only content only", async () => {
  const { server, diagnostics } = createServer();
  open(server, "project BROKEN:\n");
  const help = await server.help({ topicId: "syntax.project", level: "detail" });
  assert.equal(help.schemaVersion, "Perttool.EditorHelpResult.v1");
  assert.equal(help.status, "ok");
  assert.equal(help.content.kind, "markdown");
  assert.doesNotMatch(help.content.value, /<script|command:|https?:\/\//u);
  assert.deepEqual(
    await server.help({ topicId: "missing.topic", level: "quick" }),
    {
      schemaVersion: "Perttool.EditorHelpResult.v1",
      editorProtocolModelVersion: 1,
      status: "not_found",
      topicId: "missing.topic",
      level: "quick",
      content: null,
      relatedTopicIds: [],
    },
  );
  const actions = await server.codeAction({
    textDocument: { uri },
    range: diagnostics.at(-1).diagnostics[0].range,
    context: { diagnostics: diagnostics.at(-1).diagnostics },
  });
  assert.ok(actions.length > 0);
  for (const action of actions) {
    assert.equal(action.kind, "quickfix");
    assert.equal(action.edit, undefined);
    assert.equal(action.command.command, "perttool.openHelp");
    assert.deepEqual(Object.keys(action.command.arguments[0]), [
      "documentUri",
      "documentGeneration",
      "documentVersion",
      "topicId",
    ]);
  }

  const standard = createServer(false);
  open(standard.server, "project BROKEN:\n");
  assert.deepEqual(
    await standard.server.codeAction({
      textDocument: { uri },
      range: standard.diagnostics.at(-1).diagnostics[0].range,
      context: { diagnostics: standard.diagnostics.at(-1).diagnostics },
    }),
    [],
  );
});

test("GraphView v1 is closed, deterministic, and mode-specific", async () => {
  const source = await repositoryText("docs/examples/parallel.pert");
  const { server } = createServer();
  open(server, source);
  const results = new Map();
  for (const mode of ["none", "precedence", "resource", "both"]) {
    results.set(mode, await server.graphView({
      textDocument: { uri },
      documentVersion: 1,
      analysisMode: mode,
    }));
  }
  for (const [mode, result] of results) {
    assert.deepEqual(Object.keys(result), [
      "schemaVersion",
      "editorProtocolModelVersion",
      "document",
      "analysisMode",
      "status",
      "complete",
      "diagnostics",
      "graph",
    ]);
    assert.equal(result.schemaVersion, "Perttool.GraphViewResult.v1");
    assert.equal(result.analysisMode, mode);
    assert.equal(result.status, "current");
    assert.equal(result.complete, true);
    assert.equal(result.document.sourceDigest, digestText(source));
    assert.deepEqual(result.graph.milestones.map(({ id }) => id), [
      "NOW",
      "CORE_DONE",
      "CLI_DONE",
      "DOCS_DONE",
      "INTEGRATION_READY",
      "TEST_DONE",
      "PACKAGE_DONE",
      "RELEASED",
    ]);
    assert.deepEqual(result.graph.edges.map(({ id }) => id), [
      "CORE",
      "CLI",
      "DOCS",
      "CORE_READY",
      "CLI_READY",
      "DOCS_READY",
      "TEST",
      "PACKAGE",
      "TEST_RELEASE_GATE",
      "PACKAGE_RELEASE_GATE",
    ]);
  }
  assert.equal(results.get("none").graph.precedence, null);
  assert.equal(results.get("none").graph.resource, null);
  assert.ok(results.get("precedence").graph.precedence);
  assert.equal(results.get("precedence").graph.resource, null);
  assert.equal(results.get("resource").graph.precedence, null);
  assert.ok(results.get("resource").graph.resource);
  assert.ok(results.get("both").graph.precedence);
  assert.ok(results.get("both").graph.resource);
  assert.equal(
    results.get("resource").graph.edges.find(({ kind }) => kind === "gate").resource,
    null,
  );
  assert.equal(results.get("both").graph.resource.algorithmId, "parallel-sgs");
  assert.equal(results.get("both").graph.resource.optimal, false);
  assert.deepEqual(
    await server.graphView({
      textDocument: { uri },
      documentVersion: 1,
      analysisMode: "both",
    }),
    results.get("both"),
  );
});

test("GraphView rejects malformed, unknown-mode, and stale-version requests", async () => {
  const source = await repositoryText("docs/examples/minimal.pert");
  const { server } = createServer();
  open(server, source);
  await expectProtocolError(
    server.graphView({
      textDocument: { uri },
      documentVersion: 1,
      analysisMode: "mermaid",
    }),
    -32602,
  );
  await expectProtocolError(
    server.graphView({
      textDocument: { uri },
      documentVersion: 1,
      analysisMode: "both",
      source,
    }),
    -32602,
  );
  await expectProtocolError(
    server.graphView({
      textDocument: { uri },
      documentVersion: 0,
      analysisMode: "both",
    }),
    -32801,
  );
});

test("cancellation and stale async work return exact protocol errors and no old value", async () => {
  const source = await repositoryText("docs/examples/minimal.pert");
  const cancelled = createServer();
  open(cancelled.server, source);
  const controller = new AbortController();
  controller.abort();
  await expectProtocolError(
    cancelled.server.documentSymbol({ textDocument: { uri } }, controller.signal),
    -32800,
  );

  const stale = createServer();
  open(stale.server, source);
  const pending = stale.server.documentSymbol({ textDocument: { uri } });
  stale.server.didChange({
    textDocument: { uri, version: 2 },
    contentChanges: [{
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
      text: "# newer\n",
    }],
  });
  await expectProtocolError(pending, -32801);
});

test("close and reopen use a new generation and multiple URI identities stay separate", async () => {
  const source = await repositoryText("docs/examples/minimal.pert");
  const { server } = createServer();
  open(server, source, 7, uri);
  open(server, source.replaceAll("MINIMAL", "SECOND"), 2, "memory:second");
  const first = await server.graphView({
    textDocument: { uri },
    documentVersion: 7,
    analysisMode: "none",
  });
  assert.equal(
    (await server.documentSymbol({ textDocument: { uri: "memory:second" } }))[0].name,
    "SECOND",
  );
  server.didClose({ textDocument: { uri } });
  open(server, source, 7, uri);
  const reopened = await server.graphView({
    textDocument: { uri },
    documentVersion: 7,
    analysisMode: "none",
  });
  assert.notEqual(reopened.document.generation, first.document.generation);
  assert.equal(reopened.document.version, first.document.version);
});

function jsonRpcHarness(input, output) {
  const messages = [];
  const waiters = [];
  let buffered = Buffer.alloc(0);
  const deliver = (message) => {
    messages.push(message);
    for (const waiter of [...waiters]) {
      if (waiter.predicate(message)) {
        waiters.splice(waiters.indexOf(waiter), 1);
        waiter.resolve(message);
      }
    }
  };
  output.on("data", (chunk) => {
    buffered = Buffer.concat([buffered, chunk]);
    while (true) {
      const headerEnd = buffered.indexOf("\r\n\r\n");
      if (headerEnd < 0) break;
      const header = buffered.subarray(0, headerEnd).toString("ascii");
      const length = Number(/Content-Length: (\d+)/iu.exec(header)?.[1]);
      const bodyStart = headerEnd + 4;
      if (!Number.isSafeInteger(length) || buffered.length < bodyStart + length) break;
      const body = buffered.subarray(bodyStart, bodyStart + length).toString("utf8");
      buffered = buffered.subarray(bodyStart + length);
      deliver(JSON.parse(body));
    }
  });
  const send = (message) => {
    const body = Buffer.from(JSON.stringify(message), "utf8");
    input.write(`Content-Length: ${body.length}\r\n\r\n`);
    input.write(body);
  };
  const waitFor = (predicate) => new Promise((resolve, reject) => {
    const existing = messages.find(predicate);
    if (existing !== undefined) {
      resolve(existing);
      return;
    }
    const waiter = { predicate, resolve };
    waiters.push(waiter);
    const timeout = setTimeout(() => {
      const index = waiters.indexOf(waiter);
      if (index >= 0) waiters.splice(index, 1);
      reject(new Error("JSON-RPC response timed out"));
    }, 2000);
    waiter.resolve = (message) => {
      clearTimeout(timeout);
      resolve(message);
    };
  });
  return { input, output, send, waitFor };
}

test("stdio composition serves initialize, shutdown, and exit in isolation", async () => {
  const child = spawn(
    process.execPath,
    [path.join(root, "adapters/lsp/dist/main.js")],
    { cwd: root, stdio: ["pipe", "pipe", "pipe"] },
  );
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const harness = jsonRpcHarness(child.stdin, child.stdout);
  harness.send({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: initializeParams(true),
  });
  const initialized = await harness.waitFor((message) => message.id === 1);
  assert.equal(initialized.result.capabilities.positionEncoding, "utf-16");
  assert.equal(
    initialized.result.capabilities.experimental.perttool.editorProtocolModelVersion,
    1,
  );
  harness.send({ jsonrpc: "2.0", method: "initialized", params: {} });
  harness.send({ jsonrpc: "2.0", id: 2, method: "shutdown", params: null });
  const shutdown = await harness.waitFor((message) => message.id === 2);
  assert.equal(shutdown.result, null);
  const exited = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`language server exit timed out: ${stderr}`));
    }, 2000);
    child.once("exit", (code, signal) => {
      clearTimeout(timeout);
      resolve({ code, signal });
    });
  });
  harness.send({ jsonrpc: "2.0", method: "exit", params: null });
  assert.deepEqual(await exited, { code: 0, signal: null });
  assert.equal(stderr, "");
});

test("implementation cases are dependency ordered and root compatibility remains exact", async () => {
  const [fixtureText, acceptance, plan, packageCheck] = await Promise.all([
    repositoryText("test/fixtures/lsp-read-core-cases-v1.json"),
    repositoryText("docs/process/adapter-lsp-read-core-acceptance.md"),
    repositoryText("plans/adapter-platform.pert"),
    repositoryText("scripts/check-package.sh"),
  ]);
  const fixture = JSON.parse(fixtureText);
  const accepted = new Set();
  for (const contractCase of fixture.cases) {
    assert.equal(
      contractCase.depends_on.every((id) => accepted.has(id)),
      true,
      contractCase.id,
    );
    accepted.add(contractCase.id);
  }
  assert.deepEqual([...accepted], expectedIds("LSPC", 12));
  assert.equal(Object.keys(packageRoot).length, 129);
  assert.equal(Object.keys(nodeFacade).length, 129);
  assert.equal(Object.keys(core).length, 45);
  assert.ok(Object.keys(packageRoot).every((name) =>
    packageRoot[name] === nodeFacade[name]
  ));
  assert.equal(packageRoot.createPerttoolLanguageServer, undefined);
  assert.deepEqual(fixture.side_effects, {
    cli_subprocess: false,
    filesystem_read: false,
    filesystem_write: false,
    git: false,
    network_listener: false,
    editor_edit: false,
    telemetry: false,
    publication: false,
  });
  const source = await Promise.all(
    fixture.workspace.source_files.map((name) =>
      repositoryText(`adapters/lsp/src/${name}`)
    ),
  );
  assert.equal(source.some((text) => /child_process|node:fs|node:net|node:http/u.test(text)), false);
  assert.equal(source.some((text) => /dist\/cli|src\/cli/u.test(text)), false);
  assert.equal(source.some((text) => /from "perttool\/core"/u.test(text)), true);
  assert.match(acceptance, /Document status: Accepted 1\.0/u);
  assert.match(
    acceptance,
    /sha256:35f330cfd4aa974dde4d4720435dfcddd14ade21e1084294fddb4315ffa4b8ed/u,
  );
  assert.match(
    plan,
    /task LSP_READ_CORE DOCUMENT_SESSION_READY -> LSP_READY:[\s\S]*?status done/u,
  );
  assert.match(plan, /task LSP_ACCEPTANCE LSP_READY -> LSP_ACCEPTED:/u);
  assert.match(packageCheck, /\^package\/\(adapters\|src/u);
});
