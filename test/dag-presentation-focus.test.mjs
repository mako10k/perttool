import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Graph, layout } from "@dagrejs/dagre";
import { createPerttoolLanguageServer } from "../adapters/lsp/dist/index.js";
import { inspectEditorDagFocus } from "../dist/application/editor-dag-focus.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const uri = "untitled:perttool-dag-focus";

function repositoryText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function digestText(text) {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

function focusServer(text, includeFocus = true) {
  const server = createPerttoolLanguageServer({
    digestText,
    publishDiagnostics: () => undefined,
    ...(includeFocus ? { dagFocusApplication: { inspect: inspectEditorDagFocus } } : {}),
  });
  const initialized = server.initialize({
    processId: null,
    rootUri: null,
    capabilities: { general: { positionEncodings: ["utf-16"] } },
    initializationOptions: {
      perttool: {
        editorProtocolModelVersions: [1],
        graphViewResultSchemaVersions: ["Perttool.GraphViewResult.v1"],
        editorHelpResultSchemaVersions: ["Perttool.EditorHelpResult.v1"],
        dagFocusProtocolModelVersions: [1],
        dagFocusResultSchemaVersions: ["Perttool.DagFocusResult.v1"],
      },
    },
  });
  server.didOpen({
    textDocument: { uri, languageId: "pert", version: 1, text },
  });
  return { server, initialized };
}

function dependencyOrder(cases) {
  const accepted = new Set();
  for (const item of cases) {
    assert.equal(item.depends_on.every((id) => accepted.has(id)), true, item.id);
    accepted.add(item.id);
  }
  return [...accepted];
}

test("DAG presentation cases select one bounded engine and default", async () => {
  const [fixture, manifest, rootManifest, provider, webview, stylesheet, notices] =
    await Promise.all([
      repositoryText("test/fixtures/dag-presentation-cases-v1.json").then(JSON.parse),
      repositoryText("adapters/vscode/package.json").then(JSON.parse),
      repositoryText("package.json").then(JSON.parse),
      repositoryText("adapters/vscode/src/dag-view.ts"),
      repositoryText("adapters/vscode/src/webview.ts"),
      repositoryText("adapters/vscode/webview/dag.css"),
      repositoryText("adapters/vscode/THIRD_PARTY_NOTICES.md"),
    ]);
  assert.equal(fixture.schema_version, "Perttool.DagPresentationCases.v1");
  assert.deepEqual(dependencyOrder(fixture.cases),
    Array.from({ length: 12 }, (_, index) =>
      `DGP-${String(index + 1).padStart(3, "0")}`));
  assert.deepEqual(fixture.default_history, {
    requested_endpoint: "HEAD",
    lower_boundary: null,
    ancestry_profile: "first_parent",
    view: "lineage",
    snapshot_commit_id: null,
    analysis_mode: "both",
  });
  assert.equal(manifest.devDependencies["@dagrejs/dagre"], "3.1.0");
  assert.equal(manifest.files.includes("THIRD_PARTY_NOTICES.md"), true);
  assert.match(notices, /Copyright \(c\) 2012-2014 Chris Pettitt/u);
  assert.equal(rootManifest.dependencies, undefined);
  assert.match(provider, /<details id="historical-controls" hidden>/u);
  assert.match(provider, /Advanced history query/u);
  assert.match(provider, /analysisMode: "both"/u);
  assert.doesNotMatch(provider, /mode\.value = "none"/u);
  assert.match(webview, /from "@dagrejs\/dagre"/u);
  assert.match(webview, /rankdir: "LR"/u);
  assert.match(webview, /fitGraph/u);
  assert.match(webview, /startableTaskIds/u);
  assert.doesNotMatch(
    webview,
    /selectNextTasks|analyzePrecedence|buildResidualGraph|calculatePert/u,
  );
  assert.match(stylesheet, /#graph-viewport[\s\S]*overflow: auto/u);
  assert.match(stylesheet, /\.edge\.next/u);
  assert.match(stylesheet, /\.milestone\.current/u);

  const graph = new Graph({ directed: true, multigraph: true });
  graph.setGraph({ rankdir: "LR" });
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setNode("NOW", { width: 144, height: 58 });
  graph.setNode("DONE", { width: 144, height: 58 });
  graph.setEdge("NOW", "DONE", { width: 92, height: 38 }, "WORK");
  layout(graph);
  assert.ok(graph.node("NOW").x < graph.node("DONE").x);
  assert.ok(graph.edge({ v: "NOW", w: "DONE", name: "WORK" }).points.length >= 2);
});

test("Application focus reuses exact NextResult v6 authority", async () => {
  const source = await repositoryText("docs/examples/minimal.pert");
  const result = inspectEditorDagFocus(source, digestText(source));
  assert.equal(result.status, "current");
  assert.equal(result.reason, null);
  assert.deepEqual(result.focus.frontierMilestoneIds, ["NOW"]);
  assert.deepEqual(result.focus.activeTaskIds, []);
  assert.deepEqual(result.focus.readyTaskIds, ["WORK"]);
  assert.deepEqual(result.focus.recommendedTaskIds, ["WORK"]);
  assert.deepEqual(result.focus.startableTaskIds, ["WORK"]);
  assert.deepEqual(result.focus.safeStopReasons, []);
  assert.deepEqual(result.focus.entities, [
    { kind: "milestone", id: "NOW", compactId: "M01", title: "Now", description: null },
    { kind: "milestone", id: "DONE", compactId: "M02", title: "Done", description: null },
    { kind: "task", id: "WORK", compactId: "T01", title: "Do work", description: null },
  ]);
  assert.deepEqual(result.focus.timeSummary, {
    residualTime: { numerator: "1", denominator: "1", unit: "day", display: "1" },
    remainingTime: { numerator: "1", denominator: "1", unit: "day", display: "1" },
    taskTimes: [{
      taskId: "WORK",
      taskTime: { numerator: "1", denominator: "1", unit: "day", display: "1" },
      pointForecast: null,
    }],
    pointConversion: {
      status: "not_applicable",
      targetUnit: null,
      residualTime: null,
      remainingTime: null,
      reason: null,
    },
  });

  const completed = await repositoryText("plans/historical-dag.pert");
  const completedFocus = inspectEditorDagFocus(
    completed,
    digestText(completed),
  ).focus;
  assert.deepEqual(completedFocus.frontierMilestoneIds, ["HISTORICAL_DAG_ACCEPTED"]);
  assert.deepEqual(completedFocus.startableTaskIds, []);
  assert.deepEqual(completedFocus.entities, [{
    kind: "milestone",
    id: "HISTORICAL_DAG_ACCEPTED",
    compactId: "M01",
    title: "Historical DAG reconstruction accepted",
    description: null,
  }]);
  assert.equal(completedFocus.timeSummary.residualTime.display, "0");
  assert.equal(completedFocus.timeSummary.remainingTime.display, "0");
  assert.equal(completedFocus.timeSummary.pointConversion.status, "available");
});

test("negotiated DAG focus is closed and bound to the open document", async () => {
  const source = await repositoryText("docs/examples/minimal.pert");
  const { server, initialized } = focusServer(source);
  assert.equal(server.dagFocusProtocolNegotiated, true);
  assert.equal(
    initialized.capabilities.experimental.perttool.dagFocusProtocolModelVersion,
    1,
  );
  assert.equal(
    initialized.capabilities.experimental.perttool.dagFocusResultSchemaVersion,
    "Perttool.DagFocusResult.v1",
  );
  const result = await server.dagFocus({
    textDocument: { uri },
    documentVersion: 1,
  });
  assert.equal(result.schemaVersion, "Perttool.DagFocusResult.v1");
  assert.equal(result.complete, true);
  assert.deepEqual(result.focus.startableTaskIds, ["WORK"]);
  const bindings = await import(
    `${pathToFileURL(path.join(root, "adapters/vscode/dist/bindings.mjs")).href}?focus`
  );
  assert.deepEqual(bindings.parseDagFocusResult(result), result);
  assert.equal(bindings.parseDagFocusResult({ ...result, extra: true }), null);
  await assert.rejects(
    server.dagFocus({ textDocument: { uri }, documentVersion: 2 }),
    (error) => error.code === -32801,
  );
});

test("DAG focus fails closed without exact negotiation or valid source", async () => {
  const source = await repositoryText("docs/examples/minimal.pert");
  const absent = focusServer(source, false).server;
  assert.equal(absent.dagFocusProtocolNegotiated, false);
  await assert.rejects(
    absent.dagFocus({ textDocument: { uri }, documentVersion: 1 }),
    (error) => error.code === -32601,
  );

  const invalid = focusServer("not a PERT document\n").server;
  const result = await invalid.dagFocus({
    textDocument: { uri },
    documentVersion: 1,
  });
  assert.equal(result.status, "invalid");
  assert.equal(result.complete, false);
  assert.equal(result.focus, null);

  const malformed = createPerttoolLanguageServer({
    digestText,
    publishDiagnostics: () => undefined,
    dagFocusApplication: { inspect: () => null },
  });
  malformed.initialize({
    processId: null,
    rootUri: null,
    capabilities: { general: { positionEncodings: ["utf-16"] } },
    initializationOptions: {
      perttool: {
        editorProtocolModelVersions: [1],
        graphViewResultSchemaVersions: ["Perttool.GraphViewResult.v1"],
        editorHelpResultSchemaVersions: ["Perttool.EditorHelpResult.v1"],
        dagFocusProtocolModelVersions: [1],
        dagFocusResultSchemaVersions: ["Perttool.DagFocusResult.v1"],
      },
    },
  });
  malformed.didOpen({
    textDocument: { uri, languageId: "pert", version: 1, text: source },
  });
  const malformedResult = await malformed.dagFocus({
    textDocument: { uri },
    documentVersion: 1,
  });
  assert.equal(malformedResult.status, "unavailable");
  assert.equal(malformedResult.complete, false);
  assert.equal(malformedResult.focus, null);
});

test("DAG presentation acceptance is traced across normative documents", async () => {
  const [specification, acceptance, requirements, design, backlog] =
    await Promise.all([
      repositoryText("docs/specs/dag-presentation.md"),
      repositoryText("docs/process/dag-presentation-acceptance.md"),
      repositoryText("docs/requirements.md"),
      repositoryText("docs/basic-design.md"),
      repositoryText("docs/backlog.md"),
    ]);
  assert.match(specification, /Document status: Accepted 1\.0/u);
  assert.deepEqual(
    [...specification.matchAll(/\| `(DGP-\d{3})` \|/gu)].map((match) => match[1]),
    Array.from({ length: 12 }, (_, index) =>
      `DGP-${String(index + 1).padStart(3, "0")}`),
  );
  assert.match(acceptance, /gate passes 967 tests/u);
  assert.match(acceptance, /Root and Node\s+remain 122-name facades/u);
  assert.match(requirements, /DAG Presentation and Focus Contract/u);
  assert.match(design, /private `perttool\/dagFocus` projection/u);
  assert.match(backlog, /separately selected `DAG-UX-001` improvement/u);
});
