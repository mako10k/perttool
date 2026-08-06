import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  PerttoolProtocolError,
  createPerttoolLanguageServer,
} from "../adapters/lsp/dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const uri = "file:///workspace/plan.pert";
const source = `project HISTORY_EDITOR:\n  version 6\n  title "History editor"\n  duration_unit day\n  finish DONE\n\nmilestone START:\n  title "Start"\n  state reached\n\nmilestone DONE:\n  title "Done"\n\ntask WORK START -> DONE:\n  title "Work"\n  duration 1d\n`;

function digestText(text) {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

function projection(request = {}) {
  const commit = "a".repeat(40);
  const blob = "b".repeat(40);
  const sourceDigest = digestText(source);
  const occurrence = {
    entity_kind: "task",
    source_id: "WORK",
    occurrence_id: "HDGE-task-work",
    value_epoch_ordinal: 0,
    semantic: { plan: { title: "Work" } },
    from_occurrence_id: "HDGE-milestone-start",
    to_occurrence_id: "HDGE-milestone-done",
    first_observed_commit_id: commit,
    last_observed_commit_id: commit,
    retired_at_commit_id: null,
  };
  return {
    model: "Perttool.HistoricalDagModel.v1",
    model_version: 1,
    transition_model_version: 1,
    status: "complete",
    request: {
      requested_endpoint: request.requestedEndpoint ?? "HEAD",
      requested_lower_boundary: request.lowerBoundary ?? null,
      ancestry_profile: request.ancestryProfile ?? "first_parent",
      view: request.view ?? "lineage",
      snapshot_commit_id: request.snapshotCommitId ?? null,
      analysis_mode: request.analysisMode ?? "none",
    },
    evidence: {
      status: "complete",
      ancestry_profile: "first_parent",
      object_format: "sha1",
      repository_id: `git-repository:${sourceDigest}`,
      repository_relative_path: "plan.pert",
      repository_read_snapshot_id: digestText("read"),
      requested_endpoint: "HEAD",
      resolved_endpoint: commit,
      requested_lower_boundary: null,
      resolved_lower_boundary: null,
      oldest_inspected_commit_id: commit,
      inspected_commit_ids: [commit],
      aggregate_raw_snapshot_bytes: source.length,
    },
    effective_checkpoint_id: commit,
    selected_snapshot_commit_id: commit,
    checkpoints: [{ commit_id: commit }],
    snapshot: null,
    lineage: { occurrences: [occurrence], proofs: [] },
    timeline: null,
    analysis: { status: "not_requested", mode: "none" },
    source_bindings: [{
      repository_id: `git-repository:${sourceDigest}`,
      repository_relative_path: "plan.pert",
      commit_id: commit,
      blob_id: blob,
      source_digest: sourceDigest,
      range: {
        start: { offset: 205, line: 13, column: 0 },
        end: { offset: source.length, line: 16, column: 0 },
      },
      declaration_kind: "task",
      source_id: "WORK",
      owner_path: "WORK",
    }],
    causes: [],
    limits: {
      inspected_commits: 2048,
      raw_bytes_per_snapshot: 8388608,
      aggregate_raw_snapshot_bytes: 134217728,
      entity_value_epochs: 100000,
      transition_records: 2047,
      rendered_graph_occurrences: 20000,
      historical_source_bindings: 100000,
    },
  };
}

function initialize(server, trust = "trusted", includeHistorical = true) {
  return server.initialize({
    processId: null,
    rootUri: "file:///workspace",
    capabilities: { general: { positionEncodings: ["utf-16"] } },
    initializationOptions: {
      perttool: {
        editorProtocolModelVersions: [1],
        graphViewResultSchemaVersions: ["Perttool.GraphViewResult.v1"],
        editorHelpResultSchemaVersions: ["Perttool.EditorHelpResult.v1"],
        ...(includeHistorical ? {
          historicalEditorProtocolModelVersions: [1],
          historicalGraphViewResultSchemaVersions: [
            "Perttool.HistoricalGraphViewResult.v1",
          ],
          historicalSourceResultSchemaVersions: [
            "Perttool.HistoricalSourceResult.v1",
          ],
          historicalLocalRepository: {
            workspaceTrust: trust,
            workspaceFolderUris: ["file:///workspace"],
          },
        } : {}),
      },
    },
  });
}

function request(overrides = {}) {
  return {
    textDocument: { uri },
    documentVersion: 1,
    requestedEndpoint: "HEAD",
    lowerBoundary: null,
    ancestryProfile: "first_parent",
    view: "lineage",
    snapshotCommitId: null,
    analysisMode: "none",
    ...overrides,
  };
}

function serverWithApplication(trust = "trusted") {
  const calls = { resolve: 0, inspect: 0, load: 0 };
  const application = {
    async resolveLocalTarget() {
      calls.resolve += 1;
      return { targetPath: "/workspace/plan.pert" };
    },
    async inspect(_target, requested, expectedDigest) {
      calls.inspect += 1;
      assert.equal(expectedDigest, digestText(source));
      return {
        projection: projection(requested),
        diagnostics: [],
        diagnosticsTruncated: false,
      };
    },
    async loadSource() {
      calls.load += 1;
      return {
        text: source,
        range: {
          start: { line: 13, character: 0 },
          end: { line: 16, character: 0 },
        },
      };
    },
  };
  const server = createPerttoolLanguageServer({
    digestText,
    historicalApplication: application,
    publishDiagnostics: () => undefined,
  });
  const initialized = initialize(server, trust);
  server.didOpen({
    textDocument: { uri, languageId: "pert", version: 1, text: source },
  });
  return { server, initialized, calls };
}

test("historical protocol negotiates independently and untrusted access reads no Git", async () => {
  const absent = serverWithApplication();
  absent.server.shutdown();
  const noHistorical = createPerttoolLanguageServer({
    digestText,
    historicalApplication: {
      resolveLocalTarget: async () => null,
      inspect: async () => { throw new Error("unreachable"); },
      loadSource: async () => null,
    },
    publishDiagnostics: () => undefined,
  });
  initialize(noHistorical, "trusted", false);
  await assert.rejects(
    noHistorical.historicalGraphView(request()),
    (error) => error instanceof PerttoolProtocolError && error.code === -32601,
  );

  const untrusted = serverWithApplication("untrusted");
  const result = await untrusted.server.historicalGraphView(request());
  assert.equal(result.status, "unavailable");
  assert.equal(result.historicalGraph, null);
  assert.equal(result.diagnostics.items[0].code, "PTHED-101");
  assert.deepEqual(untrusted.calls, { resolve: 0, inspect: 0, load: 0 });
});

test("historical result, retained binding, and immutable source stay exact", async () => {
  const { server, initialized, calls } = serverWithApplication();
  assert.equal(server.historicalProtocolNegotiated, true);
  assert.equal(
    initialized.capabilities.experimental.perttool
      .historicalEditorProtocolModelVersion,
    1,
  );
  const result = await server.historicalGraphView(request());
  assert.equal(result.schemaVersion, "Perttool.HistoricalGraphViewResult.v1");
  assert.equal(result.status, "complete");
  assert.equal(result.complete, true);
  assert.match(result.historyResultId, /^sha256:[0-9a-f]{64}$/u);
  const binding = result.historicalGraph.source_bindings[0];
  assert.match(binding.binding_id, /^sha256:[0-9a-f]{64}$/u);
  const immutable = await server.historicalSource({
    textDocument: { uri },
    documentVersion: 1,
    historyResultId: result.historyResultId,
    bindingId: binding.binding_id,
  });
  assert.equal(immutable.schemaVersion, "Perttool.HistoricalSourceResult.v1");
  assert.equal(immutable.virtualDocument.text, source);
  assert.match(immutable.virtualDocument.uri, /^perttool-history:/u);
  assert.equal(immutable.virtualDocument.commitId, "a".repeat(40));
  assert.deepEqual(calls, { resolve: 1, inspect: 1, load: 1 });
});

test("closed parameters, replacement, document changes, and cancellation fail closed", async () => {
  const { server } = serverWithApplication();
  await assert.rejects(
    server.historicalGraphView({ ...request(), extra: true }),
    (error) => error instanceof PerttoolProtocolError && error.code === -32602,
  );
  await assert.rejects(
    server.historicalGraphView(request({ requestedEndpoint: "bad\nref" })),
    (error) => error instanceof PerttoolProtocolError && error.code === -32602,
  );
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(
    server.historicalGraphView(request(), abort.signal),
    (error) => error instanceof PerttoolProtocolError && error.code === -32800,
  );
  const first = await server.historicalGraphView(request());
  const firstBinding = first.historicalGraph.source_bindings[0].binding_id;
  await server.historicalGraphView(request({ view: "timeline" }));
  await assert.rejects(
    server.historicalSource({
      textDocument: { uri },
      documentVersion: 1,
      historyResultId: first.historyResultId,
      bindingId: firstBinding,
    }),
    (error) => error instanceof PerttoolProtocolError && error.code === -32801,
  );
});

test("VSIX bindings accept the closed results and remove repository facts from Webview", async () => {
  const { server } = serverWithApplication();
  const raw = await server.historicalGraphView(request());
  const bindings = await import(
    `${pathToFileURL(path.join(root, "adapters/vscode/dist/bindings.mjs")).href}?historical`
  );
  const parsed = bindings.parseHistoricalGraphViewResult(raw);
  assert.deepEqual(parsed, raw);
  assert.equal(bindings.parseHistoricalGraphViewResult({ ...raw, extra: true }), null);
  const presentation = bindings.historicalWebviewPresentation(parsed);
  const serialized = JSON.stringify(presentation);
  assert.equal(serialized.includes("repository_id"), false);
  assert.equal(serialized.includes("repository_relative_path"), false);
  assert.match(serialized, /bindingId/u);
  const reveal = {
    kind: "revealHistoricalSource",
    historyResultId: raw.historyResultId,
    bindingId: raw.historicalGraph.source_bindings[0].binding_id,
  };
  assert.deepEqual(bindings.parseWebviewMessage(reveal), reveal);
  assert.equal(bindings.parseWebviewMessage({ ...reveal, range: {} }), null);
});

test("implementation cases are dependency ordered and private surfaces are read only", async () => {
  const fixture = JSON.parse(await readFile(
    path.join(root, "test/fixtures/historical-editor-runtime-cases-v1.json"),
    "utf8",
  ));
  const accepted = new Set();
  for (const item of fixture.cases) {
    assert.equal(item.depends_on.every((id) => accepted.has(id)), true, item.id);
    accepted.add(item.id);
  }
  assert.deepEqual(
    [...accepted],
    Array.from({ length: 18 }, (_, index) =>
      `HVI-${String(index + 1).padStart(3, "0")}`
    ),
  );
  const sources = await Promise.all([
    "adapters/lsp/src/server.ts",
    "adapters/lsp/runtime/historical-service.ts",
    "adapters/vscode/src/dag-view.ts",
    "adapters/vscode/src/extension.ts",
    "adapters/vscode/src/webview.ts",
  ].map((relative) => readFile(path.join(root, relative), "utf8")));
  assert.match(sources[0], /perttool historical editor protocol was not negotiated/u);
  assert.match(sources[1], /shell: false/u);
  assert.match(sources[2], /perttool\/historicalGraphView/u);
  assert.match(sources[3], /registerTextDocumentContentProvider/u);
  assert.match(sources[4], /revealHistoricalSource/u);
  for (const text of sources) {
    assert.equal(
      /\b(?:writeFile|appendFile)\b|workspace\.fs\.writeFile/u
        .test(text),
      false,
    );
  }
  assert.equal(
    /["'](?:checkout|commit|update-ref|add|reset|merge)["']/u.test(sources[1]),
    false,
  );
  const acceptance = await readFile(
    path.join(root, "docs/process/historical-vsix-acceptance.md"),
    "utf8",
  );
  assert.match(acceptance, /Task: `HISTORICAL_VSIX`/u);
  assert.match(acceptance, /`HVI-001` through `HVI-018`/u);
  assert.match(acceptance, /adds no CLI command or schema, public/u);
  assert.match(acceptance, /candidate digest\s+`sha256:6b89163c/u);
  assert.match(acceptance, /candidate digest\s+`sha256:a89ef57c/u);
  assert.match(acceptance, /written exactly once with actor\s+`codex`/u);
  assert.match(acceptance, /makes startable only\s+`HISTORICAL_DAG_ACCEPTANCE`/u);
});
