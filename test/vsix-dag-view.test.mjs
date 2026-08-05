import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createPerttoolLanguageServer } from "../adapters/lsp/dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const uri = "untitled:perttool-vsix-dag";

function repositoryText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function digestText(text) {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

function serverFor(text) {
  const server = createPerttoolLanguageServer({
    digestText,
    publishDiagnostics: () => undefined,
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
      },
    },
  });
  server.didOpen({
    textDocument: { uri, languageId: "pert", version: 1, text },
  });
  return server;
}

async function bindings() {
  return import(
    `${pathToFileURL(path.join(root, "adapters/vscode/dist/bindings.mjs")).href}?dag`
  );
}

test("DAG view manifest is lazy, private, and closed to the accepted view", async () => {
  const manifest = JSON.parse(await repositoryText("adapters/vscode/package.json"));
  assert.equal(manifest.private, true);
  assert.deepEqual(manifest.activationEvents, [
    "onLanguage:pert",
    "onCommand:perttool.openHelp",
    "onCommand:perttool.showDag",
    "onView:perttool.dag",
  ]);
  assert.deepEqual(
    manifest.contributes.commands.map(({ command }) => command),
    ["perttool.openHelp", "perttool.showDag"],
  );
  assert.deepEqual(manifest.contributes.views, {
    explorer: [{
      id: "perttool.dag",
      name: "perttool DAG",
      type: "webview",
      when: "resourceLangId == pert",
    }],
  });
  assert.equal(manifest.engines.vscode, "^1.101.0");
  assert.deepEqual(manifest.extensionKind, ["workspace"]);
});

test("closed GraphView parser accepts every exact LSP mode", async () => {
  const source = await repositoryText("docs/examples/minimal.pert");
  const server = serverFor(source);
  const api = await bindings();
  for (const analysisMode of ["none", "precedence", "resource", "both"]) {
    const result = await server.graphView({
      textDocument: { uri },
      documentVersion: 1,
      analysisMode,
    });
    assert.deepEqual(api.parseGraphViewResult(result), result, analysisMode);
  }
});

test("GraphView parser rejects open fields, bad bindings, and mixed modes", async () => {
  const source = await repositoryText("docs/examples/minimal.pert");
  const server = serverFor(source);
  const api = await bindings();
  const none = await server.graphView({
    textDocument: { uri }, documentVersion: 1, analysisMode: "none",
  });
  const both = await server.graphView({
    textDocument: { uri }, documentVersion: 1, analysisMode: "both",
  });
  assert.equal(api.parseGraphViewResult({ ...none, extra: true }), null);
  assert.equal(api.parseGraphViewResult({
    ...none,
    document: { ...none.document, sourceDigest: "sha256:bad" },
  }), null);
  assert.equal(api.parseGraphViewResult({ ...none, complete: false, graph: null }), null);
  assert.equal(api.parseGraphViewResult({
    ...none,
    graph: { ...none.graph, precedence: both.graph.precedence },
  }), null);
  const gate = {
    ...both.graph.edges[0],
    kind: "gate",
    status: "planned",
  };
  assert.equal(api.parseGraphViewResult({
    ...both,
    graph: { ...both.graph, edges: [gate] },
  }), null);
});

test("invalid current source remains diagnostic-only and parser closed", async () => {
  const server = serverFor("not a PERT document\n");
  const api = await bindings();
  const result = await server.graphView({
    textDocument: { uri }, documentVersion: 1, analysisMode: "both",
  });
  assert.equal(result.status, "invalid");
  assert.equal(result.complete, false);
  assert.equal(result.graph, null);
  assert.ok(result.diagnostics.items.length > 0);
  assert.deepEqual(api.parseGraphViewResult(result), result);
});

test("Webview messages and source navigation are exact and binding scoped", async () => {
  const source = await repositoryText("docs/examples/minimal.pert");
  const server = serverFor(source);
  const api = await bindings();
  const result = api.parseGraphViewResult(await server.graphView({
    textDocument: { uri }, documentVersion: 1, analysisMode: "both",
  }));
  assert.ok(result);
  const ready = { kind: "ready", editorProtocolModelVersion: 1 };
  assert.deepEqual(api.parseWebviewMessage(ready), ready);
  const select = {
    kind: "selectAnalysisMode",
    documentUri: uri,
    documentGeneration: result.document.generation,
    documentVersion: 1,
    analysisMode: "resource",
  };
  assert.deepEqual(api.parseWebviewMessage(select), select);
  const reveal = {
    kind: "revealSource",
    documentUri: uri,
    documentGeneration: result.document.generation,
    documentVersion: 1,
    entityKind: "task",
    entityId: "WORK",
  };
  assert.deepEqual(api.parseWebviewMessage(reveal), reveal);
  assert.equal(api.parseWebviewMessage({ ...reveal, range: {} }), null);
  assert.equal(api.parseWebviewMessage({ ...select, analysisMode: "critical" }), null);
  assert.deepEqual(
    api.findGraphEntityRange(result, "task", "WORK"),
    result.graph.edges[0].selectionRange,
  );
  assert.equal(api.findGraphEntityRange(result, "gate", "WORK"), null);
  assert.equal(api.findGraphEntityRange(result, "task", "UNKNOWN"), null);
});

test("Webview assets retain restrictive CSP, escaped content, and accessibility", async () => {
  const [provider, webview, stylesheet, build] = await Promise.all([
    repositoryText("adapters/vscode/src/dag-view.ts"),
    repositoryText("adapters/vscode/src/webview.ts"),
    repositoryText("adapters/vscode/webview/dag.css"),
    repositoryText("adapters/vscode/scripts/build.mjs"),
  ]);
  assert.match(provider, /default-src 'none'/u);
  assert.match(provider, /script-src 'nonce-\$\{token\}'/u);
  assert.match(provider, /localResourceRoots: \[assetRoot\]/u);
  assert.equal(/unsafe-inline|unsafe-eval|https?:\/\//u.test(provider), false);
  assert.match(webview, /textContent =/u);
  assert.match(webview, /replaceChildren/u);
  assert.equal(/innerHTML|insertAdjacentHTML|eval\(|new Function|fetch\(/u.test(webview), false);
  assert.equal(/mermaid|calculatePert|criticalPath|topological/u.test(webview), false);
  assert.match(provider, /aria-live="polite"/u);
  assert.match(provider, /Accessible DAG outline/u);
  assert.match(stylesheet, /focus-visible/u);
  assert.match(stylesheet, /prefers-reduced-motion/u);
  assert.match(stylesheet, /--vscode-focusBorder/u);
  assert.match(build, /platform: "browser"/u);
  assert.match(build, /dist\/webview\/dag\.js/u);
});

test("extension presentation stays read-only and clears stale results", async () => {
  const [extension, provider, webview] = await Promise.all([
    repositoryText("adapters/vscode/src/extension.ts"),
    repositoryText("adapters/vscode/src/dag-view.ts"),
    repositoryText("adapters/vscode/src/webview.ts"),
  ]);
  assert.match(extension, /registerWebviewViewProvider/u);
  assert.match(extension, /perttool\.showDag/u);
  assert.match(provider, /perttool\/graphView/u);
  assert.match(provider, /this\.#result = null/u);
  assert.match(provider, /The DAG result became stale before presentation/u);
  assert.match(provider, /findGraphEntityRange/u);
  assert.match(webview, /analysisMode: mode\.value/u);
  for (const source of [extension, provider, webview]) {
    assert.equal(
      /node:fs|node:net|node:http|node:https|node:child_process|writeFile|workspace\.fs|executeTask/u
        .test(source),
      false,
    );
  }
});

test("DAG implementation cases are complete and dependency ordered", async () => {
  const fixture = JSON.parse(
    await repositoryText("test/fixtures/vsix-dag-view-cases-v1.json"),
  );
  assert.equal(fixture.schema_version, "Perttool.VsixDagViewCases.v1");
  assert.deepEqual(fixture.analysis_modes, ["none", "precedence", "resource", "both"]);
  const accepted = new Set();
  for (const acceptanceCase of fixture.cases) {
    assert.equal(
      acceptanceCase.depends_on.every((id) => accepted.has(id)),
      true,
      acceptanceCase.id,
    );
    accepted.add(acceptanceCase.id);
  }
  assert.deepEqual(
    [...accepted],
    Array.from(
      { length: 12 },
      (_, index) => `VDV-${String(index + 1).padStart(3, "0")}`,
    ),
  );
});

test("DAG implementation acceptance and completed lifecycle remain aligned", async () => {
  const [acceptance, plan] = await Promise.all([
    repositoryText("docs/process/adapter-vsix-dag-view-acceptance.md"),
    repositoryText("plans/adapter-platform.pert"),
  ]);
  assert.match(acceptance, /Document status: Accepted 1\.0/u);
  assert.match(acceptance, /Task: `VSIX_DAG_VIEW`/u);
  assert.match(
    acceptance,
    /WE-330a1dfb80ee57a9ebdc9fafbc1702827eeebdc7f9b3b31bc806c4de872c20fd/u,
  );
  assert.match(plan, /task VSIX_DAG_VIEW [\s\S]*?status done/u);
  assert.match(
    plan,
    /work_event WE-330a1dfb80ee57a9ebdc9fafbc1702827eeebdc7f9b3b31bc806c4de872c20fd:/u,
  );
});
