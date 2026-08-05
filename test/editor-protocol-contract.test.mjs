import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { checkDocument } from "../dist/index.js";

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
    await repositoryText("test/fixtures/editor-protocol-cases-v1.json"),
  );
}

test("editor protocol fixes stable LSP and Node-backed VS Code runtimes", async () => {
  const cases = await fixture();
  assert.equal(cases.schema_version, "Perttool.EditorProtocolCases.v1");
  assert.equal(cases.editor_protocol_model_version, 1);
  assert.deepEqual(cases.standards, {
    lsp_version: "3.17",
    lsp_3_18_status: "upcoming_not_selected",
    position_encoding: "utf-16",
    transport: "stdio",
    node_engine: ">=22",
    vscode_engine: "^1.101.0",
    extension_kind: ["workspace"],
    browser_entry: false,
  });
  assert.equal(cases.custom_handshake.optional_for_standard_lsp, true);
  assert.deepEqual(cases.custom_handshake.required_for, [
    "perttool/help",
    "perttool/graphView",
    "vscode_dag_view",
  ]);
  assert.deepEqual(cases.custom_handshake.editor_protocol_model_versions, [1]);
  assert.equal(cases.custom_handshake.unknown_method_error_code, -32601);
  assert.deepEqual(cases.document_sync, {
    identity: ["uri", "generation", "version", "source_digest"],
    version_rule: "strictly_increasing_integer",
    change_mode: "incremental_utf16_atomic",
    invalid_change_recovery: "terminate_connection_reconnect_and_did_open",
  });
});

test("read-only LSP capabilities map once to shared operations", async () => {
  const cases = await fixture();
  assert.deepEqual(
    cases.server_capabilities.map(({ id, protocol, mutability }) => ({
      id,
      protocol,
      mutability,
    })),
    [
      { id: "diagnostics", protocol: "textDocument/publishDiagnostics", mutability: "read_only" },
      { id: "document_symbols", protocol: "textDocument/documentSymbol", mutability: "read_only" },
      { id: "hover", protocol: "textDocument/hover", mutability: "read_only" },
      { id: "completion", protocol: "textDocument/completion", mutability: "user_insert_only" },
      { id: "definition", protocol: "textDocument/definition", mutability: "read_only" },
      { id: "help_code_action", protocol: "textDocument/codeAction", mutability: "read_only" },
      { id: "help", protocol: "perttool/help", mutability: "read_only" },
      { id: "graph_view", protocol: "perttool/graphView", mutability: "read_only" },
    ],
  );
  assert.equal(
    new Set(cases.server_capabilities.map(({ operation }) => operation)).size,
    cases.server_capabilities.length,
  );
  assert.deepEqual(cases.forbidden_capabilities, [
    "textDocument/rename",
    "textDocument/formatting",
    "textDocument/rangeFormatting",
    "textDocument/onTypeFormatting",
    "workspace/executeCommand",
    "workspace/willCreateFiles",
    "workspace/willRenameFiles",
    "workspace/willDeleteFiles",
  ]);
  assert.deepEqual(cases.help, {
    request_method: "perttool/help",
    schema_version: "Perttool.EditorHelpResult.v1",
    command_argument_fields: [
      "documentUri",
      "documentGeneration",
      "documentVersion",
      "topicId",
    ],
    result_fields: [
      "schemaVersion",
      "editorProtocolModelVersion",
      "status",
      "topicId",
      "level",
      "content",
      "relatedTopicIds",
    ],
    levels: ["quick", "detail"],
    statuses: ["ok", "not_found"],
    content_owner: "shared_help_registry",
    remote_content: false,
    command_links: false,
  });
});

test("GraphViewResult v1 is version bound and fail closed", async () => {
  const cases = await fixture();
  assert.deepEqual(cases.graph_view.analysis_modes, [
    "none",
    "precedence",
    "resource",
    "both",
  ]);
  assert.deepEqual(cases.graph_view.statuses, [
    "current",
    "invalid",
    "unavailable",
  ]);
  assert.equal(cases.graph_view.request_method, "perttool/graphView");
  assert.equal(
    cases.graph_view.schema_version,
    "Perttool.GraphViewResult.v1",
  );
  assert.deepEqual(cases.graph_view.result_fields, [
    "schemaVersion",
    "editorProtocolModelVersion",
    "document",
    "analysisMode",
    "status",
    "complete",
    "diagnostics",
    "graph",
  ]);
  assert.deepEqual(cases.graph_view.graph_fields, [
    "projectId",
    "finishMilestoneId",
    "milestones",
    "edges",
    "precedence",
    "resource",
  ]);
  assert.deepEqual(cases.graph_view.edge_fields, [
    "id",
    "kind",
    "sourceMilestoneId",
    "targetMilestoneId",
    "label",
    "status",
    "declarationRange",
    "selectionRange",
    "expected",
    "precedence",
    "resource",
  ]);
  assert.equal(cases.graph_view.cancelled_error_code, -32800);
  assert.equal(cases.graph_view.stale_error_code, -32801);
  assert.equal(cases.graph_view.current_requires_graph, true);
  assert.equal(cases.graph_view.non_current_graph, null);
  assert.equal(cases.graph_view.arbitrary_mermaid, false);
});

test("VSIX and Webview boundaries are offline, closed, and accessible", async () => {
  const cases = await fixture();
  assert.deepEqual(cases.vsix.activation, [
    "onLanguage:pert",
    "onCommand:perttool.showDag",
    "onView:perttool.dag",
  ]);
  assert.equal(cases.vsix.workspace_trust, "supported");
  assert.equal(cases.vsix.virtual_workspaces, "supported");
  assert.equal(cases.vsix.browser_only, "unsupported");
  assert.equal(cases.vsix.network_download, false);
  assert.equal(cases.vsix.workspace_executable, false);
  assert.equal(cases.vsix.telemetry, false);
  assert.equal(cases.webview.default_src, "none");
  assert.equal(cases.webview.script_policy, "nonce_only");
  assert.equal(cases.webview.unsafe_inline, false);
  assert.equal(cases.webview.unsafe_eval, false);
  assert.equal(cases.webview.remote_origins, false);
  assert.equal(cases.webview.workspace_resource_roots, false);
  assert.deepEqual(cases.webview.messages, [
    "ready",
    "selectAnalysisMode",
    "revealSource",
  ]);
  assert.deepEqual(cases.webview.message_fields, {
    ready: ["kind", "editorProtocolModelVersion"],
    selectAnalysisMode: [
      "kind",
      "documentUri",
      "documentGeneration",
      "documentVersion",
      "analysisMode",
    ],
    revealSource: [
      "kind",
      "documentUri",
      "documentGeneration",
      "documentVersion",
      "entityKind",
      "entityId",
    ],
  });
  assert.equal(cases.webview.accessible_text_outline, true);
});

test("all sixteen editor cases are complete and dependency ordered", async () => {
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
  assert.deepEqual([...accepted], expectedIds("EDP", 16));
});

test("editor contract aligns requirements, design, backlog, acceptance, and completed task", async () => {
  const [specification, requirements, design, backlog, acceptance, plan] = await Promise.all([
    repositoryText("docs/specs/editor-protocol.md"),
    repositoryText("docs/requirements.md"),
    repositoryText("docs/basic-design.md"),
    repositoryText("docs/backlog.md"),
    repositoryText("docs/process/adapter-editor-protocol-acceptance.md"),
    repositoryText("plans/adapter-platform.pert"),
  ]);
  assert.match(specification, /- Document status: Accepted 1\.0/);
  assert.match(specification, /Editor protocol model version: 1/);
  assert.deepEqual(tableIds(specification, "EDP"), expectedIds("EDP", 16));
  assert.match(requirements, /\[Editor Protocol Contract\]\(specs\/editor-protocol\.md\)/);
  assert.match(design, /`Perttool\.GraphViewResult\.v1`/);
  assert.match(backlog, /editor protocol contract accepted/);
  assert.match(acceptance, /- Document status: Accepted 1\.0/);
  assert.match(
    acceptance,
    /sha256:f5966e1af251ddb8873fb3ce05536ce829493533f49f7789540ae011fdc6f6f1/,
  );

  const checked = checkDocument(plan);
  const task = checked.document.declarations.find(
    ({ kind, id }) => kind === "task" && id === "EDITOR_PROTOCOL_CONTRACT",
  );
  assert.equal(checked.ok, true);
  assert.equal(task?.fields.find(({ name }) => name === "status")?.value, "done");
});
