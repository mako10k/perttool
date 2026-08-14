import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as core from "../dist/core/index.js";
import { prepareEditorMilestoneAcceptanceDocument } from
  "../dist/application/editor-milestone-acceptance.js";
import {
  EDITOR_MUTATION_PROTOCOL_MODEL_VERSION,
  PerttoolProtocolError,
  createPerttoolLanguageServer,
} from "../adapters/lsp/dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const uri = "untitled:editor-format-core";

function repositoryText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function digestText(text) {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

function applyEdits(text, edits) {
  return [...edits].reverse().reduce(
    (candidate, edit) =>
      candidate.slice(0, edit.startOffset) + edit.replacement +
        candidate.slice(edit.endOffset),
    text,
  );
}

function applyLspEdits(text, edits) {
  const offsets = edits.map((edit) => {
    const startOffset = core.documentPositionToOffset(text, edit.range.start);
    const endOffset = core.documentPositionToOffset(text, edit.range.end);
    assert.notEqual(startOffset, null);
    assert.notEqual(endOffset, null);
    return { startOffset, endOffset, replacement: edit.newText };
  });
  return applyEdits(text, offsets);
}

function initializeParams(versions) {
  return {
    processId: null,
    rootUri: null,
    capabilities: { general: { positionEncodings: ["utf-16"] } },
    initializationOptions: {
      perttool: {
        editorProtocolModelVersions: versions,
        graphViewResultSchemaVersions: ["Perttool.GraphViewResult.v1"],
        editorHelpResultSchemaVersions: ["Perttool.EditorHelpResult.v1"],
      },
    },
  };
}

function createServer(versions = [2, 1]) {
  const diagnostics = [];
  const server = createPerttoolLanguageServer({
    digestText,
    publishDiagnostics: (params) => diagnostics.push(params),
  });
  const initialized = server.initialize(initializeParams(versions));
  return { server, initialized, diagnostics };
}

function open(server, text, version = 1) {
  server.didOpen({
    textDocument: { uri, languageId: "pert", version, text },
  });
}

function expectedIds(prefix, count) {
  return Array.from(
    { length: count },
    (_, index) => `${prefix}-${String(index + 1).padStart(3, "0")}`,
  );
}

test("Core fingerprint ignores formatter trivia and detects semantic changes", async () => {
  const source = await repositoryText("docs/examples/minimal.pert");
  const lexical = `# another comment\r\n${source.replaceAll("\n", "\r\n")}`
    .replace("duration 1d", "duration 1.0d");
  const semantic = lexical.replace("duration 1.0d", "duration 2d");
  const options = { digestText };
  const original = core.createDocumentSnapshot(
    { uri, generation: "g1", version: 1, text: source },
    options,
  );
  const triviaOnly = core.createDocumentSnapshot(
    { uri, generation: "g2", version: 1, text: lexical },
    options,
  );
  const changed = core.createDocumentSnapshot(
    { uri, generation: "g3", version: 1, text: semantic },
    options,
  );
  assert.equal(original.semantic.fingerprint.schemaVersion,
    "Perttool.EditorSemanticFingerprint.v1");
  assert.equal(
    original.semantic.fingerprint.digest,
    triviaOnly.semantic.fingerprint.digest,
  );
  assert.notEqual(original.binding.sourceDigest, triviaOnly.binding.sourceDigest);
  assert.notEqual(
    triviaOnly.semantic.fingerprint.digest,
    changed.semantic.fingerprint.digest,
  );
});

test("Core E0 proof returns exact smallest edits, candidate digest, and idempotence", async () => {
  const canonical = await repositoryText("docs/examples/minimal.pert");
  const source = canonical.replace("duration 1d", "duration 1.0d");
  const session = core.createDocumentSession({ digestText });
  const opened = session.open({ uri, version: 1, text: source });
  assert.equal(opened.status, "current");
  const result = await session.format(opened.snapshot.binding);
  assert.equal(result.status, "current");
  assert.equal(result.complete, true);
  assert.equal(result.changed, true);
  assert.equal(result.edits.length, 1);
  assert.equal(applyEdits(source, result.edits), canonical);
  assert.equal(result.candidateSourceDigest, digestText(canonical));
  assert.equal(
    result.semanticEvidence.originalFingerprint.digest,
    result.semanticEvidence.candidateFingerprint.digest,
  );

  const repeated = core.createDocumentSession({ digestText });
  const current = repeated.open({ uri, version: 1, text: canonical });
  const unchanged = await repeated.format(current.snapshot.binding);
  assert.equal(unchanged.complete, true);
  assert.equal(unchanged.changed, false);
  assert.deepEqual(unchanged.edits, []);
});

test("Grammar 7 formatting preserves complete milestone-acceptance semantics", async () => {
  const canonical = await repositoryText("plans/editor-mutations.pert");
  const source = canonical.replace("duration 8p", "duration 8.0p");
  const session = core.createDocumentSession({
    digestText,
    prepareDocument: prepareEditorMilestoneAcceptanceDocument,
  });
  const opened = session.open({ uri, version: 1, text: source });
  assert.equal(opened.snapshot.semantic.ok, true);
  const result = await session.format(opened.snapshot.binding);
  assert.equal(result.complete, true);
  const candidate = applyEdits(source, result.edits);
  assert.equal(candidate, canonical);
  assert.match(candidate, /milestone_acceptance_receipt EDITOR_MUTATION_CONTRACT_EVIDENCE:/u);
  assert.equal(result.candidateSourceDigest, digestText(canonical));
});

test("invalid, truncated, malformed, and over-limit candidates expose no edit", async () => {
  const canonical = await repositoryText("docs/examples/minimal.pert");
  const invalidSession = core.createDocumentSession({ digestText });
  const invalid = invalidSession.open({
    uri,
    version: 1,
    text: canonical.replace("finish DONE", "finish MISSING"),
  });
  const invalidResult = await invalidSession.format(invalid.snapshot.binding);
  assert.equal(invalidResult.status, "invalid");
  assert.deepEqual(invalidResult.edits, []);

  for (const formatDocument of [
    () => ({
      ok: true,
      documentId: "MINIMAL",
      changed: true,
      formattedText: canonical,
      edits: [
        { startOffset: 0, endOffset: 3, replacement: "pro" },
        { startOffset: 2, endOffset: 4, replacement: "oj" },
      ],
      diagnostics: [],
      diagnosticsTruncated: false,
    }),
    (text) => ({
      ok: true,
      documentId: "MINIMAL",
      changed: true,
      formattedText: text.replace("duration 1d", "duration invalid"),
      edits: [{
        startOffset: text.indexOf("duration 1d"),
        endOffset: text.indexOf("duration 1d") + "duration 1d".length,
        replacement: "duration invalid",
      }],
      diagnostics: [],
      diagnosticsTruncated: false,
    }),
    (text) => ({
      ok: true,
      documentId: "MINIMAL",
      changed: true,
      formattedText: text + "x".repeat(8_388_609),
      edits: [{
        startOffset: text.length,
        endOffset: text.length,
        replacement: "x".repeat(8_388_609),
      }],
      diagnostics: [],
      diagnosticsTruncated: false,
    }),
  ]) {
    const session = core.createDocumentSession({ digestText, formatDocument });
    const opened = session.open({ uri, version: 1, text: canonical });
    const result = await session.format(opened.snapshot.binding);
    assert.equal(result.status, "unavailable");
    assert.equal(result.complete, false);
    assert.deepEqual(result.edits, []);
  }

  const grammar7 = await repositoryText("plans/editor-mutations.pert");
  const truncatedSession = core.createDocumentSession({
    digestText,
    maxDiagnostics: 1,
    prepareDocument: prepareEditorMilestoneAcceptanceDocument,
  });
  const truncated = truncatedSession.open({ uri, version: 1, text: grammar7 });
  assert.equal(truncated.snapshot.semantic.diagnosticsTruncated, true);
  assert.equal((await truncatedSession.format(truncated.snapshot.binding)).status,
    "unavailable");
});

test("Core cancellation and stale binding return no old formatting edit", async () => {
  const source = (await repositoryText("docs/examples/minimal.pert"))
    .replace("duration 1d", "duration 1.0d");
  const cancelledController = new AbortController();
  const cancelledSession = core.createDocumentSession({
    digestText,
    formatDocument: (text, options) => {
      cancelledController.abort();
      return core.formatDocument(text, options);
    },
  });
  const cancelled = cancelledSession.open({ uri, version: 1, text: source });
  const cancelledResult = await cancelledSession.format(
    cancelled.snapshot.binding,
    cancelledController.signal,
  );
  assert.equal(cancelledResult.status, "cancelled");
  assert.deepEqual(cancelledResult.edits, []);

  let staleSession;
  let changed = false;
  const formatter = (text, options) => {
    if (!changed) {
      changed = true;
      staleSession.change({
        uri,
        version: 2,
        changes: [{
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
          text: "# concurrent\n",
        }],
      });
    }
    return core.formatDocument(text, options);
  };
  staleSession = core.createDocumentSession({ digestText, formatDocument: formatter });
  const stale = staleSession.open({ uri, version: 1, text: source });
  const staleResult = await staleSession.format(stale.snapshot.binding);
  assert.equal(staleResult.status, "stale");
  assert.deepEqual(staleResult.edits, []);
});

test("model 2 is highest-common and model 1 remains exactly read-only", async () => {
  const model2 = createServer([2, 1]);
  assert.equal(model2.server.editorProtocolModelVersion, 2);
  assert.equal(EDITOR_MUTATION_PROTOCOL_MODEL_VERSION, 2);
  assert.equal(
    model2.initialized.capabilities.experimental.perttool.editorProtocolModelVersion,
    2,
  );
  assert.equal(model2.initialized.capabilities.documentFormattingProvider, true);
  for (const forbidden of [
    "documentRangeFormattingProvider",
    "documentOnTypeFormattingProvider",
    "renameProvider",
    "executeCommandProvider",
  ]) assert.equal(model2.initialized.capabilities[forbidden], undefined);

  const model1 = createServer([1]);
  assert.equal(model1.server.editorProtocolModelVersion, 1);
  assert.equal(model1.initialized.capabilities.documentFormattingProvider, undefined);
  await assert.rejects(
    model1.server.documentFormatting({
      textDocument: { uri },
      options: { tabSize: 2, insertSpaces: true },
    }),
    (error) => error instanceof PerttoolProtocolError && error.code === -32601,
  );

  const unsupported = createServer([3]);
  assert.equal(unsupported.server.editorProtocolModelVersion, null);
  assert.equal(unsupported.initialized.capabilities.experimental, undefined);
});

test("LSP formatting validates options and returns only exact UTF-16 Core edits", async () => {
  const canonical = await repositoryText("docs/examples/minimal.pert");
  const source = canonical.replace("duration 1d", "duration 1.0d");
  const { server } = createServer();
  open(server, source);
  const edits = await server.documentFormatting({
    textDocument: { uri },
    options: {
      tabSize: 8,
      insertSpaces: false,
      trimTrailingWhitespace: true,
      unknownExtension: "ignored",
    },
  });
  assert.equal(applyLspEdits(source, edits), canonical);
  assert.equal(edits.length, 1);
  await assert.rejects(
    server.documentFormatting({
      textDocument: { uri },
      options: { tabSize: "2", insertSpaces: true },
    }),
    (error) => error instanceof PerttoolProtocolError && error.code === -32602,
  );

  const invalid = createServer();
  open(invalid.server, canonical.replace("finish DONE", "finish MISSING"));
  assert.deepEqual(await invalid.server.documentFormatting({
    textDocument: { uri },
    options: { tabSize: 2, insertSpaces: true },
  }), []);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    server.documentFormatting({
      textDocument: { uri },
      options: { tabSize: 2, insertSpaces: true },
    }, controller.signal),
    (error) => error instanceof PerttoolProtocolError && error.code === -32800,
  );
});

function jsonRpcHarness(input, output) {
  let buffer = Buffer.alloc(0);
  const messages = [];
  const waiters = [];
  function dispatch(message) {
    messages.push(message);
    for (const waiter of [...waiters]) {
      if (!waiter.predicate(message)) continue;
      waiters.splice(waiters.indexOf(waiter), 1);
      waiter.resolve(message);
    }
  }
  output.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (true) {
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd < 0) return;
      const header = buffer.subarray(0, headerEnd).toString("ascii");
      const match = /Content-Length: (\d+)/iu.exec(header);
      assert.notEqual(match, null);
      const length = Number(match[1]);
      const bodyStart = headerEnd + 4;
      if (buffer.length < bodyStart + length) return;
      dispatch(JSON.parse(buffer.subarray(bodyStart, bodyStart + length).toString("utf8")));
      buffer = buffer.subarray(bodyStart + length);
    }
  });
  return {
    send(message) {
      const body = Buffer.from(JSON.stringify(message), "utf8");
      input.write(`Content-Length: ${body.length}\r\n\r\n`);
      input.write(body);
    },
    waitFor(predicate) {
      const existing = messages.find(predicate);
      if (existing !== undefined) return Promise.resolve(existing);
      return new Promise((resolve, reject) => {
        const waiter = { predicate, resolve };
        waiters.push(waiter);
        setTimeout(() => {
          const index = waiters.indexOf(waiter);
          if (index >= 0) waiters.splice(index, 1);
          reject(new Error("JSON-RPC response timed out"));
        }, 3000).unref();
      });
    },
  };
}

test("stdio registers standard textDocument/formatting without a CLI subprocess", async () => {
  const canonical = await repositoryText("plans/editor-mutations.pert");
  const source = canonical.replace("duration 8p", "duration 8.0p");
  const child = spawn(
    process.execPath,
    [path.join(root, "adapters/lsp/dist/main.js")],
    { cwd: root, stdio: ["pipe", "pipe", "pipe"] },
  );
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const harness = jsonRpcHarness(child.stdin, child.stdout);
  harness.send({ jsonrpc: "2.0", id: 1, method: "initialize", params: initializeParams([2, 1]) });
  const initialized = await harness.waitFor((message) => message.id === 1);
  assert.equal(initialized.result.capabilities.documentFormattingProvider, true);
  harness.send({ jsonrpc: "2.0", method: "initialized", params: {} });
  harness.send({
    jsonrpc: "2.0",
    method: "textDocument/didOpen",
    params: { textDocument: { uri, languageId: "pert", version: 1, text: source } },
  });
  harness.send({
    jsonrpc: "2.0",
    id: 2,
    method: "textDocument/formatting",
    params: { textDocument: { uri }, options: { tabSize: 2, insertSpaces: true } },
  });
  const formatted = await harness.waitFor((message) => message.id === 2);
  assert.equal(applyLspEdits(source, formatted.result), canonical);
  harness.send({ jsonrpc: "2.0", id: 3, method: "shutdown", params: null });
  await harness.waitFor((message) => message.id === 3);
  harness.send({ jsonrpc: "2.0", method: "exit", params: null });
  await new Promise((resolve) => child.once("exit", resolve));
  assert.equal(stderr, "");
});

test("fourteen cases remain ordered and the E0 implementation has no write owner", async () => {
  const [fixtureText, sessionSource, serverSource, stdioSource] = await Promise.all([
    repositoryText("test/fixtures/editor-format-core-v1.json"),
    repositoryText("src/session/document-session.ts"),
    repositoryText("adapters/lsp/src/server.ts"),
    repositoryText("adapters/lsp/src/stdio.ts"),
  ]);
  const fixture = JSON.parse(fixtureText);
  const accepted = new Set();
  for (const item of fixture.cases) {
    assert.equal(item.depends_on.every((id) => accepted.has(id)), true, item.id);
    accepted.add(item.id);
  }
  assert.deepEqual([...accepted], expectedIds("EFC", 14));
  assert.deepEqual(fixture.side_effects, {
    cli_subprocess: false,
    filesystem_read: false,
    filesystem_write: false,
    git: false,
    network_listener: false,
    settings_change: false,
    editor_apply: false,
  });
  for (const source of [sessionSource, serverSource, stdioSource]) {
    assert.equal(/child_process|node:fs|\bgit\b|src\/cli|dist\/cli/u.test(source), false);
  }
  assert.match(stdioSource, /onDocumentFormatting/u);
});
