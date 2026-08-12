import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  agentGuidanceResultToJson,
  getAgentHelp,
  getBundledAgentGuidance,
  getCommandDiscovery,
  renderCommandHelpResult,
  renderAgentGuidanceText,
  serializeAgentGuidanceResult,
} from "../dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const cli = path.join(root, "dist/cli.js");
const golden = (name) =>
  path.join(testDirectory, "golden/agent-guidance", name);

function run(args, options = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
    ...options,
  });
}

test("agent help command help comes from structured registry data", () => {
  const result = getCommandDiscovery({
    resource: "agent",
    action: "help",
  });
  const definition = result.commands[0];
  assert.ok(definition);
  assert.equal(definition.operation, "agent.help");
  assert.equal(
    definition.summary,
    "Displays read-only AI agent guidance for each provider from bundled offline profiles.",
  );
  assert.match(definition.summary, /offline profile/);

  const top = run(["--help"]);
  assert.equal(top.status, 0, top.stderr);
  assert.match(top.stdout, /^    help  Displays read-only AI agent guidance/m);
  const command = run(["agent", "help", "--help"]);
  assert.equal(command.status, 0, command.stderr);
  assert.equal(command.stdout, renderCommandHelpResult(result));
});

test("agent help index text is deterministic and matches the public renderer", async () => {
  const expected = await readFile(golden("index.expected.txt"), "utf8");
  const direct = renderAgentGuidanceText(getBundledAgentGuidance());
  assert.equal(direct, expected);
  const first = run(["agent", "help"]);
  const second = run(["agent", "help", "--level=index"]);
  assert.equal(first.status, 0, first.stderr);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(first.stderr, "");
  assert.equal(first.stdout, expected);
  assert.equal(second.stdout, expected);
});

test("agent help quick text preserves status, reasons, staleness, and read-only capability", async () => {
  const expected = await readFile(
    golden("github-copilot-prompt-quick.expected.txt"),
    "utf8",
  );
  const result = run(["agent", "help", "github-copilot", "prompt"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.equal(result.stdout, expected);
  assert.doesNotMatch(result.stdout, /^DESCRIPTION /m);
  assert.doesNotMatch(result.stdout, /^SOURCE /m);
});

test("agent help JSON adds the Contract 8 envelope to the Core projection", () => {
  const query = {
    providerId: "grok",
    surfaceId: "workflow",
    level: "quick",
  };
  const coreResult = getAgentHelp(query);
  const expected = serializeAgentGuidanceResult(coreResult);
  assert.equal(
    expected,
    serializeAgentGuidanceResult(getBundledAgentGuidance(query)),
  );
  const first = run([
    "agent", "help", "grok", "workflow", "--format=json",
  ]);
  const second = run([
    "agent", "help", "grok", "workflow", "--format", "json",
  ]);
  assert.equal(first.status, 0, first.stderr);
  assert.equal(first.stderr, "");
  assert.equal(first.stdout, second.stdout);
  const json = JSON.parse(first.stdout);
  assert.equal(json.cli_contract_version, 8);
  const { cli_contract_version: _contract, ...cliProjection } = json;
  assert.deepEqual(cliProjection, agentGuidanceResultToJson(coreResult));
  assert.deepEqual(json.query, {
    input_provider_id: "grok",
    canonical_provider_id: "grok-build",
    surface_id: "workflow",
    level: "quick",
    alias_applied: true,
  });
});

test("agent help detail exposes canonical descriptions and source detail", () => {
  const result = run([
    "agent",
    "help",
    "codex",
    "enforcement",
    "--level=detail",
    "--format=json",
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  const json = JSON.parse(result.stdout);
  assert.equal(
    json.guidance_records.find(
      ({ guidance_id: id }) => id === "consult_dag_next_before_start",
    ).description.key,
    "guidance.consult_dag_next_before_start",
  );
  assert.ok(
    json.sources.every(
      ({ title, url }) =>
        typeof title === "string" && /^https:\/\//.test(url),
    ),
  );
  assert.deepEqual(json.capabilities, {
    reads_project_files: false,
    writes_files: false,
    executes_hooks: false,
    executes_commands: false,
    accesses_network: false,
    reads_provider_state: false,
    writes_provider_state: false,
  });
});

test("agent help distinguishes domain lookup errors from usage errors", () => {
  const unknownProvider = run([
    "agent", "help", "copilot", "--format=json",
  ]);
  assert.equal(unknownProvider.status, 1, unknownProvider.stderr);
  assert.equal(unknownProvider.stderr, "");
  assert.equal(
    JSON.parse(unknownProvider.stdout).diagnostics[0].code,
    "PTAGT-101",
  );

  const unknownSurface = run([
    "agent", "help", "codex", "policy", "--format=json",
  ]);
  assert.equal(unknownSurface.status, 1, unknownSurface.stderr);
  assert.equal(
    JSON.parse(unknownSurface.stdout).diagnostics[0].code,
    "PTAGT-102",
  );

  for (const args of [
    ["agent", "help", "codex", "enforcement", "extra"],
    ["agent", "help", "--level=exhaustive"],
    ["agent", "help", "codex", "--warnings-as-errors"],
  ]) {
    const usage = run([...args, "--format=json"]);
    assert.equal(usage.status, 2, usage.stderr);
    assert.equal(usage.stderr, "");
    assert.equal(JSON.parse(usage.stdout).diagnostics[0].code, "PTCLI-001");
  }
});

test("agent help does not require or create project/provider state", () => {
  const temporary = mkdtempSync(path.join(tmpdir(), "perttool-agent-help."));
  try {
    const result = run(
      ["agent", "help", "antigravity", "connector", "--format=json"],
      { cwd: temporary, env: {} },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    assert.deepEqual(readdirSync(temporary), []);
    assert.equal(JSON.parse(result.stdout).capabilities.accesses_network, false);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test("Contract 8 guide index is byte-stable", () => {
  const result = run(["guide", "--format=json"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  const json = JSON.parse(result.stdout);
  assert.equal(json.cli_contract_version, 8);
  assert.equal(json.topics.length, 12);
  assert.equal(json.topics.at(-1).id, "milestone-acceptance");
  assert.equal(run(["guide", "--format=json"]).stdout, result.stdout);
});
