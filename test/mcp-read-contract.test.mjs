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
    await repositoryText("test/fixtures/mcp-read-contract-cases-v1.json"),
  );
}

test("MCP contract selects one modern local stdio baseline", async () => {
  const cases = await fixture();
  assert.equal(cases.schema_version, "Perttool.McpReadContractCases.v1");
  assert.equal(cases.mcp_protocol_model_version, 1);
  assert.deepEqual(cases.protocol, {
    revision: "2026-07-28",
    sdk_package: "@modelcontextprotocol/server",
    sdk_version: "2.0.0",
    transport: "stdio",
    node_engine: ">=22",
    workspace: "adapters/mcp",
    private_package: "perttool-mcp-private",
    protocol_fallback: false,
    network_listener: false,
    child_cli: false,
  });
  assert.deepEqual(cases.capabilities.advertised, ["resources", "tools"]);
  assert.equal(cases.capabilities.resource_templates, false);
  assert.equal(cases.capabilities.resource_subscriptions, false);
  assert.equal(cases.capabilities.resource_list_changed, false);
  assert.equal(cases.capabilities.tool_list_changed, false);
});

test("MCP resources and tools are exact, closed, and read only", async () => {
  const cases = await fixture();
  assert.deepEqual(cases.resources.map(({ uri }) => uri), [
    "perttool://capabilities",
    "perttool://help/commands",
    "perttool://guide/index",
    "perttool://schemas",
  ]);
  assert.deepEqual(cases.tools.map(({ name }) => name), [
    "perttool_check",
    "perttool_analyze",
    "perttool_next",
    "perttool_help",
    "perttool_schema",
  ]);
  assert.deepEqual(cases.tool_annotations, {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  });
  assert.deepEqual(cases.tools.map(({ application_result_schema }) => application_result_schema), [
    "Perttool.CheckResult.v4",
    "Perttool.AnalysisResult.v5",
    "Perttool.NextResult.v6",
    "Perttool.CommandHelpResult.v1|Perttool.GuideResult.v1",
    "Perttool.SchemaResult.v1",
  ]);
  assert.equal(new Set(cases.tools.map(({ operation }) => operation)).size, 5);
  assert.ok(cases.forbidden_operations.includes("advance"));
  assert.ok(cases.forbidden_operations.includes("persist"));
});

test("MCP source selectors exclude caller paths and require registered digest binding", async () => {
  const cases = await fixture();
  assert.deepEqual(cases.source_selectors.inline.required, ["kind", "text"]);
  assert.deepEqual(cases.source_selectors.registered.required, [
    "kind",
    "document_id",
    "expected_digest",
  ]);
  assert.equal(cases.source_selectors.registered.launcher_only, true);
  assert.equal(cases.source_selectors.registered.absolute_path_returned, false);
  assert.deepEqual(cases.source_selectors.forbidden, [
    "path",
    "file_uri",
    "cwd",
    "glob",
    "workspace_root",
    "git_repository",
    "git_ref",
    "commit",
    "remote_url",
    "wire_registration",
  ]);
});

test("MCP limits and failure ownership fail closed without partial semantics", async () => {
  const cases = await fixture();
  assert.deepEqual(cases.limits, {
    request_bytes: 262144,
    source_bytes: 2097152,
    output_bytes: 8388608,
    registrations: 64,
    capacity_overrides: 256,
    concurrent_tools: 8,
    wall_time_ms: 30000,
    diagnostics_default: 100,
    diagnostics_maximum: 1000,
    max_paths_maximum: 1000,
    explain_depth_maximum: 32,
    precision_maximum: 9,
  });
  assert.deepEqual(cases.error_mapping.source_diagnostics, [
    "PTMCP-101",
    "PTMCP-102",
    "PTMCP-103",
    "PTMCP-104",
    "PTMCP-105",
    "PTMCP-106",
    "PTMCP-107",
    "PTMCP-108",
  ]);
  assert.equal(cases.error_mapping.domain_failure_is_tool_error, true);
  assert.equal(cases.error_mapping.partial_semantic_result, false);
});

test("MCP normative cases are dependency ordered and trace the accepted task", async () => {
  const [cases, contract, requirements, design, backlog, parent, plan] = await Promise.all([
    fixture(),
    repositoryText("docs/specs/mcp-read-contract.md"),
    repositoryText("docs/requirements.md"),
    repositoryText("docs/basic-design.md"),
    repositoryText("docs/backlog.md"),
    repositoryText("docs/specs/adapter-platform.md"),
    repositoryText("plans/adapter-platform.pert"),
  ]);
  const ids = cases.cases.map(({ id }) => id);
  assert.deepEqual(ids, expectedIds("MCR", 16));
  assert.deepEqual(tableIds(contract, "MCR"), ids);
  const indexById = new Map(ids.map((id, index) => [id, index]));
  for (const entry of cases.cases) {
    for (const dependency of entry.depends_on) {
      assert.ok(indexById.get(dependency) < indexById.get(entry.id));
    }
  }
  for (const text of [requirements, design, backlog, parent]) {
    assert.match(text, /mcp-read-contract\.md/);
  }
  const checked = checkDocument(plan, { maxDiagnostics: 1000 });
  assert.equal(checked.ok, true);
  assert.equal(
    checked.diagnostics.some(({ severity }) => severity === "error"),
    false,
  );
  assert.match(plan, /task MCP_READ_CONTRACT[\s\S]*status done/);
  assert.match(plan, /gate MCP_CONTRACT_INPUT MCP_CONTRACT_READY -> MCP_IMPLEMENTATION_INPUT/);
  assert.match(plan, /gate MCP_NODE_INPUT NODE_PORTS_READY -> MCP_IMPLEMENTATION_INPUT/);
});

test("MCP contract changes no runtime or public package surface", async () => {
  const [packageJson, contract] = await Promise.all([
    repositoryText("package.json").then(JSON.parse),
    repositoryText("docs/specs/mcp-read-contract.md"),
  ]);
  assert.equal(packageJson.dependencies, undefined);
  assert.equal(packageJson.name, "perttool");
  assert.deepEqual(Object.keys(packageJson.exports), [
    ".",
    "./core",
    "./node",
    "./schemas/*",
  ]);
  assert.match(contract, /does not implement or distribute the server/i);
  assert.match(contract, /release work remain separate decisions/i);
});
