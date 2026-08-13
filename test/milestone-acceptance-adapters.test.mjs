import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  createPerttoolLanguageServer,
  PerttoolProtocolError,
} from "../adapters/lsp/dist/index.js";
import { createPerttoolMcpAdapter } from "../adapters/mcp/dist/index.js";
import {
  inspectEditorMilestoneAcceptance,
  prepareEditorMilestoneAcceptanceDocument,
} from "../dist/application/editor-milestone-acceptance.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const uri = "untitled:milestone-acceptance-adapter";

function repositoryText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function digestText(text) {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

function application() {
  return {
    inspect: inspectEditorMilestoneAcceptance,
    prepareDocument: prepareEditorMilestoneAcceptanceDocument,
  };
}

function createServer(negotiated = true) {
  const published = [];
  const server = createPerttoolLanguageServer({
    digestText,
    publishDiagnostics: (value) => published.push(value),
    milestoneAcceptanceApplication: application(),
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
        ...(negotiated ? {
          milestoneAcceptanceEditorProtocolModelVersions: [1],
          milestoneAcceptanceViewResultSchemaVersions: [
            "Perttool.MilestoneAcceptanceViewResult.v1",
          ],
        } : {}),
      },
    },
  });
  return { server, initialized, published };
}

function open(server, text, version = 1) {
  server.didOpen({
    textDocument: { uri, languageId: "pert", version, text },
  });
}

test("milestone acceptance adapter cases are complete and dependency ordered", async () => {
  const fixture = JSON.parse(
    await repositoryText("test/fixtures/milestone-acceptance-adapter-v1.json"),
  );
  assert.equal(fixture.schema_version, "Perttool.MilestoneAcceptanceAdapterCases.v1");
  const accepted = new Set();
  for (const item of fixture.cases) {
    assert.equal(item.depends_on.every((id) => accepted.has(id)), true, item.id);
    accepted.add(item.id);
  }
  assert.deepEqual([...accepted], Array.from(
    { length: 10 },
    (_, index) => `MAA-${String(index + 1).padStart(3, "0")}`,
  ));
});

test("Grammar 7 LSP projection preserves binding, semantics, and source ranges", async () => {
  const source = await repositoryText("plans/milestone-acceptance.pert");
  const { server, initialized, published } = createServer();
  assert.equal(server.milestoneAcceptanceProtocolNegotiated, true);
  assert.equal(
    initialized.capabilities.experimental.perttool
      .milestoneAcceptanceViewResultSchemaVersion,
    "Perttool.MilestoneAcceptanceViewResult.v1",
  );
  open(server, source);
  assert.deepEqual(
    published.at(-1).diagnostics.map(({ code }) => code),
    [
      "PTDAG-208",
      "PTDAG-208",
      "PTDAG-208",
    ],
  );
  const graph = await server.graphView({
    textDocument: { uri },
    documentVersion: 1,
    analysisMode: "both",
  });
  const result = await server.milestoneAcceptanceView({
    textDocument: { uri },
    documentVersion: 1,
  });
  assert.equal(graph.status, "current");
  assert.equal(result.status, "current");
  assert.equal(result.document.sourceDigest, digestText(source));
  assert.deepEqual(
    result.acceptance.milestones.map(({ milestoneId, closure, acceptance }) =>
      [milestoneId, closure, acceptance]
    ),
    [
      ["MILESTONE_ACCEPTANCE_PUBLIC_READY", "reached", "accepted"],
      ["MILESTONE_ACCEPTANCE_HISTORY_READY", "reached", "accepted"],
      ["MILESTONE_ACCEPTANCE_ADAPTER_READY", "reached", "accepted"],
      ["MILESTONE_ACCEPTANCE_INTEGRATED", "reached", "accepted"],
      ["MILESTONE_ACCEPTANCE_ACCEPTED", "reached", "accepted"],
    ],
  );
  const bindings = new Map(
    result.acceptance.sourceBindings.map((item) => [item.bindingId, item]),
  );
  for (const binding of bindings.values()) {
    const startLine = source.split("\n")[binding.range.start.line];
    assert.notEqual(startLine, undefined, binding.bindingId);
  }
  assert.ok(bindings.has("milestone:MILESTONE_ACCEPTANCE_PUBLIC_READY"));
  assert.ok(bindings.has("milestone_criterion_set:MAC_PUBLIC_R1"));
  assert.ok(bindings.has("criterion:MAC_PUBLIC_R1:ACCEPTED"));
  assert.ok(bindings.has("milestone_acceptance_receipt:MAC_PUBLIC_ACCEPTED"));
  assert.ok(bindings.has("milestone_acceptance_receipt:MAC_ADAPTER_ACCEPTED"));
  assert.ok(bindings.has("milestone_acceptance_receipt:MAC_INTEGRATED_ACCEPTED"));
  assert.ok(bindings.has("milestone_acceptance_receipt:MAC_FINAL_ACCEPTED"));
  assert.equal(result.acceptance.migration, null);
});

test("older Grammar remains explicitly not applicable and negotiation fails closed", async () => {
  const source = await repositoryText("docs/examples/minimal.pert");
  const selected = createServer();
  open(selected.server, source);
  const result = await selected.server.milestoneAcceptanceView({
    textDocument: { uri },
    documentVersion: 1,
  });
  assert.equal(result.acceptance.availability, "not_applicable");
  assert.ok(result.acceptance.milestones.every(({ acceptance }) =>
    acceptance === "not_applicable"
  ));

  const rejected = createServer(false);
  open(rejected.server, source);
  await assert.rejects(
    rejected.server.milestoneAcceptanceView({
      textDocument: { uri },
      documentVersion: 1,
    }),
    (error) => error instanceof PerttoolProtocolError && error.code === -32601,
  );
});

test("MCP retains Contract 8 acceptance under unchanged wire identities", async () => {
  const source = await repositoryText("plans/milestone-acceptance.pert");
  const adapter = createPerttoolMcpAdapter();
  const cases = [
    ["perttool_check", "Perttool.McpCheckResult.v1", "Perttool.CheckResult.v5"],
    ["perttool_analyze", "Perttool.McpAnalyzeResult.v1", "Perttool.AnalysisResult.v6"],
    ["perttool_next", "Perttool.McpNextResult.v1", "Perttool.NextResult.v7"],
  ];
  for (const [name, wire, applicationIdentity] of cases) {
    const result = await adapter.executeTool(name, {
      source: { kind: "inline", text: source },
    });
    assert.equal(result.isError, false, name);
    assert.equal(result.structuredContent.schema_version, wire);
    assert.equal(result.structuredContent.result_schema_version, applicationIdentity);
    assert.equal(result.structuredContent.result.acceptance.model_version, 1);
    assert.deepEqual(
      result.structuredContent.result.acceptance.milestones.slice(0, 2)
        .map(({ acceptance }) => acceptance),
      ["accepted", "accepted"],
    );
  }
});

test("VSIX validates and presents read-only milestone acceptance", async () => {
  const source = await repositoryText("plans/milestone-acceptance.pert");
  const { server } = createServer();
  open(server, source);
  const result = await server.milestoneAcceptanceView({
    textDocument: { uri },
    documentVersion: 1,
  });
  const bindings = await import(
    `${pathToFileURL(path.join(root, "adapters/vscode/dist/bindings.mjs")).href}?acceptance`
  );
  assert.deepEqual(bindings.parseMilestoneAcceptanceViewResult(result), result);
  assert.equal(
    bindings.findMilestoneAcceptanceSourceRange(
      result,
      "milestone_acceptance_receipt:MAC_PUBLIC_ACCEPTED",
    ).start.line,
    139,
  );
  const [dagView, webview] = await Promise.all([
    repositoryText("adapters/vscode/src/dag-view.ts"),
    repositoryText("adapters/vscode/src/webview.ts"),
  ]);
  assert.match(dagView, /perttool\/milestoneAcceptanceView/u);
  assert.match(dagView, /Milestone outcome acceptance/u);
  assert.match(webview, /Blocking required criteria/u);
  assert.match(webview, /revealAcceptanceSource/u);
  assert.doesNotMatch(`${dagView}\n${webview}`, /milestone acceptance (?:verify|waive|replace)/iu);
});
