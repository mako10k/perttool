import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createPerttoolLanguageServer } from "../adapters/lsp/dist/index.js";
import { createPerttoolMcpAdapter } from "../adapters/mcp/dist/index.js";
import * as core from "../dist/core/index.js";
import * as packageRoot from "../dist/index.js";
import * as nodeApi from "../dist/node/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const cli = path.join(root, "dist", "cli.js");
const envelopeKeys = new Set([
  "schema_version",
  "cli_contract_version",
  "recommendation_interface_version",
  "tool_version",
  "operation",
  "source",
  "source_digest",
]);

function repositoryText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function digestText(text) {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

function runCli(args, input) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
    input,
    env: { ...process.env, NO_COLOR: "1" },
  });
}

function cliPayload(wire) {
  return Object.fromEntries(
    Object.entries(wire).filter(([key]) => !envelopeKeys.has(key)),
  );
}

function createLanguageServer(publishedDiagnostics = []) {
  const server = createPerttoolLanguageServer({
    digestText,
    publishDiagnostics: (params) => publishedDiagnostics.push(params),
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
  return server;
}

function open(server, uri, text) {
  server.didOpen({
    textDocument: { uri, languageId: "pert", version: 1, text },
  });
}

function expectedIds(prefix, count) {
  return Array.from(
    { length: count },
    (_, index) => `${prefix}-${String(index + 1).padStart(3, "0")}`,
  );
}

async function sourceTreeText(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const parts = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) parts.push(await sourceTreeText(target));
    if (entry.isFile() && entry.name.endsWith(".ts")) parts.push(await readFile(target, "utf8"));
  }
  return parts.join("\n");
}

test("integration cases are complete and dependency ordered", async () => {
  const fixture = JSON.parse(
    await repositoryText("test/fixtures/adapter-integration-acceptance-cases-v1.json"),
  );
  assert.equal(
    fixture.schema_version,
    "Perttool.AdapterIntegrationAcceptanceCases.v1",
  );
  assert.deepEqual(fixture.runtime_matrix, [22, 24]);
  assert.deepEqual(fixture.baseline, {
    root_runtime_exports: 122,
    core_runtime_exports: 45,
    commands: 44,
    root_schemas: 20,
    root_production_dependencies: 0,
    lsp_package_files: 25,
    vsix_package_files: 14,
    mcp_resources: 4,
    mcp_tools: 5,
    self_use_plans: 34,
  });
  const accepted = new Set();
  for (const acceptanceCase of fixture.cases) {
    assert.equal(
      acceptanceCase.depends_on.every((id) => accepted.has(id)),
      true,
      acceptanceCase.id,
    );
    accepted.add(acceptanceCase.id);
  }
  assert.deepEqual([...accepted], expectedIds("AIA", 16));
});

test("package and dependency boundaries remain isolated and compatible", async () => {
  const [manifestText, lspManifestText, vscodeManifestText, mcpManifestText] =
    await Promise.all([
      repositoryText("package.json"),
      repositoryText("adapters/lsp/package.json"),
      repositoryText("adapters/vscode/package.json"),
      repositoryText("adapters/mcp/package.json"),
    ]);
  const manifest = JSON.parse(manifestText);
  const lsp = JSON.parse(lspManifestText);
  const vscode = JSON.parse(vscodeManifestText);
  const mcp = JSON.parse(mcpManifestText);
  assert.equal(manifest.version, "0.10.4");
  assert.deepEqual(manifest.files, ["dist", "schemas", "CHANGELOG.md"]);
  assert.deepEqual(manifest.dependencies ?? {}, {});
  assert.deepEqual(manifest.workspaces, ["adapters/*"]);
  assert.equal(lsp.private, true);
  assert.deepEqual(lsp.dependencies, { "vscode-languageserver": "9.0.1" });
  assert.equal(lsp.peerDependencies.perttool, "0.10.4");
  assert.equal(vscode.private, true);
  assert.deepEqual(vscode.dependencies ?? {}, {});
  assert.equal(vscode.devDependencies["vscode-languageclient"], "9.0.1");
  assert.equal(vscode.devDependencies["@vscode/test-electron"], "3.1.0");
  assert.equal(mcp.private, true);
  assert.deepEqual(mcp.dependencies, { "@modelcontextprotocol/server": "2.0.0" });
  assert.equal(mcp.peerDependencies.perttool, "0.10.4");

  assert.equal(Object.keys(packageRoot).length, 129);
  assert.equal(Object.keys(nodeApi).length, 129);
  assert.equal(Object.keys(core).length, 45);
  assert.equal(packageRoot.COMMAND_REGISTRY.length, 56);
  assert.equal(packageRoot.getJsonSchemaCatalog().length, 23);
  assert.deepEqual(Object.keys(packageRoot), Object.keys(nodeApi));
  for (const name of Object.keys(packageRoot)) {
    assert.equal(packageRoot[name], nodeApi[name], name);
  }

  const [rootSources, lspSources, vscodeSources, mcpSources] = await Promise.all([
    sourceTreeText(path.join(root, "src")),
    sourceTreeText(path.join(root, "adapters/lsp/src")),
    sourceTreeText(path.join(root, "adapters/vscode/src")),
    sourceTreeText(path.join(root, "adapters/mcp/src")),
  ]);
  assert.equal(
    /from ["'](?:@modelcontextprotocol\/|vscode(?:-languageclient|-languageserver)?(?:\/|["']))/u
      .test(rootSources),
    false,
  );
  assert.equal(/@modelcontextprotocol|adapters\/mcp|adapters\/vscode|dist\/cli/u.test(lspSources), false);
  assert.equal(/@modelcontextprotocol|perttool\/(?:core|node)|analyzeDocument|selectNextTasks/u.test(vscodeSources), false);
  assert.equal(/vscode-language|adapters\/(?:lsp|vscode)|dist\/cli|node:child_process/u.test(mcpSources), false);
});

test("Contract 9 CLI and read-only adapters preserve the shared Application boundary", async () => {
  const source = await repositoryText("docs/examples/minimal.pert");
  const sourceDigest = digestText(source);
  const adapter = createPerttoolMcpAdapter();
  const cases = [
    { tool: "perttool_check", cli: ["document", "check"], currentSchema: "Perttool.CheckResult.v6" },
    { tool: "perttool_analyze", cli: ["dag", "analyze"], currentSchema: "Perttool.AnalysisResult.v7" },
    { tool: "perttool_next", cli: ["dag", "next"], currentSchema: "Perttool.NextResult.v8" },
  ];
  const mcpResults = new Map();
  for (const acceptanceCase of cases) {
    const first = runCli([...acceptanceCase.cli, "docs/examples/minimal.pert", "--format=json"]);
    const second = runCli([...acceptanceCase.cli, "docs/examples/minimal.pert", "--format=json"]);
    assert.equal(first.status, 0, first.stderr);
    assert.equal(first.stdout, second.stdout, acceptanceCase.tool);
    const cliWire = JSON.parse(first.stdout);
    const mcpResult = await adapter.executeTool(acceptanceCase.tool, {
      source: { kind: "inline", text: source },
    });
    assert.equal(mcpResult.isError, false, acceptanceCase.tool);
    assert.equal(cliWire.schema_version, acceptanceCase.currentSchema);
    assert.equal(mcpResult.structuredContent.result_schema_version, acceptanceCase.currentSchema);
    assert.equal(cliWire.source_digest, sourceDigest);
    assert.equal(mcpResult.structuredContent.source.source_digest, sourceDigest);
    assert.deepEqual(
      mcpResult.structuredContent.result,
      cliPayload(cliWire),
      acceptanceCase.tool,
    );
    mcpResults.set(acceptanceCase.tool, mcpResult.structuredContent.result);
  }

  const check = nodeApi.checkDocument(source);
  const analyze = nodeApi.analyzeDocument(source);
  const next = nodeApi.selectNextTasks(source, { sourceDigest });
  const checkWire = mcpResults.get("perttool_check");
  const analyzeWire = mcpResults.get("perttool_analyze");
  const nextWire = mcpResults.get("perttool_next");
  assert.equal(check.documentId, checkWire.document_id);
  assert.equal(check.grammarVersion, checkWire.grammar_version);
  assert.deepEqual(check.summary, checkWire.summary);
  assert.equal(analyze.documentId, analyzeWire.document_id);
  assert.equal(analyze.precedence.makespan.numerator.toString(), analyzeWire.precedence.makespan.numerator);
  assert.equal(analyze.precedence.makespan.denominator.toString(), analyzeWire.precedence.makespan.denominator);
  assert.equal(analyze.resource.makespan.numerator.toString(), analyzeWire.resource.makespan.numerator);
  assert.deepEqual(next.groups.active, nextWire.groups.active);
  assert.deepEqual(next.groups.ready, nextWire.groups.ready);
  assert.deepEqual(next.groups.runnableNow, nextWire.groups.runnable_now);
  assert.deepEqual(next.recommendation.recommendedTaskIds, nextWire.recommendation.recommended_task_ids);
  assert.deepEqual(
    next.temporal.authority.startableRecommendedTaskIds,
    nextWire.temporal.authority.startable_recommended_task_ids,
  );
});

test("LSP GraphView and VSIX binding preserve the shared analysis projection", async () => {
  const source = await repositoryText("docs/examples/minimal.pert");
  const uri = "untitled:adapter-integration";
  const adapter = createPerttoolMcpAdapter();
  const analyze = (await adapter.executeTool("perttool_analyze", {
    source: { kind: "inline", text: source },
  })).structuredContent.result;
  const server = createLanguageServer();
  open(server, uri, source);
  const graphView = await server.graphView({
    textDocument: { uri },
    documentVersion: 1,
    analysisMode: "both",
  });
  const bindings = await import(
    `${pathToFileURL(path.join(root, "adapters/vscode/dist/bindings.mjs")).href}?integration`
  );
  assert.deepEqual(bindings.parseGraphViewResult(graphView), graphView);
  assert.equal(graphView.document.sourceDigest, digestText(source));
  assert.equal(graphView.graph.projectId, analyze.document_id);
  assert.deepEqual(graphView.graph.precedence.makespan, analyze.precedence.makespan);
  assert.deepEqual(
    graphView.graph.precedence.criticalMilestoneIds,
    analyze.precedence.critical.milestone_ids,
  );
  assert.deepEqual(
    graphView.graph.precedence.criticalTaskIds,
    analyze.precedence.critical.task_ids,
  );
  assert.deepEqual(
    graphView.graph.precedence.representativePathEdgeIds,
    analyze.precedence.critical.representative_path.edge_ids,
  );
  assert.deepEqual(graphView.graph.resource.makespan, analyze.resource.makespan);
  assert.deepEqual(graphView.graph.resource.resourceDelay, analyze.resource.resource_delay);
  assert.deepEqual(
    graphView.graph.resource.scheduleCriticalTaskIds,
    analyze.resource.schedule_critical.task_ids,
  );
  for (const milestone of graphView.graph.milestones) {
    const wire = analyze.precedence.milestones.find(({ id }) => id === milestone.id);
    assert.ok(wire, milestone.id);
    assert.deepEqual(milestone.precedence.earliest, wire.earliest);
    assert.deepEqual(milestone.precedence.latest, wire.latest);
    assert.deepEqual(milestone.precedence.slack, wire.slack);
  }
  for (const edge of graphView.graph.edges) {
    const precedence = analyze.precedence.edges.find(({ id }) => id === edge.id);
    const resource = analyze.resource.tasks.find(({ id }) => id === edge.id);
    assert.ok(precedence, edge.id);
    assert.equal(edge.kind, precedence.kind);
    assert.equal(edge.sourceMilestoneId, precedence.source);
    assert.equal(edge.targetMilestoneId, precedence.target);
    assert.equal(edge.status, precedence.status);
    assert.deepEqual(edge.expected, precedence.expected);
    assert.deepEqual(edge.precedence.earliestStart, precedence.es);
    assert.deepEqual(edge.precedence.earliestFinish, precedence.ef);
    assert.deepEqual(edge.precedence.latestStart, precedence.ls);
    assert.deepEqual(edge.precedence.latestFinish, precedence.lf);
    assert.deepEqual(edge.precedence.totalFloat, precedence.total_float);
    assert.deepEqual(edge.precedence.freeFloat, precedence.free_float);
    if (edge.kind === "task") {
      assert.ok(resource, edge.id);
      assert.deepEqual(edge.resource.scheduledStart, resource.start);
      assert.deepEqual(edge.resource.scheduledFinish, resource.finish);
      assert.deepEqual(edge.resource.resourceDelay, resource.resource_wait);
    }
  }
});

test("invalid source retains one diagnostic owner and fails closed in every adapter", async () => {
  const source = "not a PERT document\n";
  const direct = packageRoot.checkDocument(source);
  const cliResult = runCli(["document", "check", "-", "--format=json"], source);
  assert.equal(cliResult.status, 1, cliResult.stderr);
  const cliWire = JSON.parse(cliResult.stdout);
  const mcp = await createPerttoolMcpAdapter().executeTool("perttool_check", {
    source: { kind: "inline", text: source },
  });
  const published = [];
  const server = createLanguageServer(published);
  open(server, "untitled:adapter-invalid", source);
  const graph = await server.graphView({
    textDocument: { uri: "untitled:adapter-invalid" },
    documentVersion: 1,
    analysisMode: "both",
  });
  assert.equal(direct.ok, false);
  assert.equal(mcp.isError, true);
  assert.deepEqual(mcp.structuredContent.result.diagnostics, cliWire.diagnostics);
  assert.deepEqual(
    direct.diagnostics.map(({ code, severity }) => ({ code, severity })),
    cliWire.diagnostics.map(({ code, severity }) => ({ code, severity })),
  );
  assert.deepEqual(
    published.at(-1).diagnostics.map(({ code, range }) => ({ code, range })),
    cliWire.diagnostics.map(({ code, span }) => ({
      code,
      range: {
        start: { line: span.start.line - 1, character: span.start.column - 1 },
        end: { line: span.end.line - 1, character: span.end.column - 1 },
      },
    })),
  );
  assert.equal(graph.status, "invalid");
  assert.equal(graph.complete, false);
  assert.equal(graph.graph, null);
});

test("cross-adapter reads preserve exact source bytes and directory inventory", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "perttool-adapter-integration-"));
  try {
    const source = await repositoryText("docs/examples/minimal.pert");
    const sourcePath = path.join(temporary, "plan.pert");
    await writeFile(sourcePath, source, "utf8");
    const sourceDigest = digestText(source);
    const entriesBefore = await readdir(temporary);
    for (const args of [
      ["document", "check"],
      ["dag", "analyze"],
      ["dag", "next"],
    ]) {
      const result = runCli([...args, sourcePath, "--format=json"]);
      assert.equal(result.status, 0, result.stderr);
    }
    const adapter = createPerttoolMcpAdapter({
      registrations: [{ documentId: "acceptance-plan", path: sourcePath }],
    });
    const mcp = await adapter.executeTool("perttool_check", {
      source: {
        kind: "registered",
        documentId: "acceptance-plan",
        expectedDigest: sourceDigest,
      },
    });
    assert.equal(mcp.isError, false);
    const server = createLanguageServer();
    const uri = pathToFileURL(sourcePath).href;
    open(server, uri, source);
    const graph = await server.graphView({
      textDocument: { uri },
      documentVersion: 1,
      analysisMode: "both",
    });
    assert.equal(graph.status, "current");
    assert.equal(digestText(await readFile(sourcePath, "utf8")), sourceDigest);
    assert.deepEqual(await readdir(temporary), entriesBefore);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("integration acceptance and completed lifecycle remain aligned", async () => {
  const [
    acceptance,
    handoff,
    specification,
    requirements,
    design,
    backlog,
    development,
    agentGuidance,
    copilotGuidance,
    plan,
  ] = await Promise.all([
    repositoryText("docs/process/adapter-integration-acceptance.md"),
    repositoryText("docs/process/adapter-integration-wip.md"),
    repositoryText("docs/specs/adapter-platform.md"),
    repositoryText("docs/requirements.md"),
    repositoryText("docs/basic-design.md"),
    repositoryText("docs/backlog.md"),
    repositoryText("docs/process/ai-development.md"),
    repositoryText("AGENTS.md"),
    repositoryText(".github/copilot-instructions.md"),
    repositoryText("plans/adapter-platform.pert"),
  ]);
  assert.match(acceptance, /Document status: Accepted 1\.0/u);
  assert.match(acceptance, /Task: `ADAPTER_INTEGRATION_ACCEPTANCE`/u);
  assert.match(
    acceptance,
    /WE-824f41f4d363765d848e70b1f70f747a0d82b6a198bdd370161c3a0f892b477a/u,
  );
  assert.match(acceptance, /sha256:8aaeedea6ceb2e300947392cc551e9d6459ee5c66f5a10f8486a336696a31baa/u);
  assert.match(handoff, /Document status: Superseded 1/u);
  assert.match(specification, /### 3\.12 Accepted integrated state/u);
  for (const document of [
    requirements,
    design,
    backlog,
    development,
    agentGuidance,
    copilotGuidance,
  ]) {
    assert.match(
      document,
      /All sixteen tasks\s+and 91p\s+(?:are|remain) complete/u,
    );
  }
  assert.match(plan, /task ADAPTER_INTEGRATION_ACCEPTANCE[\s\S]*?status done/u);
  assert.match(
    plan,
    /work_event WE-824f41f4d363765d848e70b1f70f747a0d82b6a198bdd370161c3a0f892b477a:/u,
  );
});
