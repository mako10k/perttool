import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  COMMAND_REGISTRY,
  checkDocument,
  getJsonSchemaCatalog,
  selectNextTasks,
} from "../dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

function repositoryText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function expectedIds(prefix, count) {
  return Array.from(
    { length: count },
    (_, index) => `${prefix}-${String(index + 1).padStart(3, "0")}`,
  );
}

function tableIds(document, prefix) {
  return [
    ...document.matchAll(
      new RegExp("^\\| `(" + prefix + "-\\d{3})` \\|", "gm"),
    ),
  ].map((match) => match[1]);
}

async function fixture() {
  return JSON.parse(
    await repositoryText(
      "test/fixtures/historical-editor-protocol-cases-v1.json",
    ),
  );
}

test("historical editor identities are additive and keep current GraphView unchanged", async () => {
  const cases = await fixture();
  assert.equal(
    cases.schema_version,
    "Perttool.HistoricalEditorProtocolCases.v1",
  );
  assert.equal(cases.historical_editor_protocol_model_version, 1);
  assert.deepEqual(cases.methods, {
    graph: "perttool/historicalGraphView",
    source: "perttool/historicalSource",
  });
  assert.deepEqual(cases.result_schemas, [
    "Perttool.HistoricalGraphViewResult.v1",
    "Perttool.HistoricalSourceResult.v1",
  ]);
  assert.deepEqual(cases.unchanged_identities, {
    editor_protocol_model_version: 1,
    current_graph_method: "perttool/graphView",
    current_graph_schema: "Perttool.GraphViewResult.v1",
    grammar_version: 6,
    cli_contract_version: 7,
    cli_command_count: 45,
    cli_schema_count: 21,
    root_node_runtime_names: 122,
    core_runtime_names: 45,
  });
  assert.equal(COMMAND_REGISTRY.length, 56);
  assert.equal(getJsonSchemaCatalog().length, 23);
});

test("historical negotiation, trust, and request boundaries are closed", async () => {
  const cases = await fixture();
  assert.deepEqual(cases.negotiation, {
    model_versions: [1],
    graph_result_versions: ["Perttool.HistoricalGraphViewResult.v1"],
    source_result_versions: ["Perttool.HistoricalSourceResult.v1"],
    unknown_method_error_code: -32601,
    invalid_params_error_code: -32602,
  });
  assert.equal(cases.eligibility.workspace_trust, "trusted");
  assert.equal(cases.eligibility.document_scheme, "file");
  assert.equal(cases.eligibility.target_kind, "regular_no_follow_pert_file");
  assert.equal(cases.eligibility.linked_worktrees, true);
  assert.deepEqual(cases.graph_request.fields, [
    "textDocument",
    "documentVersion",
    "requestedEndpoint",
    "lowerBoundary",
    "ancestryProfile",
    "view",
    "snapshotCommitId",
    "analysisMode",
  ]);
  assert.deepEqual(cases.graph_request.defaults, {
    requestedEndpoint: "HEAD",
    lowerBoundary: null,
    ancestryProfile: "first_parent",
    view: "lineage",
    snapshotCommitId: null,
    analysisMode: "none",
  });
  assert.deepEqual(cases.graph_request.views, [
    "snapshot",
    "lineage",
    "timeline",
  ]);
  assert.deepEqual(cases.graph_request.analysis_modes, [
    "none",
    "precedence",
    "resource",
    "both",
  ]);
  assert.equal(cases.graph_request.revision_max_utf16, 1024);
  assert.equal(cases.graph_request.git_shell, false);
  assert.equal(cases.graph_request.git_option_terminator, true);
});

test("graph result preserves shared semantics without carrying CLI or host fields", async () => {
  const cases = await fixture();
  assert.deepEqual(cases.graph_result.fields, [
    "schemaVersion",
    "historicalEditorProtocolModelVersion",
    "historyResultId",
    "document",
    "status",
    "complete",
    "diagnostics",
    "historicalGraph",
  ]);
  assert.deepEqual(cases.graph_result.statuses, [
    "complete",
    "incomplete",
    "unavailable",
  ]);
  assert.deepEqual(cases.graph_result.semantic_payload_fields, [
    "model",
    "model_version",
    "transition_model_version",
    "status",
    "request",
    "evidence",
    "effective_checkpoint_id",
    "selected_snapshot_commit_id",
    "checkpoints",
    "snapshot",
    "lineage",
    "timeline",
    "analysis",
    "source_bindings",
    "causes",
    "limits",
  ]);
  assert.equal(cases.graph_result.excluded_cli_fields.includes("source"), true);
  assert.equal(cases.graph_result.excluded_cli_fields.includes("operation"), true);
  assert.equal(cases.graph_result.stale_error_code, -32801);
  assert.equal(cases.graph_result.cancelled_error_code, -32800);
});

test("historical source navigation verifies retained immutable bindings", async () => {
  const cases = await fixture();
  assert.deepEqual(cases.source_request.fields, [
    "textDocument",
    "documentVersion",
    "historyResultId",
    "bindingId",
  ]);
  assert.equal(
    cases.source_request.result_schema,
    "Perttool.HistoricalSourceResult.v1",
  );
  assert.equal(cases.source_request.uri_scheme, "perttool-history");
  assert.equal(cases.source_request.provider, "read_only_content");
  assert.equal(cases.source_request.caller_supplied_path, false);
  assert.equal(cases.source_request.caller_supplied_range, false);
  assert.deepEqual(cases.diagnostics, [
    "PTHED-101",
    "PTHED-102",
    "PTHED-103",
    "PTHED-104",
    "PTHED-105",
  ]);
});

test("hard limits, Webview input, and side effects remain bounded", async () => {
  const cases = await fixture();
  assert.deepEqual(cases.limits, {
    inspected_commits: 2048,
    raw_bytes_per_snapshot: 8388608,
    aggregate_raw_snapshot_bytes: 134217728,
    entity_value_epochs: 100000,
    transition_records: 2047,
    rendered_graph_occurrences: 20000,
    historical_source_bindings: 100000,
    retained_results_per_connection: 32,
    loaded_virtual_documents_per_connection: 32,
  });
  assert.deepEqual(cases.webview.messages, [
    "requestHistoricalGraph",
    "revealHistoricalSource",
  ]);
  assert.equal(cases.webview.receives_raw_source, false);
  assert.equal(cases.webview.receives_repository_id, false);
  assert.equal(cases.webview.receives_workspace_path, false);
  assert.equal(cases.webview.arbitrary_mermaid, false);
  assert.equal(cases.webview.accessible_text_outline, true);
  assert.deepEqual(cases.side_effects, {
    application_composition: "direct",
    cli_subprocess: false,
    git_reads: true,
    git_writes: false,
    editor_writes: false,
    workspace_execution: false,
    network: false,
    telemetry: false,
    persistent_cache: false,
  });
});

test("all eighteen historical editor cases are complete and dependency ordered", async () => {
  const cases = await fixture();
  const accepted = new Set();
  for (const contractCase of cases.cases) {
    assert.equal(
      contractCase.depends_on.every((id) => accepted.has(id)),
      true,
      contractCase.id,
    );
    accepted.add(contractCase.id);
  }
  assert.deepEqual([...accepted], expectedIds("HED", 18));
});

test("historical editor contract remains aligned after the private implementation", async () => {
  const [
    specification,
    requirements,
    design,
    backlog,
    acceptance,
    plan,
    lspProtocol,
    vscodeBindings,
  ] = await Promise.all([
    repositoryText("docs/specs/historical-editor-protocol.md"),
    repositoryText("docs/requirements.md"),
    repositoryText("docs/basic-design.md"),
    repositoryText("docs/backlog.md"),
    repositoryText("docs/process/historical-editor-contract-acceptance.md"),
    repositoryText("plans/historical-dag.pert"),
    repositoryText("adapters/lsp/src/protocol.ts"),
    repositoryText("adapters/vscode/src/bindings.ts"),
  ]);
  const checked = checkDocument(plan);
  const next = selectNextTasks(plan);

  assert.match(specification, /- Document status: Accepted 1\.0/u);
  assert.match(specification, /Historical editor protocol model version: 1/u);
  assert.deepEqual(tableIds(specification, "HED"), expectedIds("HED", 18));
  assert.match(
    requirements,
    /\[Historical Editor Protocol Contract\]\(specs\/historical-editor-protocol\.md\)/u,
  );
  assert.match(design, /`Perttool\.HistoricalGraphViewResult\.v1`/u);
  assert.match(backlog, /historical editor protocol contract is accepted/u);
  assert.match(acceptance, /- Document status: Accepted 1\.0/u);
  assert.match(
    acceptance,
    /completed status-only plan source digest is\s+`sha256:[0-9a-f]{64}`/u,
  );
  assert.equal(checked.ok, true);
  assert.match(
    plan,
    /task HISTORICAL_EDITOR_CONTRACT[\s\S]*?status done/u,
  );
  assert.match(plan, /task HISTORICAL_VSIX[\s\S]*?status done/u);
  assert.match(
    plan,
    /task HISTORICAL_DAG_ACCEPTANCE[\s\S]*?status done/u,
  );
  assert.equal(next.ok, true);
  assert.deepEqual(next.groups.ready, []);
  assert.deepEqual(next.recommendation.recommendedTaskIds, []);
  assert.deepEqual(
    next.temporal.authority.assuranceUnavailableRecommendedTaskIds,
    [],
  );
  assert.deepEqual(next.temporal.authority.startableRecommendedTaskIds, []);
  assert.match(lspProtocol, /HistoricalGraphViewResultV1/u);
  assert.match(vscodeBindings, /HistoricalGraphViewResultV1/u);
});
