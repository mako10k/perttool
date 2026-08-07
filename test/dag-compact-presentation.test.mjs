import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createPerttoolLanguageServer } from "../adapters/lsp/dist/index.js";
import { inspectEditorDagFocus } from "../dist/application/editor-dag-focus.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const uri = "untitled:perttool-compact-dag";

function repositoryText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function digestText(text) {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

function dependencyOrder(cases) {
  const accepted = new Set();
  for (const item of cases) {
    assert.equal(item.depends_on.every((id) => accepted.has(id)), true, item.id);
    accepted.add(item.id);
  }
  return [...accepted];
}

test("compact presentation cases and selected contract are closed", async () => {
  const [fixture, contract, backlog, requirements] = await Promise.all([
    repositoryText("test/fixtures/dag-compact-presentation-cases-v1.json")
      .then(JSON.parse),
    repositoryText("docs/specs/dag-compact-presentation.md"),
    repositoryText("docs/backlog.md"),
    repositoryText("docs/requirements.md"),
  ]);
  assert.equal(
    fixture.schema_version,
    "Perttool.DagCompactPresentationCases.v1",
  );
  assert.deepEqual(
    dependencyOrder(fixture.cases),
    Array.from({ length: 10 }, (_, index) =>
      `DCP-${String(index + 1).padStart(3, "0")}`),
  );
  assert.match(contract, /Document status: Accepted 1\.0/u);
  assert.match(contract, /`residualTime` is the precedence CPM makespan/u);
  assert.match(contract, /`remainingTime` is the `parallel-sgs` version 1/u);
  assert.match(
    backlog,
    /Status: Accepted local implementation and separately authorized local\s+installation \(2026-08-07\)/u,
  );
  assert.match(requirements, /deterministic compact `Mnn`, `Tnn`, and `Gnn`/u);
});

test("Application projects deterministic compact IDs and distinct exact times", async () => {
  const source = await repositoryText("docs/examples/point-velocity.pert");
  const inspected = inspectEditorDagFocus(source, digestText(source));
  assert.equal(inspected.status, "current");
  assert.deepEqual(
    inspected.focus.entities.map(({ kind, id, compactId }) => ({ kind, id, compactId })),
    [
      { kind: "milestone", id: "NOW", compactId: "M01" },
      { kind: "milestone", id: "DESIGNED", compactId: "M02" },
      { kind: "milestone", id: "IMPLEMENTED", compactId: "M03" },
      { kind: "milestone", id: "RELEASED", compactId: "M04" },
      { kind: "task", id: "DESIGN", compactId: "T01" },
      { kind: "task", id: "IMPLEMENT", compactId: "T02" },
      { kind: "gate", id: "DESIGN_RELEASE", compactId: "G01" },
      { kind: "gate", id: "IMPLEMENT_RELEASE", compactId: "G02" },
    ],
  );
  const time = inspected.focus.timeSummary;
  assert.deepEqual(time.residualTime,
    { numerator: "10", denominator: "1", unit: "point", display: "10" });
  assert.deepEqual(time.remainingTime,
    { numerator: "15", denominator: "1", unit: "point", display: "15" });
  assert.deepEqual(time.pointConversion, {
    status: "available",
    targetUnit: "day",
    residualTime: { numerator: "5", denominator: "1", unit: "day", display: "5" },
    remainingTime: {
      numerator: "15", denominator: "2", unit: "day", display: "7.5",
    },
    reason: null,
  });
  const design = time.taskTimes.find(({ taskId }) => taskId === "DESIGN");
  assert.deepEqual(design, {
    taskId: "DESIGN",
    taskTime: { numerator: "5", denominator: "1", unit: "point", display: "5" },
    pointForecast: {
      numerator: "5", denominator: "2", unit: "day", display: "2.5",
    },
  });

  const minimal = await repositoryText("docs/examples/minimal.pert");
  const described = minimal.replace(
    '  title "Do work"\n  duration 1d',
    '  title "Do work"\n  description "Visible in compact details"\n  duration 1d',
  );
  assert.equal(
    inspectEditorDagFocus(described, digestText(described)).focus.entities
      .find(({ id }) => id === "WORK").description,
    "Visible in compact details",
  );
});

test("closed focus transport rejects duplicate compact identity", async () => {
  const source = await repositoryText("docs/examples/point-velocity.pert");
  const server = createPerttoolLanguageServer({
    digestText,
    publishDiagnostics: () => undefined,
    dagFocusApplication: { inspect: inspectEditorDagFocus },
  });
  server.initialize({
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
    textDocument: { uri, languageId: "pert", version: 1, text: source },
  });
  const result = await server.dagFocus({
    textDocument: { uri }, documentVersion: 1,
  });
  const bindings = await import(
    `${pathToFileURL(path.join(root, "adapters/vscode/dist/bindings.mjs")).href}?compact`
  );
  assert.deepEqual(bindings.parseDagFocusResult(result), result);
  assert.deepEqual(
    [...bindings.allocateHistoricalCompactIds([
      { entity_kind: "task", occurrence_id: "HDGE-z", source_id: "SAME" },
      { entity_kind: "milestone", occurrence_id: "HDGE-m", source_id: "NOW" },
      { entity_kind: "task", occurrence_id: "HDGE-a", source_id: "SAME" },
    ])],
    [["HDGE-m", "M01"], ["HDGE-a", "T01"], ["HDGE-z", "T02"]],
  );
  const entities = result.focus.entities.map((entity, index) =>
    index === 1 ? { ...entity, compactId: result.focus.entities[0].compactId } : entity
  );
  assert.equal(bindings.parseDagFocusResult({
    ...result,
    focus: { ...result.focus, entities },
  }), null);

  const malformed = createPerttoolLanguageServer({
    digestText,
    publishDiagnostics: () => undefined,
    dagFocusApplication: {
      inspect: (text, digest) => {
        const inspected = inspectEditorDagFocus(text, digest);
        return {
          ...inspected,
          focus: {
            ...inspected.focus,
            timeSummary: {
              ...inspected.focus.timeSummary,
              taskTimes: inspected.focus.timeSummary.taskTimes.map((task, index) =>
                index === 0 ? { ...task, pointForecast: null } : task
              ),
            },
          },
        };
      },
    },
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
  const unavailable = await malformed.dagFocus({
    textDocument: { uri }, documentVersion: 1,
  });
  assert.equal(unavailable.status, "unavailable");
  assert.equal(unavailable.focus, null);
});

test("Webview uses compact graph links and original-identity details", async () => {
  const [provider, webview, stylesheet] = await Promise.all([
    repositoryText("adapters/vscode/src/dag-view.ts"),
    repositoryText("adapters/vscode/src/webview.ts"),
    repositoryText("adapters/vscode/webview/dag.css"),
  ]);
  assert.match(provider, /Exact time/u);
  assert.match(provider, /Entity details and accessible outline/u);
  assert.match(webview, /allocateHistoricalCompactIds/u);
  assert.match(webview, /makeDetailLink\(group, displayId/u);
  assert.match(webview, /Back to \$\{compact\} in graph/u);
  assert.match(webview, /Title: \$\{title\}/u);
  assert.match(webview, /Description: not declared/u);
  assert.match(webview, /task time unavailable in HistoricalGraphResult\.v1/u);
  assert.match(stylesheet, /\.entity-detail:focus/u);
  assert.doesNotMatch(webview, /convertWithVelocity|formatDecimal|rational\(/u);
});

test("predecessor and compact local installation evidence is exact and bounded", async () => {
  const acceptance = await repositoryText(
    "docs/process/dag-compact-presentation-acceptance.md",
  );
  assert.match(acceptance, /5dff03a7438121a6090ed7610789066c97597618459e3bb9e46d4519d3aaac8e/u);
  assert.match(acceptance, /code --install-extension/u);
  assert.match(acceptance, /perttool-private\.perttool-vscode-private@0\.0\.0/u);
  assert.match(acceptance, /predecessor artifact intentionally did not contain/u);
  assert.match(acceptance, /ac10f4dfe00d1154d282fb737b117a85fcaf7e23b6d2b412e4f7299bd8a812e6/u);
  assert.match(acceptance, /Installed markers include\s+`compactId`, `allocateHistoricalCompactIds`, and `timeSummary`/u);
  assert.match(acceptance, /Release selection, publication, commit, push/u);
});
